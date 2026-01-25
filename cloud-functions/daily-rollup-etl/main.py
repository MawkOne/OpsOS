"""
Daily Rollup ETL
Reads existing Firestore monthly data and creates daily entity metrics for Scout AI
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import json
import logging
from typing import Dict, List, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
db = firestore.Client()
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"


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
        
        # Note: Firestore has monthly data, we need to divide by days in month for daily estimate
        # This is a temporary workaround - proper daily data should come from GA4 API
        pageviews = page_data.get('pageviews', 0)
        sessions = page_data.get('sessions', 0)
        users = page_data.get('users', 0)
        avg_time = page_data.get('avgTimeOnPage', 0)
        bounce_rate = page_data.get('bounceRate', 0)
        
        # Get the month/year from the document
        month = page_data.get('month')
        year = page_data.get('year')
        
        if not month or not year:
            continue
        
        # Calculate days in that month
        import calendar
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
                'pageviews': int(pageviews / days_in_month),
                'sessions': int(sessions / days_in_month),
                'users': int(users / days_in_month),
                'avg_session_duration': avg_time,
                'bounce_rate': bounce_rate,
                'impressions': 0,
                'clicks': 0,
                'conversions': 0,
                'revenue': 0.0,
                'cost': 0.0,
                'source_breakdown': json.dumps({'ga4': int(sessions / days_in_month)}),
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
        
        sessions = campaign_data.get('sessions', 0)
        users = campaign_data.get('users', 0)
        conversions = campaign_data.get('conversions', 0)
        revenue = campaign_data.get('revenue', 0.0)
        cost = campaign_data.get('cost', 0.0)
        
        # Get month/year
        month = campaign_data.get('month')
        year = campaign_data.get('year')
        
        if not month or not year:
            continue
        
        import calendar
        days_in_month = calendar.monthrange(year, month)[1]
        
        month_start = datetime(year, month, 1).date()
        month_end = datetime(year, month, days_in_month).date()
        
        process_start = max(month_start, start_date.date())
        process_end = min(month_end, end_date.date())
        
        current_date = process_start
        while current_date <= process_end:
            daily_sessions = int(sessions / days_in_month)
            daily_cost = cost / days_in_month
            daily_revenue = revenue / days_in_month
            daily_conversions = int(conversions / days_in_month)
            
            metrics.append({
                'organization_id': organization_id,
                'date': current_date.isoformat(),
                'canonical_entity_id': canonical_id,
                'entity_type': 'campaign',
                'sessions': daily_sessions,
                'users': int(users / days_in_month),
                'conversions': daily_conversions,
                'conversion_rate': (daily_conversions / daily_sessions * 100) if daily_sessions > 0 else 0,
                'revenue': daily_revenue,
                'cost': daily_cost,
                'profit': daily_revenue - daily_cost,
                'roas': (daily_revenue / daily_cost) if daily_cost > 0 else 0,
                'roi': ((daily_revenue - daily_cost) / daily_cost * 100) if daily_cost > 0 else 0,
                'impressions': 0,
                'clicks': 0,
                'pageviews': 0,
                'source_breakdown': json.dumps({'ga4': daily_sessions}),
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
                'source_breakdown': json.dumps({'dataforseo': 1}),
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
    
    for invoice_doc in invoices_ref:
        invoice_data = invoice_doc.to_dict()
        invoice_date = invoice_data.get('date')
        
        if not invoice_date:
            continue
        
        # Convert to date
        if hasattr(invoice_date, 'date'):
            invoice_date = invoice_date.date()
        elif isinstance(invoice_date, str):
            invoice_date = datetime.fromisoformat(invoice_date).date()
        
        # Check if in range
        if invoice_date < start_date.date() or invoice_date > end_date.date():
            continue
        
        amount = invoice_data.get('amount', 0) / 100  # Convert cents to dollars
        product_id = invoice_data.get('productId', 'unknown')
        
        canonical_id = entity_map.get('stripe', {}).get(product_id, f'product_{product_id}')
        
        key = (invoice_date.isoformat(), canonical_id)
        if key not in product_daily_revenue:
            product_daily_revenue[key] = 0
        
        product_daily_revenue[key] += amount
    
    # Convert to metrics
    for (date_str, canonical_id), revenue in product_daily_revenue.items():
        metrics.append({
            'organization_id': organization_id,
            'date': date_str,
            'canonical_entity_id': canonical_id,
            'entity_type': 'product',
            'revenue': revenue,
            'conversions': 1,  # One invoice = one conversion
            'cost': 0.0,
            'profit': revenue,
            'impressions': 0,
            'clicks': 0,
            'sessions': 0,
            'source_breakdown': json.dumps({'stripe': 1}),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        })
    
    logger.info(f"Processed {len(metrics)} daily product metrics")
    return metrics


def process_activecampaign_emails(organization_id: str, start_date: datetime, end_date: datetime, entity_map: Dict) -> List[Dict]:
    """Process ActiveCampaign email campaigns into daily metrics"""
    logger.info("Processing ActiveCampaign emails...")
    
    metrics = []
    
    campaigns_ref = db.collection('activecampaign_campaigns').where('organizationId', '==', organization_id).stream()
    
    for campaign_doc in campaigns_ref:
        campaign_data = campaign_doc.to_dict()
        campaign_name = campaign_data.get('name', '')
        campaign_id = str(campaign_data.get('id', ''))
        
        canonical_id = entity_map.get('activecampaign', {}).get(campaign_id)
        if not canonical_id:
            canonical_id = f"email_{campaign_name.lower().replace(' ', '_')}"
        
        sends = campaign_data.get('total_sent', 0)
        opens = campaign_data.get('total_opens', 0)
        clicks = campaign_data.get('total_clicks', 0)
        
        open_rate = (opens / sends * 100) if sends > 0 else 0
        ctr = (clicks / opens * 100) if opens > 0 else 0
        
        # Get send date if available
        send_date = campaign_data.get('send_date')
        if send_date:
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
                    'sessions': 0,
                    'conversions': 0,
                    'revenue': 0.0,
                    'cost': 0.0,
                    'source_breakdown': json.dumps({'activecampaign': 1}),
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
    
    logger.info(f"Processed {len(metrics)} daily email metrics")
    return metrics


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
            bigquery.SchemaField("source_breakdown", "STRING", mode="NULLABLE"),
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
        
        # Process each source
        all_metrics = []
        
        all_metrics.extend(process_ga_pages(organization_id, start_date, end_date, entity_map))
        all_metrics.extend(process_ga_campaigns(organization_id, start_date, end_date, entity_map))
        all_metrics.extend(process_dataforseo_keywords(organization_id, start_date, end_date, entity_map))
        all_metrics.extend(process_stripe_products(organization_id, start_date, end_date, entity_map))
        all_metrics.extend(process_activecampaign_emails(organization_id, start_date, end_date, entity_map))
        
        # Write to BigQuery
        write_to_bigquery(all_metrics)
        
        logger.info(f"✅ Daily rollup complete!")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'start_date': start_date.date().isoformat(),
            'end_date': end_date.date().isoformat(),
            'total_metrics': len(all_metrics),
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
