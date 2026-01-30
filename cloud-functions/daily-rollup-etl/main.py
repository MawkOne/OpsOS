"""
Daily Rollup ETL - Aggregates Firestore data to BigQuery daily_entity_metrics

Aggregates:
1. Email campaigns from ActiveCampaign
2. Pages with device dimensions from GA4
3. Pages with funnel events from GA4
4. Traffic sources from GA4
5. Paid campaigns from GA4
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
from collections import defaultdict
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
        
        # Get date range (yesterday by default)
        days_back = request_json.get('daysBack', 7) if request_json else 7
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days_back)
        
        logger.info(f"🚀 Starting daily rollup for org {organization_id}")
        logger.info(f"📅 Date range: {start_date} to {end_date}")
        
        all_rows = []
        
        # 1. Aggregate email campaigns from ActiveCampaign
        email_rows = aggregate_email_campaigns(organization_id, start_date, end_date)
        logger.info(f"📧 Email campaigns: {len(email_rows)} rows")
        all_rows.extend(email_rows)
        
        # 2. Aggregate page metrics with device dimension
        page_device_rows = aggregate_page_device_metrics(organization_id, start_date, end_date)
        logger.info(f"📱 Page device metrics: {len(page_device_rows)} rows")
        all_rows.extend(page_device_rows)
        
        # 3. Aggregate page performance with funnel events
        page_funnel_rows = aggregate_page_funnel_metrics(organization_id, start_date, end_date)
        logger.info(f"🛒 Page funnel metrics: {len(page_funnel_rows)} rows")
        all_rows.extend(page_funnel_rows)
        
        # 4. Create traffic source entities
        traffic_rows = aggregate_traffic_sources(organization_id, start_date, end_date)
        logger.info(f"🚦 Traffic sources: {len(traffic_rows)} rows")
        all_rows.extend(traffic_rows)
        
        # Insert to BigQuery
        if all_rows:
            upsert_to_bigquery(all_rows, organization_id, start_date, end_date)
            logger.info(f"✅ Upserted {len(all_rows)} total rows to BigQuery")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'date_range': f"{start_date} to {end_date}",
            'total_rows': len(all_rows),
            'breakdown': {
                'email': len(email_rows),
                'page_device': len(page_device_rows),
                'page_funnel': len(page_funnel_rows),
                'traffic_source': len(traffic_rows)
            }
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Daily rollup failed: {e}", exc_info=True)
        return {'error': str(e)}, 500


def aggregate_email_campaigns(org_id: str, start_date, end_date):
    """Aggregate ActiveCampaign email metrics"""
    rows = []
    
    try:
        # Query from activecampaign_campaigns collection
        docs = db.collection('activecampaign_campaigns')\
            .where('organizationId', '==', org_id)\
            .stream()
        
        # Group by campaign + date
        campaigns = {}
        for doc in docs:
            data = doc.to_dict()
            
            # Parse send date
            send_date_str = data.get('sdate', data.get('send_date'))
            if not send_date_str:
                continue
            
            try:
                # Handle different date formats
                if isinstance(send_date_str, str):
                    if 'T' in send_date_str:
                        send_date = datetime.fromisoformat(send_date_str.replace('Z', '+00:00')).date()
                    else:
                        send_date = datetime.strptime(send_date_str, '%Y-%m-%d').date()
                else:
                    continue
                    
                # Filter by date range
                if send_date < start_date or send_date > end_date:
                    continue
                    
            except (ValueError, AttributeError) as e:
                logger.warning(f"Invalid date format: {send_date_str}")
                continue
            
            campaign_id = data.get('id', doc.id)
            key = f"{campaign_id}|{send_date}"
            
            if key not in campaigns:
                campaigns[key] = {
                    'organization_id': org_id,
                    'canonical_entity_id': f"campaign_{campaign_id}",
                    'entity_type': 'email',
                    'date': send_date.isoformat(),
                    'sends': 0,
                    'opens': 0,
                    'clicks': 0,
                    'bounces': 0,
                    'unsubscribes': 0,
                    'complaints': 0
                }
            
            # Aggregate metrics
            campaigns[key]['sends'] += int(data.get('total_amt', data.get('total_sends', 0)))
            campaigns[key]['opens'] += int(data.get('uniqueopens', data.get('opens', 0)))
            campaigns[key]['clicks'] += int(data.get('uniqueclicks', data.get('clicks', 0)))
            campaigns[key]['bounces'] += int(data.get('hardbounces', 0)) + int(data.get('softbounces', 0))
            campaigns[key]['unsubscribes'] += int(data.get('unsubreasons', data.get('unsubscribes', 0)))
            campaigns[key]['complaints'] += int(data.get('complaints', 0))
        
        # Calculate rates
        for key, metrics in campaigns.items():
            if metrics['sends'] > 0:
                metrics['open_rate'] = (metrics['opens'] / metrics['sends']) * 100
                metrics['click_rate'] = (metrics['clicks'] / metrics['sends']) * 100
                metrics['bounce_rate'] = (metrics['bounces'] / metrics['sends']) * 100
            rows.append(metrics)
        
    except Exception as e:
        logger.error(f"Error aggregating email: {e}", exc_info=True)
    
    return rows


def aggregate_page_device_metrics(org_id: str, start_date, end_date):
    """Aggregate GA4 device metrics by page"""
    rows = []
    
    try:
        # Query ga_device_metrics
        docs = db.collection('ga_device_metrics')\
            .where('organizationId', '==', org_id)\
            .stream()
        
        # Group by page + date + device
        metrics_by_key = {}
        for doc in docs:
            data = doc.to_dict()
            
            # Parse date
            date_str = data.get('date')
            if not date_str:
                continue
            
            try:
                if isinstance(date_str, str):
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
                else:
                    continue
                    
                if date_obj < start_date or date_obj > end_date:
                    continue
            except:
                continue
            
            page = data.get('pagePath', '/')
            device = data.get('deviceCategory', 'desktop').lower()
            
            key = f"{page}|{date_obj}|{device}"
            
            if key not in metrics_by_key:
                metrics_by_key[key] = {
                    'organization_id': org_id,
                    'canonical_entity_id': page,
                    'entity_type': 'page',
                    'date': date_obj.isoformat(),
                    'device_type': device,
                    'sessions': 0,
                    'pageviews': 0,
                    'conversions': 0,
                    'bounce_rates': []
                }
            
            metrics_by_key[key]['sessions'] += int(data.get('sessions', 0))
            metrics_by_key[key]['pageviews'] += int(data.get('screenPageViews', 0))
            metrics_by_key[key]['conversions'] += int(data.get('conversions', 0))
            
            if data.get('bounceRate') is not None:
                metrics_by_key[key]['bounce_rates'].append(float(data['bounceRate']))
        
        # Average bounce rate and add to rows
        for key, metrics in metrics_by_key.items():
            if metrics['bounce_rates']:
                metrics['bounce_rate'] = sum(metrics['bounce_rates']) / len(metrics['bounce_rates'])
            del metrics['bounce_rates']
            rows.append(metrics)
        
    except Exception as e:
        logger.error(f"Error aggregating device metrics: {e}", exc_info=True)
    
    return rows


def aggregate_page_funnel_metrics(org_id: str, start_date, end_date):
    """Aggregate GA4 page performance with funnel events"""
    rows = []
    
    try:
        # Query ga_page_performance
        docs = db.collection('ga_page_performance')\
            .where('organizationId', '==', org_id)\
            .stream()
        
        metrics_by_key = {}
        for doc in docs:
            data = doc.to_dict()
            
            # Parse date
            date_str = data.get('date')
            if not date_str:
                continue
            
            try:
                if isinstance(date_str, str):
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
                else:
                    continue
                    
                if date_obj < start_date or date_obj > end_date:
                    continue
            except:
                continue
            
            page = data.get('pagePath', '/')
            key = f"{page}|{date_obj}"
            
            if key not in metrics_by_key:
                metrics_by_key[key] = {
                    'organization_id': org_id,
                    'canonical_entity_id': page,
                    'entity_type': 'page',
                    'date': date_obj.isoformat(),
                    'pageviews': 0,
                    'add_to_cart': 0,
                    'checkout_started': 0,
                    'purchase_completed': 0,
                    'dwell_times': [],
                    'scroll_depths': [],
                    'engagement_rates': []
                }
            
            metrics_by_key[key]['pageviews'] += int(data.get('screenPageViews', 0))
            metrics_by_key[key]['add_to_cart'] += int(data.get('addToCarts', 0))
            metrics_by_key[key]['checkout_started'] += int(data.get('checkouts', 0))
            metrics_by_key[key]['purchase_completed'] += int(data.get('purchases', 0))
            
            if data.get('dwellTime'):
                metrics_by_key[key]['dwell_times'].append(float(data['dwellTime']))
            if data.get('scrollDepth'):
                metrics_by_key[key]['scroll_depths'].append(float(data['scrollDepth']))
            if data.get('engagementRate'):
                metrics_by_key[key]['engagement_rates'].append(float(data['engagementRate']))
        
        # Average metrics
        for key, metrics in metrics_by_key.items():
            if metrics['dwell_times']:
                metrics['dwell_time'] = sum(metrics['dwell_times']) / len(metrics['dwell_times'])
            if metrics['scroll_depths']:
                metrics['scroll_depth'] = sum(metrics['scroll_depths']) / len(metrics['scroll_depths'])
            if metrics['engagement_rates']:
                metrics['engagement_rate'] = sum(metrics['engagement_rates']) / len(metrics['engagement_rates'])
            
            del metrics['dwell_times']
            del metrics['scroll_depths']
            del metrics['engagement_rates']
            rows.append(metrics)
        
    except Exception as e:
        logger.error(f"Error aggregating funnel metrics: {e}", exc_info=True)
    
    return rows


def aggregate_traffic_sources(org_id: str, start_date, end_date):
    """Aggregate GA4 traffic sources"""
    rows = []
    
    try:
        # Query ga_traffic_sources
        docs = db.collection('ga_traffic_sources')\
            .where('organizationId', '==', org_id)\
            .stream()
        
        metrics_by_key = {}
        for doc in docs:
            data = doc.to_dict()
            
            # Parse date
            date_str = data.get('date')
            if not date_str:
                continue
            
            try:
                if isinstance(date_str, str):
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
                else:
                    continue
                    
                if date_obj < start_date or date_obj > end_date:
                    continue
            except:
                continue
            
            source = data.get('source', 'direct')
            medium = data.get('medium', 'none')
            source_medium = f"{source}/{medium}"
            
            key = f"{source_medium}|{date_obj}"
            
            if key not in metrics_by_key:
                metrics_by_key[key] = {
                    'organization_id': org_id,
                    'canonical_entity_id': source_medium,
                    'entity_type': 'traffic_source',
                    'date': date_obj.isoformat(),
                    'sessions': 0,
                    'pageviews': 0,
                    'conversions': 0,
                    'revenue': 0,
                    'bounce_rates': [],
                    'engagement_rates': []
                }
            
            metrics_by_key[key]['sessions'] += int(data.get('sessions', 0))
            metrics_by_key[key]['pageviews'] += int(data.get('screenPageViews', 0))
            metrics_by_key[key]['conversions'] += int(data.get('conversions', 0))
            metrics_by_key[key]['revenue'] += float(data.get('totalRevenue', 0))
            
            if data.get('bounceRate') is not None:
                metrics_by_key[key]['bounce_rates'].append(float(data['bounceRate']))
            if data.get('engagementRate') is not None:
                metrics_by_key[key]['engagement_rates'].append(float(data['engagementRate']))
        
        # Average metrics
        for key, metrics in metrics_by_key.items():
            if metrics['bounce_rates']:
                metrics['bounce_rate'] = sum(metrics['bounce_rates']) / len(metrics['bounce_rates'])
            if metrics['engagement_rates']:
                metrics['engagement_rate'] = sum(metrics['engagement_rates']) / len(metrics['engagement_rates'])
            
            del metrics['bounce_rates']
            del metrics['engagement_rates']
            rows.append(metrics)
        
    except Exception as e:
        logger.error(f"Error aggregating traffic sources: {e}", exc_info=True)
    
    return rows


def upsert_to_bigquery(rows, org_id, start_date, end_date):
    """Upsert rows to BigQuery (delete old, insert new)"""
    
    if not rows:
        return
    
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
    
    # Add data_source to all rows for tracking
    for row in rows:
        if 'data_source' not in row:
            row['data_source'] = 'ga4_etl'
    
    # Delete existing rows for this org + date range to avoid duplicates
    # Use data_source = 'ga4_etl' to only delete rows we manage
    delete_query = f"""
    DELETE FROM `{table_ref}`
    WHERE organization_id = '{org_id}'
      AND date BETWEEN '{start_date}' AND '{end_date}'
      AND (
        data_source = 'ga4_etl'
        OR (data_source IS NULL AND (
          device_type IS NOT NULL
          OR entity_type IN ('email', 'traffic_source')
          OR add_to_cart IS NOT NULL
        ))
      )
    """
    
    try:
        delete_job = bq_client.query(delete_query)
        delete_job.result()
        deleted_count = delete_job.num_dml_affected_rows or 0
        logger.info(f"🗑️  Deleted {deleted_count} existing ETL rows for {start_date} to {end_date}")
    except Exception as e:
        logger.warning(f"Delete query warning: {e}")
    
    # Insert new rows
    errors = bq_client.insert_rows_json(table_ref, rows)
    
    if errors:
        logger.error(f"❌ Errors inserting to BigQuery: {errors[:3]}")
        raise Exception(f"BigQuery insert failed: {errors}")
    else:
        logger.info(f"✅ Successfully inserted {len(rows)} rows")
