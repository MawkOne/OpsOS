"""
Daily Rollup ETL - Aggregates Firestore data to BigQuery daily_entity_metrics

This function:
1. Reads GA4 device metrics, page performance, and events from Firestore
2. Aggregates to page-level daily metrics
3. Inserts into BigQuery daily_entity_metrics table
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'
TABLE_ID = 'daily_entity_metrics'

db = firestore.Client()
bq_client = bigquery.Client()

@functions_framework.http
def run_daily_rollup(request):
    """Aggregate Firestore data to BigQuery daily metrics"""
    
    try:
        request_json = request.get_json(silent=True)
        organization_id = request_json.get('organizationId') if request_json else None
        
        if not organization_id:
            return {'error': 'organizationId required'}, 400
        
        # Get date range (yesterday by default, or from request)
        days_back = request_json.get('daysBack', 1) if request_json else 1
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days_back)
        
        logger.info(f"Starting daily rollup for org {organization_id}, {start_date} to {end_date}")
        
        # Aggregate device metrics
        device_rows = aggregate_device_metrics(organization_id, start_date, end_date)
        logger.info(f"Aggregated {len(device_rows)} device metric rows")
        
        # Aggregate page performance
        performance_rows = aggregate_page_performance(organization_id, start_date, end_date)
        logger.info(f"Aggregated {len(performance_rows)} performance rows")
        
        # Merge and insert to BigQuery
        merged_rows = merge_metrics(device_rows, performance_rows)
        logger.info(f"Merged to {len(merged_rows)} total rows")
        
        if merged_rows:
            insert_to_bigquery(merged_rows)
            logger.info(f"✅ Inserted {len(merged_rows)} rows to BigQuery")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'date_range': f"{start_date} to {end_date}",
            'rows_processed': len(merged_rows),
            'device_rows': len(device_rows),
            'performance_rows': len(performance_rows)
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Daily rollup failed: {e}")
        return {'error': str(e)}, 500


def aggregate_device_metrics(org_id: str, start_date, end_date):
    """Aggregate ga_device_metrics by page and date"""
    rows = []
    
    # Query device metrics from Firestore
    docs = db.collection('ga_device_metrics')\
        .where('organizationId', '==', org_id)\
        .where('date', '>=', start_date.isoformat())\
        .where('date', '<=', end_date.isoformat())\
        .stream()
    
    # Group by page + date + device
    metrics_by_key = {}
    for doc in docs:
        data = doc.to_dict()
        page = data.get('pagePath', '/')
        date = data.get('date', start_date.isoformat())
        device = data.get('deviceCategory', 'desktop').lower()
        
        key = f"{page}|{date}|{device}"
        
        if key not in metrics_by_key:
            metrics_by_key[key] = {
                'organization_id': org_id,
                'canonical_entity_id': page,
                'entity_type': 'page',
                'date': date,
                'device_type': device,
                'sessions': 0,
                'conversions': 0,
                'pageviews': 0,
                'bounce_rate': []
            }
        
        metrics_by_key[key]['sessions'] += data.get('sessions', 0)
        metrics_by_key[key]['conversions'] += data.get('conversions', 0)
        metrics_by_key[key]['pageviews'] += data.get('screenPageViews', 0)
        
        if data.get('bounceRate') is not None:
            metrics_by_key[key]['bounce_rate'].append(data.get('bounceRate'))
    
    # Convert to rows with averaged bounce rate
    for key, metrics in metrics_by_key.items():
        if metrics['bounce_rate']:
            metrics['bounce_rate'] = sum(metrics['bounce_rate']) / len(metrics['bounce_rate'])
        else:
            metrics['bounce_rate'] = None
        rows.append(metrics)
    
    return rows


def aggregate_page_performance(org_id: str, start_date, end_date):
    """Aggregate ga_page_performance by page and date"""
    rows = []
    
    docs = db.collection('ga_page_performance')\
        .where('organizationId', '==', org_id)\
        .where('date', '>=', start_date.isoformat())\
        .where('date', '<=', end_date.isoformat())\
        .stream()
    
    metrics_by_key = {}
    for doc in docs:
        data = doc.to_dict()
        page = data.get('pagePath', '/')
        date = data.get('date', start_date.isoformat())
        
        key = f"{page}|{date}"
        
        if key not in metrics_by_key:
            metrics_by_key[key] = {
                'organization_id': org_id,
                'canonical_entity_id': page,
                'entity_type': 'page',
                'date': date,
                'pageviews': 0,
                'dwell_time': [],
                'scroll_depth': [],
                'engagement_rate': [],
                'add_to_cart': 0,
                'checkout_started': 0,
                'purchase_completed': 0
            }
        
        metrics_by_key[key]['pageviews'] += data.get('screenPageViews', 0)
        
        if data.get('dwellTime'):
            metrics_by_key[key]['dwell_time'].append(data['dwellTime'])
        if data.get('scrollDepth'):
            metrics_by_key[key]['scroll_depth'].append(data['scrollDepth'])
        if data.get('engagementRate'):
            metrics_by_key[key]['engagement_rate'].append(data['engagementRate'])
        
        # Funnel events
        metrics_by_key[key]['add_to_cart'] += data.get('addToCarts', 0)
        metrics_by_key[key]['checkout_started'] += data.get('checkouts', 0)
        metrics_by_key[key]['purchase_completed'] += data.get('purchases', 0)
    
    # Average the metrics
    for key, metrics in metrics_by_key.items():
        if metrics['dwell_time']:
            metrics['dwell_time'] = sum(metrics['dwell_time']) / len(metrics['dwell_time'])
        else:
            metrics['dwell_time'] = None
            
        if metrics['scroll_depth']:
            metrics['scroll_depth'] = sum(metrics['scroll_depth']) / len(metrics['scroll_depth'])
        else:
            metrics['scroll_depth'] = None
            
        if metrics['engagement_rate']:
            metrics['engagement_rate'] = sum(metrics['engagement_rate']) / len(metrics['engagement_rate'])
        else:
            metrics['engagement_rate'] = None
        
        rows.append(metrics)
    
    return rows


def merge_metrics(device_rows, performance_rows):
    """Merge device and performance metrics"""
    merged = {}
    
    # Add device metrics (by page + date + device)
    for row in device_rows:
        key = f"{row['canonical_entity_id']}|{row['date']}|{row.get('device_type', 'unknown')}"
        merged[key] = row
    
    # Merge performance metrics (page + date level)
    for row in performance_rows:
        # Find matching device rows and add performance data
        page = row['canonical_entity_id']
        date = row['date']
        
        for device in ['mobile', 'desktop', 'tablet']:
            key = f"{page}|{date}|{device}"
            if key in merged:
                # Add performance metrics to this device row
                merged[key]['dwell_time'] = row.get('dwell_time')
                merged[key]['scroll_depth'] = row.get('scroll_depth')
                merged[key]['engagement_rate'] = row.get('engagement_rate')
                merged[key]['add_to_cart'] = row.get('add_to_cart', 0)
                merged[key]['checkout_started'] = row.get('checkout_started', 0)
                merged[key]['purchase_completed'] = row.get('purchase_completed', 0)
    
    return list(merged.values())


def insert_to_bigquery(rows):
    """Insert rows to BigQuery, handling duplicates"""
    
    if not rows:
        return
    
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
    
    # Delete existing rows for this date range to avoid duplicates
    if rows:
        org_id = rows[0]['organization_id']
        dates = set(row['date'] for row in rows)
        
        for date in dates:
            delete_query = f"""
            DELETE FROM `{table_ref}`
            WHERE organization_id = '{org_id}'
              AND date = '{date}'
              AND device_type IS NOT NULL
            """
            bq_client.query(delete_query).result()
            logger.info(f"Deleted existing rows for {date}")
    
    # Insert new rows
    errors = bq_client.insert_rows_json(table_ref, rows)
    
    if errors:
        logger.error(f"Errors inserting to BigQuery: {errors}")
        raise Exception(f"BigQuery insert failed: {errors}")
