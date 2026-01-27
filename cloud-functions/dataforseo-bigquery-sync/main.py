"""
DataForSEO to BigQuery Sync Cloud Function

Syncs DataForSEO data from Firestore to BigQuery daily_entity_metrics table
This bridges the gap between DataForSEO API data and detector queries
"""
import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@functions_framework.http
def sync_dataforseo_to_bigquery(request):
    """Sync DataForSEO data from Firestore to BigQuery"""
    
    # Parse request
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    
    logger.info(f"Starting DataForSEO sync for org: {organization_id}")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        results = {
            'pagesProcessed': 0,
            'keywordsProcessed': 0,
            'backlinksProcessed': 0,
            'rowsInserted': 0,
        }
        
        # 1. Fetch DataForSEO pages from Firestore
        pages_ref = db.collection('dataforseo_pages').where('organizationId', '==', organization_id)
        pages_docs = pages_ref.stream()
        
        # 2. Fetch keywords
        keywords_ref = db.collection('dataforseo_keywords').where('organizationId', '==', organization_id)
        keywords_docs = keywords_ref.stream()
        
        # 3. Fetch backlinks
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
        
        logger.info(f"Loaded {results['pagesProcessed']} pages, {results['keywordsProcessed']} keywords, {results['backlinksProcessed']} backlinks")
        
        # Prepare rows for BigQuery
        rows = []
        today = datetime.utcnow().date().isoformat()
        
        for url, page_data in pages_by_url.items():
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
                
                # Timestamps
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }
            
            rows.append(row)
        
        # Insert into BigQuery
        if rows:
            dataset = bq.dataset('marketing_ai')
            table = dataset.table('daily_entity_metrics')
            
            errors = bq.insert_rows_json(table, rows, skip_invalid_rows=True, ignore_unknown_values=True)
            
            if errors:
                logger.error(f"BigQuery insert errors: {errors}")
                return {
                    'success': False,
                    'error': 'Some rows failed to insert',
                    'errors': errors[:5],  # First 5 errors
                    **results
                }, 500
            
            results['rowsInserted'] = len(rows)
        
        logger.info(f"✅ Sync complete: {results['rowsInserted']} rows inserted")
        
        return {
            'success': True,
            **results,
            'message': f"Synced {results['rowsInserted']} rows to BigQuery"
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Sync failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }, 500
