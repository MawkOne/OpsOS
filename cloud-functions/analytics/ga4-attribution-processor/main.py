"""
GA4 Attribution Processor
Connects GA4 purchase events to user/company IDs via payment_sessions

This Cloud Function:
1. Reads GA4 purchase events with stripe_session_id from URL parameters
2. Joins to payment_sessions table to get company_id/user_id
3. Calculates first-touch attribution using GA4 traffic_source
4. Creates attributed_revenue entities in BigQuery

NO PRODUCT CODE CHANGES REQUIRED
"""

import functions_framework
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import json
import os

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"
GA4_DATASET = "analytics_301802672"

@functions_framework.http
def process_ga4_attribution(request):
    """Process GA4 purchases and create attributed revenue entities"""
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True) or {}
    days_back = request_json.get('daysBack', 7)
    
    logger.info(f"Processing GA4 attribution for last {days_back} days")
    
    bq = bigquery.Client()
    
    # SQL to extract purchases with attribution
    attribution_query = f"""
    WITH ga4_purchases AS (
      SELECT 
        DATE(TIMESTAMP_MICROS(event_timestamp)) as purchase_date,
        user_pseudo_id,
        REGEXP_EXTRACT(
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), 
          r'sessionId=([^&]+)'
        ) as stripe_session_id,
        CAST(REGEXP_EXTRACT(
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), 
          r'jobId=([0-9]+)'
        ) AS INT64) as ga4_job_id,
        CAST(REGEXP_EXTRACT(
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), 
          r'companyId=([0-9]+)'
        ) AS INT64) as ga4_company_id,
        ecommerce.purchase_revenue as revenue,
        COALESCE(items[OFFSET(0)].item_id, 'unknown') as product_id,
        COALESCE(items[OFFSET(0)].item_name, 'unknown') as product_name,
        traffic_source.source as last_touch_source,
        traffic_source.medium as last_touch_medium,
        traffic_source.name as last_touch_campaign,
        device.category as device_category,
        geo.country as country
      FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
      WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY))
        AND event_name = 'purchase'
        AND ecommerce.purchase_revenue > 0
    ),
    first_touch AS (
      SELECT 
        user_pseudo_id,
        ARRAY_AGG(
          STRUCT(
            traffic_source.source as source,
            traffic_source.medium as medium,
            traffic_source.name as campaign,
            DATE(TIMESTAMP_MICROS(event_timestamp)) as first_visit_date
          )
          ORDER BY event_timestamp ASC
          LIMIT 1
        )[OFFSET(0)] as first_touch
      FROM `{PROJECT_ID}.{GA4_DATASET}.events_*`
      WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL {days_back + 30} DAY))
      GROUP BY user_pseudo_id
    ),
    payment_sessions AS (
      SELECT 
        JSON_EXTRACT_SCALAR(source_breakdown, '$.stripe_session_id') as stripe_session_id,
        JSON_EXTRACT_SCALAR(source_breakdown, '$.company_id') as company_id,
        JSON_EXTRACT_SCALAR(source_breakdown, '$.user_id') as user_id,
        JSON_EXTRACT_SCALAR(source_breakdown, '$.job_id') as job_id,
        JSON_EXTRACT_SCALAR(source_breakdown, '$.product') as product
      FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
      WHERE organization_id = 'ytjobs'
        AND entity_type = 'payment_session'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)
    ),
    attributed_purchases AS (
      SELECT 
        gp.*,
        ft.first_touch.source as first_touch_source,
        ft.first_touch.medium as first_touch_medium,
        ft.first_touch.campaign as first_touch_campaign,
        ft.first_touch.first_visit_date as first_visit_date,
        ps.company_id,
        ps.user_id,
        COALESCE(ps.job_id, CAST(gp.ga4_job_id AS STRING)) as job_id,
        COALESCE(ps.product, gp.product_name) as product,
        ps.stripe_session_id as matched_session_id
      FROM ga4_purchases gp
      LEFT JOIN first_touch ft ON gp.user_pseudo_id = ft.user_pseudo_id
      LEFT JOIN payment_sessions ps ON gp.stripe_session_id = ps.stripe_session_id
    ),
    daily_attribution AS (
      SELECT 
        purchase_date,
        first_touch_source,
        first_touch_medium,
        first_touch_campaign,
        last_touch_source,
        last_touch_medium,
        last_touch_campaign,
        device_category,
        COUNT(*) as purchase_count,
        SUM(revenue) as total_revenue,
        COUNT(DISTINCT user_pseudo_id) as unique_users,
        COUNT(DISTINCT company_id) as unique_companies,
        COUNT(DISTINCT CASE WHEN first_touch_medium = 'cpc' THEN user_pseudo_id END) as ppc_users,
        SUM(CASE WHEN first_touch_medium = 'cpc' THEN revenue ELSE 0 END) as ppc_revenue,
        ARRAY_AGG(
          STRUCT(
            stripe_session_id,
            company_id,
            user_id,
            job_id,
            product,
            revenue,
            first_touch_medium,
            matched_session_id
          )
        ) as purchase_details
      FROM attributed_purchases
      GROUP BY 
        purchase_date,
        first_touch_source,
        first_touch_medium,
        first_touch_campaign,
        last_touch_source,
        last_touch_medium,
        last_touch_campaign,
        device_category
    )
    SELECT 
      purchase_date as date,
      first_touch_source,
      first_touch_medium,
      first_touch_campaign,
      last_touch_source,
      last_touch_medium,
      last_touch_campaign,
      device_category,
      purchase_count,
      total_revenue,
      unique_users,
      unique_companies,
      ppc_users,
      ppc_revenue,
      TO_JSON_STRING(purchase_details) as purchase_details
    FROM daily_attribution
    ORDER BY purchase_date DESC, total_revenue DESC
    """
    
    try:
        results = []
        query_job = bq.query(attribution_query)
        
        # Wait for query to complete to get bytes processed
        query_job.result()  # This waits for completion
        
        bytes_processed = query_job.total_bytes_processed or 0
        logger.info(f"Query executed, scanned {bytes_processed / 1024 / 1024:.2f} MB")
        
        for row in query_job:
            # Create attributed revenue entity
            entity_id = f"attributed_revenue_{row['date'].isoformat()}_{row['first_touch_campaign'] or 'direct'}_{row['device_category'] or 'unknown'}"
            
            entity_row = {
                'organization_id': 'ytjobs',
                'date': row['date'].isoformat(),
                'canonical_entity_id': entity_id.replace(' ', '_').replace('/', '_')[:200],  # BigQuery limits
                'entity_type': 'attributed_revenue',
                'revenue': float(row['total_revenue'] or 0),
                'conversions': int(row['purchase_count'] or 0),
                'source_breakdown': json.dumps({
                    'first_touch_source': row['first_touch_source'],
                    'first_touch_medium': row['first_touch_medium'],
                    'first_touch_campaign': row['first_touch_campaign'],
                    'last_touch_source': row['last_touch_source'],
                    'last_touch_medium': row['last_touch_medium'],
                    'last_touch_campaign': row['last_touch_campaign'],
                    'device_category': row['device_category'],
                    'purchase_count': int(row['purchase_count'] or 0),
                    'total_revenue': float(row['total_revenue'] or 0),
                    'unique_users': int(row['unique_users'] or 0),
                    'unique_companies': int(row['unique_companies'] or 0),
                    'ppc_users': int(row['ppc_users'] or 0),
                    'ppc_revenue': float(row['ppc_revenue'] or 0),
                    'avg_order_value': float(row['total_revenue'] or 0) / int(row['purchase_count'] or 1) if (row['purchase_count'] and row['purchase_count'] > 0) else 0,
                    'purchase_details': json.loads(row['purchase_details'])
                }),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }
            results.append(entity_row)
        
        # Insert into BigQuery
        if results:
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            # Delete existing attributed revenue for this date range
            delete_query = f"""
            DELETE FROM `{table_ref}`
            WHERE organization_id = 'ytjobs'
              AND entity_type = 'attributed_revenue'
              AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)
            """
            logger.info(f"Deleting existing attributed revenue records...")
            bq.query(delete_query).result()
            
            # Insert new data
            logger.info(f"Inserting {len(results)} attributed revenue records...")
            errors = bq.insert_rows_json(table_ref, results)
            if errors:
                logger.error(f"Insert errors: {errors}")
                return ({'error': 'Failed to insert rows', 'details': errors}, 500, headers)
        
        logger.info(f"Successfully processed {len(results)} attributed revenue records")
        
        return ({
            'success': True,
            'rows_created': len(results),
            'days_processed': days_back,
            'message': f'Processed {len(results)} attributed revenue records for last {days_back} days'
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"Error processing attribution: {str(e)}", exc_info=True)
        return ({'error': str(e)}, 500, headers)
