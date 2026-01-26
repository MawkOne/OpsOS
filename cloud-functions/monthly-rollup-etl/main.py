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
        AND FORMAT_DATE('%Y-%m', m.date) = @year_month
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


def create_campaign_monthly_aggregates(organization_id: str, year_month: str):
    """
    Aggregate campaign-level performance into monthly rollups
    Covers: Google Ads campaigns, email campaigns, social campaigns
    """
    logger.info(f"Creating campaign monthly aggregates for {organization_id} - {year_month}")
    
    # Parse year_month
    year, month = year_month.split('-')
    year = int(year)
    month = int(month)
    days_in_month = calendar.monthrange(year, month)[1]
    
    query = f"""
    -- Delete existing data for this month
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.monthly_campaign_metrics`
    WHERE organization_id = @org_id
      AND year_month = @year_month;
    
    -- Insert campaign monthly aggregates
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.monthly_campaign_metrics`
    (
      organization_id, year_month, campaign_id, campaign_type, campaign_name, channel,
      impressions, clicks, sessions, conversions, revenue, cost,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      sends, opens, open_rate, click_through_rate,
      days_in_month, days_with_data, data_completeness,
      mom_change_pct, mom_change_abs, is_best_month, is_worst_month,
      created_at, updated_at
    )
    
    WITH campaign_daily AS (
      -- Get campaigns from entity metrics where entity_type = 'campaign'
      SELECT 
        organization_id,
        canonical_entity_id as campaign_id,
        'campaign' as campaign_type,
        canonical_entity_id as campaign_name,
        'paid_search' as channel, -- TODO: derive from entity metadata
        date,
        impressions, clicks, sessions, conversions, revenue, cost,
        ctr, cpc, cpa, roas, roi,
        0 as sends,
        0 as opens,
        0.0 as open_rate,
        0.0 as click_through_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'campaign'
        AND FORMAT_DATE('%Y-%m', date) = @year_month
      
      UNION ALL
      
      -- Get email campaigns
      SELECT 
        organization_id,
        canonical_entity_id as campaign_id,
        'email' as campaign_type,
        canonical_entity_id as campaign_name,
        'email' as channel,
        date,
        0 as impressions, 0 as clicks, sessions, conversions, revenue, 0.0 as cost,
        0.0 as ctr, 0.0 as cpc, 0.0 as cpa, 0.0 as roas, 0.0 as roi,
        sends,
        opens,
        open_rate,
        click_through_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'email'
        AND FORMAT_DATE('%Y-%m', date) = @year_month
    ),
    
    monthly_agg AS (
      SELECT 
        organization_id,
        @year_month as year_month,
        campaign_id,
        campaign_type,
        campaign_name,
        channel,
        
        -- Traffic totals
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SUM(revenue) as revenue,
        SUM(cost) as cost,
        
        -- Performance averages
        AVG(ctr) as avg_ctr,
        AVG(cpc) as avg_cpc,
        AVG(cpa) as avg_cpa,
        AVG(roas) as avg_roas,
        AVG(roi) as avg_roi,
        
        -- Email metrics
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
        
      FROM campaign_daily
      GROUP BY organization_id, campaign_id, campaign_type, campaign_name, channel
    )
    
    SELECT 
      organization_id, year_month, campaign_id, campaign_type, campaign_name, channel,
      impressions, clicks, sessions, conversions, revenue, cost,
      avg_ctr, avg_cpc, avg_cpa, avg_roas, avg_roi,
      sends, opens, open_rate, click_through_rate,
      days_in_month, days_with_data, data_completeness,
      NULL as mom_change_pct,  -- Will be calculated later
      NULL as mom_change_abs,
      FALSE as is_best_month,
      FALSE as is_worst_month,
      created_at, updated_at
    FROM monthly_agg
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
        job.result()
        logger.info(f"✅ Successfully created campaign monthly aggregates for {year_month}")
        return True
    except Exception as e:
        logger.error(f"❌ Error creating campaign monthly aggregates: {e}")
        raise


def create_revenue_monthly_aggregates(organization_id: str, year_month: str):
    """
    Aggregate revenue, transactions, and subscription metrics into monthly rollups
    """
    logger.info(f"Creating revenue monthly aggregates for {organization_id} - {year_month}")
    
    query = f"""
    -- Delete existing data for this month
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.monthly_revenue_metrics`
    WHERE organization_id = @org_id
      AND year_month = @year_month;
    
    -- Insert revenue monthly aggregates
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.monthly_revenue_metrics`
    (
      organization_id, year_month,
      total_revenue, new_revenue, recurring_revenue, refunds, refund_rate, net_revenue,
      total_conversions, total_transactions, avg_order_value, revenue_per_session,
      mrr, arr, new_subscriptions, churned_subscriptions, churn_rate,
      expansion_revenue, contraction_revenue, net_mrr_change,
      mom_revenue_change_pct, mom_revenue_change_abs, mom_mrr_change_pct, mom_conversions_change_pct,
      is_best_month, is_worst_month,
      created_at, updated_at
    )
    
    WITH daily_revenue AS (
      SELECT 
        date,
        SUM(revenue) as revenue,
        SUM(conversions) as conversions,
        SUM(sessions) as sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND FORMAT_DATE('%Y-%m', date) = @year_month
      GROUP BY date
    ),
    
    monthly_agg AS (
      SELECT 
        @org_id as organization_id,
        @year_month as year_month,
        
        -- Revenue totals (we don't have new vs recurring split yet)
        SUM(revenue) as total_revenue,
        NULL as new_revenue,
        NULL as recurring_revenue,
        NULL as refunds,
        NULL as refund_rate,
        SUM(revenue) as net_revenue,
        
        -- Conversions
        SUM(conversions) as total_conversions,
        SUM(conversions) as total_transactions,  -- Assume 1:1 for now
        SAFE_DIVIDE(SUM(revenue), SUM(conversions)) as avg_order_value,
        SAFE_DIVIDE(SUM(revenue), SUM(sessions)) as revenue_per_session,
        
        -- Subscription metrics (not available yet)
        NULL as mrr,
        NULL as arr,
        NULL as new_subscriptions,
        NULL as churned_subscriptions,
        NULL as churn_rate,
        NULL as expansion_revenue,
        NULL as contraction_revenue,
        NULL as net_mrr_change,
        
        -- Trends (will calculate later)
        NULL as mom_revenue_change_pct,
        NULL as mom_revenue_change_abs,
        NULL as mom_mrr_change_pct,
        NULL as mom_conversions_change_pct,
        FALSE as is_best_month,
        FALSE as is_worst_month,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM daily_revenue
    )
    
    SELECT * FROM monthly_agg
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("year_month", "STRING", year_month)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()
        logger.info(f"✅ Successfully created revenue monthly aggregates for {year_month}")
        return True
    except Exception as e:
        logger.error(f"❌ Error creating revenue monthly aggregates: {e}")
        raise


def create_funnel_monthly_aggregates(organization_id: str, year_month: str):
    """
    Aggregate funnel stage metrics by channel into monthly rollups
    """
    logger.info(f"Creating funnel monthly aggregates for {organization_id} - {year_month}")
    
    query = f"""
    -- Delete existing data for this month
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.monthly_funnel_metrics`
    WHERE organization_id = @org_id
      AND year_month = @year_month;
    
    -- Insert funnel monthly aggregates
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.monthly_funnel_metrics`
    (
      organization_id, year_month, channel, source,
      visits, signups, trials, purchases, total_revenue,
      visit_to_signup_rate, signup_to_trial_rate, trial_to_paid_rate,
      overall_conversion_rate, avg_revenue_per_visitor, avg_revenue_per_customer,
      mom_visits_change_pct, mom_conversion_change_pct, mom_revenue_change_pct,
      is_best_month,
      created_at, updated_at
    )
    
    WITH daily_funnel AS (
      -- Aggregate by channel from entity metrics
      -- We use sessions as "visits", conversions as "purchases"
      -- TODO: When you have actual funnel events, enhance this
      SELECT 
        'organic' as channel,
        'seo' as source,
        SUM(CASE WHEN entity_type = 'page' THEN sessions ELSE 0 END) as visits,
        NULL as signups,  -- Not available yet
        NULL as trials,   -- Not available yet
        SUM(conversions) as purchases,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND FORMAT_DATE('%Y-%m', date) = @year_month
      
      UNION ALL
      
      SELECT 
        'paid' as channel,
        'paid_search' as source,
        SUM(CASE WHEN entity_type = 'campaign' THEN sessions ELSE 0 END) as visits,
        NULL as signups,
        NULL as trials,
        SUM(conversions) as purchases,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'campaign'
        AND FORMAT_DATE('%Y-%m', date) = @year_month
      
      UNION ALL
      
      SELECT 
        'email' as channel,
        'email' as source,
        SUM(CASE WHEN entity_type = 'email' THEN sessions ELSE 0 END) as visits,
        NULL as signups,
        NULL as trials,
        SUM(conversions) as purchases,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'email'
        AND FORMAT_DATE('%Y-%m', date) = @year_month
    ),
    
    monthly_agg AS (
      SELECT 
        @org_id as organization_id,
        @year_month as year_month,
        channel,
        source,
        
        -- Funnel stages
        SUM(visits) as visits,
        SUM(signups) as signups,
        SUM(trials) as trials,
        SUM(purchases) as purchases,
        SUM(total_revenue) as total_revenue,
        
        -- Conversion rates
        SAFE_DIVIDE(SUM(signups), SUM(visits)) * 100 as visit_to_signup_rate,
        SAFE_DIVIDE(SUM(trials), SUM(signups)) * 100 as signup_to_trial_rate,
        SAFE_DIVIDE(SUM(purchases), SUM(trials)) * 100 as trial_to_paid_rate,
        SAFE_DIVIDE(SUM(purchases), SUM(visits)) * 100 as overall_conversion_rate,
        
        -- Revenue metrics
        SAFE_DIVIDE(SUM(total_revenue), SUM(visits)) as avg_revenue_per_visitor,
        SAFE_DIVIDE(SUM(total_revenue), SUM(purchases)) as avg_revenue_per_customer,
        
        -- Trends (will calculate later)
        NULL as mom_visits_change_pct,
        NULL as mom_conversion_change_pct,
        NULL as mom_revenue_change_pct,
        FALSE as is_best_month,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM daily_funnel
      GROUP BY channel, source
    )
    
    SELECT * FROM monthly_agg
    WHERE visits > 0  -- Only include channels with actual traffic
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("year_month", "STRING", year_month)
        ]
    )
    
    try:
        job = bq_client.query(query, job_config=job_config)
        job.result()
        logger.info(f"✅ Successfully created funnel monthly aggregates for {year_month}")
        return True
    except Exception as e:
        logger.error(f"❌ Error creating funnel monthly aggregates: {e}")
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
                
                # Process all 4 monthly aggregate tables
                create_monthly_aggregates(organization_id, year_month)
                create_campaign_monthly_aggregates(organization_id, year_month)
                create_revenue_monthly_aggregates(organization_id, year_month)
                create_funnel_monthly_aggregates(organization_id, year_month)
                months_processed.append(year_month)
            
            # Also process current month (partial)
            current_month = current_date.strftime('%Y-%m')
            create_monthly_aggregates(organization_id, current_month)
            create_campaign_monthly_aggregates(organization_id, current_month)
            create_revenue_monthly_aggregates(organization_id, current_month)
            create_funnel_monthly_aggregates(organization_id, current_month)
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
            
            # Process all 4 monthly aggregate tables
            create_monthly_aggregates(organization_id, year_month)
            create_campaign_monthly_aggregates(organization_id, year_month)
            create_revenue_monthly_aggregates(organization_id, year_month)
            create_funnel_monthly_aggregates(organization_id, year_month)
            
            return {
                'success': True,
                'organization_id': organization_id,
                'year_month': year_month,
                'mode': 'single_month'
            }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running monthly rollup: {e}")
        return {'error': str(e)}, 500
