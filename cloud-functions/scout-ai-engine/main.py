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
    Dynamically load all detector functions from a category
    
    Args:
        category: Category name (email, revenue, pages, etc.)
    
    Returns:
        List of detector functions
    """
    try:
        # Import the category module
        module = importlib.import_module(f'detectors.{category}')
        
        # Get all functions that start with 'detect_'
        detectors = []
        for name in dir(module):
            if name.startswith('detect_'):
                func = getattr(module, name)
                if callable(func):
                    detectors.append(func)
        
        logger.info(f"  Loaded {len(detectors)} detectors from {category}")
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
    """Write opportunities to BigQuery"""
    if not opportunities:
        return
    
    try:
        table_id = f"{bq_client.project}.marketing_ai.opportunities"
        errors = bq_client.insert_rows_json(table_id, opportunities)
        if errors:
            logger.error(f"BigQuery insert errors: {errors}")
        else:
            logger.info(f"✅ Wrote {len(opportunities)} opportunities to BigQuery")
    except Exception as e:
        logger.error(f"❌ Error writing to BigQuery: {e}")

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
      "productType": "saas"  // optional: saas, ecommerce, content, b2b
    }
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    send_slack = request_json.get('sendSlackNotification', False)
    product_type = request_json.get('productType', None)
    
    logger.info(f"🤖 Starting Scout AI v3 (Priority Pages Only) for {organization_id}")
    if product_type:
        logger.info(f"   Product type: {product_type}")
    logger.info(f"   💡 DataForSEO only crawls priority pages - no filtering needed")
    
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
            logger.info(f"{icon} Running {category.title()} detectors...")
            
            # Dynamically load detectors for this category
            detectors = load_detectors_for_category(category)
            
            # Run each detector
            for detector_func in detectors:
                try:
                    logger.info(f"   Running {detector_func.__name__}...")
                    
                    # Run detector (no filtering needed - DataForSEO only crawls priority pages now)
                    opportunities = detector_func(organization_id)
                    
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
