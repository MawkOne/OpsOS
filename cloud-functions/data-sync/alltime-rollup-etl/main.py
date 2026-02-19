"""
All-Time Rollup ETL
Aggregates monthly_entity_metrics into alltime_entity_metrics (entire history)
Part of the hierarchical aggregation: daily → weekly → monthly → L12M → all-time

KEY: All-time aggregates from MONTHLY data, not daily
This provides structural baselines and historical context
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"


def create_alltime_aggregates(organization_id: str, as_of_date: datetime = None):
    """
    Aggregate all monthly metrics into all-time metrics
    as_of_date: The reference date (defaults to today)
    
    All-time includes all months from the first data point to the most recent complete month
    """
    if as_of_date is None:
        as_of_date = datetime.now()
    
    as_of_date_str = as_of_date.strftime('%Y-%m-%d')
    
    logger.info(f"Creating all-time aggregates for {organization_id} (as of {as_of_date_str})")
    
    query = f"""
    -- First, delete existing data for this as_of_date to allow re-processing
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.alltime_entity_metrics`
    WHERE organization_id = @org_id
      AND as_of_date = @as_of_date;
    
    -- Then insert fresh all-time aggregates from monthly data
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.alltime_entity_metrics`
    (
      organization_id, as_of_date, first_month, last_month,
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
      sessions_p10, sessions_p25, sessions_p50, sessions_p75, sessions_p90,
      best_month, best_month_sessions, best_month_revenue,
      worst_month, worst_month_sessions, worst_month_revenue,
      trend_direction, trend_pct_change,
      total_months, months_with_data, data_span_months,
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
        m.sends, m.opens, m.open_rate, m.click_through_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
    ),
    
    -- Calculate first 12 months vs last 12 months for trend
    entity_months AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        year_month,
        sessions,
        revenue,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id, entity_type ORDER BY year_month ASC) as month_rank_asc,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id, entity_type ORDER BY year_month DESC) as month_rank_desc,
        COUNT(*) OVER (PARTITION BY canonical_entity_id, entity_type) as total_months
      FROM monthly_data
    ),
    
    -- First 12 months aggregate
    first_12_months AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(sessions) as first_year_sessions
      FROM entity_months
      WHERE month_rank_asc <= 12
      GROUP BY canonical_entity_id, entity_type
    ),
    
    -- Last 12 months aggregate  
    last_12_months AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(sessions) as last_year_sessions
      FROM entity_months
      WHERE month_rank_desc <= 12
      GROUP BY canonical_entity_id, entity_type
    ),
    
    trends AS (
      SELECT 
        f.canonical_entity_id,
        f.entity_type,
        f.first_year_sessions,
        l.last_year_sessions,
        SAFE_DIVIDE(l.last_year_sessions - f.first_year_sessions, f.first_year_sessions) * 100 as trend_pct_change,
        CASE 
          WHEN SAFE_DIVIDE(l.last_year_sessions - f.first_year_sessions, f.first_year_sessions) > 0.1 THEN 'up'
          WHEN SAFE_DIVIDE(l.last_year_sessions - f.first_year_sessions, f.first_year_sessions) < -0.1 THEN 'down'
          ELSE 'stable'
        END as trend_direction
      FROM first_12_months f
      JOIN last_12_months l
        ON f.canonical_entity_id = l.canonical_entity_id
        AND f.entity_type = l.entity_type
    ),
    
    -- Find best and worst months per entity
    ranked_months AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        year_month,
        sessions,
        revenue,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id, entity_type ORDER BY sessions DESC) as best_rank,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id, entity_type ORDER BY sessions ASC) as worst_rank
      FROM monthly_data
      WHERE sessions > 0
    ),
    
    best_months AS (
      SELECT 
        canonical_entity_id, entity_type, 
        year_month as best_month, 
        sessions as best_month_sessions,
        revenue as best_month_revenue
      FROM ranked_months WHERE best_rank = 1
    ),
    
    worst_months AS (
      SELECT 
        canonical_entity_id, entity_type, 
        year_month as worst_month, 
        sessions as worst_month_sessions,
        revenue as worst_month_revenue
      FROM ranked_months WHERE worst_rank = 1
    ),
    
    -- Calculate percentiles for each entity
    percentiles AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        APPROX_QUANTILES(sessions, 100)[OFFSET(10)] as sessions_p10,
        APPROX_QUANTILES(sessions, 100)[OFFSET(25)] as sessions_p25,
        APPROX_QUANTILES(sessions, 100)[OFFSET(50)] as sessions_p50,
        APPROX_QUANTILES(sessions, 100)[OFFSET(75)] as sessions_p75,
        APPROX_QUANTILES(sessions, 100)[OFFSET(90)] as sessions_p90
      FROM monthly_data
      GROUP BY canonical_entity_id, entity_type
    ),
    
    alltime_agg AS (
      SELECT 
        organization_id,
        DATE(@as_of_date) as as_of_date,
        MIN(year_month) as first_month,
        MAX(year_month) as last_month,
        canonical_entity_id,
        entity_type,
        
        -- Traffic totals (sum of all months)
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
        COUNT(DISTINCT year_month) as total_months,
        COUNTIF(sessions > 0) as months_with_data,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM monthly_data
      GROUP BY organization_id, canonical_entity_id, entity_type
    ),
    
    -- Calculate data span in months
    with_span AS (
      SELECT 
        a.*,
        DATE_DIFF(
          DATE(CONCAT(a.last_month, '-01')), 
          DATE(CONCAT(a.first_month, '-01')), 
          MONTH
        ) + 1 as data_span_months
      FROM alltime_agg a
    )
    
    SELECT 
      w.organization_id, w.as_of_date, w.first_month, w.last_month,
      w.canonical_entity_id, w.entity_type,
      w.impressions, w.clicks, w.sessions, w.users, w.pageviews,
      w.avg_session_duration, w.avg_bounce_rate, w.avg_engagement_rate,
      w.conversions, w.conversion_rate, w.revenue, w.cost, w.profit,
      w.avg_ctr, w.avg_cpc, w.avg_cpa, w.avg_roas, w.avg_roi,
      w.avg_position, w.avg_search_volume,
      w.sends, w.opens, w.open_rate, w.click_through_rate,
      w.avg_monthly_sessions, w.avg_monthly_revenue, w.avg_monthly_conversions,
      w.sessions_stddev, w.revenue_stddev,
      w.sessions_min, w.sessions_max, w.revenue_min, w.revenue_max,
      p.sessions_p10, p.sessions_p25, p.sessions_p50, p.sessions_p75, p.sessions_p90,
      b.best_month, b.best_month_sessions, b.best_month_revenue,
      wst.worst_month, wst.worst_month_sessions, wst.worst_month_revenue,
      t.trend_direction, t.trend_pct_change,
      w.total_months, w.months_with_data, w.data_span_months,
      w.created_at, w.updated_at
    FROM with_span w
    LEFT JOIN trends t 
      ON w.canonical_entity_id = t.canonical_entity_id 
      AND w.entity_type = t.entity_type
    LEFT JOIN percentiles p
      ON w.canonical_entity_id = p.canonical_entity_id 
      AND w.entity_type = p.entity_type
    LEFT JOIN best_months b 
      ON w.canonical_entity_id = b.canonical_entity_id 
      AND w.entity_type = b.entity_type
    LEFT JOIN worst_months wst 
      ON w.canonical_entity_id = wst.canonical_entity_id 
      AND w.entity_type = wst.entity_type
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("as_of_date", "DATE", as_of_date.date())
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()  # Wait for completion
        
        logger.info(f"✅ Successfully created all-time aggregates for {as_of_date_str}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating all-time aggregates: {e}")
        raise


@functions_framework.http
def run_alltime_rollup(request):
    """
    HTTP Cloud Function to create all-time aggregates
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "asOfDate": "2025-01-31"  // optional, defaults to today
    }
    
    Note: All-time should be run daily to keep the snapshot current
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
        
        logger.info(f"🔄 Creating all-time aggregates for {organization_id} (as of {as_of_date.strftime('%Y-%m-%d')})")
        
        create_alltime_aggregates(organization_id, as_of_date)
        
        return {
            'success': True,
            'organization_id': organization_id,
            'as_of_date': as_of_date.strftime('%Y-%m-%d')
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running all-time rollup: {e}")
        return {'error': str(e)}, 500
