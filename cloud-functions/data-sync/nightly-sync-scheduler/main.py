"""
Nightly Sync Scheduler - Triggers update syncs for all connected data sources

Runs via Cloud Scheduler at midnight each night.
Checks Firestore for all connected sources and triggers their sync functions.

Phase 1: Data source syncs (GA4, Stripe, etc.)
Phase 2: Rollup ETLs (daily → weekly → monthly → L12M → all-time)
"""

import functions_framework
from google.cloud import firestore
import requests
import logging
from datetime import datetime
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

# GA4 raw BigQuery sync - runs independently of Firestore connections
# Reads directly from GA4 BigQuery export (analytics_301802672)
GA4_RAW_SYNC_URL = 'https://us-central1-opsos-864a1.cloudfunctions.net/ga4-raw-bigquery-sync'

# YTJobs MySQL sync - syncs marketplace metrics from MySQL read replica
YTJOBS_MYSQL_SYNC_URL = 'https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync'

# Reporting table refresh - syncs reporting tables from master view
REPORTING_REFRESH_URL = 'https://us-central1-opsos-864a1.cloudfunctions.net/reporting-table-refresh'

# Rollup ETL Cloud Function URLs (run in order after data syncs)
ROLLUP_FUNCTIONS = {
    'daily': 'https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl',
    'weekly': 'https://us-central1-opsos-864a1.cloudfunctions.net/weekly-rollup-etl',
    'monthly': 'https://us-central1-opsos-864a1.cloudfunctions.net/monthly-rollup-etl',
    'l12m': 'https://us-central1-opsos-864a1.cloudfunctions.net/l12m-rollup-etl',
    'alltime': 'https://us-central1-opsos-864a1.cloudfunctions.net/alltime-rollup-etl',
}

# Order matters: daily must run before weekly/monthly, monthly before L12M/all-time
ROLLUP_ORDER = ['daily', 'weekly', 'monthly', 'l12m', 'alltime']

# Firestore collection names for each source
CONNECTION_COLLECTIONS = [
    'ga_connections',
    'activecampaign_connections', 
    'stripe_connections',
    'quickbooks_connections',
    'google_ads_connections',
    'dataforseo_connections',
]


def trigger_sync(source_type: str, organization_id: str, custom_url: str = None) -> dict:
    """Trigger a sync for a specific source and organization"""
    
    function_url = custom_url or SYNC_FUNCTIONS.get(source_type)
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


def trigger_rollup(rollup_type: str, organization_id: str) -> dict:
    """Trigger a rollup ETL for a specific organization"""
    
    function_url = ROLLUP_FUNCTIONS.get(rollup_type)
    if not function_url:
        return {
            'rollup': rollup_type,
            'organization_id': organization_id,
            'success': False,
            'error': f'Unknown rollup type: {rollup_type}'
        }
    
    try:
        payload = {
            'organizationId': organization_id
        }
        
        # Weekly rollup: process current week
        # Monthly rollup: process current month
        # L12M and all-time: use current date
        
        response = requests.post(
            function_url,
            json=payload,
            timeout=540  # 9 minute timeout for rollups (they can be slow)
        )
        
        if response.ok:
            data = response.json()
            return {
                'rollup': rollup_type,
                'organization_id': organization_id,
                'success': True,
                'result': data
            }
        else:
            return {
                'rollup': rollup_type,
                'organization_id': organization_id,
                'success': False,
                'error': f'HTTP {response.status_code}: {response.text[:200]}'
            }
            
    except Exception as e:
        return {
            'rollup': rollup_type,
            'organization_id': organization_id,
            'success': False,
            'error': str(e)
        }


def run_rollups_for_org(organization_id: str) -> list:
    """
    Run all rollup ETLs in order for an organization.
    Order: daily → weekly → monthly → L12M → all-time
    
    Each rollup depends on the previous one, so we run them sequentially.
    """
    results = []
    
    for rollup_type in ROLLUP_ORDER:
        logger.info(f"📊 Running {rollup_type} rollup for {organization_id}...")
        result = trigger_rollup(rollup_type, organization_id)
        results.append(result)
        
        if result['success']:
            logger.info(f"✅ {rollup_type} rollup completed for {organization_id}")
        else:
            logger.error(f"❌ {rollup_type} rollup failed for {organization_id}: {result.get('error')}")
            # Continue with next rollup even if one fails
    
    return results


