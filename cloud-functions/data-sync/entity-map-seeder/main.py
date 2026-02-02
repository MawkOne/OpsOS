"""
Entity Map Seeder
Reads existing Firestore data and creates canonical entity mappings
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime
import re
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
db = firestore.Client()
bq_client = bigquery.Client()

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "entity_map"

def create_canonical_id(entity_type: str, name: str) -> str:
    """
    Create a canonical entity ID from entity type and name
    Examples:
      page, "/pricing" -> "page_pricing"
      campaign, "Q1 Brand Campaign" -> "campaign_q1_brand_campaign"
      keyword, "best crm for saas" -> "keyword_best_crm_for_saas"
    """
    # Clean name: lowercase, alphanumeric + spaces
    clean_name = re.sub(r'[^a-z0-9\s]', '', name.lower().strip())
    # Replace spaces with underscores, collapse multiple underscores
    clean_name = re.sub(r'\s+', '_', clean_name)
    clean_name = re.sub(r'_+', '_', clean_name)
    # Trim to max 50 chars
    clean_name = clean_name[:50].strip('_')
    
    return f"{entity_type}_{clean_name}"


def seed_pages(organization_id: str):
    """Seed page mappings from ga_pages collection"""
    logger.info(f"Seeding pages for {organization_id}")
    
    mappings = []
    
    # Read ga_pages collection
    pages_ref = db.collection('ga_pages').where('organizationId', '==', organization_id).stream()
    
    for page_doc in pages_ref:
        page_data = page_doc.to_dict()
        page_path = page_data.get('pagePath', '')
        page_title = page_data.get('pageTitle', page_path)
        
        if not page_path:
            continue
        
        canonical_id = create_canonical_id('page', page_path)
        
        mapping = {
            'canonical_entity_id': canonical_id,
            'entity_type': 'page',
            'source': 'ga4',
            'source_entity_id': page_path,
            'source_metadata': {
                'title': page_title,
                'firestore_doc_id': page_doc.id
            },
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        mappings.append(mapping)
    
    logger.info(f"Found {len(mappings)} pages to map")
    return mappings


def seed_campaigns(organization_id: str):
    """Seed campaign mappings from ga_campaigns collection"""
    logger.info(f"Seeding campaigns for {organization_id}")
    
    mappings = []
    
    # Read ga_campaigns collection
    campaigns_ref = db.collection('ga_campaigns').where('organizationId', '==', organization_id).stream()
    
    for campaign_doc in campaigns_ref:
        campaign_data = campaign_doc.to_dict()
        campaign_name = campaign_data.get('campaignName', '')
        campaign_id = campaign_data.get('campaignId', '')
        
        if not campaign_name:
            continue
        
        canonical_id = create_canonical_id('campaign', campaign_name)
        
        mapping = {
            'canonical_entity_id': canonical_id,
            'entity_type': 'campaign',
            'source': 'ga4',
            'source_entity_id': campaign_id or campaign_name,
            'source_metadata': {
                'name': campaign_name,
                'firestore_doc_id': campaign_doc.id
            },
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        mappings.append(mapping)
    
    logger.info(f"Found {len(mappings)} campaigns to map")
    return mappings


def seed_keywords(organization_id: str):
    """Seed keyword mappings from dataforseo_keywords collection"""
    logger.info(f"Seeding keywords for {organization_id}")
    
    mappings = []
    
    # Read dataforseo_keywords collection
    keywords_ref = db.collection('dataforseo_keywords').where('organizationId', '==', organization_id).stream()
    
    for keyword_doc in keywords_ref:
        keyword_data = keyword_doc.to_dict()
        keyword = keyword_data.get('keyword', '')
        
        if not keyword:
            continue
        
        canonical_id = create_canonical_id('keyword', keyword)
        
        mapping = {
            'canonical_entity_id': canonical_id,
            'entity_type': 'keyword',
            'source': 'dataforseo',
            'source_entity_id': keyword,
            'source_metadata': {
                'keyword': keyword,
                'firestore_doc_id': keyword_doc.id
            },
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        mappings.append(mapping)
    
    logger.info(f"Found {len(mappings)} keywords to map")
    return mappings


def seed_products(organization_id: str):
    """Seed product mappings from stripe_products collection"""
    logger.info(f"Seeding products for {organization_id}")
    
    mappings = []
    
    # Read stripe_products collection
    products_ref = db.collection('stripe_products').where('organizationId', '==', organization_id).stream()
    
    for product_doc in products_ref:
        product_data = product_doc.to_dict()
        product_name = product_data.get('name', '')
        stripe_id = product_data.get('stripeId', '')
        
        if not product_name or not stripe_id:
            continue
        
        canonical_id = create_canonical_id('product', product_name)
        
        mapping = {
            'canonical_entity_id': canonical_id,
            'entity_type': 'product',
            'source': 'stripe',
            'source_entity_id': stripe_id,
            'source_metadata': {
                'name': product_name,
                'stripe_id': stripe_id,
                'firestore_doc_id': product_doc.id
            },
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        mappings.append(mapping)
    
    logger.info(f"Found {len(mappings)} products to map")
    return mappings


def seed_email_campaigns(organization_id: str):
    """Seed email campaign mappings from activecampaign_campaigns collection"""
    logger.info(f"Seeding email campaigns for {organization_id}")
    
    mappings = []
    
    # Read activecampaign_campaigns collection
    campaigns_ref = db.collection('activecampaign_campaigns').where('organizationId', '==', organization_id).stream()
    
    for campaign_doc in campaigns_ref:
        campaign_data = campaign_doc.to_dict()
        campaign_name = campaign_data.get('name', '')
        # Use 'activecampaignId' instead of 'id' to match actual Firestore field
        campaign_id = campaign_data.get('activecampaignId', '')
        
        if not campaign_name:
            continue
        
        # Use campaign ID if available, otherwise use name
        if not campaign_id:
            campaign_id = campaign_name
        
        canonical_id = create_canonical_id('email', campaign_name)
        
        mapping = {
            'canonical_entity_id': canonical_id,
            'entity_type': 'email',
            'source': 'activecampaign',
            'source_entity_id': str(campaign_id),
            'source_metadata': {
                'name': campaign_name,
                'campaign_id': campaign_id,
                'firestore_doc_id': campaign_doc.id
            },
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        mappings.append(mapping)
    
    logger.info(f"Found {len(mappings)} email campaigns to map")
    return mappings


def write_to_bigquery(mappings: list):
    """Write entity mappings to BigQuery"""
    if not mappings:
        logger.warning("No mappings to write")
        return
    
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
    
    # Configure job to overwrite duplicates
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        schema=[
            bigquery.SchemaField("canonical_entity_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("entity_type", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_entity_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_metadata", "JSON", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE"),
        ]
    )
    
    try:
        job = bq_client.load_table_from_json(
            mappings,
            table_ref,
            job_config=job_config
        )
        job.result()  # Wait for completion
        
        logger.info(f"✅ Successfully wrote {len(mappings)} mappings to BigQuery")
        
    except Exception as e:
        logger.error(f"❌ Error writing to BigQuery: {e}")
        raise


@functions_framework.http
def seed_entity_map(request):
    """
    HTTP Cloud Function to seed entity mappings
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE"
    }
    """
    
    # Parse request
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    
    logger.info(f"🌱 Starting entity map seeding for {organization_id}")
    
    try:
        # Collect all mappings
        all_mappings = []
        
        # Seed each entity type
        all_mappings.extend(seed_pages(organization_id))
        all_mappings.extend(seed_campaigns(organization_id))
        all_mappings.extend(seed_keywords(organization_id))
        all_mappings.extend(seed_products(organization_id))
        all_mappings.extend(seed_email_campaigns(organization_id))
        
        # Write to BigQuery
        write_to_bigquery(all_mappings)
        
        # Also write to Firestore for real-time access
        batch = db.batch()
        for mapping in all_mappings:
            doc_id = f"{mapping['canonical_entity_id']}_{mapping['source']}"
            doc_ref = db.collection('entity_map').document(doc_id)
            batch.set(doc_ref, {
                'organizationId': organization_id,
                **mapping
            })
        batch.commit()
        
        logger.info(f"✅ Entity map seeding complete!")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'total_mappings': len(all_mappings),
            'breakdown': {
                'pages': len([m for m in all_mappings if m['entity_type'] == 'page']),
                'campaigns': len([m for m in all_mappings if m['entity_type'] == 'campaign']),
                'keywords': len([m for m in all_mappings if m['entity_type'] == 'keyword']),
                'products': len([m for m in all_mappings if m['entity_type'] == 'product']),
                'emails': len([m for m in all_mappings if m['entity_type'] == 'email']),
            }
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error seeding entity map: {e}")
        return {'error': str(e)}, 500
