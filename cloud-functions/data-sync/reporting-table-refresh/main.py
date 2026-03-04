"""
Reporting Table Refresh - Syncs reporting tables from master view

Updates:
1. reporting.daily_metrics from marketing_ai.v_master_daily_metrics
2. reporting.weekly_metrics from daily_metrics aggregations
3. reporting.monthly_metrics from daily_metrics aggregations

Ensures dashboard displays latest data across all time granularities.
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"


@functions_framework.http
def refresh_reporting_tables(request):
    """Refresh reporting tables from master view and rollup aggregations"""
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True) or {}
    days_back = request_json.get('daysBack', 7)
    
    logger.info(f"🔄 Starting reporting table refresh (last {days_back} days)...")
    
    try:
        bq = bigquery.Client()
        results = {}
        
        # 1. Update daily_metrics from master view (DELETE + INSERT for simplicity)
        logger.info("📅 Refreshing daily_metrics...")
        
        # Delete existing rows for the date range
        delete_query = f"""
        DELETE FROM `{PROJECT_ID}.reporting.daily_metrics`
        WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)
        """
        
        delete_job = bq.query(delete_query)
        delete_job.result()
        deleted_rows = delete_job.num_dml_affected_rows or 0
        logger.info(f"🗑️ Deleted {deleted_rows} existing rows")
        
        # Insert fresh data from master view with calculated metrics
        insert_query = f"""
        INSERT INTO `{PROJECT_ID}.reporting.daily_metrics`
