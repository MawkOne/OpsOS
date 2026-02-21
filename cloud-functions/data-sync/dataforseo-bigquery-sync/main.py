"""
DataForSEO Direct to BigQuery Sync Cloud Function

Calls DataForSEO API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for API credentials and priority page config.

Architecture: DataForSEO API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import logging
import json
import os
import requests
import base64
import calendar

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"

DATAFORSEO_API_BASE = "https://api.dataforseo.com/v3"


def dataforseo_request(endpoint: str, method: str, credentials: str, body: dict = None) -> dict:
    """Make authenticated DataForSEO API request"""
    url = f"{DATAFORSEO_API_BASE}/{endpoint}"
    
    headers = {
        'Authorization': f'Basic {credentials}',
        'Content-Type': 'application/json',
    }
    
    if method == 'POST':
        response = requests.post(url, headers=headers, json=body)
    else:
        response = requests.get(url, headers=headers)
    
    if not response.ok:
        logger.error(f"DataForSEO API error: {response.text}")
        return {}
    
    return response.json()


@functions_framework.http
def sync_dataforseo_to_bigquery(request):
    """Sync DataForSEO data directly to BigQuery"""
    
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
    
    # Full resync fetches historical data, update only fetches current
    backfill_history = sync_mode == 'full' or request_json.get('backfillHistory', False)
    
    logger.info(f"Starting DataForSEO → BigQuery sync for org: {organization_id} (mode={sync_mode}, history={backfill_history})")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get API credentials from Firestore
        connection_ref = db.collection('dataforseo_connections').document(organization_id)
        connection_doc = connection_ref.get()
        
        if not connection_doc.exists:
            return ({'error': 'DataForSEO not connected'}, 404, headers)
        
        connection_data = connection_doc.to_dict()
        login = connection_data.get('login')
        password = connection_data.get('password')
        domain = connection_data.get('domain', '')
        priority_urls = connection_data.get('priorityUrls', [])
        priority_prefixes = connection_data.get('priorityPrefixes', [])
        
        if not login or not password:
            return ({'error': 'DataForSEO credentials not found'}, 400, headers)
        
        credentials = base64.b64encode(f"{login}:{password}".encode()).decode()
        
        # Update status to syncing
        connection_ref.update({'status': 'syncing', 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        # Clean domain
        target_domain = domain.replace('https://', '').replace('http://', '').rstrip('/')
        
        results = {
            'historical_months': 0,
            'keywords_processed': 0,
            'backlinks_processed': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        now_iso = datetime.utcnow().isoformat()
        today_str = datetime.utcnow().date().isoformat()
        
        # ============================================
        # 1. FETCH HISTORICAL RANK DATA
        # ============================================
        if backfill_history:
            logger.info("Fetching historical rank data from DataForSEO...")
            
            try:
                # Get historical organic search rankings
                history_response = dataforseo_request(
                    "dataforseo_labs/google/historical_rank_overview/live",
                    "POST",
                    credentials,
                    [{
                        "target": target_domain,
                        "location_code": 2840,  # United States
                        "language_code": "en",
                    }]
                )
                
                tasks = history_response.get('tasks', [])
                for task in tasks:
                    if task.get('status_code') != 20000:
                        continue
                    
                    items = task.get('result', [{}])[0].get('items', [])
                    
                    for item in items:
                        results['historical_months'] += 1
                        
                        year = item.get('year')
                        month = item.get('month')
                        if not year or not month:
                            continue
                        
                        # Use last day of month
                        last_day = calendar.monthrange(year, month)[1]
                        date_str = f"{year}-{str(month).zfill(2)}-{str(last_day).zfill(2)}"
                        
                        metrics = item.get('metrics', {}).get('organic', {})
                        
                        row = {
                            'organization_id': organization_id,
                            'date': date_str,
                            'canonical_entity_id': target_domain,
                            'entity_type': 'domain',
                            
                            'seo_keywords_total': metrics.get('count', 0),
                            'seo_traffic_value': metrics.get('etv', 0),
                            'seo_position': metrics.get('pos', 0),
                            
                            'source_breakdown': json.dumps({
                                'pos_1': metrics.get('pos_1', 0),
                                'pos_2_3': metrics.get('pos_2_3', 0),
                                'pos_4_10': metrics.get('pos_4_10', 0),
                                'pos_11_20': metrics.get('pos_11_20', 0),
                                'pos_21_30': metrics.get('pos_21_30', 0),
                            }),
                            
                            'created_at': now_iso,
                            'updated_at': now_iso,
                        }
                        rows.append(row)
                        
            except Exception as e:
                logger.error(f"Error fetching historical data: {e}")
        
        # ============================================
        # 2. FETCH CURRENT KEYWORDS FOR DOMAIN
        # ============================================
        logger.info("Fetching keywords from DataForSEO...")
        
        try:
            keywords_response = dataforseo_request(
                "dataforseo_labs/google/ranked_keywords/live",
                "POST",
                credentials,
                [{
                    "target": target_domain,
                    "location_code": 2840,
                    "language_code": "en",
                    "limit": 100,
                    "order_by": ["keyword_data.keyword_info.search_volume,desc"],
                }]
            )
            
            tasks = keywords_response.get('tasks', [])
            for task in tasks:
                if task.get('status_code') != 20000:
                    continue
                
                items = task.get('result', [{}])[0].get('items', [])
                
                for item in items:
                    results['keywords_processed'] += 1
                    
                    keyword_data = item.get('keyword_data', {})
                    keyword_info = keyword_data.get('keyword_info', {})
                    ranked_element = item.get('ranked_serp_element', {}).get('serp_item', {})
                    
                    keyword = keyword_data.get('keyword', '')
                    search_volume = keyword_info.get('search_volume', 0) or 0
                    position = ranked_element.get('rank_absolute', 0) or 0
                    url = ranked_element.get('url', '')
                    cpc = keyword_info.get('cpc', 0) or 0
                    competition = keyword_info.get('competition', 0) or 0
                    
                    # Get monthly searches for impressions estimate
                    monthly_searches = keyword_info.get('monthly_searches', [])
                    
                    # Estimate CTR based on position (industry averages)
                    ctr = 0
                    if position == 1:
                        ctr = 31.7
                    elif position == 2:
                        ctr = 24.7
                    elif position == 3:
                        ctr = 18.7
                    elif position <= 5:
                        ctr = 9.5
                    elif position <= 10:
                        ctr = 3.0
                    elif position <= 20:
                        ctr = 1.0
                    elif position > 0:
                        ctr = 0.5
                    
                    # Estimate impressions and clicks
                    impressions = search_volume  # Monthly impressions ≈ search volume
                    clicks = int(impressions * ctr / 100) if impressions > 0 else 0
                    
                    row = {
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': keyword,
                        'entity_type': 'keyword',
                        
                        'entity_name': keyword,
                        
                        # Core SEO metrics (used by detectors)
                        'position': position,  # Alias for detectors
                        'search_volume': search_volume,  # Alias for detectors
                        'seo_position': position,
                        'seo_search_volume': search_volume,
                        'seo_url': url,
                        
                        # Calculated/estimated metrics
                        'impressions': impressions,
                        'clicks': clicks,
                        'ctr': ctr,
                        'cpc': cpc,
                        'competition': competition,
                        
                        'source_breakdown': json.dumps({
                            'cpc': cpc,
                            'competition': competition,
                            'monthly_searches': monthly_searches[-3:] if monthly_searches else [],
                        }),
                        
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    }
                    rows.append(row)
                    
        except Exception as e:
            logger.error(f"Error fetching keywords: {e}")
        
        # ============================================
        # 3. FETCH BACKLINKS SUMMARY
        # ============================================
        logger.info("Fetching backlinks from DataForSEO...")
        
        try:
            backlinks_response = dataforseo_request(
                "backlinks/summary/live",
                "POST",
                credentials,
                [{
                    "target": target_domain,
                    "internal_list_limit": 10,
                    "include_subdomains": True,
                }]
            )
            
            tasks = backlinks_response.get('tasks', [])
            if not tasks:
                logger.warning("DataForSEO backlinks API returned no tasks")
            
            for task in tasks:
                status_code = task.get('status_code')
                if status_code != 20000:
                    logger.error(f"DataForSEO backlinks API error: status_code={status_code}, message={task.get('status_message')}")
                    continue
                
                result = task.get('result', [{}])[0]
                results['backlinks_processed'] = result.get('backlinks', 0)
                
                if results['backlinks_processed'] == 0:
                    logger.warning(f"DataForSEO backlinks API returned 0 backlinks for {target_domain}")
                
                row = {
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': f"{target_domain}_backlinks_{today_str}",  # Include date for history
                    'entity_type': 'backlinks',
                    
                    'backlinks_total': result.get('backlinks', 0),
                    'referring_domains': result.get('referring_domains', 0),
                    'domain_rank': result.get('rank', 0),
                    
                    'source_breakdown': json.dumps({
                        'referring_pages': result.get('referring_pages', 0),
                        'referring_ips': result.get('referring_ips', 0),
                        'referring_subnets': result.get('referring_subnets', 0),
                        'dofollow': result.get('referring_links_types', {}).get('dofollow', 0),
                        'nofollow': result.get('referring_links_types', {}).get('nofollow', 0),
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(row)
                
        except Exception as e:
            logger.error(f"Error fetching backlinks: {e}")
        
        # ============================================
        # 4. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Writing {len(rows)} rows to BigQuery (mode={sync_mode})...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            if sync_mode == 'full':
                # FULL RESYNC: Delete keywords and domain (but KEEP backlinks history)
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('domain', 'keyword')
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info("Deleted existing DataForSEO domain/keyword data (preserving backlinks history)")
                except Exception as e:
                    logger.warning(f"Delete query warning: {e}")
                
                # Only delete TODAY's backlinks (allow re-run same day, but keep history)
                delete_backlinks_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type = 'backlinks'
                  AND date = '{today_str}'
                """
                try:
                    bq.query(delete_backlinks_query).result()
                except Exception as e:
                    logger.warning(f"Delete backlinks warning: {e}")
            else:
                # UPDATE SYNC: Only delete today's keyword data (preserve all history)
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type = 'keyword'
                  AND date = '{today_str}'
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info(f"Deleted today's DataForSEO keyword data for update")
                except Exception as e:
                    logger.warning(f"Delete query warning: {e}")
                
                # Only delete TODAY's backlinks (allow re-run, keep history)
                delete_backlinks_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type = 'backlinks'
                  AND date = '{today_str}'
                """
                try:
                    bq.query(delete_backlinks_query).result()
                except Exception as e:
                    logger.warning(f"Delete backlinks warning: {e}")
            
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
                'historicalMonths': results['historical_months'],
                'keywords': results['keywords_processed'],
                'backlinks': results['backlinks_processed'],
                'bigqueryRows': results['rows_inserted'],
            },
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
        
        mode_label = "Full re-sync" if sync_mode == 'full' else "Incremental sync"
        logger.info(f"✅ DataForSEO sync complete ({mode_label}): {results}")
        
        return ({
            'success': True,
            'mode': sync_mode,
            **results,
            'message': f"{mode_label}: {results['rows_inserted']} rows to BigQuery"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ DataForSEO sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        try:
            db = firestore.Client()
            connection_ref = db.collection('dataforseo_connections').document(organization_id)
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
