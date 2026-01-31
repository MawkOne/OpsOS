"""
Nightly Sync Scheduler - Triggers update syncs for all connected data sources

Runs via Cloud Scheduler at midnight each night.
Checks Firestore for all connected sources and triggers their sync functions.
"""

import functions_framework
from google.cloud import firestore
import requests
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

# Cloud Function URLs for each data source
SYNC_FUNCTIONS = {
    'ga_connections': 'https://us-central1-opsos-864a1.cloudfunctions.net/ga4-bigquery-sync',
    'activecampaign_connections': 'https://us-central1-opsos-864a1.cloudfunctions.net/activecampaign-bigquery-sync',
    'stripe_connections': 'https://us-central1-opsos-864a1.cloudfunctions.net/stripe-bigquery-sync',
    'quickbooks_connections': 'https://us-central1-opsos-864a1.cloudfunctions.net/quickbooks-bigquery-sync',
    'google_ads_connections': 'https://us-central1-opsos-864a1.cloudfunctions.net/google-ads-bigquery-sync',
    'dataforseo_connections': 'https://us-central1-opsos-864a1.cloudfunctions.net/dataforseo-bigquery-sync',
}

# Firestore collection names for each source
CONNECTION_COLLECTIONS = [
    'ga_connections',
    'activecampaign_connections', 
    'stripe_connections',
    'quickbooks_connections',
    'google_ads_connections',
    'dataforseo_connections',
]


def trigger_sync(source_type: str, organization_id: str) -> dict:
    """Trigger a sync for a specific source and organization"""
    
    function_url = SYNC_FUNCTIONS.get(source_type)
    if not function_url:
        return {
            'source': source_type,
            'organization_id': organization_id,
            'success': False,
            'error': f'Unknown source type: {source_type}'
        }
    
    try:
        # Use 'update' mode for nightly syncs (incremental, efficient)
        payload = {
            'organizationId': organization_id,
            'mode': 'update'  # Incremental sync, not full resync
        }
        
        response = requests.post(
            function_url,
            json=payload,
            timeout=300  # 5 minute timeout per sync
        )
        
        if response.ok:
            data = response.json()
            return {
                'source': source_type,
                'organization_id': organization_id,
                'success': True,
                'result': data
            }
        else:
            return {
                'source': source_type,
                'organization_id': organization_id,
                'success': False,
                'error': f'HTTP {response.status_code}: {response.text[:200]}'
            }
            
    except Exception as e:
        return {
            'source': source_type,
            'organization_id': organization_id,
            'success': False,
            'error': str(e)
        }


@functions_framework.http
def nightly_sync_scheduler(request):
    """
    Main entry point - triggered by Cloud Scheduler at midnight.
    Finds all connected sources and triggers update syncs.
    """
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    logger.info("🌙 Starting nightly sync scheduler...")
    
    db = firestore.Client()
    
    # Collect all sync tasks
    sync_tasks = []
    
    for collection_name in CONNECTION_COLLECTIONS:
        try:
            # Query for connected sources
            connections = db.collection(collection_name).where('status', '==', 'connected').stream()
            
            for doc in connections:
                organization_id = doc.id
                sync_tasks.append({
                    'source_type': collection_name,
                    'organization_id': organization_id
                })
                logger.info(f"Found connected {collection_name} for org: {organization_id}")
                
        except Exception as e:
            logger.warning(f"Error checking {collection_name}: {e}")
    
    logger.info(f"📋 Found {len(sync_tasks)} connected sources to sync")
    
    if not sync_tasks:
        return ({
            'success': True,
            'message': 'No connected sources found',
            'syncs_triggered': 0
        }, 200, headers)
    
    # Run syncs in parallel (max 5 concurrent)
    results = []
    successful = 0
    failed = 0
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(trigger_sync, task['source_type'], task['organization_id']): task 
            for task in sync_tasks
        }
        
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            
            if result['success']:
                successful += 1
                logger.info(f"✅ {result['source']} sync completed for {result['organization_id']}")
            else:
                failed += 1
                logger.error(f"❌ {result['source']} sync failed for {result['organization_id']}: {result.get('error')}")
    
    logger.info(f"🏁 Nightly sync complete: {successful} successful, {failed} failed")
    
    return ({
        'success': True,
        'message': f'Nightly sync complete: {successful} successful, {failed} failed',
        'syncs_triggered': len(sync_tasks),
        'successful': successful,
        'failed': failed,
        'results': results
    }, 200, headers)