SELECT
          v.date as date,
          v.talent_signups as talent_signups,
          v.company_signups as company_signups,
          v.talent_signups + v.company_signups as total_signups,
          v.jobs_posted as jobs_posted,
          v.applications as applications,
          SAFE_DIVIDE(v.applications, v.jobs_posted) as apps_per_job,
          v.hires as hires,
          SAFE_DIVIDE(v.hires, v.jobs_posted) * 100 as match_rate_pct,
          SAFE_DIVIDE(v.hires, v.applications) * 100 as app_to_hire_pct,
          v.ytjobs_revenue as revenue,
          SAFE_DIVIDE(v.ytjobs_revenue, NULLIF(v.talent_signups, 0)) as revenue_per_talent_signup,
          SAFE_DIVIDE(v.ytjobs_revenue, NULLIF(v.hires, 0)) as revenue_per_hire,
          v.job_views as job_views,
          v.profile_views as profile_views,
          v.reviews as reviews,
          
          -- Calculate purchases from charge data
          COALESCE((
            SELECT COUNT(DISTINCT canonical_entity_id)
            FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
            WHERE organization_id = 'ytjobs'
              AND entity_type = 'charge'
              AND date = v.date
              AND conversions > 0
          ), 0) as purchases,
          
          COALESCE((
            SELECT COUNT(DISTINCT canonical_entity_id)
            FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
            WHERE organization_id = 'ytjobs'
              AND entity_type = 'charge'
              AND date = v.date
              AND (conversions = 0 OR conversions IS NULL)
              AND revenue > 0
          ), 0) as failed_transactions,
          
          COALESCE((
            SELECT COUNT(DISTINCT JSON_EXTRACT_SCALAR(source_breakdown, '$.stripe_customer_id'))
            FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
            WHERE organization_id = 'ytjobs'
              AND entity_type = 'payment_session'
              AND date = v.date
              AND conversions > 0
              AND JSON_EXTRACT_SCALAR(source_breakdown, '$.payment_status') = 'paid'
              AND JSON_EXTRACT_SCALAR(source_breakdown, '$.stripe_customer_id') IS NOT NULL
          ), 0) as purchasing_customers,
          
          v.stripe_revenue as stripe_revenue,
          
          -- Calculate purchases per customer
          SAFE_DIVIDE(
            COALESCE((
              SELECT COUNT(DISTINCT canonical_entity_id)
              FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
              WHERE organization_id = 'ytjobs'
                AND entity_type = 'charge'
                AND date = v.date
                AND conversions > 0
            ), 0),
            NULLIF(COALESCE((
              SELECT COUNT(DISTINCT JSON_EXTRACT_SCALAR(source_breakdown, '$.stripe_customer_id'))
              FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
              WHERE organization_id = 'ytjobs'
                AND entity_type = 'payment_session'
                AND date = v.date
                AND conversions > 0
                AND JSON_EXTRACT_SCALAR(source_breakdown, '$.payment_status') = 'paid'
                AND JSON_EXTRACT_SCALAR(source_breakdown, '$.stripe_customer_id') IS NOT NULL
            ), 0), 0)
          ) as purchases_per_customer_daily,
          
          0 as cumulative_purchases,
          0 as cumulative_company_signups,
          0.0 as company_purchase_conversion_pct,
          0.0 as avg_purchases_per_company,
          0.0 as mrr,
          0.0 as arr,
          0 as active_subscriptions,
          0 as churned_subscriptions,
          0.0 as churn_rate_pct,
          v.website_sessions as sessions,
          0 as engaged_sessions,
          0.0 as engagement_rate_pct,
          v.website_events as total_events,
          SAFE_DIVIDE(v.website_events, NULLIF(v.website_sessions, 0)) as events_per_session,
          0.0 as key_events,
          0.0 as ga4_revenue,
          v.website_visitors as new_users,
          v.organic_sessions as organic_sessions,
          v.paid_search_sessions as paid_search_sessions,
          0 as paid_pmax_sessions,
          v.paid_search_sessions as total_paid_sessions,
          v.direct_sessions as direct_sessions,
          v.referral_sessions as referral_sessions,
          v.social_sessions as social_sessions,
          v.email_sessions as email_traffic_sessions,
          0 as video_sessions,
          0 as organic_engaged_sessions,
          0 as paid_search_engaged_sessions,
          0 as paid_pmax_engaged_sessions,
          0.0 as organic_engagement_rate,
          0.0 as paid_engagement_rate,
          SAFE_DIVIDE(v.organic_sessions, NULLIF(v.total_attributed_signups, 0)) * 100 as organic_pct,
          SAFE_DIVIDE(v.paid_search_sessions, NULLIF(v.total_attributed_signups, 0)) * 100 as paid_pct,
          SAFE_DIVIDE(v.direct_sessions, NULLIF(v.total_attributed_signups, 0)) * 100 as direct_pct,
          SAFE_DIVIDE(v.referral_sessions, NULLIF(v.total_attributed_signups, 0)) * 100 as referral_pct,
          0 as gads_sessions,
          0 as gads_users,
          0 as gads_conversions,
          0.0 as gads_revenue,
          0 as gads_pmax_sessions,
          0 as gads_pmax_conversions,
          0 as gads_search_sessions,
          0 as gads_search_conversions,
          0.0 as talent_signup_rate_pct,
          0.0 as company_signup_rate_pct,
          0.0 as overall_signup_rate_pct,
          0.0 as revenue_per_session,
          0 as marketing_campaigns_launched,
          0 as marketing_sends,
          0 as marketing_opens,
          0 as marketing_clicks,
          0.0 as marketing_avg_open_rate,
          0.0 as marketing_avg_ctr,
          0 as automation_campaigns_launched,
          0 as automation_sends,
          0 as automation_opens,
          0 as automation_clicks,
          0.0 as automation_avg_open_rate,
          0.0 as automation_avg_ctr,
          0 as campaigns_launched,
          0 as campaign_lifetime_sends,
          0 as campaign_lifetime_opens,
          0 as campaign_lifetime_clicks,
          0.0 as campaign_avg_open_rate,
          0.0 as campaign_avg_ctr,
          0.0 as campaign_click_to_open_pct,
          0 as email_contacts_total,
          0 as email_list_subscribers_total,
          0 as email_daily_opens,
          0 as email_daily_unique_openers,
          0 as email_daily_clicks,
          0 as email_daily_unique_clickers,
          0 as talent_signups_dod,
          0 as company_signups_dod,
          0 as applications_dod,
          0.0 as revenue_dod,
          0 as sessions_dod,
          0 as purchases_dod,
          0.0 as stripe_revenue_dod,
          0.0 as talent_signups_7d_avg,
          0.0 as company_signups_7d_avg,
          0.0 as applications_7d_avg,
          0.0 as revenue_7d_avg,
          0.0 as sessions_7d_avg,
          0.0 as purchases_7d_avg,
          0.0 as stripe_revenue_7d_avg,
          0.0 as talent_signups_wow_pct,
          0.0 as revenue_wow_pct,
          0.0 as sessions_wow_pct,
          0.0 as purchases_wow_pct,
          0.0 as stripe_revenue_wow_pct
        FROM `{PROJECT_ID}.marketing_ai.v_master_daily_metrics` v
        WHERE v.date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)
        """
        
        insert_job = bq.query(insert_query)
        insert_job.result()
        inserted_rows = insert_job.num_dml_affected_rows or 0
        results['daily_rows_updated'] = inserted_rows
        logger.info(f"✅ Inserted {inserted_rows} rows into daily_metrics")
        
        # 2. Rebuild weekly_metrics from daily_metrics (DELETE + INSERT for all columns)
        logger.info("📊 Refreshing weekly_metrics...")
        
        # Calculate affected weeks from days_back
        delete_weekly = f"""
        DELETE FROM `{PROJECT_ID}.reporting.weekly_metrics`
        WHERE week_start >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 7} DAY), WEEK(MONDAY))
        """
        
        delete_job = bq.query(delete_weekly)
        delete_job.result()
        deleted_weeks = delete_job.num_dml_affected_rows or 0
        logger.info(f"🗑️ Deleted {deleted_weeks} weeks")
        
        insert_weekly = f"""
        INSERT INTO `{PROJECT_ID}.reporting.weekly_metrics`
        SELECT
          DATE_TRUNC(date, WEEK(MONDAY)) as week_start,
          CAST(EXTRACT(ISOWEEK FROM MIN(date)) AS INT64) as week_num,
          SUM(talent_signups) as talent_signups,
          SUM(company_signups) as company_signups,
          SUM(total_signups) as total_signups,
          SUM(jobs_posted) as jobs_posted,
          SUM(applications) as applications,
          ROUND(AVG(apps_per_job), 2) as apps_per_job,
          SUM(hires) as hires,
          ROUND(AVG(match_rate_pct), 2) as match_rate_pct,
          ROUND(AVG(app_to_hire_pct), 2) as app_to_hire_pct,
          SUM(revenue) as revenue,
          ROUND(AVG(revenue_per_talent_signup), 2) as revenue_per_talent_signup,
          ROUND(AVG(revenue_per_hire), 2) as revenue_per_hire,
          SUM(job_views) as job_views,
          SUM(profile_views) as profile_views,
          SUM(reviews) as reviews,
          SUM(purchases) as purchases,
          SUM(failed_transactions) as failed_transactions,
          SUM(purchasing_customers) as purchasing_customers,
          SUM(stripe_revenue) as stripe_revenue,
          ROUND(AVG(purchases_per_customer_daily), 2) as purchases_per_customer_daily,
          CAST(MAX(cumulative_purchases) AS INT64) as cumulative_purchases,
          CAST(MAX(cumulative_company_signups) AS INT64) as cumulative_company_signups,
          ROUND(AVG(company_purchase_conversion_pct), 2) as company_purchase_conversion_pct,
          ROUND(AVG(avg_purchases_per_company), 2) as avg_purchases_per_company,
          SUM(mrr) as mrr,
          SUM(arr) as arr,
          SUM(active_subscriptions) as active_subscriptions,
          SUM(churned_subscriptions) as churned_subscriptions,
          ROUND(AVG(churn_rate_pct), 2) as churn_rate_pct,
          SUM(sessions) as sessions,
          SUM(engaged_sessions) as engaged_sessions,
          ROUND(AVG(engagement_rate_pct), 2) as engagement_rate_pct,
          SUM(total_events) as total_events,
          ROUND(AVG(events_per_session), 2) as events_per_session,
          SUM(key_events) as key_events,
          SUM(ga4_revenue) as ga4_revenue,
          SUM(new_users) as new_users,
          SUM(organic_sessions) as organic_sessions,
          SUM(paid_search_sessions) as paid_search_sessions,
          SUM(paid_pmax_sessions) as paid_pmax_sessions,
          SUM(total_paid_sessions) as total_paid_sessions,
          SUM(direct_sessions) as direct_sessions,
          SUM(referral_sessions) as referral_sessions,
          SUM(social_sessions) as social_sessions,
          SUM(email_traffic_sessions) as email_traffic_sessions,
          SUM(video_sessions) as video_sessions,
          SUM(organic_engaged_sessions) as organic_engaged_sessions,
          SUM(paid_search_engaged_sessions) as paid_search_engaged_sessions,
          SUM(paid_pmax_engaged_sessions) as paid_pmax_engaged_sessions,
          ROUND(AVG(organic_engagement_rate), 2) as organic_engagement_rate,
          ROUND(AVG(paid_engagement_rate), 2) as paid_engagement_rate,
          ROUND(AVG(organic_pct), 2) as organic_pct,
          ROUND(AVG(paid_pct), 2) as paid_pct,
          ROUND(AVG(direct_pct), 2) as direct_pct,
          ROUND(AVG(referral_pct), 2) as referral_pct,
          SUM(gads_sessions) as gads_sessions,
          SUM(gads_users) as gads_users,
          SUM(gads_conversions) as gads_conversions,
          SUM(gads_revenue) as gads_revenue,
          SUM(gads_pmax_sessions) as gads_pmax_sessions,
          SUM(gads_pmax_conversions) as gads_pmax_conversions,
          SUM(gads_search_sessions) as gads_search_sessions,
          SUM(gads_search_conversions) as gads_search_conversions,
          ROUND(AVG(talent_signup_rate_pct), 2) as talent_signup_rate_pct,
          ROUND(AVG(company_signup_rate_pct), 2) as company_signup_rate_pct,
          ROUND(AVG(overall_signup_rate_pct), 2) as overall_signup_rate_pct,
          ROUND(AVG(revenue_per_session), 2) as revenue_per_session,
          SUM(marketing_campaigns_launched) as marketing_campaigns_launched,
          SUM(marketing_sends) as marketing_sends,
          SUM(marketing_opens) as marketing_opens,
          SUM(marketing_clicks) as marketing_clicks,
          ROUND(AVG(marketing_avg_open_rate), 2) as marketing_avg_open_rate,
          ROUND(AVG(marketing_avg_ctr), 2) as marketing_avg_ctr,
          SUM(automation_campaigns_launched) as automation_campaigns_launched,
          SUM(automation_sends) as automation_sends,
          SUM(automation_opens) as automation_opens,
          SUM(automation_clicks) as automation_clicks,
          ROUND(AVG(automation_avg_open_rate), 2) as automation_avg_open_rate,
          ROUND(AVG(automation_avg_ctr), 2) as automation_avg_ctr,
          SUM(campaigns_launched) as campaigns_launched,
          SUM(campaign_lifetime_sends) as campaign_lifetime_sends,
          SUM(campaign_lifetime_opens) as campaign_lifetime_opens,
          SUM(campaign_lifetime_clicks) as campaign_lifetime_clicks,
          ROUND(AVG(campaign_avg_open_rate), 2) as campaign_avg_open_rate,
          ROUND(AVG(campaign_avg_ctr), 2) as campaign_avg_ctr,
          ROUND(AVG(campaign_click_to_open_pct), 2) as campaign_click_to_open_pct,
          SUM(email_contacts_total) as email_contacts_total,
          SUM(email_list_subscribers_total) as email_list_subscribers_total,
          CAST(ROUND(AVG(email_daily_opens)) AS INT64) as email_daily_opens,
          CAST(ROUND(AVG(email_daily_unique_openers)) AS INT64) as email_daily_unique_openers,
          CAST(ROUND(AVG(email_daily_clicks)) AS INT64) as email_daily_clicks,
          CAST(ROUND(AVG(email_daily_unique_clickers)) AS INT64) as email_daily_unique_clickers,
          0 as talent_signups_dod,
          0 as company_signups_dod,
          0 as applications_dod,
          0 as revenue_dod,
          0 as sessions_dod,
          0 as purchases_dod,
          0 as stripe_revenue_dod
        FROM `{PROJECT_ID}.reporting.daily_metrics`
        WHERE date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 7} DAY), WEEK(MONDAY))
        GROUP BY week_start
        """
        
        insert_job = bq.query(insert_weekly)
        insert_job.result()
        results['weekly_rows_updated'] = insert_job.num_dml_affected_rows or 0
        logger.info(f"✅ Inserted {results['weekly_rows_updated']} weeks into weekly_metrics")
        
        # 3. Rebuild monthly_metrics from daily_metrics (DELETE + INSERT for all columns)
        logger.info("📆 Refreshing monthly_metrics...")
        
        # Delete affected months
        delete_monthly = f"""
        DELETE FROM `{PROJECT_ID}.reporting.monthly_metrics`
        WHERE month_start >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 31} DAY), MONTH)
        """
        
        delete_job = bq.query(delete_monthly)
        delete_job.result()
        deleted_months = delete_job.num_dml_affected_rows or 0
        logger.info(f"🗑️ Deleted {deleted_months} months")
        
        insert_monthly = f"""
        INSERT INTO `{PROJECT_ID}.reporting.monthly_metrics`
        SELECT
            DATE_TRUNC(date, MONTH) as month_start,
            CAST(EXTRACT(MONTH FROM MIN(date)) AS INT64) as month_num,
            SUM(talent_signups) as talent_signups,
            SUM(company_signups) as company_signups,
            SUM(total_signups) as total_signups,
            SUM(jobs_posted) as jobs_posted,
            SUM(applications) as applications,
            ROUND(AVG(apps_per_job), 2) as apps_per_job,
            SUM(hires) as hires,
            ROUND(AVG(match_rate_pct), 2) as match_rate_pct,
            ROUND(AVG(app_to_hire_pct), 2) as app_to_hire_pct,
            SUM(revenue) as revenue,
            ROUND(AVG(revenue_per_talent_signup), 2) as revenue_per_talent_signup,
            ROUND(AVG(revenue_per_hire), 2) as revenue_per_hire,
            SUM(job_views) as job_views,
            SUM(profile_views) as profile_views,
            SUM(reviews) as reviews,
            SUM(purchases) as purchases,
            SUM(failed_transactions) as failed_transactions,
            SUM(purchasing_customers) as purchasing_customers,
            SUM(stripe_revenue) as stripe_revenue,
            ROUND(AVG(purchases_per_customer_daily), 2) as purchases_per_customer_daily,
            CAST(MAX(cumulative_purchases) AS INT64) as cumulative_purchases,
            CAST(MAX(cumulative_company_signups) AS INT64) as cumulative_company_signups,
            ROUND(AVG(company_purchase_conversion_pct), 2) as company_purchase_conversion_pct,
            ROUND(AVG(avg_purchases_per_company), 2) as avg_purchases_per_company,
            SUM(mrr) as mrr,
            SUM(arr) as arr,
            SUM(active_subscriptions) as active_subscriptions,
            SUM(churned_subscriptions) as churned_subscriptions,
            ROUND(AVG(churn_rate_pct), 2) as churn_rate_pct,
            SUM(sessions) as sessions,
            SUM(engaged_sessions) as engaged_sessions,
            ROUND(AVG(engagement_rate_pct), 2) as engagement_rate_pct,
            SUM(total_events) as total_events,
            ROUND(AVG(events_per_session), 2) as events_per_session,
            SUM(key_events) as key_events,
            SUM(ga4_revenue) as ga4_revenue,
            SUM(new_users) as new_users,
            SUM(organic_sessions) as organic_sessions,
            SUM(paid_search_sessions) as paid_search_sessions,
            SUM(paid_pmax_sessions) as paid_pmax_sessions,
            SUM(total_paid_sessions) as total_paid_sessions,
            SUM(direct_sessions) as direct_sessions,
            SUM(referral_sessions) as referral_sessions,
            SUM(social_sessions) as social_sessions,
            SUM(email_traffic_sessions) as email_traffic_sessions,
            SUM(video_sessions) as video_sessions,
            SUM(organic_engaged_sessions) as organic_engaged_sessions,
            SUM(paid_search_engaged_sessions) as paid_search_engaged_sessions,
            SUM(paid_pmax_engaged_sessions) as paid_pmax_engaged_sessions,
            ROUND(AVG(organic_engagement_rate), 2) as organic_engagement_rate,
            ROUND(AVG(paid_engagement_rate), 2) as paid_engagement_rate,
            ROUND(AVG(organic_pct), 2) as organic_pct,
            ROUND(AVG(paid_pct), 2) as paid_pct,
            ROUND(AVG(direct_pct), 2) as direct_pct,
            ROUND(AVG(referral_pct), 2) as referral_pct,
            SUM(gads_sessions) as gads_sessions,
            SUM(gads_users) as gads_users,
            SUM(gads_conversions) as gads_conversions,
            SUM(gads_revenue) as gads_revenue,
            SUM(gads_pmax_sessions) as gads_pmax_sessions,
            SUM(gads_pmax_conversions) as gads_pmax_conversions,
            SUM(gads_search_sessions) as gads_search_sessions,
            SUM(gads_search_conversions) as gads_search_conversions,
            ROUND(AVG(talent_signup_rate_pct), 2) as talent_signup_rate_pct,
            ROUND(AVG(company_signup_rate_pct), 2) as company_signup_rate_pct,
            ROUND(AVG(overall_signup_rate_pct), 2) as overall_signup_rate_pct,
            ROUND(AVG(revenue_per_session), 2) as revenue_per_session,
            SUM(marketing_campaigns_launched) as marketing_campaigns_launched,
            SUM(marketing_sends) as marketing_sends,
            SUM(marketing_opens) as marketing_opens,
            SUM(marketing_clicks) as marketing_clicks,
            ROUND(AVG(marketing_avg_open_rate), 2) as marketing_avg_open_rate,
            ROUND(AVG(marketing_avg_ctr), 2) as marketing_avg_ctr,
            SUM(automation_campaigns_launched) as automation_campaigns_launched,
            SUM(automation_sends) as automation_sends,
            SUM(automation_opens) as automation_opens,
            SUM(automation_clicks) as automation_clicks,
            ROUND(AVG(automation_avg_open_rate), 2) as automation_avg_open_rate,
            ROUND(AVG(automation_avg_ctr), 2) as automation_avg_ctr,
            SUM(campaigns_launched) as campaigns_launched,
            SUM(campaign_lifetime_sends) as campaign_lifetime_sends,
            SUM(campaign_lifetime_opens) as campaign_lifetime_opens,
            SUM(campaign_lifetime_clicks) as campaign_lifetime_clicks,
            ROUND(AVG(campaign_avg_open_rate), 2) as campaign_avg_open_rate,
            ROUND(AVG(campaign_avg_ctr), 2) as campaign_avg_ctr,
            ROUND(AVG(campaign_click_to_open_pct), 2) as campaign_click_to_open_pct,
            SUM(email_contacts_total) as email_contacts_total,
            SUM(email_list_subscribers_total) as email_list_subscribers_total,
            CAST(ROUND(AVG(email_daily_opens)) AS INT64) as email_daily_opens,
            CAST(ROUND(AVG(email_daily_unique_openers)) AS INT64) as email_daily_unique_openers,
            CAST(ROUND(AVG(email_daily_clicks)) AS INT64) as email_daily_clicks,
            CAST(ROUND(AVG(email_daily_unique_clickers)) AS INT64) as email_daily_unique_clickers,
            0 as talent_signups_dod,
            0 as company_signups_dod,
            0 as applications_dod,
            0 as revenue_dod,
            0 as sessions_dod,
            0 as purchases_dod,
            0 as stripe_revenue_dod
        FROM `{PROJECT_ID}.reporting.daily_metrics`
        WHERE date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 31} DAY), MONTH)
        GROUP BY month_start
        """
        
        insert_job = bq.query(insert_monthly)
        insert_job.result()
        results['monthly_rows_updated'] = insert_job.num_dml_affected_rows or 0
        logger.info(f"✅ Inserted {results['monthly_rows_updated']} months into monthly_metrics")
        
        total_rows = results['daily_rows_updated'] + results['weekly_rows_updated'] + results['monthly_rows_updated']
        
        return ({
            'success': True,
            'days_back': days_back,
            'daily_rows_updated': results['daily_rows_updated'],
            'weekly_rows_updated': results['weekly_rows_updated'],
            'monthly_rows_updated': results['monthly_rows_updated'],
            'total_rows_updated': total_rows,
            'message': f'Refreshed all reporting tables: {total_rows} total rows updated'
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ Reporting refresh failed: {e}", exc_info=True)
        return ({
            'success': False,
            'error': str(e)
        }, 500, headers)
