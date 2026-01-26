"""
Daily Rollup ETL
Reads existing Firestore monthly data and creates daily entity metrics for Scout AI
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import json
import logging
import calendar
from typing import Dict, List, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
db = firestore.Client()
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"
ETL_LOG_TABLE = "etl_run_log"


def get_entity_mapping(organization_id: str) -> Dict[str, Dict]:
    """
    Load entity mappings to translate source IDs to canonical IDs
    Returns: {source: {source_entity_id: canonical_entity_id}}
    """
    mappings = {}
    
    entity_map_ref = db.collection('entity_map').where('organizationId', '==', organization_id).stream()
    
    for doc in entity_map_ref:
        data = doc.to_dict()
        source = data.get('source')
        source_id = data.get('source_entity_id')
        canonical_id = data.get('canonical_entity_id')
        
        if source not in mappings:
            mappings[source] = {}
        
        mappings[source][source_id] = canonical_id
    
    logger.info(f"Loaded {len(mappings)} source mappings")
    return mappings


def process_ga_pages(organization_id: str, start_date: datetime, end_date: datetime, entity_map: Dict) -> List[Dict]:
    """Process GA4 pages data into daily metrics"""
    logger.info("Processing GA4 pages...")
    
    metrics = []
    
    # Read ga_pages collection
    pages_ref = db.collection('ga_pages').where('organizationId', '==', organization_id).stream()
    
    for page_doc in pages_ref:
        page_data = page_doc.to_dict()
        page_path = page_data.get('pagePath', '')
        
        # Get canonical ID
        canonical_id = entity_map.get('ga4', {}).get(page_path)
        if not canonical_id:
            canonical_id = f"page_{page_path.replace('/', '_').strip('_')}"
        
        # Data is stored in months object: {"2025-10": {users: 100, pageViews: 200, ...}, "2025-11": {...}}
        months_data = page_data.get('months', {})
        
        if not months_data:
            continue
        
        # Process each month
        for month_key, month_metrics in months_data.items():
            # Parse month_key (format: "YYYY-MM")
            try:
                year, month = month_key.split('-')
                year = int(year)
                month = int(month)
            except (ValueError, AttributeError):
                continue
            
            # Extract metrics
            pageviews = month_metrics.get('pageViews', 0)
            users = month_metrics.get('users', 0)
            conversions = month_metrics.get('conversions', 0)
            avg_time = month_metrics.get('avgSessionDuration', 0)
            
            # Calculate days in that month
            days_in_month = calendar.monthrange(year, month)[1]
            
            # Create daily estimates for each day in the range
            month_start = datetime(year, month, 1).date()
            month_end = datetime(year, month, days_in_month).date()
            
            # Only process days within our requested range
            process_start = max(month_start, start_date.date())
            process_end = min(month_end, end_date.date())
            
            current_date = process_start
            while current_date <= process_end:
                metrics.append({
                    'organization_id': organization_id,
                    'date': current_date.isoformat(),
                    'canonical_entity_id': canonical_id,
                    'entity_type': 'page',
                    'pageviews': int(pageviews / days_in_month) if pageviews else 0,
                    'sessions': int(pageviews / days_in_month) if pageviews else 0,  # Approximation
                    'users': int(users / days_in_month) if users else 0,
                    'avg_session_duration': avg_time,
                    'bounce_rate': 0.0,
                    'conversions': int(conversions / days_in_month) if conversions else 0,
                    'conversion_rate': (conversions / pageviews * 100) if pageviews > 0 else 0,
                    'impressions': 0,
                    'clicks': 0,
                    'revenue': 0.0,
                    'cost': 0.0,
                    'source_breakdown': {'ga4': int(pageviews / days_in_month) if pageviews else 0},
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
                current_date += timedelta(days=1)
    
    logger.info(f"Processed {len(metrics)} daily page metrics")
    return metrics


def process_ga_campaigns(organization_id: str, start_date: datetime, end_date: datetime, entity_map: Dict) -> List[Dict]:
    """Process GA4 campaigns data into daily metrics"""
    logger.info("Processing GA4 campaigns...")
    
    metrics = []
    
    campaigns_ref = db.collection('ga_campaigns').where('organizationId', '==', organization_id).stream()
    
    for campaign_doc in campaigns_ref:
        campaign_data = campaign_doc.to_dict()
        campaign_name = campaign_data.get('campaignName', '')
        campaign_id = campaign_data.get('campaignId', campaign_name)
        
        # Get canonical ID
        canonical_id = entity_map.get('ga4', {}).get(campaign_id)
        if not canonical_id:
            canonical_id = f"campaign_{campaign_name.lower().replace(' ', '_')}"
        
        # Data is stored in months object: {"2025-10": {sessions: 100, conversions: 10, ...}, ...}
        months_data = campaign_data.get('months', {})
        
        if not months_data:
            continue
        
        # Process each month
        for month_key, month_metrics in months_data.items():
            # Parse month_key (format: "YYYY-MM")
            try:
                year, month = month_key.split('-')
                year = int(year)
                month = int(month)
            except (ValueError, AttributeError):
                continue
            
            # Extract metrics
            sessions = month_metrics.get('sessions', 0)
            users = month_metrics.get('newUsers', month_metrics.get('users', 0))
            conversions = month_metrics.get('conversions', 0)
            revenue = month_metrics.get('revenue', 0.0)
            cost = month_metrics.get('spend', month_metrics.get('cost', 0.0))
            
            # Calculate days in that month
            days_in_month = calendar.monthrange(year, month)[1]
            
            month_start = datetime(year, month, 1).date()
            month_end = datetime(year, month, days_in_month).date()
            
            process_start = max(month_start, start_date.date())
            process_end = min(month_end, end_date.date())
            
            current_date = process_start
            while current_date <= process_end:
                daily_sessions = int(sessions / days_in_month) if sessions else 0
                daily_cost = cost / days_in_month if cost else 0
                daily_revenue = revenue / days_in_month if revenue else 0
                daily_conversions = int(conversions / days_in_month) if conversions else 0
                
                metrics.append({
                    'organization_id': organization_id,
                    'date': current_date.isoformat(),
                    'canonical_entity_id': canonical_id,
                    'entity_type': 'campaign',
                    'sessions': daily_sessions,
                    'users': int(users / days_in_month) if users else 0,
                    'conversions': daily_conversions,
                    'conversion_rate': (daily_conversions / daily_sessions * 100) if daily_sessions > 0 else 0,
                    'revenue': daily_revenue,
                    'cost': daily_cost,
                    'profit': daily_revenue - daily_cost,
                    'roas': (daily_revenue / daily_cost) if daily_cost > 0 else 0,
                    'roi': ((daily_revenue - daily_cost) / daily_cost * 100) if daily_cost > 0 else 0,
                    'impressions': int(month_metrics.get('impressions', 0) / days_in_month) if month_metrics.get('impressions') else 0,
                    'clicks': int(month_metrics.get('clicks', 0) / days_in_month) if month_metrics.get('clicks') else 0,
                    'pageviews': 0,
                    'source_breakdown': {'ga4': daily_sessions},
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
                current_date += timedelta(days=1)
    
    logger.info(f"Processed {len(metrics)} daily campaign metrics")
    return metrics


def process_dataforseo_keywords(organization_id: str, start_date: datetime, end_date: datetime, entity_map: Dict) -> List[Dict]:
    """Process DataForSEO keywords into daily metrics"""
    logger.info("Processing DataForSEO keywords...")
    
    metrics = []
    
    keywords_ref = db.collection('dataforseo_keywords').where('organizationId', '==', organization_id).stream()
    
    for keyword_doc in keywords_ref:
        keyword_data = keyword_doc.to_dict()
        keyword = keyword_data.get('keyword', '')
        
        canonical_id = entity_map.get('dataforseo', {}).get(keyword)
        if not canonical_id:
            canonical_id = f"keyword_{keyword.lower().replace(' ', '_')}"
        
        position = keyword_data.get('position', 0)
        search_volume = keyword_data.get('searchVolume', 0)
        
        # DataForSEO is typically point-in-time, so we'll create a metric for the date range
        current_date = start_date.date()
        while current_date <= end_date.date():
            metrics.append({
                'organization_id': organization_id,
                'date': current_date.isoformat(),
                'canonical_entity_id': canonical_id,
                'entity_type': 'keyword',
                'position': position,
                'search_volume': search_volume,
                'impressions': search_volume,  # Approximate
                'clicks': 0,
                'sessions': 0,
                'conversions': 0,
                'revenue': 0.0,
                'cost': 0.0,
                'source_breakdown': {'dataforseo': 1},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
            current_date += timedelta(days=1)
    
    logger.info(f"Processed {len(metrics)} daily keyword metrics")
    return metrics


def process_stripe_products(organization_id: str, start_date: datetime, end_date: datetime, entity_map: Dict) -> List[Dict]:
    """Process Stripe products into daily metrics"""
    logger.info("Processing Stripe products...")
    
    metrics = []
    
    # Read stripe_invoices to get revenue by product
    invoices_ref = db.collection('stripe_invoices').where('organizationId', '==', organization_id).stream()
    
    product_daily_revenue = {}
    product_daily_conversions = {}
    
    for invoice_doc in invoices_ref:
        invoice_data = invoice_doc.to_dict()
        
        # Use 'created' timestamp instead of 'date'
        invoice_date = invoice_data.get('created')
        
        if not invoice_date:
            continue
        
        # Convert Firestore timestamp to date
        if hasattr(invoice_date, 'date'):
            invoice_date = invoice_date.date()
        elif isinstance(invoice_date, str):
            invoice_date = datetime.fromisoformat(invoice_date).date()
        
        # Check if in range
        if invoice_date < start_date.date() or invoice_date > end_date.date():
            continue
        
        # Use 'total' instead of 'amount' and convert cents to dollars
        amount = invoice_data.get('total', 0) / 100
        
        # Extract products from lineItems array
        line_items = invoice_data.get('lineItems', [])
        
        if not line_items:
            # No line items, aggregate as 'unknown' product
            product_id = 'unknown'
            canonical_id = entity_map.get('stripe', {}).get(product_id, f'product_{product_id}')
            
            key = (invoice_date.isoformat(), canonical_id)
            if key not in product_daily_revenue:
                product_daily_revenue[key] = 0
                product_daily_conversions[key] = 0
            
            product_daily_revenue[key] += amount
            product_daily_conversions[key] += 1
        else:
            # Process each line item
            for item in line_items:
                product_id = item.get('productId', 'unknown')
                item_amount = item.get('amount', 0) / 100
                
                canonical_id = entity_map.get('stripe', {}).get(product_id, f'product_{product_id}')
                
                key = (invoice_date.isoformat(), canonical_id)
                if key not in product_daily_revenue:
                    product_daily_revenue[key] = 0
                    product_daily_conversions[key] = 0
                
                product_daily_revenue[key] += item_amount
                product_daily_conversions[key] += item.get('quantity', 1)
    
    # Convert to metrics
    for (date_str, canonical_id), revenue in product_daily_revenue.items():
        conversions = product_daily_conversions.get((date_str, canonical_id), 1)
        metrics.append({
            'organization_id': organization_id,
            'date': date_str,
            'canonical_entity_id': canonical_id,
            'entity_type': 'product',
            'revenue': revenue,
            'conversions': conversions,
            'cost': 0.0,
            'profit': revenue,
            'impressions': 0,
            'clicks': 0,
            'sessions': 0,
            'source_breakdown': {'stripe': 1},
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        })
    
    logger.info(f"Processed {len(metrics)} daily product metrics from Stripe")
    return metrics


def process_activecampaign_emails(organization_id: str, start_date: datetime, end_date: datetime, entity_map: Dict) -> List[Dict]:
    """Process ActiveCampaign email campaigns into daily metrics"""
    logger.info("Processing ActiveCampaign emails...")
    
    metrics = []
    
    campaigns_ref = db.collection('activecampaign_campaigns').where('organizationId', '==', organization_id).stream()
    
    for campaign_doc in campaigns_ref:
        campaign_data = campaign_doc.to_dict()
        campaign_name = campaign_data.get('name', '')
        
        # Use 'activecampaignId' instead of 'id'
        campaign_id = str(campaign_data.get('activecampaignId', ''))
        
        canonical_id = entity_map.get('activecampaign', {}).get(campaign_id)
        if not canonical_id:
            # Clean campaign name for canonical ID
            clean_name = campaign_name.lower().replace(' ', '_').replace('-', '_')[:50]
            canonical_id = f"email_{clean_name}"
        
        # Use correct field names from actual data
        sends = campaign_data.get('sendAmt', 0)  # Was: total_sent
        opens = campaign_data.get('opens', 0)  # Was: total_opens
        clicks = campaign_data.get('linkClicks', 0)  # Was: total_clicks
        unique_opens = campaign_data.get('uniqueOpens', 0)
        unique_clicks = campaign_data.get('uniqueLinkClicks', 0)
        
        open_rate = (opens / sends * 100) if sends > 0 else 0
        ctr = (clicks / opens * 100) if opens > 0 else 0
        unique_open_rate = (unique_opens / sends * 100) if sends > 0 else 0
        
        # Use 'sentAt' instead of 'send_date'
        send_date = campaign_data.get('sentAt')
        
        if send_date:
            # Convert Firestore timestamp to date
            if hasattr(send_date, 'date'):
                send_date = send_date.date()
            elif isinstance(send_date, str):
                send_date = datetime.fromisoformat(send_date).date()
            
            if start_date.date() <= send_date <= end_date.date():
                metrics.append({
                    'organization_id': organization_id,
                    'date': send_date.isoformat(),
                    'canonical_entity_id': canonical_id,
                    'entity_type': 'email',
                    'sends': sends,
                    'opens': opens,
                    'clicks': clicks,
                    'open_rate': open_rate,
                    'click_through_rate': ctr,
                    'impressions': sends,
                    'sessions': clicks,  # Use clicks as proxy for sessions
                    'conversions': 0,
                    'revenue': 0.0,
                    'cost': 0.0,
                    'source_breakdown': {
                        'activecampaign': 1,
                        'unique_opens': unique_opens,
                        'unique_clicks': unique_clicks,
                        'unique_open_rate': unique_open_rate
                    },
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
    
    logger.info(f"Processed {len(metrics)} daily email metrics from ActiveCampaign")
    return metrics


def log_etl_run(organization_id: str, source: str, status: str, row_count: int, start_date: str, end_date: str, error_message: str = None):
    """Log ETL run metadata to BigQuery for monitoring"""
    try:
        log_entry = {
            'organization_id': organization_id,
            'source': source,
            'status': status,  # 'success', 'partial', 'failed'
            'row_count': row_count,
            'start_date': start_date,
            'end_date': end_date,
            'run_timestamp': datetime.utcnow().isoformat(),
            'error_message': error_message
        }
        
        table_ref = f"{PROJECT_ID}.{DATASET_ID}.{ETL_LOG_TABLE}"
        
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            schema=[
                bigquery.SchemaField("organization_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("row_count", "INT64", mode="REQUIRED"),
                bigquery.SchemaField("start_date", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("end_date", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("run_timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("error_message", "STRING", mode="NULLABLE"),
            ]
        )
        
        job = bq_client.load_table_from_json([log_entry], table_ref, job_config=job_config)
        job.result()
        
        logger.info(f"✅ Logged ETL run for {source}: {status}, {row_count} rows")
        
    except Exception as e:
        logger.error(f"❌ Error logging ETL run: {e}")
        # Don't raise - logging failures shouldn't break the ETL


def write_to_bigquery(metrics: List[Dict]):
    """Write daily metrics to BigQuery"""
    if not metrics:
        logger.warning("No metrics to write")
        return
    
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
    
    # Define schema
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        schema=[
            bigquery.SchemaField("organization_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("date", "DATE", mode="REQUIRED"),
            bigquery.SchemaField("canonical_entity_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("entity_type", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("impressions", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("clicks", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("sessions", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("users", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("pageviews", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("avg_session_duration", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("bounce_rate", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("engagement_rate", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("conversions", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("conversion_rate", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("revenue", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("cost", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("profit", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("ctr", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("cpc", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("cpa", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("roas", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("roi", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("position", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("search_volume", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("sends", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("opens", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("open_rate", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("click_through_rate", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("source_breakdown", "JSON", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE"),
        ]
    )
    
    try:
        job = bq_client.load_table_from_json(
            metrics,
            table_ref,
            job_config=job_config
        )
        job.result()  # Wait for completion
        
        logger.info(f"✅ Successfully wrote {len(metrics)} metrics to BigQuery")
        
    except Exception as e:
        logger.error(f"❌ Error writing to BigQuery: {e}")
        raise


@functions_framework.http
def run_daily_rollup(request):
    """
    HTTP Cloud Function to run daily rollup ETL
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "startDate": "2024-01-01",  // optional, defaults to 90 days ago
      "endDate": "2024-01-31"     // optional, defaults to today
    }
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    
    # Parse date range
    if 'startDate' in request_json:
        start_date = datetime.fromisoformat(request_json['startDate'])
    else:
        start_date = datetime.now() - timedelta(days=90)
    
    if 'endDate' in request_json:
        end_date = datetime.fromisoformat(request_json['endDate'])
    else:
        end_date = datetime.now()
    
    logger.info(f"🔄 Starting daily rollup for {organization_id} from {start_date.date()} to {end_date.date()}")
    
    try:
        # Load entity mappings
        entity_map = get_entity_mapping(organization_id)
        
        # Process each source with logging
        all_metrics = []
        sources_processed = {}
        
        # GA4 Pages
        try:
            pages_metrics = process_ga_pages(organization_id, start_date, end_date, entity_map)
            all_metrics.extend(pages_metrics)
            sources_processed['ga4_pages'] = len(pages_metrics)
            log_etl_run(organization_id, 'ga4_pages', 'success', len(pages_metrics), 
                       start_date.date().isoformat(), end_date.date().isoformat())
        except Exception as e:
            logger.error(f"Error processing GA4 pages: {e}")
            log_etl_run(organization_id, 'ga4_pages', 'failed', 0, 
                       start_date.date().isoformat(), end_date.date().isoformat(), str(e))
        
        # GA4 Campaigns
        try:
            campaigns_metrics = process_ga_campaigns(organization_id, start_date, end_date, entity_map)
            all_metrics.extend(campaigns_metrics)
            sources_processed['ga4_campaigns'] = len(campaigns_metrics)
            log_etl_run(organization_id, 'ga4_campaigns', 'success', len(campaigns_metrics),
                       start_date.date().isoformat(), end_date.date().isoformat())
        except Exception as e:
            logger.error(f"Error processing GA4 campaigns: {e}")
            log_etl_run(organization_id, 'ga4_campaigns', 'failed', 0,
                       start_date.date().isoformat(), end_date.date().isoformat(), str(e))
        
        # DataForSEO Keywords
        try:
            keywords_metrics = process_dataforseo_keywords(organization_id, start_date, end_date, entity_map)
            all_metrics.extend(keywords_metrics)
            sources_processed['dataforseo'] = len(keywords_metrics)
            log_etl_run(organization_id, 'dataforseo', 'success', len(keywords_metrics),
                       start_date.date().isoformat(), end_date.date().isoformat())
        except Exception as e:
            logger.error(f"Error processing DataForSEO keywords: {e}")
            log_etl_run(organization_id, 'dataforseo', 'failed', 0,
                       start_date.date().isoformat(), end_date.date().isoformat(), str(e))
        
        # Stripe Products
        try:
            products_metrics = process_stripe_products(organization_id, start_date, end_date, entity_map)
            all_metrics.extend(products_metrics)
            sources_processed['stripe'] = len(products_metrics)
            log_etl_run(organization_id, 'stripe', 'success', len(products_metrics),
                       start_date.date().isoformat(), end_date.date().isoformat())
        except Exception as e:
            logger.error(f"Error processing Stripe products: {e}")
            log_etl_run(organization_id, 'stripe', 'failed', 0,
                       start_date.date().isoformat(), end_date.date().isoformat(), str(e))
        
        # ActiveCampaign Emails
        try:
            emails_metrics = process_activecampaign_emails(organization_id, start_date, end_date, entity_map)
            all_metrics.extend(emails_metrics)
            sources_processed['activecampaign'] = len(emails_metrics)
            log_etl_run(organization_id, 'activecampaign', 'success', len(emails_metrics),
                       start_date.date().isoformat(), end_date.date().isoformat())
        except Exception as e:
            logger.error(f"Error processing ActiveCampaign emails: {e}")
            log_etl_run(organization_id, 'activecampaign', 'failed', 0,
                       start_date.date().isoformat(), end_date.date().isoformat(), str(e))
        
        # Write to BigQuery
        write_to_bigquery(all_metrics)
        
        logger.info(f"✅ Daily rollup complete!")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'start_date': start_date.date().isoformat(),
            'end_date': end_date.date().isoformat(),
            'total_metrics': len(all_metrics),
            'sources_processed': sources_processed,
            'breakdown': {
                'pages': len([m for m in all_metrics if m['entity_type'] == 'page']),
                'campaigns': len([m for m in all_metrics if m['entity_type'] == 'campaign']),
                'keywords': len([m for m in all_metrics if m['entity_type'] == 'keyword']),
                'products': len([m for m in all_metrics if m['entity_type'] == 'product']),
                'emails': len([m for m in all_metrics if m['entity_type'] == 'email']),
            }
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running daily rollup: {e}")
        return {'error': str(e)}, 500