@functions_framework.http
def nightly_sync_scheduler(request):
    """
    Main entry point - triggered by Cloud Scheduler at midnight.
    
    Phase 1: Syncs raw data from all connected sources (parallel)
    Phase 2: Runs rollup ETLs to aggregate data (sequential per org, parallel across orgs)
    
    Hierarchy: daily → weekly → monthly → L12M → all-time
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
    
    # =========================================================================
    # PHASE 1: Data Source Syncs
    # =========================================================================
    logger.info("📥 PHASE 1: Syncing data sources...")
    
    # Collect all sync tasks
    sync_tasks = []
    organizations = set()  # Track unique orgs for rollups
    
    for collection_name in CONNECTION_COLLECTIONS:
        try:
            # Query for connected sources
            connections = db.collection(collection_name).where('status', '==', 'connected').stream()
            
            for doc in connections:
                organization_id = doc.id
                organizations.add(organization_id)
                sync_tasks.append({
                    'source_type': collection_name,
                    'organization_id': organization_id
                })
                logger.info(f"Found connected {collection_name} for org: {organization_id}")
                
        except Exception as e:
            logger.warning(f"Error checking {collection_name}: {e}")
    
    # Also run GA4 raw BigQuery sync (reads from BigQuery export directly)
    # This syncs traffic_source, page, and google_ads_campaign entity types with conversions/engagement
    logger.info("📊 Adding GA4 raw BigQuery sync to tasks...")
    ga4_raw_task = {
        'source_type': 'ga4_raw_bigquery',
        'organization_id': 'SBjucW1ztDyFYWBz7ZLE',  # Default org
        'custom_url': GA4_RAW_SYNC_URL
    }
    sync_tasks.append(ga4_raw_task)
    organizations.add('SBjucW1ztDyFYWBz7ZLE')
    
    # Run YTJobs MySQL sync (marketplace metrics: signups, jobs, applications, revenue)
    logger.info("📊 Adding YTJobs MySQL sync to tasks...")
    ytjobs_task = {
        'source_type': 'ytjobs_mysql',
        'organization_id': 'ytjobs',
        'custom_url': YTJOBS_MYSQL_SYNC_URL
    }
    sync_tasks.append(ytjobs_task)
    organizations.add('ytjobs')
    
    # Add reporting table refresh (runs after all data syncs)
    logger.info("📊 Adding reporting table refresh to tasks...")
    reporting_refresh_task = {
        'source_type': 'reporting_refresh',
        'organization_id': 'SBjucW1ztDyFYWBz7ZLE',
        'custom_url': REPORTING_REFRESH_URL
    }
    sync_tasks.append(reporting_refresh_task)
    
    logger.info(f"📋 Found {len(sync_tasks)} connected sources to sync across {len(organizations)} organizations")
    
    # Run syncs in parallel (max 5 concurrent)
    sync_results = []
    sync_successful = 0
    sync_failed = 0
    
    if sync_tasks:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(trigger_sync, task['source_type'], task['organization_id'], task.get('custom_url')): task 
                for task in sync_tasks
            }
            
            for future in as_completed(futures):
                result = future.result()
                sync_results.append(result)
                
                if result['success']:
                    sync_successful += 1
                    logger.info(f"✅ {result['source']} sync completed for {result['organization_id']}")
                else:
                    sync_failed += 1
                    logger.error(f"❌ {result['source']} sync failed for {result['organization_id']}: {result.get('error')}")
        
        logger.info(f"📥 Phase 1 complete: {sync_successful} successful, {sync_failed} failed")
    else:
        logger.info("📥 Phase 1: No data sources to sync")
    
    # =========================================================================
    # PHASE 2: Rollup ETLs
    # =========================================================================
    logger.info("📊 PHASE 2: Running rollup ETLs...")
    
    rollup_results = []
    rollup_successful = 0
    rollup_failed = 0
    
    if organizations:
        # Run rollups for each organization
        # Organizations can run in parallel, but rollups within an org run sequentially
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(run_rollups_for_org, org_id): org_id 
                for org_id in organizations
            }
            
            for future in as_completed(futures):
                org_results = future.result()
                rollup_results.extend(org_results)
                
                for result in org_results:
                    if result['success']:
                        rollup_successful += 1
                    else:
                        rollup_failed += 1
        
        logger.info(f"📊 Phase 2 complete: {rollup_successful} successful, {rollup_failed} failed")
    else:
        logger.info("📊 Phase 2: No organizations to process rollups for")
    
    # =========================================================================
    # Summary
    # =========================================================================
    logger.info(f"🏁 Nightly sync complete!")
    logger.info(f"   Data syncs: {sync_successful} successful, {sync_failed} failed")
    logger.info(f"   Rollups: {rollup_successful} successful, {rollup_failed} failed")
    
    return ({
        'success': True,
        'message': f'Nightly sync complete',
        'phase1_data_syncs': {
            'triggered': len(sync_tasks),
            'successful': sync_successful,
            'failed': sync_failed
        },
        'phase2_rollups': {
            'organizations': len(organizations),
            'successful': rollup_successful,
            'failed': rollup_failed
        },
        'sync_results': sync_results,
        'rollup_results': rollup_results
    }, 200, headers)
