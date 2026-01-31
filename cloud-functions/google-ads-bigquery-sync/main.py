"""
Google Ads Direct to BigQuery Sync Cloud Function

Calls Google Ads API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for OAuth credentials.

Architecture: Google Ads API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
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
GOOGLE_ADS_API_VERSION = 'v18'


def refresh_access_token(refresh_token: str) -> str:
    """Refresh Google OAuth access token"""
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
        raise ValueError(f"Failed to refresh token: {response.text}")
    
    return response.json()['access_token']


def execute_google_ads_query(access_token: str, developer_token: str, customer_id: str, query: str) -> list:
    """Execute Google Ads query via searchStream"""
    url = f"https://googleads.googleapis.com/{GOOGLE_ADS_API_VERSION}/customers/{customer_id}/googleAds:searchStream"
    
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {access_token}',
            'developer-token': developer_token,
            'Content-Type': 'application/json',
        },
        json={'query': query}
    )
    
    if not response.ok:
        logger.error(f"Google Ads API error: {response.text}")
        return []
    
    data = response.json()
    
    # searchStream returns array of result batches
    results = []
    if isinstance(data, list):
        for batch in data:
            if 'results' in batch:
                results.extend(batch['results'])
    
    return results


@functions_framework.http
def sync_google_ads_to_bigquery(request):
    """Sync Google Ads data directly to BigQuery"""
    
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
    
    # Set date range based on mode
    if sync_mode == 'full':
        date_range = request_json.get('dateRange', 'LAST_365_DAYS')  # 1 year for full resync
    else:
        date_range = request_json.get('dateRange', 'LAST_30_DAYS')  # 30 days for incremental
    
    logger.info(f"Starting Google Ads → BigQuery sync for org: {organization_id} (mode={sync_mode}, range={date_range})")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get OAuth credentials from Firestore
        connection_ref = db.collection('google_ads_connections').document(organization_id)
        connection_doc = connection_ref.get()
        
        if not connection_doc.exists:
            return ({'error': 'Google Ads not connected'}, 404, headers)
        
        connection_data = connection_doc.to_dict()
        access_token = connection_data.get('accessToken')
        refresh_token = connection_data.get('refreshToken')
        developer_token = connection_data.get('developerToken')
        customer_id = connection_data.get('customerId')
        
        if not developer_token or not customer_id:
            return ({'error': 'Google Ads not properly configured'}, 400, headers)
        
        # Check if token needs refresh
        token_expiry = connection_data.get('tokenExpiresAt')
        if token_expiry:
            if hasattr(token_expiry, 'timestamp'):
                expiry_time = token_expiry.timestamp()
            else:
                expiry_time = 0
            
            if expiry_time < datetime.utcnow().timestamp():
                logger.info("Refreshing access token...")
                access_token = refresh_access_token(refresh_token)
                connection_ref.update({
                    'accessToken': access_token,
                    'tokenExpiresAt': datetime.utcnow() + timedelta(hours=1),
                })
        
        # Update status to syncing
        connection_ref.update({'status': 'syncing', 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        results = {
            'daily_records': 0,
            'campaigns_processed': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        now_iso = datetime.utcnow().isoformat()
        today_str = datetime.utcnow().date().isoformat()
        
        # ============================================
        # 1. FETCH DAILY METRICS FROM GOOGLE ADS
        # ============================================
        logger.info("Fetching daily metrics from Google Ads API...")
        
        daily_query = f"""
            SELECT
                segments.date,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
            FROM customer
            WHERE segments.date DURING {date_range}
            ORDER BY segments.date DESC
        """
        
        try:
            daily_data = execute_google_ads_query(access_token, developer_token, customer_id, daily_query)
            
            for row in daily_data:
                results['daily_records'] += 1
                
                date_str = row.get('segments', {}).get('date', today_str)
                metrics = row.get('metrics', {})
                
                spend = int(metrics.get('costMicros', 0)) / 1000000
                impressions = int(metrics.get('impressions', 0))
                clicks = int(metrics.get('clicks', 0))
                conversions = float(metrics.get('conversions', 0))
                conversion_value = float(metrics.get('conversionsValue', 0))
                
                # Calculate derived metrics
                ctr = (clicks / impressions * 100) if impressions > 0 else 0
                conversion_rate = (conversions / clicks * 100) if clicks > 0 else 0
                cpc = (spend / clicks) if clicks > 0 else 0
                cpa = (spend / conversions) if conversions > 0 else 0
                roas = (conversion_value / spend) if spend > 0 else 0
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"google_ads_{date_str}",
                    'entity_type': 'ad_account',
                    
                    # Core metrics
                    'cost': spend,  # Alias used by detectors
                    'ad_spend': spend,
                    'impressions': impressions,
                    'clicks': clicks,
                    'conversions': conversions,
                    'conversion_value': conversion_value,
                    'revenue': conversion_value,  # Alias used by detectors
                    
                    # Calculated metrics
                    'ctr': ctr,
                    'conversion_rate': conversion_rate,
                    'cpc': cpc,
                    'cpa': cpa,
                    'roas': roas,
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching daily metrics: {e}")
        
        # ============================================
        # 2. FETCH CAMPAIGN DATA
        # ============================================
        logger.info("Fetching campaigns from Google Ads API...")
        
        campaign_query = f"""
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE segments.date DURING LAST_30_DAYS
                AND campaign.status != 'REMOVED'
            ORDER BY metrics.cost_micros DESC
        """
        
        try:
            campaign_data = execute_google_ads_query(access_token, developer_token, customer_id, campaign_query)
            
            for row in campaign_data:
                results['campaigns_processed'] += 1
                
                campaign = row.get('campaign', {})
                metrics = row.get('metrics', {})
                
                campaign_id = campaign.get('id', 'unknown')
                campaign_name = campaign.get('name', 'Unknown')
                
                spend = int(metrics.get('costMicros', 0)) / 1000000
                impressions = int(metrics.get('impressions', 0))
                clicks = int(metrics.get('clicks', 0))
                conversions = float(metrics.get('conversions', 0))
                conversion_value = float(metrics.get('conversionsValue', 0))
                
                # Calculate derived metrics
                ctr = (clicks / impressions * 100) if impressions > 0 else 0
                conversion_rate = (conversions / clicks * 100) if clicks > 0 else 0
                cpc = (spend / clicks) if clicks > 0 else 0
                cpa = (spend / conversions) if conversions > 0 else 0
                roas = (conversion_value / spend) if spend > 0 else 0
                
                bq_row = {
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': f"campaign_{campaign_id}",
                    'entity_type': 'campaign',
                    
                    'entity_name': campaign_name,
                    
                    # Core metrics
                    'cost': spend,  # Alias used by detectors
                    'ad_spend': spend,
                    'impressions': impressions,
                    'clicks': clicks,
                    'conversions': conversions,
                    'conversion_value': conversion_value,
                    'revenue': conversion_value,  # Alias used by detectors
                    
                    # Calculated metrics
                    'ctr': ctr,
                    'conversion_rate': conversion_rate,
                    'cpc': cpc,
                    'cpa': cpa,
                    'roas': roas,
                    
                    'source_breakdown': json.dumps({
                        'status': campaign.get('status', 'UNKNOWN'),
                        'channel_type': campaign.get('advertisingChannelType', 'UNKNOWN'),
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(bq_row)
                
        except Exception as e:
            logger.error(f"Error fetching campaigns: {e}")
        
        # ============================================
        # 3. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Writing {len(rows)} rows to BigQuery (mode={sync_mode})...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            # Get min date for deletion
            dates = [r['date'] for r in rows]
            min_date = min(dates) if dates else today_str
            
            if sync_mode == 'full':
                # FULL RESYNC: Delete ALL existing Google Ads data for this org
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('ad_account', 'campaign')
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info("Deleted all existing Google Ads data for full resync")
                except Exception as e:
                    logger.warning(f"Delete query warning: {e}")
            else:
                # UPDATE SYNC: Only delete data in the date range being synced
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('ad_account', 'campaign')
                  AND date >= '{min_date}'
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info(f"Deleted Google Ads data since {min_date} for update")
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
                'campaigns': results['campaigns_processed'],
                'bigqueryRows': results['rows_inserted'],
            },
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
        
        mode_label = "Full re-sync" if sync_mode == 'full' else "Incremental sync"
        logger.info(f"✅ Google Ads sync complete ({mode_label}): {results}")
        
        return ({
            'success': True,
            'mode': sync_mode,
            **results,
            'message': f"{mode_label}: {results['rows_inserted']} rows to BigQuery"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ Google Ads sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        try:
            db = firestore.Client()
            connection_ref = db.collection('google_ads_connections').document(organization_id)
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
