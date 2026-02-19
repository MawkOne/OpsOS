"""
Weekly Rollup ETL
Aggregates daily_entity_metrics into weekly_entity_metrics (ISO week: Mon-Sun)
Part of the hierarchical aggregation: daily → weekly → monthly → L12M → all-time
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"


def get_iso_week_dates(year: int, week: int):
    """
    Get the start (Monday) and end (Sunday) dates for an ISO week
    """
    # ISO week 1 is the week containing January 4th
    jan4 = datetime(year, 1, 4)
    # Find the Monday of week 1
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    # Calculate the Monday of the target week
    target_monday = week1_monday + timedelta(weeks=week - 1)
    target_sunday = target_monday + timedelta(days=6)
    return target_monday.date(), target_sunday.date()


def create_weekly_aggregates(organization_id: str, year_week: str):
    """
    Aggregate daily metrics into weekly metrics for a specific ISO week
    year_week format: "2025-W05"
    """
    logger.info(f"Creating weekly aggregates for {organization_id} - {year_week}")
    
    # Parse year_week (e.g., "2025-W05")
    year, week_str = year_week.split('-W')
    year = int(year)
    week = int(week_str)
    
    week_start, week_end = get_iso_week_dates(year, week)
    
    query = f"""
    -- First, delete existing data for this week to allow re-processing
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.weekly_entity_metrics`
    WHERE organization_id = @org_id
      AND year_week = @year_week;
    
    -- Then insert fresh weekly aggregates
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.weekly_entity_metrics`
    (
      organization_id, year_week, week_start_date, week_end_date,
      canonical_entity_id, entity_type,
      impressions, clicks, sessions, users, pageviews,
      avg_session_duration, avg_bounce_rate, avg_engagement_rate,
      conversions, conversion_rate, revenue, cost, profit,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      avg_position, avg_search_volume,
      sends, opens, open_rate, click_through_rate,
      days_in_week, days_with_data, data_completeness,
      wow_change_pct, wow_change_abs, is_best_week, is_worst_week,
      created_at, updated_at
    )
    
    WITH daily_data AS (
      SELECT 
        m.organization_id,
        m.canonical_entity_id,
        m.entity_type,
        m.date,
        m.impressions, m.clicks, m.sessions, m.users, m.pageviews,
        m.avg_session_duration, m.bounce_rate, m.engagement_rate,
        m.conversions, m.conversion_rate, m.revenue, m.cost, m.profit,
        m.ctr, m.cpc, m.cpa, m.roas, m.roi,
        m.position, m.search_volume,
        m.sends, m.opens, m.open_rate, m.click_through_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= @week_start
        AND m.date <= @week_end
    ),
    
    weekly_agg AS (
      SELECT 
        organization_id,
        @year_week as year_week,
        @week_start as week_start_date,
        @week_end as week_end_date,
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
        
        -- Data quality
        7 as days_in_week,
        COUNT(DISTINCT date) as days_with_data,
        CAST(COUNT(DISTINCT date) AS FLOAT64) / 7 as data_completeness,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM daily_data
      GROUP BY organization_id, canonical_entity_id, entity_type
    )
    
    SELECT 
      organization_id, year_week, week_start_date, week_end_date,
      canonical_entity_id, entity_type,
      impressions, clicks, sessions, users, pageviews,
      avg_session_duration, avg_bounce_rate, avg_engagement_rate,
      conversions, conversion_rate, revenue, cost, profit,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      avg_position, avg_search_volume,
      sends, opens, open_rate, click_through_rate,
      days_in_week, days_with_data, data_completeness,
      NULL as wow_change_pct,  -- Will be calculated via update
      NULL as wow_change_abs,
      FALSE as is_best_week,
      FALSE as is_worst_week,
      created_at, updated_at
    FROM weekly_agg
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("year_week", "STRING", year_week),
            bigquery.ScalarQueryParameter("week_start", "DATE", week_start),
            bigquery.ScalarQueryParameter("week_end", "DATE", week_end)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()  # Wait for completion
        
        logger.info(f"✅ Successfully created weekly aggregates for {year_week}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating weekly aggregates for {year_week}: {e}")
        raise


