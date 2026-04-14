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
        
        # Insert fresh data from master view + GA4 rollups + computed trends.
        # Trends (dod, 7d_avg, wow_pct) are computed via window functions over
        # the full v_master history so lag values are always available.
        insert_query = f"""
        INSERT INTO `{PROJECT_ID}.reporting.daily_metrics`
        WITH
        ga_website AS (
          SELECT
            date,
            SUM(
              SAFE_CAST(sessions AS INT64) * CASE
                WHEN SAFE_CAST(engagement_rate AS FLOAT64) > 1.0
                  THEN SAFE_CAST(engagement_rate AS FLOAT64) / 100.0
                ELSE COALESCE(SAFE_CAST(engagement_rate AS FLOAT64), 0.0)
              END
            ) AS engaged_sessions_est,
            MAX(SAFE_CAST(users AS INT64)) AS wt_users_max,
            SUM(SAFE_CAST(conversions AS INT64)) AS wt_conversions_sum,
            SUM(SAFE_CAST(revenue AS FLOAT64)) AS wt_revenue_sum
          FROM `{PROJECT_ID}.marketing_ai.daily_entity_metrics`
          WHERE organization_id = 'ytjobs'
            AND entity_type = 'website_traffic'
          GROUP BY date
        ),
        ga_traffic AS (
          SELECT
            date,
            SUM(CASE WHEN canonical_entity_id LIKE '%Cross-network%' THEN SAFE_CAST(sessions AS INT64) ELSE 0 END) AS paid_pmax_sessions_est,
            SUM(CASE WHEN canonical_entity_id LIKE '%Organic_Video%' THEN SAFE_CAST(sessions AS INT64) ELSE 0 END) AS video_sessions_est,
            SUM(
              CASE WHEN canonical_entity_id LIKE '%Organic_Search%'
                THEN SAFE_CAST(sessions AS INT64) * CASE
                  WHEN SAFE_CAST(engagement_rate AS FLOAT64) > 1.0
                    THEN SAFE_CAST(engagement_rate AS FLOAT64) / 100.0
                  ELSE COALESCE(SAFE_CAST(engagement_rate AS FLOAT64), 0.0)
                END
              ELSE 0 END
            ) AS organic_engaged_est,
            SUM(
              CASE WHEN canonical_entity_id LIKE '%Paid_Search%'
                THEN SAFE_CAST(sessions AS INT64) * CASE
                  WHEN SAFE_CAST(engagement_rate AS FLOAT64) > 1.0
                    THEN SAFE_CAST(engagement_rate AS FLOAT64) / 100.0
                  ELSE COALESCE(SAFE_CAST(engagement_rate AS FLOAT64), 0.0)
                END
              ELSE 0 END
            ) AS paid_search_engaged_est,
            SUM(
              CASE WHEN canonical_entity_id LIKE '%Cross-network%'
                THEN SAFE_CAST(sessions AS INT64) * CASE
                  WHEN SAFE_CAST(engagement_rate AS FLOAT64) > 1.0
                    THEN SAFE_CAST(engagement_rate AS FLOAT64) / 100.0
                  ELSE COALESCE(SAFE_CAST(engagement_rate AS FLOAT64), 0.0)
                END
              ELSE 0 END
            ) AS paid_pmax_engaged_est
          FROM `{PROJECT_ID}.marketing_ai.daily_entity_metrics`
          WHERE organization_id = 'ytjobs'
            AND entity_type = 'traffic_source'
          GROUP BY date
        ),
        ga_ads_users AS (
          SELECT
            date,
            SUM(SAFE_CAST(users AS INT64)) AS gads_users_sum
          FROM `{PROJECT_ID}.marketing_ai.daily_entity_metrics`
          WHERE organization_id = 'ytjobs'
            AND entity_type = 'google_ads_campaign'
          GROUP BY date
        ),
        -- Pre-compute actual daily purchases so window functions can reference it
        daily_purchases AS (
          SELECT
            date,
            COUNT(DISTINCT canonical_entity_id) AS purchase_count
          FROM `{PROJECT_ID}.marketing_ai.daily_entity_metrics`
          WHERE organization_id = 'ytjobs'
            AND entity_type = 'charge'
            AND conversions > 0
          GROUP BY date
        )
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
          
          -- Cumulative running totals (over full history via window)
          SUM(COALESCE((
            SELECT COUNT(DISTINCT canonical_entity_id)
            FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
            WHERE organization_id = 'ytjobs'
              AND entity_type = 'charge'
              AND date = v.date
              AND conversions > 0
          ), 0)) OVER (ORDER BY v.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_purchases,
          SUM(v.company_signups) OVER (ORDER BY v.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_company_signups,
          ROUND(SAFE_DIVIDE(
            COALESCE((
              SELECT COUNT(DISTINCT canonical_entity_id)
              FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
              WHERE organization_id = 'ytjobs'
                AND entity_type = 'charge'
                AND date = v.date
                AND conversions > 0
            ), 0),
            NULLIF(v.company_signups, 0)
          ) * 100, 2) as company_purchase_conversion_pct,
          -- avg purchases per company = cumulative purchases / cumulative company signups
          ROUND(SAFE_DIVIDE(
            SUM(COALESCE((
              SELECT COUNT(DISTINCT canonical_entity_id)
              FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
              WHERE organization_id = 'ytjobs' AND entity_type = 'charge'
                AND date = v.date AND conversions > 0
            ), 0)) OVER (ORDER BY v.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
            NULLIF(SUM(v.company_signups) OVER (ORDER BY v.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 0)
          ), 4) as avg_purchases_per_company,
          0.0 as mrr,
          0.0 as arr,
          0 as active_subscriptions,
          0 as churned_subscriptions,
          0.0 as churn_rate_pct,
          v.website_sessions as sessions,
          CAST(COALESCE(ga_website.engaged_sessions_est, 0) AS INT64) as engaged_sessions,
          ROUND(SAFE_DIVIDE(COALESCE(ga_website.engaged_sessions_est, 0), NULLIF(v.website_sessions, 0)) * 100, 2) as engagement_rate_pct,
          v.website_events as total_events,
          SAFE_DIVIDE(v.website_events, NULLIF(v.website_sessions, 0)) as events_per_session,
          CAST(COALESCE(ga_website.wt_conversions_sum, 0) AS FLOAT64) as key_events,
          COALESCE(ga_website.wt_revenue_sum, 0.0) as ga4_revenue,
          v.website_visitors as new_users,
          v.organic_sessions as organic_sessions,
          v.paid_search_sessions as paid_search_sessions,
          COALESCE(ga_traffic.paid_pmax_sessions_est, 0) as paid_pmax_sessions,
          v.paid_search_sessions + COALESCE(ga_traffic.paid_pmax_sessions_est, 0) as total_paid_sessions,
          v.direct_sessions as direct_sessions,
          v.referral_sessions as referral_sessions,
          v.social_sessions as social_sessions,
          v.email_sessions as email_traffic_sessions,
          COALESCE(ga_traffic.video_sessions_est, 0) as video_sessions,
          CAST(COALESCE(ga_traffic.organic_engaged_est, 0) AS INT64) as organic_engaged_sessions,
          CAST(COALESCE(ga_traffic.paid_search_engaged_est, 0) AS INT64) as paid_search_engaged_sessions,
          CAST(COALESCE(ga_traffic.paid_pmax_engaged_est, 0) AS INT64) as paid_pmax_engaged_sessions,
          ROUND(SAFE_DIVIDE(COALESCE(ga_traffic.organic_engaged_est, 0), NULLIF(v.organic_sessions, 0)) * 100, 2) as organic_engagement_rate,
          ROUND(
            SAFE_DIVIDE(
              COALESCE(ga_traffic.paid_search_engaged_est, 0) + COALESCE(ga_traffic.paid_pmax_engaged_est, 0),
              NULLIF(v.paid_search_sessions + COALESCE(ga_traffic.paid_pmax_sessions_est, 0), 0)
            ) * 100,
            2
          ) as paid_engagement_rate,
          ROUND(SAFE_DIVIDE(v.organic_sessions,     NULLIF(v.website_sessions, 0)) * 100, 2) as organic_pct,
          ROUND(SAFE_DIVIDE(v.paid_search_sessions, NULLIF(v.website_sessions, 0)) * 100, 2) as paid_pct,
          ROUND(SAFE_DIVIDE(v.direct_sessions,      NULLIF(v.website_sessions, 0)) * 100, 2) as direct_pct,
          ROUND(SAFE_DIVIDE(v.referral_sessions,    NULLIF(v.website_sessions, 0)) * 100, 2) as referral_pct,
          v.gads_sessions as gads_sessions,
          COALESCE(ga_ads_users.gads_users_sum, 0) as gads_users,
          v.gads_conversions as gads_conversions,
          v.ppc_revenue as gads_revenue,
          v.gads_pmax_sessions as gads_pmax_sessions,
          v.gads_pmax_conversions as gads_pmax_conversions,
          v.gads_search_sessions as gads_search_sessions,
          v.gads_search_conversions as gads_search_conversions,
          ROUND(SAFE_DIVIDE(v.talent_signups,                          NULLIF(v.website_sessions, 0)) * 100, 2) as talent_signup_rate_pct,
          ROUND(SAFE_DIVIDE(v.company_signups,                         NULLIF(v.website_sessions, 0)) * 100, 2) as company_signup_rate_pct,
          ROUND(SAFE_DIVIDE(v.talent_signups + v.company_signups,      NULLIF(v.website_sessions, 0)) * 100, 2) as overall_signup_rate_pct,
          ROUND(SAFE_DIVIDE(v.stripe_revenue,                          NULLIF(v.website_sessions, 0)), 4)       as revenue_per_session,
          CAST(v.ac_marketing_campaigns_launched AS INT64) as marketing_campaigns_launched,
          CAST(v.ac_marketing_sends AS INT64) as marketing_sends,
          CAST(v.ac_marketing_opens AS INT64) as marketing_opens,
          CAST(v.ac_marketing_clicks AS INT64) as marketing_clicks,
          v.ac_marketing_open_rate_pct as marketing_avg_open_rate,
          v.ac_marketing_ctr_pct as marketing_avg_ctr,
          CAST(v.ac_automation_campaigns_launched AS INT64) as automation_campaigns_launched,
          CAST(v.ac_automation_sends AS INT64) as automation_sends,
          CAST(v.ac_automation_opens AS INT64) as automation_opens,
          CAST(v.ac_automation_clicks AS INT64) as automation_clicks,
          v.ac_automation_open_rate_pct as automation_avg_open_rate,
          v.ac_automation_ctr_pct as automation_avg_ctr,
          CAST(v.ac_campaigns_sent_count AS INT64) as campaigns_launched,
          CAST(v.ac_total_sends AS INT64) as campaign_lifetime_sends,
          CAST(v.ac_total_opens AS INT64) as campaign_lifetime_opens,
          CAST(v.ac_total_clicks AS INT64) as campaign_lifetime_clicks,
          v.ac_blended_open_rate_pct as campaign_avg_open_rate,
          v.ac_blended_ctr_pct as campaign_avg_ctr,
          v.ac_click_to_open_pct as campaign_click_to_open_pct,
          0 as email_contacts_total,
          CAST(v.ac_list_subscribers_total AS INT64) as email_list_subscribers_total,
          CAST(v.ac_activity_opens AS INT64) as email_daily_opens,
          CAST(v.ac_activity_unique_openers AS INT64) as email_daily_unique_openers,
          CAST(v.ac_activity_clicks AS INT64) as email_daily_clicks,
          CAST(v.ac_activity_unique_clickers AS INT64) as email_daily_unique_clickers,
          -- Day-over-day deltas
          CAST(v.talent_signups  AS INT64) - LAG(CAST(v.talent_signups  AS INT64)) OVER (ORDER BY v.date) as talent_signups_dod,
          CAST(v.company_signups AS INT64) - LAG(CAST(v.company_signups AS INT64)) OVER (ORDER BY v.date) as company_signups_dod,
          CAST(v.applications    AS INT64) - LAG(CAST(v.applications    AS INT64)) OVER (ORDER BY v.date) as applications_dod,
          COALESCE(v.ytjobs_revenue, 0)  - LAG(COALESCE(v.ytjobs_revenue, 0))  OVER (ORDER BY v.date) as revenue_dod,
          COALESCE(v.website_sessions,0) - LAG(COALESCE(v.website_sessions,0)) OVER (ORDER BY v.date) as sessions_dod,
          COALESCE(dp.purchase_count,0)  - LAG(COALESCE(dp.purchase_count,0))  OVER (ORDER BY v.date) as purchases_dod,
          COALESCE(v.stripe_revenue,0)   - LAG(COALESCE(v.stripe_revenue,0))   OVER (ORDER BY v.date) as stripe_revenue_dod,

          -- 7-day rolling averages
          ROUND(AVG(CAST(v.talent_signups  AS FLOAT64)) OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) as talent_signups_7d_avg,
          ROUND(AVG(CAST(v.company_signups AS FLOAT64)) OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) as company_signups_7d_avg,
          ROUND(AVG(CAST(v.applications    AS FLOAT64)) OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) as applications_7d_avg,
          ROUND(AVG(COALESCE(v.ytjobs_revenue,  0))    OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) as revenue_7d_avg,
          ROUND(AVG(COALESCE(v.website_sessions,0))    OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) as sessions_7d_avg,
          ROUND(AVG(CAST(COALESCE(dp.purchase_count,0) AS FLOAT64)) OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) as purchases_7d_avg,
          ROUND(AVG(COALESCE(v.stripe_revenue,  0))    OVER (ORDER BY v.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) as stripe_revenue_7d_avg,

          -- Week-over-week % change (vs same day 7 days ago)
          ROUND(SAFE_DIVIDE(
            CAST(v.talent_signups AS FLOAT64) - LAG(CAST(v.talent_signups AS FLOAT64), 7) OVER (ORDER BY v.date),
            NULLIF(ABS(LAG(CAST(v.talent_signups AS FLOAT64), 7) OVER (ORDER BY v.date)), 0)
          ) * 100, 2) as talent_signups_wow_pct,
          ROUND(SAFE_DIVIDE(
            COALESCE(v.ytjobs_revenue,0) - LAG(COALESCE(v.ytjobs_revenue,0), 7) OVER (ORDER BY v.date),
            NULLIF(ABS(LAG(COALESCE(v.ytjobs_revenue,0), 7) OVER (ORDER BY v.date)), 0)
          ) * 100, 2) as revenue_wow_pct,
          ROUND(SAFE_DIVIDE(
            COALESCE(v.website_sessions,0) - LAG(COALESCE(v.website_sessions,0), 7) OVER (ORDER BY v.date),
            NULLIF(ABS(LAG(COALESCE(v.website_sessions,0), 7) OVER (ORDER BY v.date)), 0)
          ) * 100, 2) as sessions_wow_pct,
          ROUND(SAFE_DIVIDE(
            CAST(COALESCE(dp.purchase_count,0) AS FLOAT64) - LAG(CAST(COALESCE(dp.purchase_count,0) AS FLOAT64), 7) OVER (ORDER BY v.date),
            NULLIF(ABS(LAG(CAST(COALESCE(dp.purchase_count,0) AS FLOAT64), 7) OVER (ORDER BY v.date)), 0)
          ) * 100, 2) as purchases_wow_pct,
          ROUND(SAFE_DIVIDE(
            COALESCE(v.stripe_revenue,0) - LAG(COALESCE(v.stripe_revenue,0), 7) OVER (ORDER BY v.date),
            NULLIF(ABS(LAG(COALESCE(v.stripe_revenue,0), 7) OVER (ORDER BY v.date)), 0)
          ) * 100, 2) as stripe_revenue_wow_pct,

          v.ad_spend as ad_spend,
          v.ppc_revenue as ppc_revenue,
          CAST(v.ppc_purchases AS INT64) as ppc_purchases,
          v.roas as roas
        FROM `{PROJECT_ID}.marketing_ai.v_master_daily_metrics` v
        LEFT JOIN ga_website    ON ga_website.date    = v.date
        LEFT JOIN ga_traffic    ON ga_traffic.date    = v.date
        LEFT JOIN ga_ads_users  ON ga_ads_users.date  = v.date
        LEFT JOIN daily_purchases dp ON dp.date       = v.date
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
          ROUND(SAFE_DIVIDE(SUM(purchases), NULLIF(SUM(company_signups), 0)) * 100, 2) as company_purchase_conversion_pct,
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
          ROUND(SAFE_DIVIDE(SUM(organic_sessions),     NULLIF(SUM(sessions), 0)) * 100, 2) as organic_pct,
          ROUND(SAFE_DIVIDE(SUM(paid_search_sessions), NULLIF(SUM(sessions), 0)) * 100, 2) as paid_pct,
          ROUND(SAFE_DIVIDE(SUM(direct_sessions),      NULLIF(SUM(sessions), 0)) * 100, 2) as direct_pct,
          ROUND(SAFE_DIVIDE(SUM(referral_sessions),    NULLIF(SUM(sessions), 0)) * 100, 2) as referral_pct,
          SUM(gads_sessions) as gads_sessions,
          SUM(gads_users) as gads_users,
          SUM(gads_conversions) as gads_conversions,
          SUM(gads_revenue) as gads_revenue,
          SUM(gads_pmax_sessions) as gads_pmax_sessions,
          SUM(gads_pmax_conversions) as gads_pmax_conversions,
          SUM(gads_search_sessions) as gads_search_sessions,
          SUM(gads_search_conversions) as gads_search_conversions,
          ROUND(SAFE_DIVIDE(SUM(talent_signups),                   NULLIF(SUM(sessions), 0)) * 100, 2) as talent_signup_rate_pct,
          ROUND(SAFE_DIVIDE(SUM(company_signups),                  NULLIF(SUM(sessions), 0)) * 100, 2) as company_signup_rate_pct,
          ROUND(SAFE_DIVIDE(SUM(total_signups),                    NULLIF(SUM(sessions), 0)) * 100, 2) as overall_signup_rate_pct,
          ROUND(SAFE_DIVIDE(SUM(stripe_revenue),                   NULLIF(SUM(sessions), 0)), 4)       as revenue_per_session,
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
          0 as stripe_revenue_dod,
          ROUND(SUM(ad_spend), 2) as ad_spend,
          ROUND(SUM(ppc_revenue), 2) as ppc_revenue,
          SUM(ppc_purchases) as ppc_purchases,
          ROUND(SAFE_DIVIDE(SUM(ppc_revenue), NULLIF(SUM(ad_spend), 0)), 2) as roas
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
            ROUND(SAFE_DIVIDE(SUM(purchases), NULLIF(SUM(company_signups), 0)) * 100, 2) as company_purchase_conversion_pct,
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
            ROUND(SAFE_DIVIDE(SUM(organic_sessions),     NULLIF(SUM(sessions), 0)) * 100, 2) as organic_pct,
            ROUND(SAFE_DIVIDE(SUM(paid_search_sessions), NULLIF(SUM(sessions), 0)) * 100, 2) as paid_pct,
            ROUND(SAFE_DIVIDE(SUM(direct_sessions),      NULLIF(SUM(sessions), 0)) * 100, 2) as direct_pct,
            ROUND(SAFE_DIVIDE(SUM(referral_sessions),    NULLIF(SUM(sessions), 0)) * 100, 2) as referral_pct,
            SUM(gads_sessions) as gads_sessions,
            SUM(gads_users) as gads_users,
            SUM(gads_conversions) as gads_conversions,
            SUM(gads_revenue) as gads_revenue,
            SUM(gads_pmax_sessions) as gads_pmax_sessions,
            SUM(gads_pmax_conversions) as gads_pmax_conversions,
            SUM(gads_search_sessions) as gads_search_sessions,
            SUM(gads_search_conversions) as gads_search_conversions,
            ROUND(SAFE_DIVIDE(SUM(talent_signups),  NULLIF(SUM(sessions), 0)) * 100, 2) as talent_signup_rate_pct,
            ROUND(SAFE_DIVIDE(SUM(company_signups), NULLIF(SUM(sessions), 0)) * 100, 2) as company_signup_rate_pct,
            ROUND(SAFE_DIVIDE(SUM(total_signups),   NULLIF(SUM(sessions), 0)) * 100, 2) as overall_signup_rate_pct,
            ROUND(SAFE_DIVIDE(SUM(stripe_revenue),  NULLIF(SUM(sessions), 0)), 4)       as revenue_per_session,
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
            0 as stripe_revenue_dod,
            ROUND(SUM(ad_spend), 2) as ad_spend,
            ROUND(SUM(ppc_revenue), 2) as ppc_revenue,
            SUM(ppc_purchases) as ppc_purchases,
            ROUND(SAFE_DIVIDE(SUM(ppc_revenue), NULLIF(SUM(ad_spend), 0)), 2) as roas
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
