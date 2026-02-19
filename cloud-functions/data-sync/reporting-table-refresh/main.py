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
        
        # Insert fresh data from master view (all columns)
        insert_query = f"""
        INSERT INTO `{PROJECT_ID}.reporting.daily_metrics`
        SELECT * FROM `{PROJECT_ID}.marketing_ai.v_master_daily_metrics`
        WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)
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
          EXTRACT(YEAR FROM DATE_TRUNC(date, WEEK(MONDAY))) as year,
          FORMAT_DATE('%G-W%V', DATE_TRUNC(date, WEEK(MONDAY))) as week_num,
          EXTRACT(ISOWEEK FROM DATE_TRUNC(date, WEEK(MONDAY))) as week,
          FORMAT_DATE('%b %d', MIN(date)) || ' - ' || FORMAT_DATE('%b %d', MAX(date)) as week_label,
          MIN(date) as week_start_date,
          MAX(date) as week_end_date,
          COUNT(DISTINCT date) as days_in_week,
          SUM(new_users) as new_users,
          SUM(sessions) as sessions,
          SUM(talent_signups) as talent_signups,
          SUM(company_signups) as company_signups,
          SUM(total_signups) as total_signups,
          SUM(jobs_posted) as jobs_posted,
          SUM(applications) as applications,
          SUM(hires) as hires,
          SUM(stripe_revenue) as stripe_revenue,
          SUM(revenue) as revenue,
          SUM(purchases) as purchases,
          SUM(purchasing_customers) as purchasing_customers,
          SUM(failed_transactions) as failed_transactions,
          ROUND(AVG(talent_signups), 1) as talent_signups_daily_avg,
          ROUND(AVG(company_signups), 1) as company_signups_daily_avg,
          ROUND(AVG(stripe_revenue), 1) as stripe_revenue_daily_avg,
          ROUND(AVG(revenue), 1) as revenue_daily_avg,
          ROUND(AVG(apps_per_job), 2) as apps_per_job,
          ROUND(AVG(match_rate_pct), 2) as match_rate_pct,
          ROUND(AVG(app_to_hire_pct), 2) as app_to_hire_pct,
          ROUND(AVG(talent_signup_rate_pct), 2) as talent_signup_rate_pct,
          ROUND(AVG(company_signup_rate_pct), 2) as company_signup_rate_pct,
          ROUND(AVG(overall_signup_rate_pct), 2) as overall_signup_rate_pct,
          SUM(organic_sessions) as organic_sessions,
          SUM(paid_search_sessions) as paid_search_sessions,
          SUM(paid_pmax_sessions) as paid_pmax_sessions,
          SUM(total_paid_sessions) as total_paid_sessions,
          SUM(direct_sessions) as direct_sessions,
          SUM(referral_sessions) as referral_sessions,
          SUM(social_sessions) as social_sessions,
          SUM(email_traffic_sessions) as email_traffic_sessions,
          SUM(video_sessions) as video_sessions,
          SUM(engaged_sessions) as engaged_sessions,
          SUM(organic_engaged_sessions) as organic_engaged_sessions,
          SUM(paid_search_engaged_sessions) as paid_search_engaged_sessions,
          SUM(paid_pmax_engaged_sessions) as paid_pmax_engaged_sessions,
          ROUND(AVG(engagement_rate_pct), 2) as engagement_rate_pct,
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
          SUM(total_events) as total_events,
          SUM(key_events) as key_events,
          ROUND(AVG(events_per_session), 2) as events_per_session,
          ROUND(AVG(revenue_per_session), 2) as revenue_per_session,
          SUM(ga4_revenue) as ga4_revenue,
          SUM(campaigns_launched) as campaigns_launched,
          SUM(campaign_lifetime_sends) as campaign_lifetime_sends,
          SUM(campaign_lifetime_opens) as campaign_lifetime_opens,
          SUM(campaign_lifetime_clicks) as campaign_lifetime_clicks,
          ROUND(AVG(campaign_avg_open_rate), 2) as campaign_avg_open_rate,
          ROUND(AVG(campaign_avg_ctr), 2) as campaign_avg_ctr,
          SUM(job_views) as job_views,
          SUM(profile_views) as profile_views,
          SUM(reviews) as reviews
        FROM `{PROJECT_ID}.reporting.daily_metrics`
        WHERE date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 7} DAY), WEEK(MONDAY))
        GROUP BY week_start, year, week_num, week
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
        WITH monthly_agg AS (
          SELECT
            DATE_TRUNC(date, MONTH) as month_start,
            EXTRACT(YEAR FROM DATE_TRUNC(date, MONTH)) as year,
            EXTRACT(MONTH FROM DATE_TRUNC(date, MONTH)) as month,
            SUM(new_users) as new_users,
            SUM(sessions) as sessions,
            SUM(talent_signups) as talent_signups,
            SUM(company_signups) as company_signups,
            SUM(total_signups) as total_signups,
            SUM(jobs_posted) as jobs_posted,
            SUM(applications) as applications,
            SUM(hires) as hires,
            SUM(stripe_revenue) as stripe_revenue,
            SUM(revenue) as revenue,
            SUM(purchases) as purchases,
            SUM(purchasing_customers) as purchasing_customers,
            SUM(failed_transactions) as failed_transactions,
            ROUND(AVG(talent_signups), 1) as talent_signups_daily_avg,
            ROUND(AVG(company_signups), 1) as company_signups_daily_avg,
            ROUND(AVG(stripe_revenue), 1) as stripe_revenue_daily_avg,
            ROUND(AVG(revenue), 1) as revenue_daily_avg,
            ROUND(AVG(apps_per_job), 2) as apps_per_job,
            ROUND(AVG(match_rate_pct), 2) as match_rate_pct,
            ROUND(AVG(app_to_hire_pct), 2) as app_to_hire_pct,
            ROUND(AVG(talent_signup_rate_pct), 2) as talent_signup_rate_pct,
            ROUND(AVG(company_signup_rate_pct), 2) as company_signup_rate_pct,
            ROUND(AVG(overall_signup_rate_pct), 2) as overall_signup_rate_pct,
            SUM(organic_sessions) as organic_sessions,
            SUM(paid_search_sessions) as paid_search_sessions,
            SUM(paid_pmax_sessions) as paid_pmax_sessions,
            SUM(total_paid_sessions) as total_paid_sessions,
            SUM(direct_sessions) as direct_sessions,
            SUM(referral_sessions) as referral_sessions,
            SUM(social_sessions) as social_sessions,
            SUM(email_traffic_sessions) as email_traffic_sessions,
            SUM(video_sessions) as video_sessions,
            SUM(engaged_sessions) as engaged_sessions,
            SUM(organic_engaged_sessions) as organic_engaged_sessions,
            SUM(paid_search_engaged_sessions) as paid_search_engaged_sessions,
            SUM(paid_pmax_engaged_sessions) as paid_pmax_engaged_sessions,
            ROUND(AVG(engagement_rate_pct), 2) as engagement_rate_pct,
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
            SUM(total_events) as total_events,
            SUM(key_events) as key_events,
            ROUND(AVG(events_per_session), 2) as events_per_session,
            ROUND(AVG(revenue_per_session), 2) as revenue_per_session,
            SUM(ga4_revenue) as ga4_revenue,
            SUM(campaigns_launched) as campaigns_launched,
            SUM(campaign_lifetime_sends) as campaign_lifetime_sends,
            SUM(campaign_lifetime_opens) as campaign_lifetime_opens,
            SUM(campaign_lifetime_clicks) as campaign_lifetime_clicks,
            ROUND(AVG(campaign_avg_open_rate), 2) as campaign_avg_open_rate,
          ROUND(AVG(campaign_avg_ctr), 2) as campaign_avg_ctr,
          SUM(job_views) as job_views,
          SUM(profile_views) as profile_views,
          SUM(reviews) as reviews,
          COUNT(DISTINCT date) as days_in_month
        FROM `{PROJECT_ID}.reporting.daily_metrics`
        WHERE date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 31} DAY), MONTH)
        GROUP BY month_start, year, month
        )
        SELECT 
          month_start, year, month,
          FORMAT_DATE('%b %Y', month_start) as month_label,
          days_in_month, new_users, sessions, talent_signups, company_signups, total_signups,
          jobs_posted, applications, hires, stripe_revenue, revenue, purchases,
          purchasing_customers, failed_transactions, talent_signups_daily_avg,
          company_signups_daily_avg, stripe_revenue_daily_avg, revenue_daily_avg,
          apps_per_job, match_rate_pct, app_to_hire_pct, talent_signup_rate_pct,
          company_signup_rate_pct, overall_signup_rate_pct, organic_sessions,
          paid_search_sessions, paid_pmax_sessions, total_paid_sessions, direct_sessions,
          referral_sessions, social_sessions, email_traffic_sessions, video_sessions,
          engaged_sessions, organic_engaged_sessions, paid_search_engaged_sessions,
          paid_pmax_engaged_sessions, engagement_rate_pct, organic_engagement_rate,
          paid_engagement_rate, organic_pct, paid_pct, direct_pct, referral_pct,
          gads_sessions, gads_users, gads_conversions, gads_revenue, gads_pmax_sessions,
          gads_pmax_conversions, gads_search_sessions, gads_search_conversions,
          total_events, key_events, events_per_session, revenue_per_session,
          ga4_revenue, campaigns_launched, campaign_lifetime_sends, campaign_lifetime_opens,
          campaign_lifetime_clicks, campaign_avg_open_rate, campaign_avg_ctr,
          job_views, profile_views, reviews
        FROM monthly_agg
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
