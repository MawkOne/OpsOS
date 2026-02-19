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
        
        # 1. Update daily_metrics from master view
        logger.info("📅 Refreshing daily_metrics...")
        daily_merge_query = f"""
        MERGE `{PROJECT_ID}.reporting.daily_metrics` AS target
        USING `{PROJECT_ID}.marketing_ai.v_master_daily_metrics` AS source
        ON target.date = source.date
        WHEN MATCHED AND source.date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY) THEN
          UPDATE SET 
            target.new_users = source.new_users,
            target.sessions = source.sessions,
            target.talent_signups = source.talent_signups,
            target.company_signups = source.company_signups,
            target.total_signups = source.total_signups,
            target.jobs_posted = source.jobs_posted,
            target.applications = source.applications,
            target.hires = source.hires,
            target.stripe_revenue = source.stripe_revenue,
            target.revenue = source.revenue,
            target.purchases = source.purchases,
            target.purchasing_customers = source.purchasing_customers,
            target.failed_transactions = source.failed_transactions,
            target.talent_signup_rate_pct = source.talent_signup_rate_pct,
            target.company_signup_rate_pct = source.company_signup_rate_pct,
            target.overall_signup_rate_pct = source.overall_signup_rate_pct
        WHEN NOT MATCHED AND source.date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY) THEN
          INSERT (
            date, new_users, sessions, talent_signups, company_signups, total_signups,
            jobs_posted, applications, hires, stripe_revenue, revenue, purchases,
            purchasing_customers, failed_transactions, talent_signup_rate_pct,
            company_signup_rate_pct, overall_signup_rate_pct
          )
          VALUES (
            source.date, source.new_users, source.sessions, source.talent_signups, 
            source.company_signups, source.total_signups, source.jobs_posted, 
            source.applications, source.hires, source.stripe_revenue, source.revenue, 
            source.purchases, source.purchasing_customers, source.failed_transactions,
            source.talent_signup_rate_pct, source.company_signup_rate_pct, 
            source.overall_signup_rate_pct
          )
        """
        
        job = bq.query(daily_merge_query)
        job.result()
        results['daily_rows_updated'] = job.num_dml_affected_rows or 0
        logger.info(f"✅ Updated {results['daily_rows_updated']} rows in daily_metrics")
        
        # 2. Update weekly_metrics from daily_metrics
        logger.info("📊 Refreshing weekly_metrics...")
        weekly_merge_query = f"""
        MERGE `{PROJECT_ID}.reporting.weekly_metrics` AS target
        USING (
          SELECT
            DATE_TRUNC(date, WEEK(MONDAY)) as week_start,
            EXTRACT(YEAR FROM DATE_TRUNC(date, WEEK(MONDAY))) as year,
            FORMAT_DATE('%G-W%V', DATE_TRUNC(date, WEEK(MONDAY))) as week_num,
            EXTRACT(ISOWEEK FROM DATE_TRUNC(date, WEEK(MONDAY))) as week,
            COUNT(DISTINCT date) as days_in_week,
            SUM(talent_signups) as talent_signups,
            SUM(company_signups) as company_signups,
            SUM(total_signups) as total_signups,
            ROUND(AVG(talent_signups), 1) as talent_signups_daily_avg,
            ROUND(AVG(company_signups), 1) as company_signups_daily_avg,
            SUM(jobs_posted) as jobs_posted,
            SUM(applications) as applications,
            SUM(hires) as hires,
            SUM(stripe_revenue) as stripe_revenue,
            ROUND(AVG(stripe_revenue), 1) as stripe_revenue_daily_avg,
            SUM(purchases) as purchases,
            SUM(purchasing_customers) as purchasing_customers,
            SUM(failed_transactions) as failed_transactions,
            ROUND(AVG(talent_signup_rate_pct), 1) as talent_signup_rate_pct,
            ROUND(AVG(company_signup_rate_pct), 1) as company_signup_rate_pct,
            ROUND(AVG(overall_signup_rate_pct), 1) as overall_signup_rate_pct,
            SUM(sessions) as sessions,
            SUM(revenue) as revenue,
            ROUND(AVG(revenue), 1) as revenue_daily_avg
          FROM `{PROJECT_ID}.reporting.daily_metrics`
          WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 7} DAY)
          GROUP BY week_start, year, week_num, week
        ) AS source
        ON target.week_start = source.week_start
        WHEN MATCHED THEN
          UPDATE SET
            target.talent_signups = source.talent_signups,
            target.company_signups = source.company_signups,
            target.total_signups = source.total_signups,
            target.talent_signups_daily_avg = source.talent_signups_daily_avg,
            target.company_signups_daily_avg = source.company_signups_daily_avg,
            target.jobs_posted = source.jobs_posted,
            target.applications = source.applications,
            target.hires = source.hires,
            target.stripe_revenue = source.stripe_revenue,
            target.stripe_revenue_daily_avg = source.stripe_revenue_daily_avg,
            target.purchases = source.purchases,
            target.purchasing_customers = source.purchasing_customers,
            target.failed_transactions = source.failed_transactions,
            target.talent_signup_rate_pct = source.talent_signup_rate_pct,
            target.company_signup_rate_pct = source.company_signup_rate_pct,
            target.overall_signup_rate_pct = source.overall_signup_rate_pct,
            target.sessions = source.sessions,
            target.revenue = source.revenue,
            target.revenue_daily_avg = source.revenue_daily_avg,
            target.week = source.week,
            target.week_num = source.week_num,
            target.week_end = DATE_ADD(source.week_start, INTERVAL 6 DAY),
            target.days_in_week = source.days_in_week
        WHEN NOT MATCHED THEN
          INSERT (week_num, year, week, week_start, week_end, days_in_week,
                  talent_signups, company_signups, total_signups,
                  talent_signups_daily_avg, company_signups_daily_avg,
                  jobs_posted, applications, hires,
                  stripe_revenue, stripe_revenue_daily_avg, purchases,
                  purchasing_customers, failed_transactions,
                  talent_signup_rate_pct, company_signup_rate_pct, overall_signup_rate_pct,
                  sessions, revenue, revenue_daily_avg)
          VALUES (source.week_num, source.year, source.week, source.week_start,
                  DATE_ADD(source.week_start, INTERVAL 6 DAY), source.days_in_week,
                  source.talent_signups, source.company_signups, source.total_signups,
                  source.talent_signups_daily_avg, source.company_signups_daily_avg,
                  source.jobs_posted, source.applications, source.hires,
                  source.stripe_revenue, source.stripe_revenue_daily_avg, source.purchases,
                  source.purchasing_customers, source.failed_transactions,
                  source.talent_signup_rate_pct, source.company_signup_rate_pct, source.overall_signup_rate_pct,
                  source.sessions, source.revenue, source.revenue_daily_avg)
        """
        
        job = bq.query(weekly_merge_query)
        job.result()
        results['weekly_rows_updated'] = job.num_dml_affected_rows or 0
        logger.info(f"✅ Updated {results['weekly_rows_updated']} rows in weekly_metrics")
        
        # 3. Update monthly_metrics from daily_metrics
        logger.info("📆 Refreshing monthly_metrics...")
        monthly_merge_query = f"""
        MERGE `{PROJECT_ID}.reporting.monthly_metrics` AS target
        USING (
          SELECT
            DATE_TRUNC(date, MONTH) as month_start,
            EXTRACT(YEAR FROM date) as year,
            EXTRACT(MONTH FROM date) as month,
            SUM(talent_signups) as talent_signups,
            SUM(company_signups) as company_signups,
            SUM(total_signups) as total_signups,
            SUM(jobs_posted) as jobs_posted,
            SUM(applications) as applications,
            SUM(hires) as hires,
            SUM(revenue) as revenue,
            SUM(purchases) as purchases,
            SUM(purchasing_customers) as purchasing_customers,
            SUM(stripe_revenue) as stripe_revenue,
            SUM(sessions) as sessions,
            ROUND(AVG(talent_signup_rate_pct), 1) as talent_signup_rate_pct,
            ROUND(AVG(company_signup_rate_pct), 1) as company_signup_rate_pct,
            ROUND(AVG(overall_signup_rate_pct), 1) as overall_signup_rate_pct
          FROM `{PROJECT_ID}.reporting.daily_metrics`
          WHERE date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 31} DAY), MONTH)
          GROUP BY month_start, year, month
        ) AS source
        ON target.month_start = source.month_start
        WHEN MATCHED THEN
          UPDATE SET
            target.talent_signups = source.talent_signups,
            target.company_signups = source.company_signups,
            target.total_signups = source.total_signups,
            target.jobs_posted = source.jobs_posted,
            target.applications = source.applications,
            target.hires = source.hires,
            target.revenue = source.revenue,
            target.purchases = source.purchases,
            target.purchasing_customers = source.purchasing_customers,
            target.stripe_revenue = source.stripe_revenue,
            target.sessions = source.sessions,
            target.talent_signup_rate_pct = source.talent_signup_rate_pct,
            target.company_signup_rate_pct = source.company_signup_rate_pct,
            target.overall_signup_rate_pct = source.overall_signup_rate_pct,
            target.year = source.year,
            target.month = source.month
        WHEN NOT MATCHED THEN
          INSERT (month_start, year, month, talent_signups, company_signups, total_signups,
                  jobs_posted, applications, hires, revenue, purchases, purchasing_customers,
                  stripe_revenue, sessions, talent_signup_rate_pct, company_signup_rate_pct,
                  overall_signup_rate_pct)
          VALUES (source.month_start, source.year, source.month, source.talent_signups,
                  source.company_signups, source.total_signups, source.jobs_posted,
                  source.applications, source.hires, source.revenue, source.purchases,
                  source.purchasing_customers, source.stripe_revenue, source.sessions,
                  source.talent_signup_rate_pct, source.company_signup_rate_pct,
                  source.overall_signup_rate_pct)
        """
        
        job = bq.query(monthly_merge_query)
        job.result()
        results['monthly_rows_updated'] = job.num_dml_affected_rows or 0
        logger.info(f"✅ Updated {results['monthly_rows_updated']} rows in monthly_metrics")
        
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
