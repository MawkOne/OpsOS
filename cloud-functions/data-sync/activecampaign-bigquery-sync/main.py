"""
ActiveCampaign Direct to BigQuery Sync Cloud Function

Calls ActiveCampaign API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for API credentials.

Architecture: ActiveCampaign API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta, timedelta
import logging
import json
import requests

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"
RAW_TABLE_ID = "raw_activecampaign"
EMAIL_ACTIVITIES_TABLE = "email_activities"
BQ_LOCATION = "northamerica-northeast1"


def ac_api_v1_request(api_url: str, api_key: str, action: str, params: dict = None, max_retries: int = 3) -> dict:
    """Make a request to the ActiveCampaign v1 API (for campaign reports) with retry logic"""
    import time
    
    url = f"{api_url}/admin/api.php"
    
    request_params = {
        'api_action': action,
        'api_output': 'json',
    }
    if params:
        request_params.update(params)
    
    headers = {
        "Api-Token": api_key,
    }
    
    for attempt in range(max_retries):
        try:
            # Add delay between requests to avoid rate limiting (200ms)
            time.sleep(0.2)
            
            response = requests.get(url, headers=headers, params=request_params, timeout=30)
            
            if not response.ok:
                logger.warning(f"v1 API error (attempt {attempt+1}): {response.status_code}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                return {}
            
            return response.json()
        except Exception as e:
            logger.warning(f"v1 API request failed (attempt {attempt+1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
            else:
                return {}
    
    return {}


def ac_api_v1_paginate(api_url: str, api_key: str, action: str, campaign_id: str, extra_params: dict = None) -> list:
    """Fetch all items from a paginated v1 API report endpoint"""
    all_items = []
    page = 1
    
    while True:
        params = {
            'campaignid': campaign_id,
            'page': page,
        }
        if extra_params:
            params.update(extra_params)
        
        data = ac_api_v1_request(api_url, api_key, action, params)
        
        # v1 API returns numbered keys for results (0, 1, 2, etc.)
        items = []
        for key in data:
            if key.isdigit():
                items.append(data[key])
        
        if not items:
            break
        
        all_items.extend(items)
        
        # v1 API returns 20 per page
        if len(items) < 20:
            break
        
        page += 1
        
        # Safety limit
        if page > 100:
            logger.warning(f"Reached page limit for {action} campaign {campaign_id}")
            break
    
    return all_items


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
    
    # Support explicit date range for backfilling campaigns
    explicit_start = request_json.get('startDate')  # Format: 'YYYY-MM-DD'
    explicit_end = request_json.get('endDate')      # Format: 'YYYY-MM-DD'
    
    if explicit_start and explicit_end:
        logger.info(f"Starting ActiveCampaign → BigQuery sync for org: {organization_id} (range: {explicit_start} to {explicit_end})")
    else:
        logger.info(f"Starting ActiveCampaign → BigQuery sync for org: {organization_id} (mode={sync_mode})")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client(location=BQ_LOCATION)
        
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
            'email_activities': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        raw_rows = []  # For storing raw API responses
        now_iso = datetime.utcnow().isoformat()
        today_str = datetime.utcnow().date().isoformat()
        
        # Parse date filters if provided
        start_date = datetime.strptime(explicit_start, '%Y-%m-%d').date() if explicit_start else None
        end_date = datetime.strptime(explicit_end, '%Y-%m-%d').date() if explicit_end else None
        
        # ============================================
        # 1. FETCH CONTACTS (with pagination for raw storage)
        # ============================================
        logger.info("Fetching contacts from ActiveCampaign API...")
        
        try:
            # Get ALL contacts with pagination if doing full sync
            if sync_mode == 'full' or explicit_start:
                contacts = ac_api_paginate(api_url, api_key, 'contacts', 'contacts')
                total_contacts = len(contacts)
                active_contacts = sum(1 for c in contacts if c.get('status') == '1')
                
                # Store raw contact data
                for contact in contacts:
                    contact_date_str = contact.get('cdate', '') or contact.get('udate', '') or today_str
                    try:
                        if ' ' in contact_date_str:
                            contact_date = datetime.strptime(contact_date_str.split(' ')[0], '%Y-%m-%d').date()
                        elif contact_date_str:
                            contact_date = datetime.strptime(contact_date_str[:10], '%Y-%m-%d').date()
                        else:
                            contact_date = datetime.utcnow().date()
                    except:
                        contact_date = datetime.utcnow().date()
                    
                    # Filter by date range if specified
                    if start_date and end_date:
                        if contact_date < start_date or contact_date > end_date:
                            continue
                    
                    raw_rows.append({
                        'organization_id': organization_id,
                        'date': contact_date.isoformat(),
                        'data_type': 'contact',
                        'api_response': json.dumps(contact),
                        'created_at': now_iso,
                    })
            else:
                # Just get counts for incremental sync
                contacts_data = ac_api_request(api_url, api_key, 'contacts', {'limit': 1})
                total_contacts = int(contacts_data.get('meta', {}).get('total', 0))
                
                active_contacts_data = ac_api_request(api_url, api_key, 'contacts', {
                    'limit': 1,
                    'status': 1  # Active
                })
                active_contacts = int(active_contacts_data.get('meta', {}).get('total', 0))
            
            results['contacts'] = total_contacts
            
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
                
                # Get deal creation date
                deal_date_str = deal.get('cdate', '') or deal.get('mdate', '') or today_str
                try:
                    if ' ' in deal_date_str:
                        deal_date = datetime.strptime(deal_date_str.split(' ')[0], '%Y-%m-%d').date()
                    elif deal_date_str:
                        deal_date = datetime.strptime(deal_date_str[:10], '%Y-%m-%d').date()
                    else:
                        deal_date = datetime.utcnow().date()
                except:
                    deal_date = datetime.utcnow().date()
                
                # Filter by date range if specified
                if start_date and end_date:
                    if deal_date < start_date or deal_date > end_date:
                        continue  # Skip deals outside date range
                
                # Store raw deal data
                raw_rows.append({
                    'organization_id': organization_id,
                    'date': deal_date.isoformat(),
                    'data_type': 'deal',
                    'api_response': json.dumps(deal),
                    'created_at': now_iso,
                })
                
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
                
                # Get actual send date from campaign
                send_date_str = campaign.get('sdate', '') or campaign.get('ldate', '') or today_str
                campaign_date = None
                try:
                    # Parse and format send date (AC format: "2024-01-15 10:30:00")
                    if ' ' in send_date_str:
                        campaign_date = datetime.strptime(send_date_str.split(' ')[0], '%Y-%m-%d').date()
                    elif send_date_str:
                        campaign_date = datetime.strptime(send_date_str[:10], '%Y-%m-%d').date()
                except:
                    pass
                
                # Filter by date range if specified
                if start_date and end_date and campaign_date:
                    if campaign_date < start_date or campaign_date > end_date:
                        continue  # Skip campaigns outside date range
                
                campaign_date_str = campaign_date.isoformat() if campaign_date else today_str
                
                # Store raw campaign data
                raw_rows.append({
                    'organization_id': organization_id,
                    'date': campaign_date_str,
                    'data_type': 'campaign',
                    'api_response': json.dumps(campaign),
                    'created_at': now_iso,
                })
                
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
                        'date': campaign_date_str,  # Use actual send date
                        'canonical_entity_id': f"ac_campaign_{campaign_id}",
                        'entity_type': 'email_campaign',
                        
                        'entity_name': campaign_name,
                        
                        # Core metrics (use schema column names)
                        'sends': send_amt,  # Fixed: was 'emails_sent'
                        'opens': opens,
                        'clicks': clicks,
                        
                        # Calculated rates (needed by detectors)
                        'open_rate': open_rate,
                        'click_through_rate': click_rate,
                        'bounce_rate': bounce_rate,
                        
                        # Store campaign details
                        'source_breakdown': json.dumps({
                            'campaign_id': campaign_id,
                            'send_date': send_date_str,
                            'type': campaign.get('type', 'unknown'),
                            'status': campaign.get('status', 'unknown'),
                            'bounces': bounces,
                            'hard_bounces': hard_bounces,
                            'soft_bounces': soft_bounces,
                            'unsubscribes': unsubscribes,
                            'complaints': complaints,
                        }),
                        
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
                'sends': total_sent,  # Fixed: was 'emails_sent'
                'opens': total_opens,
                'clicks': total_clicks,
                
                # Calculated rates (needed by detectors)
                'open_rate': avg_open_rate,
                'click_through_rate': avg_click_rate,
                'bounce_rate': avg_bounce_rate,
                
                'created_at': now_iso,
                'updated_at': now_iso,
            })
            
        except Exception as e:
            logger.error(f"Error fetching campaigns: {e}")
        
        # ============================================
        # 4. EMAIL ACTIVITIES (v1 API - timestamped opens/clicks)
        # ============================================
        import time
        
        fetch_activities = request_json.get('fetch_activities', False)
        days_back = int(request_json.get('days_back', 30))
        start_days_back = request_json.get('start_days_back')  # Optional: for batched backfills
        
        cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        end_cutoff_date = None
        if start_days_back is not None:
            end_cutoff_date = (datetime.now() - timedelta(days=int(start_days_back))).strftime('%Y-%m-%d')
        
        if not fetch_activities:
            logger.info("Email activities fetch skipped (pass fetch_activities=true to enable)")
            results['email_activities'] = 0
        else:
            date_range_msg = f"since {cutoff_date}" if not end_cutoff_date else f"from {cutoff_date} to {end_cutoff_date}"
            logger.info(f"Fetching email activities via v1 API {date_range_msg}...")
            
            activities_by_date = {}
            
            try:
                # Get campaigns sent in the date range
                all_campaigns = ac_api_paginate(api_url, api_key, 'campaigns', 'campaigns')
                recent_campaigns = [c for c in all_campaigns 
                                   if int(c.get('send_amt', 0) or 0) > 0 
                                   and (c.get('sdate') or '1970-01-01') >= cutoff_date
                                   and (end_cutoff_date is None or (c.get('sdate') or '9999-99-99') < end_cutoff_date)]
                
                logger.info(f"Found {len(recent_campaigns)} campaigns in range (of {len(all_campaigns)} total)")
                
                for idx, campaign in enumerate(recent_campaigns):
                    campaign_id = campaign.get('id')
                    campaign_name = campaign.get('name', 'Unknown')[:40]
                    
                    if idx % 5 == 0:
                        logger.info(f"Processing campaign {idx+1}/{len(recent_campaigns)}: {campaign_name}...")
                    
                    # Rate limit: 300ms between campaigns to avoid hitting rate limits
                    time.sleep(0.3)
                    
                    # Fetch opens via v1 API
                    try:
                        opens = ac_api_v1_paginate(api_url, api_key, 'campaign_report_open_list', campaign_id)
                        for record in opens:
                            tstamp = record.get('tstamp', '')
                            if tstamp:
                                activity_date = tstamp.split(' ')[0]
                                if activity_date not in activities_by_date:
                                    activities_by_date[activity_date] = {'opens': 0, 'clicks': 0, 'bounces': 0, 'unsubscribes': 0, 'unique_openers': set(), 'unique_clickers': set()}
                                activities_by_date[activity_date]['opens'] += int(record.get('times', 1) or 1)
                                activities_by_date[activity_date]['unique_openers'].add(record.get('email', ''))
                    except Exception as e:
                        logger.warning(f"Opens error for campaign {campaign_id}: {e}")
                    
                    # Fetch clicks via v1 API
                    try:
                        clicks = ac_api_v1_paginate(api_url, api_key, 'campaign_report_link_list', campaign_id)
                        for record in clicks:
                            tstamp = record.get('tstamp', '')
                            if tstamp:
                                activity_date = tstamp.split(' ')[0]
                                if activity_date not in activities_by_date:
                                    activities_by_date[activity_date] = {'opens': 0, 'clicks': 0, 'bounces': 0, 'unsubscribes': 0, 'unique_openers': set(), 'unique_clickers': set()}
                                activities_by_date[activity_date]['clicks'] += int(record.get('times', 1) or 1)
                                activities_by_date[activity_date]['unique_clickers'].add(record.get('email', ''))
                    except Exception as e:
                        logger.warning(f"Clicks error for campaign {campaign_id}: {e}")
                
                # Create daily activity rows
                for activity_date, metrics in activities_by_date.items():
                    rows.append({
                        'organization_id': organization_id,
                        'date': activity_date,
                        'canonical_entity_id': f"email_daily_{activity_date}",
                        'entity_type': 'email_daily_activity',
                        'opens': metrics['opens'],
                        'clicks': metrics['clicks'],
                        'users': len(metrics['unique_openers']),
                        'sessions': len(metrics['unique_clickers']),
                        'open_rate': 0,
                        'click_through_rate': (metrics['clicks'] / metrics['opens'] * 100) if metrics['opens'] > 0 else 0,
                        'source_breakdown': json.dumps({
                            'unique_openers': len(metrics['unique_openers']),
                            'unique_clickers': len(metrics['unique_clickers']),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
                
                results['email_activities'] = len(activities_by_date)
                logger.info(f"Created {len(activities_by_date)} daily email activity rows")
                
            except Exception as e:
                logger.error(f"Error fetching email activities: {e}")
                import traceback
                logger.error(traceback.format_exc())
                results['email_activities'] = 0
        
        # ============================================
        # 5. FETCH LISTS (with pagination)
        # ============================================
        logger.info("Fetching lists from ActiveCampaign v3 API...")
        
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
                
                # Store raw list data
                raw_rows.append({
                    'organization_id': organization_id,
                    'date': today_str,
                    'data_type': 'list',
                    'api_response': json.dumps(lst),
                    'created_at': now_iso,
                })
                
                rows.append({
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': f"ac_list_{list_id}",
                    'entity_type': 'email_list',
                    
                    'entity_name': list_name,
                    'users': subscriber_count,  # Use 'users' column for subscriber count
                    
                    'source_breakdown': json.dumps({
                        'list_id': list_id,
                        'list_name': list_name,
                        'subscriber_count': subscriber_count,
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
        except Exception as e:
            logger.error(f"Error fetching lists: {e}")
        
        # ============================================
        # 6. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Writing {len(rows)} rows to BigQuery (mode={sync_mode})...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            if sync_mode == 'full':
                # FULL RESYNC: Delete ALL existing ActiveCampaign data for this org
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('contact_summary', 'deal_summary', 'email_campaign', 'email_summary', 'email_list', 'email_daily_activity')
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
                  AND entity_type IN ('contact_summary', 'deal_summary', 'email_campaign', 'email_summary', 'email_list', 'email_daily_activity')
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
        
        # ============================================
        # 7. WRITE RAW DATA TO BIGQUERY
        # ============================================
        if raw_rows:
            logger.info(f"Writing {len(raw_rows)} raw records to BigQuery...")
            raw_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{RAW_TABLE_ID}"
            
            # Delete existing raw data for date range if full sync
            if sync_mode == 'full' and start_date and end_date:
                delete_raw_query = f"""
                DELETE FROM `{raw_table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
                """
                try:
                    bq.query(delete_raw_query).result()
                except Exception as e:
                    logger.warning(f"Raw delete warning: {e}")
            
            # Insert raw rows in batches
            BATCH_SIZE = 500
            raw_inserted = 0
            for i in range(0, len(raw_rows), BATCH_SIZE):
                batch = raw_rows[i:i + BATCH_SIZE]
                errors = bq.insert_rows_json(raw_table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                if not errors:
                    raw_inserted += len(batch)
            
            results['raw_records_inserted'] = raw_inserted
            logger.info(f"Inserted {raw_inserted} raw records")
        
        # Update connection status
        connection_ref.update({
            'status': 'connected',
            'lastSyncAt': firestore.SERVER_TIMESTAMP,
            'lastSyncResults': {
                'contacts': results['contacts'],
                'deals': results['deals'],
                'campaigns': results['campaigns'],
                'lists': results['lists'],
                'email_activities': results['email_activities'],
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
