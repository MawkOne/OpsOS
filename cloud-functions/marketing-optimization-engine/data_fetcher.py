"""
Data Fetcher Module
Fetches marketing data from BigQuery and builds unified feature matrix
"""

from google.cloud import bigquery
import pandas as pd
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


def fetch_marketing_data(org_id: str, lookback_days: int = 90) -> pd.DataFrame:
    """
    Fetch all marketing data from BigQuery and build unified monthly feature matrix
    
    Args:
        org_id: Organization ID to filter data
        lookback_days: Number of days to look back
    
    Returns:
        DataFrame with monthly aggregates and all marketing features
    """
    
    client = bigquery.Client(project='opsos-864a1')
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=lookback_days)
    
    logger.info(f"Fetching data from {start_date.date()} to {end_date.date()}")
    
    # Build the unified query - UNION queries for each month
    query = f"""
    WITH ga_events_monthly AS (
      -- GA Events - extract each month separately
      SELECT '2025-10' as month, 
        JSON_VALUE(data, '$.eventName') as event_name,
        CAST(JSON_VALUE(data, '$.months."2025-10".events') AS INT64) as events,
        CAST(JSON_VALUE(data, '$.months."2025-10".revenue') AS FLOAT64) as revenue
      FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2025-10".events') IS NOT NULL
      
      UNION ALL
      
      SELECT '2025-11' as month,
        JSON_VALUE(data, '$.eventName') as event_name,
        CAST(JSON_VALUE(data, '$.months."2025-11".events') AS INT64) as events,
        CAST(JSON_VALUE(data, '$.months."2025-11".revenue') AS FLOAT64) as revenue
      FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2025-11".events') IS NOT NULL
      
      UNION ALL
      
      SELECT '2025-12' as month,
        JSON_VALUE(data, '$.eventName') as event_name,
        CAST(JSON_VALUE(data, '$.months."2025-12".events') AS INT64) as events,
        CAST(JSON_VALUE(data, '$.months."2025-12".revenue') AS FLOAT64) as revenue
      FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2025-12".events') IS NOT NULL
      
      UNION ALL
      
      SELECT '2026-01' as month,
        JSON_VALUE(data, '$.eventName') as event_name,
        CAST(JSON_VALUE(data, '$.months."2026-01".events') AS INT64) as events,
        CAST(JSON_VALUE(data, '$.months."2026-01".revenue') AS FLOAT64) as revenue
      FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2026-01".events') IS NOT NULL
    ),
    
    ga_events_aggregated AS (
      SELECT
        month,
        SUM(CASE WHEN event_name = 'page_view' THEN events ELSE 0 END) as page_views,
        SUM(CASE WHEN event_name = 'session_start' THEN events ELSE 0 END) as sessions,
        SUM(CASE WHEN event_name = 'first_visit' THEN events ELSE 0 END) as new_users,
        SUM(CASE WHEN event_name = 'user_engagement' THEN events ELSE 0 END) as engaged_users,
        SUM(CASE WHEN event_name = 'view_search_results' THEN events ELSE 0 END) as search_usage,
        SUM(CASE WHEN event_name = 'feed-scrolled' THEN events ELSE 0 END) as feed_scrolls,
        SUM(CASE WHEN event_name = 'form_start' THEN events ELSE 0 END) as form_starts,
        SUM(CASE WHEN event_name = 'form_submit' THEN events ELSE 0 END) as form_submits,
        SUM(CASE WHEN event_name = 'video_start' THEN events ELSE 0 END) as video_starts,
        SUM(CASE WHEN event_name = 'video_complete' THEN events ELSE 0 END) as video_completes,
        SUM(CASE WHEN event_name LIKE 'paywall-%' THEN events ELSE 0 END) as paywall_hits,
        SUM(CASE WHEN event_name = 'talent-signup' THEN events ELSE 0 END) as talent_signups,
        SUM(CASE WHEN event_name = 'company-signup' THEN events ELSE 0 END) as company_signups,
        SUM(CASE WHEN event_name = 'purchase' THEN events ELSE 0 END) as purchases,
        SUM(CASE WHEN event_name = 'purchase' THEN revenue ELSE 0 END) as revenue
      FROM ga_events_monthly
      GROUP BY month
    ),
    
    ga_traffic_raw AS (
      -- GA Traffic Sources - UNION for each month
      SELECT '2025-10' as month,
        JSON_VALUE(data, '$.source') as source,
        CAST(JSON_VALUE(data, '$.months."2025-10".users') AS INT64) as users,
        CAST(JSON_VALUE(data, '$.months."2025-10".conversions') AS INT64) as conversions
      FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2025-10".users') IS NOT NULL
      
      UNION ALL
      
      SELECT '2025-11' as month,
        JSON_VALUE(data, '$.source') as source,
        CAST(JSON_VALUE(data, '$.months."2025-11".users') AS INT64) as users,
        CAST(JSON_VALUE(data, '$.months."2025-11".conversions') AS INT64) as conversions
      FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2025-11".users') IS NOT NULL
      
      UNION ALL
      
      SELECT '2025-12' as month,
        JSON_VALUE(data, '$.source') as source,
        CAST(JSON_VALUE(data, '$.months."2025-12".users') AS INT64) as users,
        CAST(JSON_VALUE(data, '$.months."2025-12".conversions') AS INT64) as conversions
      FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2025-12".users') IS NOT NULL
      
      UNION ALL
      
      SELECT '2026-01' as month,
        JSON_VALUE(data, '$.source') as source,
        CAST(JSON_VALUE(data, '$.months."2026-01".users') AS INT64) as users,
        CAST(JSON_VALUE(data, '$.months."2026-01".conversions') AS INT64) as conversions
      FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`
      WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        AND JSON_VALUE(data, '$.months."2026-01".users') IS NOT NULL
    ),
    
    ga_traffic_monthly AS (
      -- Aggregate traffic sources
      SELECT
        month,
        SUM(CASE WHEN source = 'organic' THEN users ELSE 0 END) as organic_users,
        SUM(CASE WHEN source = 'organic' THEN conversions ELSE 0 END) as organic_conversions,
        SUM(CASE WHEN source = 'direct' THEN users ELSE 0 END) as direct_users,
        SUM(CASE WHEN source = 'referral' THEN users ELSE 0 END) as referral_users,
        SUM(CASE WHEN source LIKE '%paid%' OR source LIKE '%cpc%' THEN users ELSE 0 END) as paid_users,
        SUM(CASE WHEN source LIKE '%social%' THEN users ELSE 0 END) as social_users
      FROM ga_traffic_raw
      GROUP BY month
    ),
    
    email_campaigns_monthly AS (
      -- ActiveCampaign aggregated by month
      SELECT
        FORMAT_DATE('%Y-%m', sent_date) as month,
        COUNT(*) as email_campaigns_sent,
        SUM(send_amt) as total_emails_sent,
        SUM(unique_opens) as total_opens,
        SUM(unique_link_clicks) as total_clicks,
        SUM(unsubscribes) as total_unsubscribes,
        AVG(SAFE_DIVIDE(unique_opens, send_amt)) as avg_open_rate,
        AVG(SAFE_DIVIDE(unique_link_clicks, unique_opens)) as avg_ctr
      FROM (
        SELECT
          DATE(TIMESTAMP_SECONDS(CAST(JSON_VALUE(data, '$.sentAt._seconds') AS INT64))) as sent_date,
          CAST(JSON_VALUE(data, '$.sendAmt') AS INT64) as send_amt,
          CAST(JSON_VALUE(data, '$.uniqueOpens') AS INT64) as unique_opens,
          CAST(JSON_VALUE(data, '$.uniqueLinkClicks') AS INT64) as unique_link_clicks,
          CAST(JSON_VALUE(data, '$.unsubscribes') AS INT64) as unsubscribes
        FROM `opsos-864a1.firestore_export.activecampaign_campaigns_raw_latest`
        WHERE JSON_VALUE(data, '$.organizationId') = @org_id
          AND JSON_VALUE(data, '$.sentAt._seconds') IS NOT NULL
      )
      GROUP BY month
    )
    
    -- Combine all sources
    SELECT
      COALESCE(e.month, t.month, c.month) as month,
      
      -- GA Events
      COALESCE(e.page_views, 0) as page_views,
      COALESCE(e.sessions, 0) as sessions,
      COALESCE(e.new_users, 0) as new_users,
      COALESCE(e.engaged_users, 0) as engaged_users,
      COALESCE(e.search_usage, 0) as search_usage,
      COALESCE(e.feed_scrolls, 0) as feed_scrolls,
      COALESCE(e.form_starts, 0) as form_starts,
      COALESCE(e.form_submits, 0) as form_submits,
      COALESCE(e.video_starts, 0) as video_starts,
      COALESCE(e.video_completes, 0) as video_completes,
      COALESCE(e.paywall_hits, 0) as paywall_hits,
      COALESCE(e.talent_signups, 0) as talent_signups,
      COALESCE(e.company_signups, 0) as company_signups,
      COALESCE(e.purchases, 0) as purchases,
      COALESCE(e.revenue, 0) as revenue,
      
      -- Calculated metrics from GA
      SAFE_DIVIDE(e.engaged_users, e.sessions) as engagement_rate,
      SAFE_DIVIDE(e.form_submits, e.form_starts) as form_completion_rate,
      SAFE_DIVIDE(e.video_completes, e.video_starts) as video_completion_rate,
      
      -- GA Traffic Sources
      COALESCE(t.organic_users, 0) as organic_users,
      COALESCE(t.organic_conversions, 0) as organic_conversions,
      COALESCE(t.direct_users, 0) as direct_users,
      COALESCE(t.referral_users, 0) as referral_users,
      COALESCE(t.paid_users, 0) as paid_users,
      COALESCE(t.social_users, 0) as social_users,
      SAFE_DIVIDE(t.organic_conversions, t.organic_users) as organic_conversion_rate,
      
      -- Email Campaigns
      COALESCE(c.email_campaigns_sent, 0) as email_campaigns_sent,
      COALESCE(c.total_emails_sent, 0) as total_emails_sent,
      COALESCE(c.total_opens, 0) as total_opens,
      COALESCE(c.total_clicks, 0) as total_clicks,
      COALESCE(c.total_unsubscribes, 0) as total_unsubscribes,
      COALESCE(c.avg_open_rate, 0) as email_open_rate,
      COALESCE(c.avg_ctr, 0) as email_ctr,
      
      -- Target variable (total signups)
      COALESCE(e.talent_signups, 0) + COALESCE(e.company_signups, 0) as signups
      
    FROM ga_events_aggregated e
    FULL OUTER JOIN ga_traffic_monthly t ON e.month = t.month
    FULL OUTER JOIN email_campaigns_monthly c ON COALESCE(e.month, t.month) = c.month
    
    WHERE COALESCE(e.month, t.month, c.month) IS NOT NULL
    ORDER BY month DESC
    LIMIT {lookback_days // 30 + 1}
    """
    
    # Execute query
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", org_id)
        ]
    )
    
    logger.info("Executing BigQuery query...")
    df = client.query(query, job_config=job_config).to_dataframe()
    
    # Clean up
    df = df.sort_values('month').reset_index(drop=True)
    
    # Fill NaN values with 0
    df = df.fillna(0)
    
    # Add derived features
    df = add_derived_features(df)
    
    logger.info(f"✅ Fetched {len(df)} rows with {len(df.columns)} columns")
    logger.info(f"Date range: {df['month'].min()} to {df['month'].max()}")
    
    return df


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add calculated features that might be useful for analysis"""
    
    # Conversion rates
    if 'sessions' in df.columns and 'signups' in df.columns:
        df['signup_conversion_rate'] = df['signups'] / df['sessions'].replace(0, 1)
    
    # Traffic quality score (engagement * conversion)
    if 'engagement_rate' in df.columns and 'signup_conversion_rate' in df.columns:
        df['traffic_quality_score'] = df['engagement_rate'] * df['signup_conversion_rate']
    
    # Email effectiveness
    if 'email_open_rate' in df.columns and 'email_ctr' in df.columns:
        df['email_effectiveness'] = df['email_open_rate'] * df['email_ctr']
    
    # Video engagement score
    if 'video_starts' in df.columns and 'video_completion_rate' in df.columns:
        df['video_engagement_score'] = (df['video_starts'] / df['sessions'].replace(0, 1)) * df['video_completion_rate']
    
    # Friction score (negative indicator)
    if 'paywall_hits' in df.columns and 'sessions' in df.columns:
        df['paywall_friction_rate'] = df['paywall_hits'] / df['sessions'].replace(0, 1)
    
    if 'form_starts' in df.columns and 'form_submits' in df.columns:
        df['form_abandonment_rate'] = 1 - (df['form_submits'] / df['form_starts'].replace(0, 1))
    
    # Trend features (month-over-month change)
    for col in ['page_views', 'sessions', 'signups', 'email_open_rate']:
        if col in df.columns:
            df[f'{col}_mom_change'] = df[col].pct_change()
    
    return df
