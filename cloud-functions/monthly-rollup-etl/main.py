"""
Monthly Rollup ETL
Aggregates daily_entity_metrics into monthly_entity_metrics for trend detection
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime, timedelta
import calendar
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"


def create_monthly_aggregates(organization_id: str, year_month: str):
    """
    Aggregate daily metrics into monthly metrics for a specific month
    year_month format: "2025-10", "2025-11", etc.
    """
    logger.info(f"Creating monthly aggregates for {organization_id} - {year_month}")
    
    # Parse year_month
    year, month = year_month.split('-')
    year = int(year)
    month = int(month)
    days_in_month = calendar.monthrange(year, month)[1]
    
    query = f"""
    -- First, delete existing data for this month to allow re-processing
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
    WHERE organization_id = @org_id
      AND year_month = @year_month;
    
    -- Then insert fresh monthly aggregates
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
    (
      organization_id, year_month, canonical_entity_id, entity_type,
      impressions, clicks, sessions, users, pageviews,
      avg_session_duration, avg_bounce_rate, avg_engagement_rate,
      conversions, conversion_rate, revenue, cost, profit,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      avg_position, avg_search_volume,
      sends, opens, open_rate, click_through_rate,
      days_in_month, days_with_data, data_completeness,
      mom_change_pct, mom_change_abs, is_best_month, is_worst_month,
      created_at, updated_at
    )
    
    WITH daily_data AS (
      SELECT 
        organization_id,
        canonical_entity_id,
        entity_type,
        date,
        impressions, clicks, sessions, users, pageviews,
        avg_session_duration, bounce_rate, engagement_rate,
        conversions, conversion_rate, revenue, cost, profit,
        ctr, cpc, cpa, roas, roi,
        position, search_volume,
        sends, opens, open_rate, click_through_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND FORMAT_DATE('%Y-%m', date) = @year_month
    ),
    
    monthly_agg AS (
      SELECT 
        organization_id,
        @year_month as year_month,
        canonical_entity_id,
        entity_type,
        
        -- Traffic totals
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(sessions) as sessions,
        SUM(users) as users,
        SUM(pageviews) as pageviews,
        
        -- Engagement averages (weighted by sessions where applicable)
        CASE 
          WHEN SUM(sessions) > 0 
          THEN SUM(avg_session_duration * sessions) / SUM(sessions)
          ELSE AVG(avg_session_duration)
        END as avg_session_duration,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(engagement_rate) as avg_engagement_rate,
        
        -- Conversion & revenue totals
        SUM(conversions) as conversions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as conversion_rate,
        SUM(revenue) as revenue,
        SUM(cost) as cost,
        SUM(revenue) - SUM(cost) as profit,
        
        -- Performance averages
        AVG(ctr) as avg_ctr,
        AVG(cpc) as avg_cpc,
        AVG(cpa) as avg_cpa,
        AVG(roas) as avg_roas,
        AVG(roi) as avg_roi,
        
        -- SEO averages
        AVG(position) as avg_position,
        CAST(AVG(search_volume) AS INT64) as avg_search_volume,
        
        -- Email totals
        SUM(sends) as sends,
        SUM(opens) as opens,
        SAFE_DIVIDE(SUM(opens), SUM(sends)) * 100 as open_rate,
        SAFE_DIVIDE(SUM(clicks), SUM(sends)) * 100 as click_through_rate,
        
        -- Metadata
        @days_in_month as days_in_month,
        COUNT(DISTINCT date) as days_with_data,
        CAST(COUNT(DISTINCT date) AS FLOAT64) / @days_in_month as data_completeness,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM daily_data
      GROUP BY organization_id, canonical_entity_id, entity_type
    ),
    
    with_trends AS (
      SELECT 
        m.*,
        NULL as mom_change_pct,  -- Will be calculated later via update
        NULL as mom_change_abs,
        FALSE as is_best_month,  -- Will be calculated later
        FALSE as is_worst_month
      FROM monthly_agg m
    )
    
    SELECT 
      organization_id, year_month, canonical_entity_id, entity_type,
      impressions, clicks, sessions, users, pageviews,
      avg_session_duration, avg_bounce_rate, avg_engagement_rate,
      conversions, conversion_rate, revenue, cost, profit,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      avg_position, avg_search_volume,
      sends, opens, open_rate, click_through_rate,
      days_in_month, days_with_data, data_completeness,
      mom_change_pct, mom_change_abs, is_best_month, is_worst_month,
      created_at, updated_at
    FROM with_trends
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("year_month", "STRING", year_month),
            bigquery.ScalarQueryParameter("days_in_month", "INT64", days_in_month)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()  # Wait for completion
        
        logger.info(f"✅ Successfully created monthly aggregates for {year_month}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating monthly aggregates for {year_month}: {e}")
        raise


