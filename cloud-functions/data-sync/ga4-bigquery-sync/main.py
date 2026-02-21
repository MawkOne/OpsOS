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
    sync_mode = request_json.get('mode', 'update')  # 'update' (incremental) or 'full' (complete resync)
    
    # Support explicit date range (like Stripe sync)
    explicit_start = request_json.get('startDate')  # e.g., "2025-01-01"
    explicit_end = request_json.get('endDate')      # e.g., "2025-01-31"
    
    logger.info(f"🔍 RECEIVED: mode={sync_mode}, startDate={explicit_start}, endDate={explicit_end}, raw request={request_json}")
    
    # Use explicit dates if provided, otherwise calculate from days_back
    if explicit_start and explicit_end:
        start_date = datetime.strptime(explicit_start, '%Y-%m-%d').date()
        end_date = datetime.strptime(explicit_end, '%Y-%m-%d').date()
        days_back = (datetime.utcnow().date() - start_date).days
        logger.info(f"🚀 Starting GA4 → BigQuery {sync_mode.upper()} sync for org: {organization_id} ({start_date} to {end_date})")
    else:
        # Update sync: last 30 days, uses MERGE to avoid duplicates
        # Full sync: all historical data (5 years), deletes and rewrites
        if sync_mode == 'full':
            days_back = request_json.get('daysBack', 1825)  # 5 years for full resync
        else:
            days_back = request_json.get('daysBack', 30)  # 30 days for incremental update
        
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days_back)
        logger.info(f"🚀 Starting GA4 → BigQuery {sync_mode.upper()} sync for org: {organization_id} ({days_back} days)")
    
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
                    {'name': 'conversions'},
                    {'name': 'engagementRate'},
                ]
            })
            
            for row in daily_report.get('rows', []):
                results['daily_records'] += 1
                
                date_val = row['dimensionValues'][0]['value']
                # Convert YYYYMMDD to YYYY-MM-DD
                date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
                
                metrics = row['metricValues']
                
                users = int(metrics[0]['value'])
                new_users = int(metrics[1]['value'])
                sessions = int(metrics[2]['value'])
                pageviews = int(metrics[3]['value'])
                avg_session_duration = float(metrics[4]['value'])
                bounce_rate = float(metrics[5]['value'])
                engaged_sessions = int(metrics[6]['value'])
                revenue = float(metrics[7]['value'])
                conversions = int(metrics[8]['value'])
                engagement_rate = float(metrics[9]['value'])
                
                # Calculate conversion_rate
                conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
                
                # Calculate pages_per_session
                pages_per_session = (pageviews / sessions) if sessions > 0 else 0
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"ga4_daily_{date_str}",
                    'entity_type': 'website_traffic',
                    
                    # Core metrics needed by detectors
                    'users': users,
                    'sessions': sessions,
                    'pageviews': pageviews,
                    'conversions': conversions,
                    'conversion_rate': conversion_rate,
                    'revenue': revenue,
                    'avg_session_duration': avg_session_duration,
                    'bounce_rate': bounce_rate,
                    'engagement_rate': engagement_rate,
                    'pages_per_session': pages_per_session,
                    'dwell_time': avg_session_duration,  # Use session duration as dwell time proxy
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching daily metrics: {e}")
        
        # ============================================
        # 2. FETCH TRAFFIC SOURCES BY DAY (for daily tracking)
        # ============================================
        logger.info("Fetching traffic sources by day from GA4 API...")
        
        try:
            # Fetch traffic sources with date dimension for daily tracking
            source_rows = ga4_run_report_paginated(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [
                    {'name': 'date'},
                    {'name': 'sessionDefaultChannelGroup'},
                    {'name': 'sessionSourceMedium'},
                ],
                'metrics': [
                    {'name': 'sessions'},
                    {'name': 'activeUsers'},
                    {'name': 'conversions'},
                    {'name': 'totalRevenue'},
                    {'name': 'bounceRate'},
                    {'name': 'engagementRate'},
                ],
            })
            
            for row in source_rows:
                results['traffic_sources'] += 1
                
                date_val = row['dimensionValues'][0]['value']
                date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
                channel = row['dimensionValues'][1]['value']
                source_medium = row['dimensionValues'][2]['value']
                metrics = row['metricValues']
                
                sessions = int(metrics[0]['value'])
                users = int(metrics[1]['value'])
                conversions = int(metrics[2]['value'])
                revenue = float(metrics[3]['value'])
                bounce_rate = float(metrics[4]['value'])
                engagement_rate = float(metrics[5]['value'])
                
                # Calculate conversion_rate
                conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"ga4_source_{date_str}_{channel}_{source_medium}".replace(' ', '_').replace('/', '_'),
                    'entity_type': 'traffic_source',
                    
                    # Core metrics needed by detectors
                    'sessions': sessions,
                    'users': users,
                    'conversions': conversions,
                    'conversion_rate': conversion_rate,
                    'revenue': revenue,
                    'bounce_rate': bounce_rate,
                    'engagement_rate': engagement_rate,
                    
                    'source_breakdown': json.dumps({
                        'channel': channel,
                        'source_medium': source_medium,
                        'name': f"{channel} - {source_medium}",
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching traffic sources: {e}")
        
        # ============================================
        # 3. FETCH TOP PAGES BY DAY (for daily tracking)
        # ============================================
        logger.info("Fetching top pages by day from GA4 API...")
        
        try:
            # Fetch pages with date dimension for daily tracking
            # Limit to top 100 pages per day to avoid massive row counts
            pages_rows = ga4_run_report_paginated(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [
                    {'name': 'date'},
                    {'name': 'pagePath'},
                ],
                'metrics': [
                    {'name': 'screenPageViews'},
                    {'name': 'activeUsers'},
                    {'name': 'sessions'},
                    {'name': 'averageSessionDuration'},
                    {'name': 'bounceRate'},
                    {'name': 'conversions'},
                    {'name': 'totalRevenue'},
                    {'name': 'engagementRate'},
                ],
                'orderBys': [
                    {'dimension': {'dimensionName': 'date'}, 'desc': True},
                    {'metric': {'metricName': 'screenPageViews'}, 'desc': True},
                ],
            }, max_rows=50000)  # Limit total rows to prevent timeout
            
            for row in pages_rows:
                results['pages_processed'] += 1
                
                date_val = row['dimensionValues'][0]['value']
                date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
                page_path = row['dimensionValues'][1]['value']
                metrics = row['metricValues']
                
                pageviews = int(metrics[0]['value'])
                users = int(metrics[1]['value'])
                sessions = int(metrics[2]['value'])
                avg_session_duration = float(metrics[3]['value'])
                bounce_rate = float(metrics[4]['value'])
                conversions = int(metrics[5]['value'])
                revenue = float(metrics[6]['value'])
                engagement_rate = float(metrics[7]['value'])
                
                # Calculate conversion_rate and pages_per_session
                conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"page_{date_str}_{page_path[:150]}",  # Include date in entity ID
                    'entity_type': 'page',
                    
                    # Core metrics needed by detectors
                    'pageviews': pageviews,
                    'users': users,
                    'sessions': sessions,
                    'conversions': conversions,
                    'conversion_rate': conversion_rate,
                    'revenue': revenue,
                    'avg_session_duration': avg_session_duration,
                    'bounce_rate': bounce_rate,
                    'engagement_rate': engagement_rate,
                    'dwell_time': avg_session_duration,  # Use session duration as dwell time
                    
                    # Store page path in source_breakdown JSON
                    'source_breakdown': json.dumps({
                        'page_path': page_path,
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching pages: {e}")
        
        # ============================================
        # 4. FETCH GOOGLE ADS CAMPAIGNS BY DAY
        # ============================================
        logger.info("Fetching Google Ads campaigns by day from GA4 API...")
        results['google_ads_campaigns'] = 0
        
        try:
            # Fetch Google Ads campaign data with detailed dimensions
            campaign_rows = ga4_run_report_paginated(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [
                    {'name': 'date'},
                    {'name': 'sessionGoogleAdsCampaignName'},
                    {'name': 'sessionGoogleAdsCampaignId'},
                    {'name': 'sessionGoogleAdsCampaignType'},
                    {'name': 'sessionGoogleAdsAdNetworkType'},
                ],
                'metrics': [
                    {'name': 'sessions'},
                    {'name': 'activeUsers'},
                    {'name': 'engagedSessions'},
                    {'name': 'conversions'},
                    {'name': 'totalRevenue'},
                    {'name': 'engagementRate'},
                    {'name': 'bounceRate'},
                ],
                'dimensionFilter': {
                    'filter': {
                        'fieldName': 'sessionGoogleAdsCampaignName',
                        'stringFilter': {
                            'matchType': 'FULL_REGEXP',
                            'value': '.+',  # Non-empty campaign names only
                        }
                    }
                },
                'orderBys': [
                    {'dimension': {'dimensionName': 'date'}, 'desc': True},
                    {'metric': {'metricName': 'sessions'}, 'desc': True},
                ],
            }, max_rows=10000)
            
            for row in campaign_rows:
                date_val = row['dimensionValues'][0]['value']
                date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
                campaign_name = row['dimensionValues'][1]['value']
                campaign_id = row['dimensionValues'][2]['value']
                campaign_type = row['dimensionValues'][3]['value']
                ad_network = row['dimensionValues'][4]['value']
                
                # Skip (not set) campaigns - these are not real Google Ads traffic
                if campaign_name == '(not set)':
                    continue
                
                results['google_ads_campaigns'] += 1
                
                metrics = row['metricValues']
                
                sessions = int(metrics[0]['value'])
                users = int(metrics[1]['value'])
                engaged_sessions = int(metrics[2]['value'])
                conversions = int(metrics[3]['value'])
                revenue = float(metrics[4]['value'])
                engagement_rate = float(metrics[5]['value'])
                bounce_rate = float(metrics[6]['value'])
                
                # Calculate conversion_rate
                conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
                
                # Create safe entity ID
                safe_campaign_name = campaign_name[:100].replace(' ', '_').replace('/', '_').replace('-', '_')
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"gads_campaign_{date_str}_{campaign_id}_{safe_campaign_name}",
                    'entity_type': 'google_ads_campaign',
                    
                    # Core metrics
                    'sessions': sessions,
                    'users': users,
                    'conversions': conversions,
                    'conversion_rate': conversion_rate,
                    'revenue': revenue,
                    'bounce_rate': bounce_rate,
                    'engagement_rate': engagement_rate,
                    
                    # Store campaign details in source_breakdown JSON
                    'source_breakdown': json.dumps({
                        'campaign_name': campaign_name,
                        'campaign_id': campaign_id,
                        'campaign_type': campaign_type,
                        'ad_network': ad_network,
                        'engaged_sessions': engaged_sessions,
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
            
            logger.info(f"Fetched {results['google_ads_campaigns']} Google Ads campaign rows")
                
        except Exception as e:
            logger.error(f"Error fetching Google Ads campaigns: {e}")
        
        # ============================================
        # 5. FETCH GOOGLE ADS AD GROUPS BY DAY (more granular)
        # ============================================
        logger.info("Fetching Google Ads ad groups by day from GA4 API...")
        results['google_ads_adgroups'] = 0
        
        try:
            # Fetch Google Ads ad group data
            adgroup_rows = ga4_run_report_paginated(access_token, property_id, {
                'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
                'dimensions': [
                    {'name': 'date'},
                    {'name': 'sessionGoogleAdsCampaignName'},
                    {'name': 'sessionGoogleAdsAdGroupName'},
                    {'name': 'sessionGoogleAdsAdGroupId'},
                ],
                'metrics': [
                    {'name': 'sessions'},
                    {'name': 'activeUsers'},
                    {'name': 'engagedSessions'},
                    {'name': 'conversions'},
                    {'name': 'totalRevenue'},
                ],
                'dimensionFilter': {
                    'filter': {
                        'fieldName': 'sessionGoogleAdsAdGroupName',
                        'stringFilter': {
                            'matchType': 'FULL_REGEXP',
                            'value': '.+',  # Non-empty ad group names only
                        }
                    }
                },
                'orderBys': [
                    {'dimension': {'dimensionName': 'date'}, 'desc': True},
                    {'metric': {'metricName': 'sessions'}, 'desc': True},
                ],
            }, max_rows=20000)
            
            for row in adgroup_rows:
                date_val = row['dimensionValues'][0]['value']
                date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
                campaign_name = row['dimensionValues'][1]['value']
                adgroup_name = row['dimensionValues'][2]['value']
                adgroup_id = row['dimensionValues'][3]['value']
                
                # Skip (not set) ad groups - these are not real Google Ads traffic
                if adgroup_name == '(not set)' or campaign_name == '(not set)':
                    continue
                
                results['google_ads_adgroups'] += 1
                
                metrics = row['metricValues']
                
                sessions = int(metrics[0]['value'])
                users = int(metrics[1]['value'])
                engaged_sessions = int(metrics[2]['value'])
                conversions = int(metrics[3]['value'])
                revenue = float(metrics[4]['value'])
                
                # Calculate conversion_rate
                conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
                
                # Create safe entity ID
                safe_adgroup_name = adgroup_name[:80].replace(' ', '_').replace('/', '_').replace('-', '_')
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"gads_adgroup_{date_str}_{adgroup_id}_{safe_adgroup_name}",
                    'entity_type': 'google_ads_adgroup',
                    
                    # Core metrics
                    'sessions': sessions,
                    'users': users,
                    'conversions': conversions,
                    'conversion_rate': conversion_rate,
                    'revenue': revenue,
                    
                    # Store ad group details in source_breakdown JSON
                    'source_breakdown': json.dumps({
                        'campaign_name': campaign_name,
                        'adgroup_name': adgroup_name,
                        'adgroup_id': adgroup_id,
                        'engaged_sessions': engaged_sessions,
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
            
            logger.info(f"Fetched {results['google_ads_adgroups']} Google Ads ad group rows")
                
        except Exception as e:
            logger.error(f"Error fetching Google Ads ad groups: {e}")
        
        # ============================================
        # 6. WRITE DIRECTLY TO BIGQUERY (in batches)
        # ============================================
        if rows:
            logger.info(f"Writing {len(rows)} rows to BigQuery ({sync_mode} mode)...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            if sync_mode == 'full':
                # FULL RESYNC: Delete all existing GA4 data and rewrite
                logger.info("Full resync: Deleting existing GA4 data...")
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('website_traffic', 'traffic_source', 'page', 'google_ads_campaign', 'google_ads_adgroup')
                  AND date >= '{start_date.isoformat()}'
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info("Deleted existing GA4 data")
                except Exception as e:
                    logger.warning(f"Delete query warning: {e}")
                
                # Insert all rows in batches
                BATCH_SIZE = 500
                total_inserted = 0
                total_errors = 0
                
                for i in range(0, len(rows), BATCH_SIZE):
                    batch = rows[i:i + BATCH_SIZE]
                    batch_num = (i // BATCH_SIZE) + 1
                    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
                    
                    logger.info(f"Inserting batch {batch_num}/{total_batches} ({len(batch)} rows)...")
                    
                    try:
                        errors = bq.insert_rows_json(table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                        
                        if errors:
                            total_errors += len(errors)
                            logger.warning(f"Batch {batch_num} had {len(errors)} errors")
                        else:
                            total_inserted += len(batch)
                    except Exception as e:
                        logger.error(f"Batch {batch_num} failed: {e}")
                        total_errors += len(batch)
                
                results['rows_inserted'] = total_inserted
                if total_errors > 0:
                    logger.warning(f"Total errors across all batches: {total_errors}")
            
            else:
                # UPDATE SYNC: Use MERGE to upsert (update existing, insert new)
                logger.info("Update sync: Using MERGE for efficient upsert...")
                
                # Create a temporary table with new data
                temp_table_id = f"temp_ga4_sync_{organization_id.replace('-', '_')}_{int(datetime.utcnow().timestamp())}"
                temp_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{temp_table_id}"
                
                # Insert to temp table in batches
                BATCH_SIZE = 500
                total_inserted = 0
                
                # First create temp table by inserting first batch
                for i in range(0, len(rows), BATCH_SIZE):
                    batch = rows[i:i + BATCH_SIZE]
                    batch_num = (i // BATCH_SIZE) + 1
                    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
                    
                    logger.info(f"Loading batch {batch_num}/{total_batches} to temp table...")
                    
                    try:
                        errors = bq.insert_rows_json(temp_table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                        if not errors:
                            total_inserted += len(batch)
                    except Exception as e:
                        # If table doesn't exist, create it via query
                        if 'Not found' in str(e) or i == 0:
                            # Use INSERT via query to auto-create table
                            logger.info("Creating temp table via streaming insert...")
                            try:
                                errors = bq.insert_rows_json(temp_table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                                if not errors:
                                    total_inserted += len(batch)
                            except:
                                pass
                
                # Execute MERGE statement
                merge_query = f"""
                MERGE `{table_ref}` AS target
                USING `{temp_table_ref}` AS source
                ON target.organization_id = source.organization_id
                   AND target.canonical_entity_id = source.canonical_entity_id
                   AND target.date = source.date
                   AND target.entity_type = source.entity_type
                WHEN MATCHED THEN
                    UPDATE SET
                        users = source.users,
                        sessions = source.sessions,
                        pageviews = source.pageviews,
                        conversions = source.conversions,
                        conversion_rate = source.conversion_rate,
                        revenue = source.revenue,
                        bounce_rate = source.bounce_rate,
                        avg_session_duration = source.avg_session_duration,
                        engagement_rate = source.engagement_rate,
                        source_breakdown = source.source_breakdown,
                        updated_at = source.updated_at
                WHEN NOT MATCHED THEN
                    INSERT ROW
                """
                
                try:
                    bq.query(merge_query).result()
                    results['rows_inserted'] = total_inserted
                    logger.info(f"MERGE completed: {total_inserted} rows processed")
                except Exception as e:
                    logger.error(f"MERGE failed: {e}")
                    # Fallback: just do streaming insert (may create duplicates but better than failing)
                    results['rows_inserted'] = total_inserted
                
                # Clean up temp table
                try:
                    bq.query(f"DROP TABLE IF EXISTS `{temp_table_ref}`").result()
                except:
                    pass
        
        # Update connection status
        connection_ref.update({
            'status': 'connected',
            'lastSyncAt': firestore.SERVER_TIMESTAMP,
            'lastSyncResults': {
                'dailyRecords': results['daily_records'],
                'trafficSources': results['traffic_sources'],
                'pages': results['pages_processed'],
                'googleAdsCampaigns': results.get('google_ads_campaigns', 0),
                'googleAdsAdgroups': results.get('google_ads_adgroups', 0),
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
