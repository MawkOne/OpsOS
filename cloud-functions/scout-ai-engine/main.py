"""
Scout AI Engine - Modular Orchestrator
Dynamically loads and runs detectors based on configuration
"""

import functions_framework
from google.cloud import bigquery, firestore
from datetime import datetime, timedelta
import json
import logging
import uuid
import os
import requests
import importlib
import inspect

# Import detector configuration
from detector_config import get_enabled_categories, is_category_enabled

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()
db = firestore.Client()

def load_detectors_for_category(category: str):
    """
    Dynamically load all detector functions from a category folder
    
    Args:
        category: Category name (email, revenue, pages, etc.)
    
    Returns:
        List of detector functions
    """
    try:
        # Import the category module (e.g., detectors.seo)
        # Each category folder has an __init__.py that exports its detectors
        module = importlib.import_module(f'detectors.{category}')
        
        # Get all functions that start with 'detect_'
        detectors = []
        for name in dir(module):
            if name.startswith('detect_'):
                func = getattr(module, name)
                if callable(func):
                    detectors.append(func)
        
        logger.info(f"  Loaded {len(detectors)} detectors from {category}/")
        return detectors
        
    except Exception as e:
        logger.error(f"  ❌ Error loading {category} detectors: {e}")
        return []

def get_enabled_areas(organization_id: str):
    """Get enabled detector areas for organization"""
    try:
        org_doc = db.collection('organizations').document(organization_id).get()
        if org_doc.exists:
            org_data = org_doc.to_dict()
            return org_data.get('enabled_detector_areas', {
                'email': True,
                'revenue': True,
                'pages': True,
                'traffic': True,
                'seo': True,
                'advertising': True,
                'content': True
            })
        return {'email': True, 'revenue': True, 'pages': True, 'traffic': True, 'seo': True, 'advertising': True, 'content': True}
    except Exception as e:
        logger.error(f"Error loading org config: {e}")
        return {'email': True, 'revenue': True, 'pages': True, 'traffic': True, 'seo': True, 'advertising': True, 'content': True}

def write_opportunities_to_bigquery(opportunities: list):
    """Write opportunities to BigQuery with proper JSON field handling"""
    if not opportunities:
        return
    
    try:
        table_id = f"{bq_client.project}.marketing_ai.opportunities"
        
        # Prepare opportunities for BigQuery by converting nested objects to JSON strings
        # BigQuery doesn't accept nested dicts unless the schema has RECORD types
        prepared_opportunities = []
        for opp in opportunities:
            prepared_opp = opp.copy()
            
            # Convert nested objects to JSON strings for JSON-type columns
            # (evidence, metrics, etc. are JSON type in BigQuery)
            json_fields = ['evidence', 'metrics', 'historical_performance', 'comparison_data']
            
            for field in json_fields:
                if field in prepared_opp and prepared_opp[field] is not None:
                    if isinstance(prepared_opp[field], (dict, list)):
                        prepared_opp[field] = json.dumps(prepared_opp[field])
            
            # Ensure all required JSON fields have values
            prepared_opp['evidence'] = prepared_opp.get('evidence') or '{}'
            prepared_opp['metrics'] = prepared_opp.get('metrics') or '{}'
            prepared_opp['historical_performance'] = prepared_opp.get('historical_performance') or '{}'
            prepared_opp['comparison_data'] = prepared_opp.get('comparison_data') or '{}'
            
            # recommended_actions is a REPEATED STRING (array) - keep it as list
            if prepared_opp.get('recommended_actions') is None:
                prepared_opp['recommended_actions'] = []
            elif isinstance(prepared_opp['recommended_actions'], str):
                # If it's already a string somehow, parse it back to list
                try:
                    prepared_opp['recommended_actions'] = json.loads(prepared_opp['recommended_actions'])
                except:
                    prepared_opp['recommended_actions'] = [prepared_opp['recommended_actions']]
            
            # Ensure numeric fields are proper numbers
            prepared_opp['confidence_score'] = float(prepared_opp.get('confidence_score') or 0)
            prepared_opp['potential_impact_score'] = float(prepared_opp.get('potential_impact_score') or 0)
            prepared_opp['urgency_score'] = float(prepared_opp.get('urgency_score') or 0)
            
            prepared_opportunities.append(prepared_opp)
        
        errors = bq_client.insert_rows_json(table_id, prepared_opportunities)
        if errors:
            logger.error(f"BigQuery insert errors (first 3): {errors[:3]}")
            # Log the structure of a failed row for debugging
            if prepared_opportunities:
                logger.error(f"Sample row structure: {list(prepared_opportunities[0].keys())}")
        else:
            logger.info(f"✅ Wrote {len(prepared_opportunities)} opportunities to BigQuery")
    except Exception as e:
        logger.error(f"❌ Error writing to BigQuery: {e}")
        import traceback
        logger.error(traceback.format_exc())

def write_opportunities_to_firestore(opportunities: list):
    """Mirror opportunities to Firestore for real-time access"""
    if not opportunities:
        return
    
    try:
        batch = db.batch()
        for opp in opportunities:
            doc_ref = db.collection('opportunities').document(opp['id'])
            batch.set(doc_ref, opp)
        
        batch.commit()
        logger.info(f"✅ Mirrored {len(opportunities)} opportunities to Firestore")
    except Exception as e:
        logger.error(f"❌ Error writing to Firestore: {e}")

