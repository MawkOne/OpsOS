"""
Google Analytics 4 Direct to BigQuery Sync Cloud Function

Calls GA4 API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for OAuth credentials.

Architecture: GA4 API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import json
import os
import requests

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')


def refresh_access_token(db, organization_id: str, connection_data: dict) -> str:
    """Refresh Google OAuth access token if expired"""
    
    access_token = connection_data.get('accessToken')
    refresh_token = connection_data.get('refreshToken')
    expiry = connection_data.get('tokenExpiresAt')
    
    # Check if token is still valid
    if expiry:
        if hasattr(expiry, 'timestamp'):
            expiry_time = expiry.timestamp()
        else:
            expiry_time = 0
        
        # If token valid for at least 5 more minutes, use it
        if expiry_time - 300 > datetime.utcnow().timestamp():
            return access_token
    
    # Token expired, refresh it
    if not refresh_token:
        raise ValueError('No refresh token available')
    
    response = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
        }
    )
    
    if not response.ok:
        raise ValueError(f'Failed to refresh token: {response.text}')
    
    token_data = response.json()
    new_access_token = token_data['access_token']
    
    # Update token in Firestore
    connection_ref = db.collection('ga_connections').document(organization_id)
    connection_ref.update({
        'accessToken': new_access_token,
        'tokenExpiresAt': datetime.utcnow() + timedelta(hours=1),
        'updatedAt': firestore.SERVER_TIMESTAMP,
    })
    
    return new_access_token


def ga4_run_report(access_token: str, property_id: str, report_request: dict) -> dict:
    """Execute GA4 Data API runReport"""
    url = f"https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"
    
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
        json=report_request
    )
    
    if not response.ok:
        logger.error(f"GA4 API error: {response.text}")
        return {}
    
    return response.json()


def ga4_run_report_paginated(access_token: str, property_id: str, report_request: dict, max_rows: int = None) -> list:
    """Execute GA4 Data API runReport with pagination to fetch ALL rows (or up to max_rows if specified)"""
    all_rows = []
    offset = 0
    limit = 10000  # GA4 max per request
    
    # Set initial limit
    report_request['limit'] = limit
    
    while True:
        if max_rows and len(all_rows) >= max_rows:
            break
            
        report_request['offset'] = offset
        
        data = ga4_run_report(access_token, property_id, report_request)
        rows = data.get('rows', [])
        
        if not rows:
            break
        
        all_rows.extend(rows)
        logger.info(f"Fetched {len(all_rows)} rows so far...")
        
        # Check if there are more rows
        row_count = int(data.get('rowCount', 0))
        if len(all_rows) >= row_count or len(rows) < limit:
            break
        
        offset += limit
    
    # Trim to max_rows if specified and exceeded
    if max_rows and len(all_rows) > max_rows:
        all_rows = all_rows[:max_rows]
    
    logger.info(f"Total rows fetched: {len(all_rows)}")
    return all_rows


@functions_framework.http
def sync_ga4_to_bigquery(request):
    """Sync GA4 data directly to BigQuery"""
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return ({'error': 'Missing organizationId'}, 400, headers)
    
    organization_id = request_json['organizationId']
    days_back = request_json.get('daysBack', 90)
    
    logger.info(f"Starting GA4 → BigQuery DIRECT sync for org: {organization_id}")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get OAuth credentials from Firestore
        connection_ref = db.collection('ga_connections').document(organization_id)
        connection_doc = connection_ref.get()
        
        if not connection_doc.exists:
            return ({'error': 'Google Analytics not connected'}, 404, headers)
        
        connection_data = connection_doc.to_dict()
        property_id = connection_data.get('selectedPropertyId')
        # Remove 'properties/' prefix if present (stored as 'properties/123456')
        if property_id and property_id.startswith('properties/'):
            property_id = property_id.replace('properties/', '')
        
        if not property_id:
            return ({'error': 'No GA4 property selected'}, 400, headers)
        
        # Update status to syncing
        connection_ref.update({'status': 'syncing', 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        # Get valid access token (refresh if needed)
        access_token = refresh_access_token(db, organization_id, connection_data)
        
        results = {
            'daily_records': 0,
            'traffic_sources': 0,
            'pages_processed': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        now_iso = datetime.utcnow().isoformat()
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days_back)
        
        # ============================================
        # 1. FETCH DAILY METRICS FROM GA4
        # ============================================
        logger.info("Fetching daily metrics from GA4 API...")
        
        try:
            daily_report = ga4_run_report(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [{'name': 'date'}],
                'metrics': [
                    {'name': 'activeUsers'},
                    {'name': 'newUsers'},
                    {'name': 'sessions'},
                    {'name': 'screenPageViews'},
                    {'name': 'averageSessionDuration'},
                    {'name': 'bounceRate'},
                    {'name': 'engagedSessions'},
                    {'name': 'totalRevenue'},
                ]
            })
            
            for row in daily_report.get('rows', []):
                results['daily_records'] += 1
                
                date_val = row['dimensionValues'][0]['value']
                # Convert YYYYMMDD to YYYY-MM-DD
                date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
                
                metrics = row['metricValues']
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"ga4_daily_{date_str}",
                    'entity_type': 'website_traffic',
                    
                    # Using correct column names from table schema
                    'users': int(metrics[0]['value']),  # activeUsers
                    'sessions': int(metrics[2]['value']),
                    'pageviews': int(metrics[3]['value']),  # screenPageViews
                    'avg_session_duration': float(metrics[4]['value']),
                    'bounce_rate': float(metrics[5]['value']),
                    'revenue': float(metrics[7]['value']),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching daily metrics: {e}")
        
        # ============================================
        # 2. FETCH TRAFFIC SOURCES (ALL - with pagination)
        # ============================================
        logger.info("Fetching ALL traffic sources from GA4 API...")
        
        try:
            # Fetch ALL traffic sources (no limit)
            source_rows = ga4_run_report_paginated(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [
                    {'name': 'sessionDefaultChannelGroup'},
                    {'name': 'sessionSourceMedium'},
                ],
                'metrics': [
                    {'name': 'sessions'},
                    {'name': 'activeUsers'},
                    {'name': 'conversions'},
                    {'name': 'totalRevenue'},
                ],
            })
            
            today_str = end_date.isoformat()
            
            for row in source_rows:
                results['traffic_sources'] += 1
                
                channel = row['dimensionValues'][0]['value']
                source_medium = row['dimensionValues'][1]['value']
                metrics = row['metricValues']
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': f"ga4_source_{channel}_{source_medium}".replace(' ', '_').replace('/', '_'),
                    'entity_type': 'traffic_source',
                    
                    # Using correct column names from table schema
                    'sessions': int(metrics[0]['value']),
                    'users': int(metrics[1]['value']),  # activeUsers
                    'conversions': int(metrics[2]['value']),
                    'revenue': float(metrics[3]['value']),
                    
                    'source_breakdown': json.dumps({
                        'channel': channel,
                        'source_medium': source_medium,
                        'name': f"{channel} - {source_medium}",  # Store name in JSON
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching traffic sources: {e}")
        
        # ============================================
        # 3. FETCH TOP PAGES (limited to manage memory)
        # ============================================
        logger.info("Fetching top pages from GA4 API...")
        
        try:
            # Fetch ALL pages (no limit)
            pages_rows = ga4_run_report_paginated(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [
                    {'name': 'pagePath'},
                    {'name': 'pageTitle'},
                ],
                'metrics': [
                    {'name': 'screenPageViews'},
                    {'name': 'activeUsers'},
                    {'name': 'averageSessionDuration'},
                    {'name': 'bounceRate'},
                ],
                'orderBys': [{'metric': {'metricName': 'screenPageViews'}, 'desc': True}],
            })
            
            today_str = end_date.isoformat()
            
            for row in pages_rows:
                results['pages_processed'] += 1
                
                page_path = row['dimensionValues'][0]['value']
                page_title = row['dimensionValues'][1]['value']
                metrics = row['metricValues']
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': page_path[:200],  # Page path as entity ID
                    'entity_type': 'page',
                    
                    # Using correct column names from table schema
                    'pageviews': int(metrics[0]['value']),  # screenPageViews
                    'users': int(metrics[1]['value']),  # activeUsers
                    'avg_session_duration': float(metrics[2]['value']),
                    'bounce_rate': float(metrics[3]['value']),
                    
                    # Store page title in source_breakdown JSON
                    'source_breakdown': json.dumps({
                        'page_path': page_path,
                        'page_title': page_title[:200] if page_title else page_path[:200],
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching pages: {e}")
        
        # ============================================
        # 4. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Inserting {len(rows)} rows directly to BigQuery...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            # Delete existing GA4 data for this org and date range
            # Using entity_type to identify GA4 data (website_traffic, traffic_source, page)
            delete_query = f"""
            DELETE FROM `{table_ref}`
            WHERE organization_id = '{organization_id}'
              AND entity_type IN ('website_traffic', 'traffic_source', 'page')
              AND date >= '{start_date.isoformat()}'
            """
            
            try:
                bq.query(delete_query).result()
                logger.info("Deleted existing GA4 data")
            except Exception as e:
                logger.warning(f"Delete query warning: {e}")
            
            # Insert new rows
            errors = bq.insert_rows_json(table_ref, rows, skip_invalid_rows=True, ignore_unknown_values=True)
            
            if errors:
                logger.warning(f"Some rows failed: {errors[:3]}")
            else:
                results['rows_inserted'] = len(rows)
        
        # Update connection status
        connection_ref.update({
            'status': 'connected',
            'lastSyncAt': firestore.SERVER_TIMESTAMP,
            'lastSyncResults': {
                'dailyRecords': results['daily_records'],
                'trafficSources': results['traffic_sources'],
                'pages': results['pages_processed'],
                'bigqueryRows': results['rows_inserted'],
            },
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
        
        logger.info(f"✅ GA4 DIRECT sync complete: {results}")
        
        return ({
            'success': True,
            **results,
            'message': f"Synced {results['rows_inserted']} rows directly to BigQuery (bypassed Firestore)"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ GA4 sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        try:
            db = firestore.Client()
            connection_ref = db.collection('ga_connections').document(organization_id)
            connection_ref.update({
                'status': 'error',
                'errorMessage': str(e),
                'updatedAt': firestore.SERVER_TIMESTAMP,
            })
        except:
            pass
        
        return ({
            'success': False,
            'error': str(e)
        }, 500, headers)