def calculate_monthly_trends(organization_id: str):
    """
    Calculate MoM changes and best/worst month flags across all months
    Run after backfill to populate trend fields
    """
    logger.info(f"Calculating monthly trends for {organization_id}")
    
    query = f"""
    -- Update MoM trends using window functions
    MERGE `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` T
    USING (
      WITH with_lags AS (
        SELECT 
          organization_id,
          year_month,
          canonical_entity_id,
          entity_type,
          sessions,
          revenue,
          
          LAG(sessions, 1) OVER (
            PARTITION BY canonical_entity_id, entity_type 
            ORDER BY year_month
          ) as prev_month_sessions,
          
          MAX(sessions) OVER (
            PARTITION BY canonical_entity_id, entity_type
          ) as max_sessions,
          
          MIN(CASE WHEN sessions > 0 THEN sessions END) OVER (
            PARTITION BY canonical_entity_id, entity_type
          ) as min_sessions
          
        FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        WHERE organization_id = @org_id
      )
      SELECT 
        organization_id,
        year_month,
        canonical_entity_id,
        entity_type,
        SAFE_DIVIDE(sessions - prev_month_sessions, prev_month_sessions) * 100 as mom_change_pct,
        sessions - prev_month_sessions as mom_change_abs,
        sessions = max_sessions as is_best_month,
        sessions = min_sessions AND sessions > 0 as is_worst_month
      FROM with_lags
    ) S
    ON T.organization_id = S.organization_id
      AND T.year_month = S.year_month
      AND T.canonical_entity_id = S.canonical_entity_id
      AND T.entity_type = S.entity_type
    WHEN MATCHED THEN
      UPDATE SET 
        mom_change_pct = S.mom_change_pct,
        mom_change_abs = S.mom_change_abs,
        is_best_month = S.is_best_month,
        is_worst_month = S.is_worst_month,
        updated_at = CURRENT_TIMESTAMP()
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        result = job.result()
        
        logger.info(f"✅ Successfully calculated monthly trends")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error calculating monthly trends: {e}")
        raise


@functions_framework.http
def run_monthly_rollup(request):
    """
    HTTP Cloud Function to create monthly aggregates
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "yearMonth": "2025-10",  // optional, defaults to last month
      "backfill": true          // optional, if true processes last 4 months
    }
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    backfill = request_json.get('backfill', False)
    
    try:
        if backfill:
            # Process last 4 months
            logger.info(f"🔄 Starting backfill for {organization_id} (last 4 months)")
            
            current_date = datetime.now()
            months_processed = []
            
            for i in range(4, 0, -1):  # Process 4 months ago to 1 month ago
                target_date = current_date - timedelta(days=30 * i)
                year_month = target_date.strftime('%Y-%m')
                
                create_monthly_aggregates(organization_id, year_month)
                months_processed.append(year_month)
            
            # Also process current month (partial)
            current_month = current_date.strftime('%Y-%m')
            create_monthly_aggregates(organization_id, current_month)
            months_processed.append(current_month)
            
            logger.info(f"✅ Backfill complete! Processed: {', '.join(months_processed)}")
            
            # Calculate trends across all months
            logger.info("Calculating monthly trends...")
            calculate_monthly_trends(organization_id)
            
            return {
                'success': True,
                'organization_id': organization_id,
                'mode': 'backfill',
                'months_processed': months_processed,
                'total_months': len(months_processed),
                'trends_calculated': True
            }, 200
            
        else:
            # Process single month
            if 'yearMonth' in request_json:
                year_month = request_json['yearMonth']
            else:
                # Default to last month
                last_month = datetime.now() - timedelta(days=30)
                year_month = last_month.strftime('%Y-%m')
            
            logger.info(f"🔄 Processing {year_month} for {organization_id}")
            
            create_monthly_aggregates(organization_id, year_month)
            
            return {
                'success': True,
                'organization_id': organization_id,
                'year_month': year_month,
                'mode': 'single_month'
            }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running monthly rollup: {e}")
        return {'error': str(e)}, 500
