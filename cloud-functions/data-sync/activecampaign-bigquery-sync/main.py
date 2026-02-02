"""
ActiveCampaign Direct to BigQuery Sync Cloud Function

Calls ActiveCampaign API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for API credentials.

Architecture: ActiveCampaign API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import logging
import json
import requests

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"


def ac_api_request(api_url: str, api_key: str, endpoint: str, params: dict = None) -> dict:
    """Make a request to the ActiveCampaign API"""
    url = f"{api_url}/api/3/{endpoint}"
    headers = {
        "Api-Token": api_key,
        "Content-Type": "application/json",
    }
    
    response = requests.get(url, headers=headers, params=params)
    
    if not response.ok:
        logger.error(f"ActiveCampaign API error: {response.status_code} - {response.text}")
        return {}
    
    return response.json()


def ac_api_paginate(api_url: str, api_key: str, endpoint: str, key: str, extra_params: dict = None) -> list:
    """Fetch all items from a paginated ActiveCampaign API endpoint"""
    all_items = []
    offset = 0
    limit = 100  # ActiveCampaign max per page
    
    while True:
        params = {'limit': limit, 'offset': offset}
        if extra_params:
            params.update(extra_params)
        
        data = ac_api_request(api_url, api_key, endpoint, params)
        items = data.get(key, [])
        
        if not items:
            break
        
        all_items.extend(items)
        logger.info(f"Fetched {len(all_items)} {key} so far...")
        
        # Check if there are more
        total = int(data.get('meta', {}).get('total', 0))
        if len(all_items) >= total or len(items) < limit:
            break
        
        offset += limit
    
    logger.info(f"Total {key} fetched: {len(all_items)}")
    return all_items


@functions_framework.http
def sync_activecampaign_to_bigquery(request):
    """Sync ActiveCampaign data directly to BigQuery"""
    
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
    
    logger.info(f"Starting ActiveCampaign → BigQuery sync for org: {organization_id} (mode={sync_mode})")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get API credentials from Firestore
        connection_ref = db.collection('activecampaign_connections').document(organization_id)
        connection_doc = connection_ref.get()
        
        if not connection_doc.exists:
            return ({'error': 'ActiveCampaign not connected'}, 404, headers)
        
        connection_data = connection_doc.to_dict()
        api_url = connection_data.get('apiUrl')
        api_key = connection_data.get('apiKey')
        
        if not api_url or not api_key:
            return ({'error': 'Missing API credentials'}, 400, headers)
        
        # Update status to syncing
        connection_ref.update({'status': 'syncing', 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        results = {
            'contacts': 0,
            'deals': 0,
            'campaigns': 0,
            'lists': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        now_iso = datetime.utcnow().isoformat()
        today_str = datetime.utcnow().date().isoformat()
        
        # ============================================
        # 1. FETCH CONTACTS SUMMARY
        # ============================================
        logger.info("Fetching contacts from ActiveCampaign API...")
        
        try:
            contacts_data = ac_api_request(api_url, api_key, 'contacts', {'limit': 1})
            total_contacts = int(contacts_data.get('meta', {}).get('total', 0))
            results['contacts'] = total_contacts
            
            # Get active contacts count
            active_contacts_data = ac_api_request(api_url, api_key, 'contacts', {
                'limit': 1,
                'status': 1  # Active
            })
            active_contacts = int(active_contacts_data.get('meta', {}).get('total', 0))
            
            rows.append({
                'organization_id': organization_id,
                'date': today_str,
                'canonical_entity_id': 'activecampaign_contacts',
                'entity_type': 'contact_summary',
                
                'entity_name': 'All Contacts',
                'total_contacts': total_contacts,
                'active_contacts': active_contacts,
                
                'created_at': now_iso,
                'updated_at': now_iso,
            })
            
        except Exception as e:
            logger.error(f"Error fetching contacts: {e}")
        
        # ============================================
        # 2. FETCH DEALS (with pagination)
        # ============================================
        logger.info("Fetching deals from ActiveCampaign API...")
        
        try:
            # Get ALL deals with pagination
            deals = ac_api_paginate(api_url, api_key, 'deals', 'deals')
            results['deals'] = len(deals)
            
            # Aggregate deals by status
            open_value = 0
            won_value = 0
            lost_value = 0
            open_count = 0
            won_count = 0
            lost_count = 0
            
            for deal in deals:
                value = float(deal.get('value', 0)) / 100  # Convert from cents
                status = deal.get('status', '0')
                
                if status == '0':  # Open
                    open_value += value
                    open_count += 1
                elif status == '1':  # Won
                    won_value += value
                    won_count += 1
                elif status == '2':  # Lost
                    lost_value += value
                    lost_count += 1
            
            rows.append({
                'organization_id': organization_id,
                'date': today_str,
                'canonical_entity_id': 'activecampaign_deals',
                'entity_type': 'deal_summary',
                
                'entity_name': 'CRM Deals',
                'pipeline_value': open_value,
                'won_value': won_value,
                'lost_value': lost_value,
                'open_deals': open_count,
                'won_deals': won_count,
                'lost_deals': lost_count,
                
                'metrics_json': json.dumps({
                    'total_deals': len(deals),
                    'win_rate': (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0,
                }),
                
                'created_at': now_iso,
                'updated_at': now_iso,
            })
            
        except Exception as e:
            logger.error(f"Error fetching deals: {e}")
        
        # ============================================
        # 3. FETCH EMAIL CAMPAIGNS (with pagination)
        # ============================================
        logger.info("Fetching campaigns from ActiveCampaign API...")
        
        try:
            # Get ALL campaigns with pagination
            campaigns = ac_api_paginate(api_url, api_key, 'campaigns', 'campaigns')
            results['campaigns'] = len(campaigns)
            
            total_sent = 0
            total_opens = 0
            total_clicks = 0
            total_bounces = 0
            total_unsubscribes = 0
            total_complaints = 0
            
            for campaign in campaigns:
                send_amt = int(campaign.get('send_amt', 0) or 0)
                opens = int(campaign.get('uniqueopens', 0) or campaign.get('opens', 0) or 0)
                clicks = int(campaign.get('uniquelinkclicks', 0) or 0)
                bounces = int(campaign.get('bouncescnt', 0) or 0)
                hard_bounces = int(campaign.get('hardbounces', 0) or 0)
                soft_bounces = int(campaign.get('softbounces', 0) or 0)
                unsubscribes = int(campaign.get('unsubscribes', 0) or 0)
                complaints = int(campaign.get('complaints', 0) or 0)
                
                total_sent += send_amt
                total_opens += opens
                total_clicks += clicks
                total_bounces += bounces
                total_unsubscribes += unsubscribes
                total_complaints += complaints
                
                # Add individual campaign as entity
                if send_amt > 0:
                    campaign_name = campaign.get('name', 'Unnamed Campaign')
                    campaign_id = campaign.get('id', 'unknown')
                    
                    # Calculate rates
                    open_rate = (opens / send_amt * 100) if send_amt > 0 else 0
                    click_rate = (clicks / send_amt * 100) if send_amt > 0 else 0
                    click_to_open_rate = (clicks / opens * 100) if opens > 0 else 0
                    bounce_rate = (bounces / send_amt * 100) if send_amt > 0 else 0
                    unsubscribe_rate = (unsubscribes / send_amt * 100) if send_amt > 0 else 0
                    spam_complaint_rate = (complaints / send_amt * 100) if send_amt > 0 else 0
                    
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"ac_campaign_{campaign_id}",
                        'entity_type': 'email_campaign',
                        
                        'entity_name': campaign_name,
                        
                        # Core metrics
                        'emails_sent': send_amt,
                        'opens': opens,
                        'clicks': clicks,
                        'bounces': bounces,
                        'hard_bounces': hard_bounces,
                        'soft_bounces': soft_bounces,
                        'unsubscribes': unsubscribes,
                        'complaints': complaints,
                        
                        # Calculated rates (needed by detectors)
                        'open_rate': open_rate,
                        'click_rate': click_rate,
                        'click_through_rate': click_rate,  # Alias
                        'click_to_open_rate': click_to_open_rate,
                        'bounce_rate': bounce_rate,
                        'hard_bounce_rate': (hard_bounces / send_amt * 100) if send_amt > 0 else 0,
                        'soft_bounce_rate': (soft_bounces / send_amt * 100) if send_amt > 0 else 0,
                        'unsubscribe_rate': unsubscribe_rate,
                        'spam_complaint_rate': spam_complaint_rate,
                        
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # Calculate summary rates
            avg_open_rate = (total_opens / total_sent * 100) if total_sent > 0 else 0
            avg_click_rate = (total_clicks / total_sent * 100) if total_sent > 0 else 0
            avg_bounce_rate = (total_bounces / total_sent * 100) if total_sent > 0 else 0
            avg_unsubscribe_rate = (total_unsubscribes / total_sent * 100) if total_sent > 0 else 0
            avg_complaint_rate = (total_complaints / total_sent * 100) if total_sent > 0 else 0
            
            # Add campaign summary
            rows.append({
                'organization_id': organization_id,
                'date': today_str,
                'canonical_entity_id': 'activecampaign_email_summary',
                'entity_type': 'email_summary',
                
                'entity_name': 'Email Performance',
                'total_campaigns': len(campaigns),
                'emails_sent': total_sent,
                'total_opens': total_opens,
                'total_clicks': total_clicks,
                'total_bounces': total_bounces,
                'total_unsubscribes': total_unsubscribes,
                'total_complaints': total_complaints,
                
                # Calculated rates (needed by detectors)
                'open_rate': avg_open_rate,
                'click_rate': avg_click_rate,
                'click_through_rate': avg_click_rate,
                'bounce_rate': avg_bounce_rate,
                'unsubscribe_rate': avg_unsubscribe_rate,
                'spam_complaint_rate': avg_complaint_rate,
                
                'created_at': now_iso,
                'updated_at': now_iso,
            })
            
        except Exception as e:
            logger.error(f"Error fetching campaigns: {e}")
        
        # ============================================
        # 4. FETCH LISTS (with pagination)
        # ============================================
        logger.info("Fetching lists from ActiveCampaign API...")
        
        try:
            # Get ALL lists with pagination
            lists = ac_api_paginate(api_url, api_key, 'lists', 'lists')
            results['lists'] = len(lists)
            
            total_subscribers = 0
            
            for lst in lists:
                list_name = lst.get('name', 'Unnamed List')
                list_id = lst.get('id', 'unknown')
                subscriber_count = int(lst.get('subscriber_count', 0) or 0)
                total_subscribers += subscriber_count
                
                rows.append({
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': f"ac_list_{list_id}",
                    'entity_type': 'email_list',
                    
                    'entity_name': list_name,
                    'subscribers': subscriber_count,
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
        except Exception as e:
            logger.error(f"Error fetching lists: {e}")
        
        # ============================================
        # 5. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Writing {len(rows)} rows to BigQuery (mode={sync_mode})...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            if sync_mode == 'full':
                # FULL RESYNC: Delete ALL existing ActiveCampaign data for this org
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('contact_summary', 'deal_summary', 'email_campaign', 'email_summary', 'email_list')
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info("Deleted all existing ActiveCampaign data for full resync")
                except Exception as e:
                    logger.warning(f"Delete query warning: {e}")
            else:
                # UPDATE SYNC: Only delete today's data (will be replaced with fresh snapshot)
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('contact_summary', 'deal_summary', 'email_campaign', 'email_summary', 'email_list')
                  AND date = '{today_str}'
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info("Deleted today's ActiveCampaign data for update")
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
                'contacts': results['contacts'],
                'deals': results['deals'],
                'campaigns': results['campaigns'],
                'lists': results['lists'],
                'bigqueryRows': results['rows_inserted'],
            },
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
        
        mode_label = "Full re-sync" if sync_mode == 'full' else "Incremental sync"
        logger.info(f"✅ ActiveCampaign sync complete ({mode_label}): {results}")
        
        return ({
            'success': True,
            'mode': sync_mode,
            **results,
            'message': f"{mode_label}: {results['rows_inserted']} rows to BigQuery"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ ActiveCampaign sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        try:
            db = firestore.Client()
            connection_ref = db.collection('activecampaign_connections').document(organization_id)
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
