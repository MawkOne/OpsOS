"""
GA4 Raw BigQuery Export to Daily Metrics Sync

Reads from GA4 raw BigQuery export tables (analytics_XXXXX.events_*) 
and aggregates to daily_entity_metrics. No API credentials needed.

This provides:
- Daily website_traffic with conversions, engagement_rate
- Daily traffic_source breakdown
- Daily page performance
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import json

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
GA4_DATASET = "analytics_301802672"  # Raw GA4 export dataset (in northamerica-northeast1)
GA4_LOCATION = "northamerica-northeast1"
TARGET_DATASET = "marketing_ai"  # (in US)
TARGET_TABLE = "daily_entity_metrics"


@functions_framework.http
def sync_ga4_raw_to_metrics(request):
    """Sync GA4 raw export data to daily_entity_metrics"""
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True) or {}
    organization_id = request_json.get('organizationId', 'SBjucW1ztDyFYWBz7ZLE')
    sync_mode = request_json.get('mode', 'update')
    
    # Date range support
    explicit_start = request_json.get('startDate')
    explicit_end = request_json.get('endDate')
    days_back = request_json.get('daysBack', 30 if sync_mode == 'update' else 365)
    
    if explicit_start and explicit_end:
        start_date = datetime.strptime(explicit_start, '%Y-%m-%d').date()
        end_date = datetime.strptime(explicit_end, '%Y-%m-%d').date()
    else:
        end_date = datetime.utcnow().date() - timedelta(days=1)  # Yesterday (today's data may be incomplete)
        start_date = end_date - timedelta(days=days_back)
    
    logger.info(f"🚀 Starting GA4 Raw → Metrics sync: {start_date} to {end_date} (mode={sync_mode})")
    
    try:
        # Two clients: one for GA4 region, one for target region
        bq_ga4 = bigquery.Client(location=GA4_LOCATION)
        bq_us = bigquery.Client(location="US")
        
        results = {
            'website_traffic_rows': 0,
            'traffic_source_rows': 0,
            'page_rows': 0,
            'google_ads_aggregate_rows': 0,
            'google_ads_campaign_rows': 0,
        }
        
        target_table = f"{PROJECT_ID}.{TARGET_DATASET}.{TARGET_TABLE}"
        now_iso = datetime.utcnow().isoformat()
        
        # Format dates for GA4 table suffix
        start_suffix = start_date.strftime('%Y%m%d')
        end_suffix = end_date.strftime('%Y%m%d')
        
        # ============================================
        # 1. WEBSITE_TRAFFIC (daily aggregate)
        # ============================================
        logger.info("Aggregating website_traffic from raw GA4...")
        
        website_query = f"""
        WITH daily_sessions AS (
            SELECT
                PARSE_DATE('%Y%m%d', event_date) as date,
                COUNT(DISTINCT CONCAT(user_pseudo_id, 
                    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'))) as sessions,
                COUNT(DISTINCT user_pseudo_id) as users,
                COUNTIF(event_name = 'page_view') as pageviews,
                COUNTIF(event_name = 'first_visit') as new_users,
                -- Conversions: count signup events
                COUNTIF(event_name LIKE 'ads_conversion%' OR event_name = 'talent-signup') as conversions,
                -- Revenue (if e-commerce)
                SUM(CASE WHEN event_name = 'purchase' THEN 
                    (SELECT COALESCE(value.double_value, value.int_value) FROM UNNEST(event_params) WHERE key = 'value')
                    ELSE 0 END) as revenue,
                -- Engagement: sessions with user_engagement event
                COUNT(DISTINCT CASE WHEN event_name = 'user_engagement' THEN 
                    CONCAT(user_pseudo_id, (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'))
                    END) as engaged_sessions
            FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
            WHERE _TABLE_SUFFIX BETWEEN '{start_suffix}' AND '{end_suffix}'
            GROUP BY event_date
        )
        SELECT
            '{organization_id}' as organization_id,
            FORMAT_DATE('%Y-%m-%d', date) as date,
            CONCAT('ga4_daily_', FORMAT_DATE('%Y-%m-%d', date)) as canonical_entity_id,
            'website_traffic' as entity_type,
            users,
            sessions,
            pageviews,
            conversions,
            CASE WHEN sessions > 0 THEN ROUND(conversions / sessions * 100, 2) ELSE 0 END as conversion_rate,
            revenue,
            CASE WHEN sessions > 0 THEN ROUND(engaged_sessions / sessions * 100, 2) ELSE 0 END as engagement_rate,
            CASE WHEN sessions > 0 THEN ROUND(pageviews / sessions, 2) ELSE 0 END as pages_per_session
        FROM daily_sessions
        ORDER BY date
        """
        
        # Delete existing data for the date range (in US region)
        if sync_mode == 'full':
            delete_query = f"""
            DELETE FROM `{target_table}`
            WHERE organization_id = '{organization_id}'
              AND entity_type = 'website_traffic'
              AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
            """
            bq_us.query(delete_query).result()
            logger.info("Deleted existing website_traffic data")
        
        # Query GA4 in its region, then stream insert to US
        try:
            ga4_result = bq_ga4.query(website_query).result()
            website_rows = []
            for row in ga4_result:
                website_rows.append({
                    'organization_id': row.organization_id,
                    'date': row.date,
                    'canonical_entity_id': row.canonical_entity_id,
                    'entity_type': row.entity_type,
                    'users': row.users,
                    'sessions': row.sessions,
                    'pageviews': row.pageviews,
                    'conversions': row.conversions,
                    'conversion_rate': row.conversion_rate,
                    'revenue': row.revenue,
                    'engagement_rate': row.engagement_rate,
                    'pages_per_session': row.pages_per_session,
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            if website_rows:
                errors = bq_us.insert_rows_json(target_table, website_rows, skip_invalid_rows=True)
                if errors:
                    logger.warning(f"Website traffic insert errors: {errors[:3]}")
                results['website_traffic_rows'] = len(website_rows)
                logger.info(f"Inserted {len(website_rows)} website_traffic rows")
        except Exception as e:
            logger.error(f"Website traffic error: {e}")
        
        # ============================================
        # 2. TRAFFIC_SOURCE (daily by source/medium)
        # ============================================
        logger.info("Aggregating traffic_source from raw GA4...")
        
        source_query = f"""
        WITH source_sessions AS (
            SELECT
                PARSE_DATE('%Y%m%d', event_date) as date,
                IFNULL(traffic_source.source, '(direct)') as source,
                IFNULL(traffic_source.medium, '(none)') as medium,
                IFNULL((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_default_channel_group'), 
                       'Direct') as channel,
                COUNT(DISTINCT CONCAT(user_pseudo_id, 
                    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'))) as sessions,
                COUNT(DISTINCT user_pseudo_id) as users,
                COUNTIF(event_name LIKE 'ads_conversion%' OR event_name = 'talent-signup') as conversions,
                SUM(CASE WHEN event_name = 'purchase' THEN 
                    (SELECT COALESCE(value.double_value, value.int_value) FROM UNNEST(event_params) WHERE key = 'value')
                    ELSE 0 END) as revenue
            FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
            WHERE _TABLE_SUFFIX BETWEEN '{start_suffix}' AND '{end_suffix}'
            GROUP BY event_date, source, medium, channel
        )
        SELECT
            '{organization_id}' as organization_id,
            FORMAT_DATE('%Y-%m-%d', date) as date,
            CONCAT('ga4_source_', FORMAT_DATE('%Y-%m-%d', date), '_', 
                   REGEXP_REPLACE(channel, r'[^a-zA-Z0-9]', '_'), '_',
                   REGEXP_REPLACE(source, r'[^a-zA-Z0-9]', '_'), '_',
                   REGEXP_REPLACE(medium, r'[^a-zA-Z0-9]', '_')) as canonical_entity_id,
            'traffic_source' as entity_type,
            users,
            sessions,
            conversions,
            CASE WHEN sessions > 0 THEN ROUND(conversions / sessions * 100, 2) ELSE 0 END as conversion_rate,
            revenue,
            channel,
            source,
            medium
        FROM source_sessions
        WHERE sessions > 0
        ORDER BY date, sessions DESC
        """
        
        if sync_mode == 'full':
            delete_source = f"""
            DELETE FROM `{target_table}`
            WHERE organization_id = '{organization_id}'
              AND entity_type = 'traffic_source'
              AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
            """
            bq_us.query(delete_source).result()
        
        try:
            ga4_result = bq_ga4.query(source_query).result()
            source_rows = []
            for row in ga4_result:
                source_rows.append({
                    'organization_id': row.organization_id,
                    'date': row.date,
                    'canonical_entity_id': row.canonical_entity_id,
                    'entity_type': row.entity_type,
                    'users': row.users,
                    'sessions': row.sessions,
                    'conversions': row.conversions,
                    'conversion_rate': row.conversion_rate,
                    'revenue': row.revenue,
                    'source_breakdown': json.dumps({
                        'channel': row.channel,
                        'source_medium': f"{row.source} / {row.medium}",
                        'name': f"{row.channel} - {row.source} / {row.medium}",
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            if source_rows:
                # Insert in batches
                BATCH_SIZE = 500
                for i in range(0, len(source_rows), BATCH_SIZE):
                    batch = source_rows[i:i + BATCH_SIZE]
                    errors = bq_us.insert_rows_json(target_table, batch, skip_invalid_rows=True)
                    if errors:
                        logger.warning(f"Traffic source batch {i//BATCH_SIZE + 1} errors: {len(errors)}")
                
                results['traffic_source_rows'] = len(source_rows)
                logger.info(f"Inserted {len(source_rows)} traffic_source rows")
        except Exception as e:
            logger.error(f"Traffic source error: {e}")
        
        # ============================================
        # 3. PAGE (daily by page path)
        # ============================================
        logger.info("Aggregating page performance from raw GA4...")
        
        page_query = f"""
        WITH page_metrics AS (
            SELECT
                PARSE_DATE('%Y%m%d', event_date) as date,
                (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') as page_url,
                (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') as page_title,
                COUNT(*) as pageviews,
                COUNT(DISTINCT user_pseudo_id) as users,
                COUNT(DISTINCT CONCAT(user_pseudo_id, 
                    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'))) as sessions,
                COUNTIF(event_name LIKE 'ads_conversion%' OR event_name = 'talent-signup') as conversions
            FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
            WHERE _TABLE_SUFFIX BETWEEN '{start_suffix}' AND '{end_suffix}'
              AND event_name = 'page_view'
            GROUP BY event_date, page_url, page_title
        )
        SELECT
            '{organization_id}' as organization_id,
            FORMAT_DATE('%Y-%m-%d', date) as date,
            CONCAT('page_', FORMAT_DATE('%Y-%m-%d', date), '_', 
                   SUBSTR(REGEXP_REPLACE(IFNULL(page_url, '/'), r'[^a-zA-Z0-9/]', '_'), 1, 150)) as canonical_entity_id,
            'page' as entity_type,
            pageviews,
            users,
            sessions,
            conversions,
            CASE WHEN sessions > 0 THEN ROUND(conversions / sessions * 100, 2) ELSE 0 END as conversion_rate,
            page_url,
            page_title
        FROM page_metrics
        WHERE pageviews >= 5  -- Filter low-traffic pages
        ORDER BY date, pageviews DESC
        """
        
        if sync_mode == 'full':
            delete_pages = f"""
            DELETE FROM `{target_table}`
            WHERE organization_id = '{organization_id}'
              AND entity_type = 'page'
              AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
            """
            bq_us.query(delete_pages).result()
        
        try:
            ga4_result = bq_ga4.query(page_query).result()
            page_rows = []
            for row in ga4_result:
                page_rows.append({
                    'organization_id': row.organization_id,
                    'date': row.date,
                    'canonical_entity_id': row.canonical_entity_id,
                    'entity_type': row.entity_type,
                    'pageviews': row.pageviews,
                    'users': row.users,
                    'sessions': row.sessions,
                    'conversions': row.conversions,
                    'conversion_rate': row.conversion_rate,
                    'source_breakdown': json.dumps({
                        'page_path': row.page_url[:500] if row.page_url else '/',
                        'page_title': row.page_title[:200] if row.page_title else '',
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            if page_rows:
                # Insert in batches
                BATCH_SIZE = 500
                for i in range(0, len(page_rows), BATCH_SIZE):
                    batch = page_rows[i:i + BATCH_SIZE]
                    errors = bq_us.insert_rows_json(target_table, batch, skip_invalid_rows=True)
                    if errors:
                        logger.warning(f"Page batch {i//BATCH_SIZE + 1} errors: {len(errors)}")
                
                results['page_rows'] = len(page_rows)
                logger.info(f"Inserted {len(page_rows)} page rows")
        except Exception as e:
            logger.error(f"Page error: {e}")
        
        # ============================================
        # 4. GOOGLE ADS AGGREGATE (account-level conversions/revenue)
        # ============================================
        logger.info("Extracting Google Ads aggregate metrics from raw GA4...")
        
        # First, get aggregate account-level metrics (conversions/revenue are not campaign-attributed in GA4)
        aggregate_query = f"""
        WITH google_ads_aggregate AS (
            SELECT
                PARSE_DATE('%Y%m%d', event_date) as date,
                COUNT(DISTINCT CONCAT(user_pseudo_id, 
                    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'))) as sessions,
                COUNT(DISTINCT user_pseudo_id) as users,
                COUNTIF(event_name LIKE 'ads_conversion%' OR event_name = 'talent-signup') as conversions,
                SUM(CASE WHEN event_name = 'purchase' THEN 
                    (SELECT COALESCE(value.double_value, value.int_value) FROM UNNEST(event_params) WHERE key = 'value')
                    ELSE 0 END) as revenue
            FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
            WHERE _TABLE_SUFFIX BETWEEN '{start_suffix}' AND '{end_suffix}'
              AND traffic_source.source = 'google'
              AND traffic_source.medium IN ('cpc', 'ppc', 'paidsearch')
            GROUP BY event_date
        )
        SELECT
            '{organization_id}' as organization_id,
            FORMAT_DATE('%Y-%m-%d', date) as date,
            CONCAT('google_ads_', FORMAT_DATE('%Y-%m-%d', date)) as canonical_entity_id,
            'ad_account' as entity_type,
            users,
            sessions,
            conversions,
            CASE WHEN sessions > 0 THEN ROUND(conversions / sessions * 100, 2) ELSE 0 END as conversion_rate,
            revenue
        FROM google_ads_aggregate
        WHERE sessions > 0
        ORDER BY date DESC
        """
        
        if sync_mode == 'full':
            delete_aggregate = f"""
            DELETE FROM `{target_table}`
            WHERE organization_id = '{organization_id}'
              AND entity_type = 'ad_account'
              AND canonical_entity_id LIKE 'google_ads_%'
              AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
            """
            bq_us.query(delete_aggregate).result()
        
        try:
            ga4_result = bq_ga4.query(aggregate_query).result()
            aggregate_rows = []
            for row in ga4_result:
                aggregate_rows.append({
                    'organization_id': row.organization_id,
                    'date': row.date,
                    'canonical_entity_id': row.canonical_entity_id,
                    'entity_type': row.entity_type,
                    'users': row.users,
                    'sessions': row.sessions,
                    'conversions': row.conversions,
                    'conversion_rate': row.conversion_rate,
                    'revenue': row.revenue,
                    'source_breakdown': json.dumps({
                        'source': 'Google Ads (from GA4)',
                        'type': 'aggregate'
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            if aggregate_rows:
                errors = bq_us.insert_rows_json(target_table, aggregate_rows, skip_invalid_rows=True)
                if errors:
                    logger.warning(f"Google Ads aggregate insert errors: {errors[:3]}")
                
                results['google_ads_aggregate_rows'] = len(aggregate_rows)
                logger.info(f"Inserted {len(aggregate_rows)} google_ads_aggregate rows")
        except Exception as e:
            logger.error(f"Google Ads aggregate error: {e}")
        
        # ============================================
        # 5. GOOGLE ADS CAMPAIGNS (session-level only, no conversions)
        # ============================================
        logger.info("Extracting Google Ads campaigns from raw GA4...")
        
        campaign_query = f"""
        WITH campaign_sessions AS (
            SELECT
                PARSE_DATE('%Y%m%d', event_date) as date,
                (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign') as campaign_name,
                COUNT(DISTINCT CONCAT(user_pseudo_id, 
                    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'))) as sessions,
                COUNT(DISTINCT user_pseudo_id) as users,
                COUNTIF(event_name LIKE 'ads_conversion%' OR event_name = 'talent-signup') as conversions,
                SUM(CASE WHEN event_name = 'purchase' THEN 
                    (SELECT COALESCE(value.double_value, value.int_value) FROM UNNEST(event_params) WHERE key = 'value')
                    ELSE 0 END) as revenue
            FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
            WHERE _TABLE_SUFFIX BETWEEN '{start_suffix}' AND '{end_suffix}'
              AND traffic_source.source = 'google'
              AND traffic_source.medium IN ('cpc', 'ppc', 'paidsearch')
            GROUP BY event_date, campaign_name
        )
        SELECT
            '{organization_id}' as organization_id,
            FORMAT_DATE('%Y-%m-%d', date) as date,
            CONCAT('gads_campaign_', FORMAT_DATE('%Y-%m-%d', date), '_', 
                   REGEXP_REPLACE(IFNULL(campaign_name, 'unknown'), r'[^a-zA-Z0-9]', '_')) as canonical_entity_id,
            'google_ads_campaign' as entity_type,
            users,
            sessions,
            conversions,
            CASE WHEN sessions > 0 THEN ROUND(conversions / sessions * 100, 2) ELSE 0 END as conversion_rate,
            revenue,
            IFNULL(campaign_name, '(not set)') as campaign_name,
            CASE 
                WHEN campaign_name LIKE '%PMax%' THEN 'Performance Max'
                WHEN campaign_name LIKE '%Search%' THEN 'Search'
                ELSE 'Other'
            END as campaign_type
        FROM campaign_sessions
        WHERE sessions > 0
        ORDER BY date, sessions DESC
        """
        
        if sync_mode == 'full':
            delete_campaigns = f"""
            DELETE FROM `{target_table}`
            WHERE organization_id = '{organization_id}'
              AND entity_type = 'google_ads_campaign'
              AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
            """
            bq_us.query(delete_campaigns).result()
        
        try:
            ga4_result = bq_ga4.query(campaign_query).result()
            campaign_rows = []
            for row in ga4_result:
                campaign_rows.append({
                    'organization_id': row.organization_id,
                    'date': row.date,
                    'canonical_entity_id': row.canonical_entity_id,
                    'entity_type': row.entity_type,
                    'users': row.users,
                    'sessions': row.sessions,
                    'conversions': row.conversions,
                    'conversion_rate': row.conversion_rate,
                    'revenue': row.revenue,
                    'source_breakdown': json.dumps({
                        'campaign_name': row.campaign_name,
                        'campaign_type': row.campaign_type,
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            if campaign_rows:
                # Insert in batches
                BATCH_SIZE = 500
                for i in range(0, len(campaign_rows), BATCH_SIZE):
                    batch = campaign_rows[i:i + BATCH_SIZE]
                    errors = bq_us.insert_rows_json(target_table, batch, skip_invalid_rows=True)
                    if errors:
                        logger.warning(f"Campaign batch {i//BATCH_SIZE + 1} errors: {len(errors)}")
                
                results['google_ads_campaign_rows'] = len(campaign_rows)
                logger.info(f"Inserted {len(campaign_rows)} google_ads_campaign rows")
        except Exception as e:
            logger.error(f"Google Ads campaign error: {e}")
        
        # Results already counted during insertion
        
        logger.info(f"✅ GA4 Raw sync complete: {results}")
        
        return ({
            'success': True,
            **results,
            'date_range': f"{start_date.isoformat()} to {end_date.isoformat()}",
            'message': f"Synced GA4 raw data to daily_entity_metrics"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ GA4 Raw sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        return ({
            'success': False,
            'error': str(e)
        }, 500, headers)
