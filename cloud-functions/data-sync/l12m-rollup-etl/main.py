"""
L12M (Last 12 Months) Rollup ETL
Aggregates monthly_entity_metrics into l12m_entity_metrics
Part of the hierarchical aggregation: daily → weekly → monthly → L12M → all-time

KEY: L12M aggregates from MONTHLY data, not daily
This provides seasonality context and yearly baseline comparisons
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime
from dateutil.relativedelta import relativedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"


def create_l12m_aggregates(organization_id: str, as_of_date: datetime = None):
    """
    Aggregate monthly metrics into L12M metrics
    as_of_date: The reference date (defaults to today)
    
    L12M includes the 12 complete months ending with the previous month
    (e.g., if today is Jan 15, 2025, L12M = Feb 2024 - Jan 2025)
    """
    if as_of_date is None:
        as_of_date = datetime.now()
    
    # Calculate the 12-month period
    # End month is the previous complete month
    end_date = as_of_date.replace(day=1) - relativedelta(days=1)
    end_month = end_date.strftime('%Y-%m')
    
    # Start month is 12 months before the end month
    start_date = end_date - relativedelta(months=11)
    start_month = start_date.strftime('%Y-%m')
    
    as_of_date_str = as_of_date.strftime('%Y-%m-%d')
    
    logger.info(f"Creating L12M aggregates for {organization_id}")
    logger.info(f"  Period: {start_month} to {end_month} (as of {as_of_date_str})")
    
    query = f"""
    -- First, delete existing data for this as_of_date to allow re-processing
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.l12m_entity_metrics`
    WHERE organization_id = @org_id
      AND as_of_date = @as_of_date;
    
    -- Then insert fresh L12M aggregates from monthly data
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.l12m_entity_metrics`
    (
      organization_id, as_of_date, period_start_month, period_end_month,
      canonical_entity_id, entity_type,
      impressions, clicks, sessions, users, pageviews,
      avg_session_duration, avg_bounce_rate, avg_engagement_rate,
      conversions, conversion_rate, revenue, cost, profit,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      avg_position, avg_search_volume,
      sends, opens, open_rate, click_through_rate,
      avg_monthly_sessions, avg_monthly_revenue, avg_monthly_conversions,
      sessions_stddev, revenue_stddev,
      sessions_min, sessions_max, revenue_min, revenue_max,
      trend_direction, trend_pct_change,
      best_month, best_month_sessions, worst_month, worst_month_sessions,
      months_with_data, data_completeness,
      created_at, updated_at
    )
    
    WITH monthly_data AS (
      SELECT 
        m.organization_id,
        m.year_month,
        m.canonical_entity_id,
        m.entity_type,
        m.impressions, m.clicks, m.sessions, m.users, m.pageviews,
        m.avg_session_duration, m.avg_bounce_rate, m.avg_engagement_rate,
        m.conversions, m.conversion_rate, m.revenue, m.cost, m.profit,
        m.avg_ctr, m.avg_cpc, m.avg_cpa, m.avg_roas, m.avg_roi,
        m.avg_position, m.avg_search_volume,
        m.sends, m.opens, m.open_rate, m.click_through_rate,
        -- Flag for first half (H1) vs second half (H2) for trend calculation
        CASE 
          WHEN m.year_month < FORMAT_DATE('%Y-%m', DATE_ADD(DATE(@start_month || '-01'), INTERVAL 6 MONTH))
          THEN 'H1' 
          ELSE 'H2' 
        END as half
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.year_month >= @start_month
        AND m.year_month <= @end_month
    ),
    
    -- Calculate H1 vs H2 for trend detection
    half_aggregates AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        half,
        SUM(sessions) as half_sessions,
        SUM(revenue) as half_revenue
      FROM monthly_data
      GROUP BY canonical_entity_id, entity_type, half
    ),
    
    trends AS (
      SELECT 
        h1.canonical_entity_id,
        h1.entity_type,
        h1.half_sessions as h1_sessions,
        h2.half_sessions as h2_sessions,
        SAFE_DIVIDE(h2.half_sessions - h1.half_sessions, h1.half_sessions) * 100 as trend_pct_change,
        CASE 
          WHEN SAFE_DIVIDE(h2.half_sessions - h1.half_sessions, h1.half_sessions) > 0.1 THEN 'up'
          WHEN SAFE_DIVIDE(h2.half_sessions - h1.half_sessions, h1.half_sessions) < -0.1 THEN 'down'
          ELSE 'stable'
        END as trend_direction
      FROM (SELECT * FROM half_aggregates WHERE half = 'H1') h1
      FULL OUTER JOIN (SELECT * FROM half_aggregates WHERE half = 'H2') h2
        ON h1.canonical_entity_id = h2.canonical_entity_id
        AND h1.entity_type = h2.entity_type
    ),
    
    -- Find best and worst months per entity
    ranked_months AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        year_month,
        sessions,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id, entity_type ORDER BY sessions DESC) as best_rank,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id, entity_type ORDER BY sessions ASC) as worst_rank
      FROM monthly_data
      WHERE sessions > 0
    ),
    
    best_months AS (
      SELECT canonical_entity_id, entity_type, year_month as best_month, sessions as best_month_sessions
      FROM ranked_months WHERE best_rank = 1
    ),
    
    worst_months AS (
      SELECT canonical_entity_id, entity_type, year_month as worst_month, sessions as worst_month_sessions
      FROM ranked_months WHERE worst_rank = 1
    ),
    
    l12m_agg AS (
      SELECT 
        organization_id,
        DATE(@as_of_date) as as_of_date,
        @start_month as period_start_month,
        @end_month as period_end_month,
        canonical_entity_id,
        entity_type,
        
        -- Traffic totals (sum of 12 months)
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(sessions) as sessions,
        SUM(users) as users,
        SUM(pageviews) as pageviews,
        
        -- Engagement averages (weighted by sessions)
        CASE 
          WHEN SUM(sessions) > 0 
          THEN SUM(avg_session_duration * sessions) / SUM(sessions)
          ELSE AVG(avg_session_duration)
        END as avg_session_duration,
        AVG(avg_bounce_rate) as avg_bounce_rate,
        AVG(avg_engagement_rate) as avg_engagement_rate,
        
        -- Conversion & revenue totals
        SUM(conversions) as conversions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as conversion_rate,
        SUM(revenue) as revenue,
        SUM(cost) as cost,
        SUM(revenue) - SUM(cost) as profit,
        
        -- Performance averages
        AVG(avg_ctr) as avg_ctr,
        AVG(avg_cpc) as avg_cpc,
        AVG(avg_cpa) as avg_cpa,
        AVG(avg_roas) as avg_roas,
        AVG(avg_roi) as avg_roi,
        
        -- SEO averages
        AVG(avg_position) as avg_position,
        CAST(AVG(avg_search_volume) AS INT64) as avg_search_volume,
        
        -- Email totals
        SUM(sends) as sends,
        SUM(opens) as opens,
        SAFE_DIVIDE(SUM(opens), SUM(sends)) * 100 as open_rate,
        SAFE_DIVIDE(SUM(clicks), SUM(sends)) * 100 as click_through_rate,
        
        -- Monthly averages
        AVG(sessions) as avg_monthly_sessions,
        AVG(revenue) as avg_monthly_revenue,
        AVG(conversions) as avg_monthly_conversions,
        
        -- Variance for anomaly detection
        STDDEV(sessions) as sessions_stddev,
        STDDEV(revenue) as revenue_stddev,
        MIN(sessions) as sessions_min,
        MAX(sessions) as sessions_max,
        MIN(revenue) as revenue_min,
        MAX(revenue) as revenue_max,
        
        -- Data quality
        COUNT(DISTINCT year_month) as months_with_data,
        CAST(COUNT(DISTINCT year_month) AS FLOAT64) / 12 as data_completeness,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM monthly_data
      GROUP BY organization_id, canonical_entity_id, entity_type
    )
    
    SELECT 
      l.organization_id, l.as_of_date, l.period_start_month, l.period_end_month,
      l.canonical_entity_id, l.entity_type,
      l.impressions, l.clicks, l.sessions, l.users, l.pageviews,
      l.avg_session_duration, l.avg_bounce_rate, l.avg_engagement_rate,
      l.conversions, l.conversion_rate, l.revenue, l.cost, l.profit,
      l.avg_ctr, l.avg_cpc, l.avg_cpa, l.avg_roas, l.avg_roi,
      l.avg_position, l.avg_search_volume,
      l.sends, l.opens, l.open_rate, l.click_through_rate,
      l.avg_monthly_sessions, l.avg_monthly_revenue, l.avg_monthly_conversions,
      l.sessions_stddev, l.revenue_stddev,
      l.sessions_min, l.sessions_max, l.revenue_min, l.revenue_max,
      t.trend_direction, t.trend_pct_change,
      b.best_month, b.best_month_sessions,
      w.worst_month, w.worst_month_sessions,
      l.months_with_data, l.data_completeness,
      l.created_at, l.updated_at
    FROM l12m_agg l
    LEFT JOIN trends t 
      ON l.canonical_entity_id = t.canonical_entity_id 
      AND l.entity_type = t.entity_type
    LEFT JOIN best_months b 
      ON l.canonical_entity_id = b.canonical_entity_id 
      AND l.entity_type = b.entity_type
    LEFT JOIN worst_months w 
      ON l.canonical_entity_id = w.canonical_entity_id 
      AND l.entity_type = w.entity_type
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("as_of_date", "DATE", as_of_date.date()),
            bigquery.ScalarQueryParameter("start_month", "STRING", start_month),
            bigquery.ScalarQueryParameter("end_month", "STRING", end_month)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()  # Wait for completion
        
        logger.info(f"✅ Successfully created L12M aggregates for {as_of_date_str}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating L12M aggregates: {e}")
        raise


@functions_framework.http
def run_l12m_rollup(request):
    """
    HTTP Cloud Function to create L12M aggregates
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "asOfDate": "2025-01-31"  // optional, defaults to today
    }
    
    Note: L12M should be run daily to keep the rolling 12-month view current
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    
    try:
        if 'asOfDate' in request_json:
            as_of_date = datetime.strptime(request_json['asOfDate'], '%Y-%m-%d')
        else:
            as_of_date = datetime.now()
        
        logger.info(f"🔄 Creating L12M aggregates for {organization_id} (as of {as_of_date.strftime('%Y-%m-%d')})")
        
        create_l12m_aggregates(organization_id, as_of_date)
        
        # Calculate the period for response
        end_date = as_of_date.replace(day=1) - relativedelta(days=1)
        end_month = end_date.strftime('%Y-%m')
        start_date = end_date - relativedelta(months=11)
        start_month = start_date.strftime('%Y-%m')
        
        return {
            'success': True,
            'organization_id': organization_id,
            'as_of_date': as_of_date.strftime('%Y-%m-%d'),
            'period': {
                'start_month': start_month,
                'end_month': end_month,
                'months': 12
            }
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running L12M rollup: {e}")
        return {'error': str(e)}, 500
