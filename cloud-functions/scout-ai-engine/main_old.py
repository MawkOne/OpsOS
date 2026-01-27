"""
Scout AI Engine - Orchestrator
Runs all detectors to find marketing opportunities
"""

import functions_framework
from google.cloud import bigquery, firestore
from datetime import datetime, timedelta
import json
import logging
import uuid
import os
import requests

# Import detectors organized by marketing area
from detectors.email_detectors import (
    detect_email_engagement_drop,
    detect_email_high_opens_low_clicks,
    detect_email_trends_multitimeframe,
    detect_email_bounce_rate_spike,
    detect_email_spam_complaint_spike,
    detect_email_list_health_decline,
    detect_email_click_to_open_rate_decline,
    detect_email_optimal_frequency_deviation
)
from detectors.seo_detectors import (
    detect_seo_striking_distance,
    detect_seo_rank_drops,
    detect_keyword_cannibalization,
    detect_seo_rank_trends_multitimeframe
)
from detectors.advertising_detectors import (
    detect_cost_inefficiency,
    detect_paid_waste,
    detect_paid_campaigns_multitimeframe
)
from detectors.pages_detectors import (
    detect_high_traffic_low_conversion_pages,
    detect_page_engagement_decay,
    detect_scale_winners_multitimeframe,
    detect_scale_winners,
    detect_fix_losers,
    detect_page_form_abandonment_spike,
    detect_page_cart_abandonment_increase,
    detect_page_error_rate_spike,
    detect_page_micro_conversion_drop,
    detect_page_exit_rate_increase
)
from detectors.content_detectors import (
    detect_content_decay,
    detect_content_decay_multitimeframe
)
from detectors.traffic_detectors import (
    detect_cross_channel_gaps,
    detect_declining_performers_multitimeframe,
    detect_declining_performers,
    detect_traffic_bot_spam_spike,
    detect_traffic_spike_quality_check,
    detect_traffic_utm_parameter_gaps,
    detect_traffic_referral_opportunities
)
from detectors.revenue_detectors import (
    detect_revenue_anomaly,
    detect_metric_anomalies,
    detect_revenue_trends_multitimeframe,
    detect_revenue_aov_decline,
    detect_revenue_payment_failure_spike,
    detect_revenue_new_customer_decline,
    detect_revenue_discount_cannibalization,
    detect_revenue_seasonality_deviation
)

# Import new expansion detectors (32 additional detectors)
from expansion_imports import get_enabled_detectors

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()
db = firestore.Client()