def calculate_weekly_trends(organization_id: str):
    """
    Calculate WoW changes and best/worst week flags across all weeks
    Run after backfill to populate trend fields
    """
    logger.info(f"Calculating weekly trends for {organization_id}")
    
    query = f"""
    -- Update WoW trends using window functions
    MERGE `{PROJECT_ID}.{DATASET_ID}.weekly_entity_metrics` T
    USING (
      WITH with_lags AS (
        SELECT 
          organization_id,
          year_week,
          canonical_entity_id,
          entity_type,
          sessions,
          revenue,
          
          LAG(sessions, 1) OVER (
            PARTITION BY canonical_entity_id, entity_type 
            ORDER BY week_start_date
          ) as prev_week_sessions,
          
          MAX(sessions) OVER (
            PARTITION BY canonical_entity_id, entity_type
          ) as max_sessions,
          
          MIN(CASE WHEN sessions > 0 THEN sessions END) OVER (
            PARTITION BY canonical_entity_id, entity_type
          ) as min_sessions
          
        FROM `{PROJECT_ID}.{DATASET_ID}.weekly_entity_metrics`
        WHERE organization_id = @org_id
      )
      SELECT 
        organization_id,
        year_week,
        canonical_entity_id,
        entity_type,
        SAFE_DIVIDE(sessions - prev_week_sessions, prev_week_sessions) * 100 as wow_change_pct,
        sessions - prev_week_sessions as wow_change_abs,
        sessions = max_sessions as is_best_week,
        sessions = min_sessions AND sessions > 0 as is_worst_week
      FROM with_lags
    ) S
    ON T.organization_id = S.organization_id
      AND T.year_week = S.year_week
      AND T.canonical_entity_id = S.canonical_entity_id
      AND T.entity_type = S.entity_type
    WHEN MATCHED THEN
      UPDATE SET 
        wow_change_pct = S.wow_change_pct,
        wow_change_abs = S.wow_change_abs,
        is_best_week = S.is_best_week,
        is_worst_week = S.is_worst_week,
        updated_at = CURRENT_TIMESTAMP()
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()
        
        logger.info(f"✅ Successfully calculated weekly trends")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error calculating weekly trends: {e}")
        raise


def get_iso_week_string(date: datetime) -> str:
    """Convert a date to ISO week string format (e.g., '2025-W05')"""
    iso_cal = date.isocalendar()
    return f"{iso_cal[0]}-W{iso_cal[1]:02d}"


@functions_framework.http
def run_weekly_rollup(request):
    """
    HTTP Cloud Function to create weekly aggregates
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "yearWeek": "2025-W05",  // optional, defaults to last week
      "backfill": true         // optional, if true processes last 8 weeks
    }
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    backfill = request_json.get('backfill', False)
    
    try:
        if backfill:
            # Process last 8 weeks
            logger.info(f"🔄 Starting backfill for {organization_id} (last 8 weeks)")
            
            current_date = datetime.now()
            weeks_processed = []
            
            for i in range(8, 0, -1):  # Process 8 weeks ago to 1 week ago
                target_date = current_date - timedelta(weeks=i)
                year_week = get_iso_week_string(target_date)
                
                create_weekly_aggregates(organization_id, year_week)
                weeks_processed.append(year_week)
            
            # Also process current week (partial)
            current_week = get_iso_week_string(current_date)
            create_weekly_aggregates(organization_id, current_week)
            weeks_processed.append(current_week)
            
            logger.info(f"✅ Backfill complete! Processed: {', '.join(weeks_processed)}")
            
            # Calculate trends across all weeks
            logger.info("Calculating weekly trends...")
            calculate_weekly_trends(organization_id)
            
            return {
                'success': True,
                'organization_id': organization_id,
                'mode': 'backfill',
                'weeks_processed': weeks_processed,
                'total_weeks': len(weeks_processed),
                'trends_calculated': True
            }, 200
            
        else:
            # Process single week
            if 'yearWeek' in request_json:
                year_week = request_json['yearWeek']
            else:
                # Default to last week
                last_week = datetime.now() - timedelta(weeks=1)
                year_week = get_iso_week_string(last_week)
            
            logger.info(f"🔄 Processing {year_week} for {organization_id}")
            
            create_weekly_aggregates(organization_id, year_week)
            
            return {
                'success': True,
                'organization_id': organization_id,
                'year_week': year_week,
                'mode': 'single_week'
            }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running weekly rollup: {e}")
        return {'error': str(e)}, 500