def send_slack_notification(opportunities: list, organization_id: str):
    """Send Slack notification with opportunity summary"""
    try:
        webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
        if not webhook_url:
            logger.warning("No Slack webhook URL configured")
            return
        
        high_priority = [o for o in opportunities if o.get('priority') == 'high']
        
        message = {
            "text": f"🤖 Scout AI found {len(opportunities)} opportunities for {organization_id}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Scout AI Report*\n{len(opportunities)} total opportunities\n{len(high_priority)} high priority"
                    }
                }
            ]
        }
        
        response = requests.post(webhook_url, json=message)
        if response.status_code == 200:
            logger.info("✅ Sent Slack notification")
        else:
            logger.error(f"❌ Slack notification failed: {response.status_code}")
            
    except Exception as e:
        logger.error(f"❌ Error sending Slack notification: {e}")

@functions_framework.http
def run_scout_ai(request):
    """
    Main Cloud Function entry point
    
    Expected request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "sendSlackNotification": true,  // optional
      "productType": "saas",  // optional: saas, ecommerce, content, b2b
      "lookbackDays": {  // optional: lookback period per category
        "seo": 30,
        "email": 30,
        "advertising": 30,
        "pages": 30,
        "traffic": 30,
        "revenue": 30,
        "content": 30
      },
      "priorityPages": {  // optional: filter pages detectors to specific pages
        "urls": ["https://example.com/page1", "https://example.com/page2"],
        "prefixes": ["/blog", "/products"],
        "domain": "example.com"
      }
    }
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    send_slack = request_json.get('sendSlackNotification', False)
    product_type = request_json.get('productType', None)
    lookback_days = request_json.get('lookbackDays', {})
    priority_pages = request_json.get('priorityPages', None)
    
    logger.info(f"🤖 Starting Scout AI v3 for {organization_id}")
    if product_type:
        logger.info(f"   Product type: {product_type}")
    if lookback_days:
        logger.info(f"   Lookback periods: {lookback_days}")
    if priority_pages:
        url_count = len(priority_pages.get('urls', []))
        prefix_count = len(priority_pages.get('prefixes', []))
        logger.info(f"   ⭐ Priority pages filter: {url_count} URLs, {prefix_count} prefixes")
    else:
        logger.info(f"   📄 Running on ALL pages (no priority filter)")
    
    try:
        all_opportunities = []
        
        # Get enabled categories from config
        enabled_categories = get_enabled_categories(product_type)
        logger.info(f"📋 Enabled detector categories: {enabled_categories}")
        
        # Run detectors for each enabled category
        category_icons = {
            'email': '📧',
            'revenue': '💵',
            'pages': '📄',
            'traffic': '🚦',
            'seo': '🔍',
            'advertising': '💰',
            'content': '✍️',
            'system': '🏗️'
        }
        
        for category in enabled_categories:
            icon = category_icons.get(category, '📊')
            category_lookback = lookback_days.get(category, 30)  # Default to 30 days
            
            # Check if priority pages filter applies to this category
            category_priority_pages = priority_pages if category == 'pages' and priority_pages else None
            filter_note = " (priority pages only)" if category_priority_pages else ""
            logger.info(f"{icon} Running {category.title()} detectors (lookback: {category_lookback} days){filter_note}...")
            
            # Dynamically load detectors for this category
            detectors = load_detectors_for_category(category)
            
            # Run each detector
            for detector_func in detectors:
                try:
                    logger.info(f"   Running {detector_func.__name__}...")
                    
                    # Check what parameters the detector accepts
                    sig = inspect.signature(detector_func)
                    kwargs = {}
                    
                    if 'lookback_days' in sig.parameters:
                        kwargs['lookback_days'] = category_lookback
                    
                    if 'priority_pages' in sig.parameters and category_priority_pages:
                        kwargs['priority_pages'] = category_priority_pages
                    
                    opportunities = detector_func(organization_id, **kwargs)
                    
                    all_opportunities.extend(opportunities)
                    if opportunities:
                        logger.info(f"   ✓ Found {len(opportunities)} opportunities")
                except Exception as e:
                    logger.error(f"   ❌ Error in {detector_func.__name__}: {e}")
        
        # Write to BigQuery and Firestore
        logger.info(f"💾 Saving {len(all_opportunities)} opportunities...")
        write_opportunities_to_bigquery(all_opportunities)
        write_opportunities_to_firestore(all_opportunities)
        
        # Send Slack notification if requested
        if send_slack:
            send_slack_notification(all_opportunities, organization_id)
        
        logger.info(f"✅ Scout AI complete! Found {len(all_opportunities)} opportunities")
        
        # Build category breakdown
        category_counts = {}
        for category in enabled_categories:
            category_counts[category] = len([o for o in all_opportunities if o.get('category', '').startswith(category)])
        
        logger.info(f"📊 Breakdown by category: {category_counts}")
        logger.info(f"   SEO opportunities: {category_counts.get('seo', 0)}")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'product_type': product_type,
            'total_opportunities': len(all_opportunities),
            'enabled_categories': enabled_categories,
            'breakdown_by_category': category_counts,
            'high_priority_count': len([o for o in all_opportunities if o.get('priority') == 'high'])
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running Scout AI: {e}")
        return {'error': str(e)}, 500
