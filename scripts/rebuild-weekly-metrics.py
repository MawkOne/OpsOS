#!/usr/bin/env python3
from google.cloud import bigquery
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"

def rebuild_weekly_metrics():
    bq = bigquery.Client(project=PROJECT_ID)
    
    # The full INSERT query from main.py
    insert_query = f"""
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
      SUM(job_views) as job_views,
      SUM(profile_views) as profile_views,
      SUM(reviews) as reviews
    FROM `{PROJECT_ID}.reporting.daily_metrics`
    WHERE date >= '2024-01-01'
    GROUP BY week_start, year, week_num, week
    """
    
    logger.info("Rebuilding weekly_metrics from all daily_metrics data...")
    job = bq.query(insert_query)
    job.result()
    logger.info(f"✅ Inserted {job.num_dml_affected_rows or 0} weeks")
    
    # Verify
    verify = bq.query("SELECT MAX(week_start) as latest, COUNT(*) as total FROM `opsos-864a1.reporting.weekly_metrics`")
    for row in verify:
        logger.info(f"Latest week: {row.latest}, Total weeks: {row.total}")

if __name__ == "__main__":
    rebuild_weekly_metrics()
