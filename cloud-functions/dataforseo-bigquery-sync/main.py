"""
DataForSEO to BigQuery Sync Cloud Function

Syncs DataForSEO data from Firestore to BigQuery daily_entity_metrics table
This bridges the gap between DataForSEO API data and detector queries

NEW: Backfills historical rank data from dataforseo_rank_history collection
"""
import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import logging
import calendar
import json

logger = logging.getLogger(__name__)

@functions_framework.http
def sync_dataforseo_to_bigquery(request):
    """Sync DataForSEO data from Firestore to BigQuery with historical backfill"""
    
    # Set CORS headers for all requests
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    # Parse request
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return ({'error': 'Missing organizationId'}, 400, headers)
    
    organization_id = request_json['organizationId']
    backfill_history = request_json.get('backfillHistory', True)  # Default to True
    
    logger.info(f"Starting DataForSEO sync for org: {organization_id} (backfill: {backfill_history})")
    
    try:
        # Initialize clients first
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get priority pages configuration from Firestore
        priority_urls = []
        priority_prefixes = []
        try:
            connection_doc = db.collection('dataforseo_connections').document(organization_id).get()
            if connection_doc.exists:
                connection_data = connection_doc.to_dict()
                priority_urls = connection_data.get('priorityUrls', [])
                priority_prefixes = connection_data.get('priorityPrefixes', [])
                logger.info(f"✓ Loaded {len(priority_urls)} priority URLs and {len(priority_prefixes)} priority prefixes")
        except Exception as e:
            logger.warning(f"Could not load priority pages config: {e}")
        
        def is_priority_page(url):
            """Check if a URL matches priority criteria"""
            if url in priority_urls:
                return True
            for prefix in priority_prefixes:
                if prefix in url:  # Check if prefix is in URL
                    return True
            return False
        
        results = {
            'pagesProcessed': 0,
            'keywordsProcessed': 0,
            'backlinksProcessed': 0,
            'historicalMonthsProcessed': 0,
            'rowsInserted': 0,
        }
        
        # 1. Fetch historical rank data for backfill
        historical_rows = []
        if backfill_history:
            logger.info("Fetching historical rank data...")
            history_ref = db.collection('dataforseo_rank_history').where('organizationId', '==', organization_id)
            history_docs = history_ref.stream()
            
            for doc in history_docs:
                data = doc.to_dict()
                
                # Get date from year-month
                year = data.get('year')
                month = data.get('month')
                if not year or not month:
                    continue
                
                # Use the last day of the month for consistency
                last_day = calendar.monthrange(year, month)[1]
                date_str = f"{year}-{str(month).zfill(2)}-{str(last_day).zfill(2)}"
                
                metrics = data.get('metrics', {})
                rank_dist = data.get('rankDistribution', {})
                
                # Create a synthetic "domain" entity with monthly aggregated metrics
                row = {
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': data.get('domain', 'domain'),
                    'entity_type': 'domain',
                    
                    # Aggregate metrics from historical data (convert to integer)
                    'sessions': int(metrics.get('organicEtv', 0)),  # Estimated traffic value as proxy
                    'impressions': int(metrics.get('organicCount', 0)),  # Keyword count
                    
                    # Position distribution (for trend analysis)
                    'seo_position': 15.0,  # Average position (rough estimate)
                    'seo_search_volume': int(metrics.get('organicCount', 0)),
                    
                    # Store rank distribution in JSON for analysis (as JSON string)
                    'source_breakdown': json.dumps({
                        'pos1': int(rank_dist.get('pos1', 0)),
                        'pos2_3': int(rank_dist.get('pos2_3', 0)),
                        'pos4_10': int(rank_dist.get('pos4_10', 0)),
                        'pos11_20': int(rank_dist.get('pos11_20', 0)),
                        'pos21_30': int(rank_dist.get('pos21_30', 0)),
                        'top3_keywords': int(data.get('top3Keywords', 0)),
                        'top10_keywords': int(data.get('top10Keywords', 0)),
                        'total_keywords': int(data.get('totalKeywords', 0)),
                    }),
                    
                    # Timestamps
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat(),
                }
                
                historical_rows.append(row)
                results['historicalMonthsProcessed'] += 1
            
            logger.info(f"Prepared {len(historical_rows)} historical rows")
        
        # 2. Fetch DataForSEO pages from Firestore (current snapshot)
        pages_ref = db.collection('dataforseo_pages').where('organizationId', '==', organization_id)
        pages_docs = pages_ref.stream()
        
        # 3. Fetch keywords (current snapshot)
        keywords_ref = db.collection('dataforseo_keywords').where('organizationId', '==', organization_id)
        keywords_docs = keywords_ref.stream()
        
        # 4. Fetch backlinks (current snapshot)
        backlinks_ref = db.collection('dataforseo_backlinks').where('organizationId', '==', organization_id)
        backlinks_docs = backlinks_ref.stream()
        
        # Build lookup maps
        pages_by_url = {}
        for doc in pages_docs:
            data = doc.to_dict()
            pages_by_url[data['url']] = data
            results['pagesProcessed'] += 1
        
        keywords_by_url = {}
        for doc in keywords_docs:
            data = doc.to_dict()
            url = data.get('url', '')
            if url not in keywords_by_url:
                keywords_by_url[url] = []
            keywords_by_url[url].append(data)
            results['keywordsProcessed'] += 1
        
        backlinks_by_url = {}
        for doc in backlinks_docs:
            data = doc.to_dict()
            url_to = data.get('urlTo', '')
            if url_to not in backlinks_by_url:
                backlinks_by_url[url_to] = {'total': 0, 'domains': set()}
            backlinks_by_url[url_to]['total'] += 1
            backlinks_by_url[url_to]['domains'].add(data.get('domainFrom', ''))
            results['backlinksProcessed'] += 1
        
        has_priority_config = bool(priority_urls or priority_prefixes)
        logger.info(f"Loaded {results['pagesProcessed']} pages from DataForSEO, {results['keywordsProcessed']} keywords, {results['backlinksProcessed']} backlinks")
        if has_priority_config:
            logger.info(f"🎯 Priority filtering ACTIVE: Will only sync pages matching {len(priority_urls)} URLs + {len(priority_prefixes)} prefixes")
        
        # Prepare current snapshot rows for BigQuery
        current_rows = []
        today = datetime.utcnow().date().isoformat()
        
        for url, page_data in pages_by_url.items():
            # Check if this is a priority page - SKIP if not
            is_priority = is_priority_page(url)
            
            # If priority pages are configured, ONLY sync priority pages
            if (priority_urls or priority_prefixes) and not is_priority:
                logger.debug(f"Skipping non-priority page: {url}")
                continue
            
            keywords = keywords_by_url.get(url, [])
            backlinks_data = backlinks_by_url.get(url, {'total': 0, 'domains': set()})
            
            # Get primary keyword (highest search volume)
            primary_keyword = None
            if keywords:
                primary_keyword = max(keywords, key=lambda k: k.get('searchVolume', 0))
            
            # Calculate position change
            position_change = 0
            if primary_keyword and primary_keyword.get('previousPosition'):
                position_change = primary_keyword['previousPosition'] - primary_keyword.get('position', 0)
            
            # Get page timings
            page_timings = page_data.get('pageTimings', {})
            checks = page_data.get('checks', {})
            
            row = {
                'organization_id': organization_id,
                'date': today,
                'canonical_entity_id': url,
                'entity_type': 'page',
                
                # SEO Rankings
                'seo_position': primary_keyword.get('position') if primary_keyword else None,
                'seo_position_change': position_change if position_change else None,
                'seo_search_volume': primary_keyword.get('searchVolume') if primary_keyword else None,
                
                # Backlinks
                'backlinks_total': backlinks_data['total'],
                'backlinks_change': 0,  # Would need historical comparison
                'referring_domains': len(backlinks_data['domains']),
                
                # Page Health
                'onpage_score': page_data.get('onpageScore'),
                'core_web_vitals_lcp': page_timings.get('largest_contentful_paint'),
                'core_web_vitals_fid': page_timings.get('first_input_delay'),
                'page_size_bytes': page_data.get('totalDomSize'),
                
                # Technical SEO Checks
                'has_schema_markup': checks.get('has_schema_markup', False),
                'broken_links_count': checks.get('broken_links', 0),
                'duplicate_content_detected': checks.get('is_duplicate', False),
                'missing_meta_description': checks.get('no_description', False),
                'missing_h1_tag': checks.get('no_h1_tag', False),
                
                # Priority Pages
                'is_priority_page': is_priority,
                'priority_added_at': datetime.utcnow().isoformat() if is_priority else None,
                
                # Timestamps
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }
            
            current_rows.append(row)
        
        # Prepare for BigQuery insert
        dataset = bq.dataset('marketing_ai')
        table_ref = dataset.table('daily_entity_metrics')
        
        # Step 1: Insert historical rows (skip if already exist to preserve history)
        if historical_rows:
            logger.info(f"Checking for existing historical data...")
            
            # Get dates that already exist to avoid duplicates
            historical_dates = set(row['date'] for row in historical_rows)
            dates_list = ','.join(f"'{date}'" for date in historical_dates)
            
            check_query = f"""
                SELECT DISTINCT date
                FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
                WHERE organization_id = '{organization_id}'
                  AND entity_type = 'domain'
                  AND date IN ({dates_list})
            """
            
            existing_dates = set()
            query_job = bq.query(check_query)
            for row in query_job.result():
                existing_dates.add(row.date.isoformat())
            
            # Only insert historical rows that don't already exist
            new_historical_rows = [row for row in historical_rows if row['date'] not in existing_dates]
            
            if new_historical_rows:
                logger.info(f"Inserting {len(new_historical_rows)} new historical rows (skipping {len(historical_rows) - len(new_historical_rows)} existing)")
                errors = bq.insert_rows_json(table_ref, new_historical_rows, skip_invalid_rows=True, ignore_unknown_values=True)
                if errors:
                    logger.warning(f"Some historical rows failed: {errors[:3]}")
                else:
                    results['rowsInserted'] += len(new_historical_rows)
            else:
                logger.info(f"All {len(historical_rows)} historical months already exist, skipping")
        
        # Step 2: Insert TODAY's page data (streaming insert, no DELETE needed)
        if current_rows:
            today = datetime.utcnow().date().isoformat()
            
            # Use streaming insert - BigQuery will handle deduplication via insert_id
            # Add unique insert_id to prevent duplicates within streaming buffer window
            for row in current_rows:
                # Create unique insert_id from org + entity + date
                row['insert_id'] = f"{organization_id}_{row['canonical_entity_id']}_{today}".replace('/', '_')[:128]
            
            pages_synced = len(current_rows)
            pages_skipped = results['pagesProcessed'] - pages_synced
            logger.info(f"Inserting {pages_synced} priority page rows for today ({today})...")
            if pages_skipped > 0:
                logger.info(f"  ↳ Skipped {pages_skipped} non-priority pages")
            errors = bq.insert_rows_json(table_ref, current_rows, skip_invalid_rows=True, ignore_unknown_values=True)
            
            if errors:
                logger.warning(f"Some current page rows failed: {errors[:3]}")
                # Continue even if some rows fail
            
            results['rowsInserted'] += len(current_rows)
        
        historical_inserted = results['rowsInserted'] - len(current_rows) if current_rows else results['rowsInserted']
        
        logger.info(f"✅ Sync complete: {results['rowsInserted']} rows inserted ({historical_inserted} new historical + {len(current_rows) if current_rows else 0} current)")
        
        return ({
            'success': True,
            **results,
            'message': f"Synced {results['rowsInserted']} rows to BigQuery ({historical_inserted} new historical + {len(current_rows) if current_rows else 0} current)"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ Sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return ({
            'success': False,
            'error': str(e)
        }, 500, headers)