# Load detector configuration
def load_detector_config():
    """Load detector configuration from JSON file"""
    config_path = os.path.join(os.path.dirname(__file__), 'detector_config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load detector config: {e}. Using defaults.")
        return {"default_config": {"enabled_areas": {
            "email": True, "seo": True, "advertising": True,
            "pages": True, "content": True, "traffic": True, "revenue": True
        }}}

DETECTOR_CONFIG = load_detector_config()

def get_enabled_areas(organization_id):
    """Get enabled detector areas for an organization"""
    # Check for org-specific overrides
    if organization_id in DETECTOR_CONFIG.get('organization_overrides', {}):
        return DETECTOR_CONFIG['organization_overrides'][organization_id]['enabled_areas']
    # Fall back to default
    return DETECTOR_CONFIG['default_config']['enabled_areas']

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"


def calculate_score(confidence: float, impact: float, urgency: float) -> float:
    """
    Calculate overall opportunity score
    confidence: 0-1 (how sure we are)
    impact: 0-100 (potential revenue/improvement)
    urgency: 0-100 (how time-sensitive)
    """
    return (confidence * 0.3 + impact * 0.5 + urgency * 0.2)


def write_opportunities_to_bigquery(opportunities: list):
    """Write opportunities to BigQuery"""
    if not opportunities:
        logger.warning("No opportunities to write")
        return
    
    # First, delete old opportunities for this organization
    org_id = opportunities[0]['organization_id'] if opportunities else None
    if org_id:
        logger.info(f"🗑️  Deleting old opportunities for org: {org_id}")
        delete_query = f"""
        DELETE FROM `{PROJECT_ID}.{DATASET_ID}.opportunities`
        WHERE organization_id = @org_id
        """
        job_config_delete = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("org_id", "STRING", org_id)
            ]
        )
        try:
            delete_job = bq_client.query(delete_query, job_config=job_config_delete)
            delete_job.result()
            logger.info(f"✅ Deleted old opportunities for org: {org_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting old opportunities: {e}")
            # Continue anyway to write new ones
    
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.opportunities"
    
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        schema=[
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("organization_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("detected_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("type", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("priority", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("status", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("entity_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("entity_type", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("title", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("description", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("evidence", "JSON", mode="REQUIRED"),
            bigquery.SchemaField("metrics", "JSON", mode="REQUIRED"),
            bigquery.SchemaField("hypothesis", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("confidence_score", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("potential_impact_score", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("urgency_score", "FLOAT64", mode="NULLABLE"),
            bigquery.SchemaField("recommended_actions", "STRING", mode="REPEATED"),
            bigquery.SchemaField("estimated_effort", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("estimated_timeline", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("historical_performance", "JSON", mode="NULLABLE"),
            bigquery.SchemaField("comparison_data", "JSON", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE"),
        ]
    )
    
    try:
        job = bq_client.load_table_from_json(
            opportunities,
            table_ref,
            job_config=job_config
        )
        job.result()
        
        logger.info(f"✅ Successfully wrote {len(opportunities)} opportunities to BigQuery")
        
    except Exception as e:
        logger.error(f"❌ Error writing opportunities to BigQuery: {e}")
        raise


def write_opportunities_to_firestore(opportunities: list):
    """Mirror opportunities to Firestore for real-time access"""
    if not opportunities:
        logger.warning("No opportunities to write to Firestore")
        return
    
    try:
        # First, delete all existing opportunities for this organization
        org_id = opportunities[0]['organization_id'] if opportunities else None
        if org_id:
            logger.info(f"🗑️  Clearing old opportunities for org: {org_id}")
            old_docs = db.collection('opportunities').where('organization_id', '==', org_id).stream()
            
            delete_batch = db.batch()
            delete_count = 0
            batch_count = 0
            
            for doc in old_docs:
                delete_batch.delete(doc.reference)
                batch_count += 1
                delete_count += 1
                
                if batch_count >= 500:
                    delete_batch.commit()
                    delete_batch = db.batch()
                    batch_count = 0
            
            if batch_count > 0:
                delete_batch.commit()
            
            logger.info(f"✅ Deleted {delete_count} old opportunities")
        
        # Now write new opportunities
        # Firestore batch can only handle 500 operations
        # Write in batches of 400 to be safe
        batch_size = 400
        total_written = 0
        
        for i in range(0, len(opportunities), batch_size):
            batch = db.batch()
            chunk = opportunities[i:i + batch_size]
            
            for opp in chunk:
                doc_ref = db.collection('opportunities').document(opp['id'])
                
                # Ensure all timestamps are strings
                firestore_opp = {
                    **opp,
                    'detected_at': opp['detected_at'] if isinstance(opp['detected_at'], str) else opp['detected_at'].isoformat(),
                    'created_at': opp['created_at'] if isinstance(opp['created_at'], str) else opp['created_at'].isoformat(),
                    'updated_at': opp['updated_at'] if isinstance(opp['updated_at'], str) else opp['updated_at'].isoformat(),
                }
                
                batch.set(doc_ref, firestore_opp)
            
            batch.commit()
            total_written += len(chunk)
            logger.info(f"✅ Wrote batch {i // batch_size + 1} ({len(chunk)} opportunities)")
        
        logger.info(f"✅ Successfully mirrored {total_written} opportunities to Firestore")
        
    except Exception as e:
        logger.error(f"❌ Error writing to Firestore: {e}")
        logger.exception(e)


def send_slack_notification(opportunities: list, organization_id: str):
    """Send Slack notification with opportunity summary"""
    slack_webhook = os.environ.get('SLACK_WEBHOOK_URL')
    
    if not slack_webhook:
        logger.warning("No Slack webhook URL configured, skipping notification")
        return
    
    if not opportunities:
        return
    
    # Group by priority
    high = [o for o in opportunities if o['priority'] == 'high']
    medium = [o for o in opportunities if o['priority'] == 'medium']
    low = [o for o in opportunities if o['priority'] == 'low']
    
    # Build message
    message = {
        "text": f"🤖 *Scout AI Daily Summary* - {datetime.now().strftime('%B %d, %Y')}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🎯 {len(opportunities)} New Opportunities Detected"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Organization:* {organization_id}\n\n"
                            f"🔴 *{len(high)}* High Priority\n"
                            f"🟡 *{len(medium)}* Medium Priority\n"
                            f"🔵 *{len(low)}* Low Priority"
                }
            },
            {"type": "divider"}
        ]
    }
    
    # Add top 3 high priority opportunities
    for opp in high[:3]:
        message["blocks"].append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{opp['title']}*\n{opp['description']}\n\n"
                        f"💰 Impact: {opp['potential_impact_score']:.0f} | "
                        f"⚡ Urgency: {opp['urgency_score']:.0f} | "
                        f"🎯 Confidence: {opp['confidence_score']*100:.0f}%"
            }
        })
    
    # Add link to dashboard
    message["blocks"].append({
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "<https://v0-ops-ai.vercel.app/ai/opportunities|View All Opportunities →>"
        }
    })
    
    try:
        response = requests.post(slack_webhook, json=message)
        if response.status_code == 200:
            logger.info("✅ Slack notification sent successfully")
        else:
            logger.error(f"❌ Slack notification failed: {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Error sending Slack notification: {e}")


@functions_framework.http
def run_scout_ai(request):
    """
    HTTP Cloud Function to run Scout AI detection
    
    Request body:
    {
      "organizationId": "SBjucW1ztDyFYWBz7ZLE",
      "sendSlackNotification": true  // optional
    }
    """
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return {'error': 'Missing organizationId'}, 400
    
    organization_id = request_json['organizationId']
    send_slack = request_json.get('sendSlackNotification', False)
    
    logger.info(f"🤖 Starting Scout AI for {organization_id}")
    
    try:
        all_opportunities = []
        
        # Get enabled areas for this organization
        enabled_areas = get_enabled_areas(organization_id)
        logger.info(f"📋 Enabled detector areas: {[k for k, v in enabled_areas.items() if v]}")
        
        # Run detectors by area (only if enabled)
        
        # EMAIL detectors
        if enabled_areas.get('email', True):
            logger.info("📧 Running Email detectors...")
            all_opportunities.extend(detect_email_engagement_drop(organization_id))
            all_opportunities.extend(detect_email_high_opens_low_clicks(organization_id))
            all_opportunities.extend(detect_email_trends_multitimeframe(organization_id))
            all_opportunities.extend(detect_email_bounce_rate_spike(organization_id))
            all_opportunities.extend(detect_email_spam_complaint_spike(organization_id))
            all_opportunities.extend(detect_email_list_health_decline(organization_id))
            all_opportunities.extend(detect_email_click_to_open_rate_decline(organization_id))
            all_opportunities.extend(detect_email_optimal_frequency_deviation(organization_id))
        
        # SEO detectors
        if enabled_areas.get('seo', True):
            logger.info("🔍 Running SEO detectors...")
            all_opportunities.extend(detect_seo_striking_distance(organization_id))
            all_opportunities.extend(detect_seo_rank_drops(organization_id))
            all_opportunities.extend(detect_keyword_cannibalization(organization_id))
            all_opportunities.extend(detect_seo_rank_trends_multitimeframe(organization_id))
        
        # ADVERTISING detectors
        if enabled_areas.get('advertising', True):
            logger.info("💰 Running Advertising detectors...")
            all_opportunities.extend(detect_cost_inefficiency(organization_id))
            all_opportunities.extend(detect_paid_waste(organization_id))
            all_opportunities.extend(detect_paid_campaigns_multitimeframe(organization_id))
        
        # PAGES detectors
        if enabled_areas.get('pages', True):
            logger.info("📄 Running Pages detectors...")
            all_opportunities.extend(detect_high_traffic_low_conversion_pages(organization_id))
            all_opportunities.extend(detect_page_engagement_decay(organization_id))
            all_opportunities.extend(detect_scale_winners_multitimeframe(organization_id))
            all_opportunities.extend(detect_page_form_abandonment_spike(organization_id))
            all_opportunities.extend(detect_page_cart_abandonment_increase(organization_id))
            all_opportunities.extend(detect_page_error_rate_spike(organization_id))
            all_opportunities.extend(detect_page_micro_conversion_drop(organization_id))
            all_opportunities.extend(detect_page_exit_rate_increase(organization_id))
        
        # CONTENT detectors
        if enabled_areas.get('content', True):
            logger.info("✍️ Running Content detectors...")
            all_opportunities.extend(detect_content_decay(organization_id))
            all_opportunities.extend(detect_content_decay_multitimeframe(organization_id))
        
        # TRAFFIC detectors
        if enabled_areas.get('traffic', True):
            logger.info("🚦 Running Traffic detectors...")
            all_opportunities.extend(detect_cross_channel_gaps(organization_id))
            all_opportunities.extend(detect_declining_performers_multitimeframe(organization_id))
            all_opportunities.extend(detect_traffic_bot_spam_spike(organization_id))
            all_opportunities.extend(detect_traffic_spike_quality_check(organization_id))
            all_opportunities.extend(detect_traffic_utm_parameter_gaps(organization_id))
            all_opportunities.extend(detect_traffic_referral_opportunities(organization_id))
        
        # REVENUE detectors
        if enabled_areas.get('revenue', True):
            logger.info("💵 Running Revenue detectors...")
            all_opportunities.extend(detect_revenue_anomaly(organization_id))
            all_opportunities.extend(detect_metric_anomalies(organization_id))
            all_opportunities.extend(detect_revenue_trends_multitimeframe(organization_id))
            all_opportunities.extend(detect_revenue_aov_decline(organization_id))
            all_opportunities.extend(detect_revenue_payment_failure_spike(organization_id))
            all_opportunities.extend(detect_revenue_new_customer_decline(organization_id))
            all_opportunities.extend(detect_revenue_discount_cannibalization(organization_id))
            all_opportunities.extend(detect_revenue_seasonality_deviation(organization_id))
        
        # NEW EXPANSION DETECTORS (32 additional detectors)
        logger.info("🚀 Running Expansion Detectors...")
        expansion_detectors = get_enabled_detectors()
        logger.info(f"📊 Running {len(expansion_detectors)} expansion detectors...")
        for detector_func in expansion_detectors:
            try:
                logger.info(f"   Running {detector_func.__name__}...")
                all_opportunities.extend(detector_func(organization_id))
            except Exception as e:
                logger.error(f"   ❌ Error in {detector_func.__name__}: {e}")
        
        # Write to BigQuery and Firestore
        write_opportunities_to_bigquery(all_opportunities)
        write_opportunities_to_firestore(all_opportunities)
        
        # Send Slack notification if requested
        if send_slack:
            send_slack_notification(all_opportunities, organization_id)
        
        logger.info(f"✅ Scout AI complete! Found {len(all_opportunities)} opportunities")
        
        return {
            'success': True,
            'organization_id': organization_id,
            'total_opportunities': len(all_opportunities),
            'breakdown': {
                'scale_winners': len([o for o in all_opportunities if o['category'] == 'scale_winner']),
                'fix_losers': len([o for o in all_opportunities if o['category'] == 'fix_loser']),
                'declining_performers': len([o for o in all_opportunities if o['category'] == 'declining_performer']),
                'cross_channel': len([o for o in all_opportunities if o['category'] == 'cross_channel']),
                'seo_issues': len([o for o in all_opportunities if o['category'] in ['seo_issue', 'seo_opportunity', 'seo_rank_trend']]),
                'cost_inefficiency': len([o for o in all_opportunities if o['category'] == 'cost_inefficiency']),
                'email_issues': len([o for o in all_opportunities if o['category'] in ['email_issue', 'email_optimization', 'email_trend']]),
                'paid_waste': len([o for o in all_opportunities if o['category'] == 'paid_waste']),
                'revenue_anomalies': len([o for o in all_opportunities if o['category'] in ['revenue_anomaly', 'revenue_trend']]),
                'anomalies': len([o for o in all_opportunities if o['category'] == 'anomaly']),
                'page_optimization': len([o for o in all_opportunities if o['category'] == 'page_optimization']),
                'content_decay': len([o for o in all_opportunities if o['category'] in ['content_decay', 'content_trend']])
            }
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running Scout AI: {e}")
        return {'error': str(e)}, 500
