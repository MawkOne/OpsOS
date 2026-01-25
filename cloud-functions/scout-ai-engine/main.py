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

# Import additional detectors
from detectors import (
    detect_cross_channel_gaps,
    detect_keyword_cannibalization,
    detect_cost_inefficiency,
    detect_email_engagement_drop
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
bq_client = bigquery.Client()
db = firestore.Client()

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


def detect_scale_winners(organization_id: str) -> list:
    """
    Detect: Entities performing well but not getting enough resources
    Example: Page with high conversion rate but low traffic
    """
    logger.info("🔍 Running Scale Winners detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(roas) as avg_roas,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('page', 'campaign')
      GROUP BY canonical_entity_id, entity_type
      HAVING total_sessions > 10  -- Minimum threshold
    ),
    ranked AS (
      SELECT 
        *,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY avg_conversion_rate) as conversion_percentile,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY total_sessions) as traffic_percentile
      FROM recent_metrics
    )
    SELECT *
    FROM ranked
    WHERE conversion_percentile > 0.7  -- Top 30% performers
      AND traffic_percentile < 0.3     -- Bottom 30% traffic
      AND avg_conversion_rate > 2.0    -- Minimum conversion rate
    ORDER BY avg_conversion_rate DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            entity_id = row['canonical_entity_id']
            entity_type = row['entity_type']
            conv_rate = row['avg_conversion_rate']
            sessions = row['total_sessions']
            revenue = row['total_revenue']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'scale_winner',
                'type': 'high_conversion_low_traffic',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🚀 Scale Winner: {entity_id}",
                'description': f"This {entity_type} has {conv_rate:.1f}% conversion rate (top 30%) but only {sessions} sessions (bottom 30%). Increasing traffic could significantly boost revenue.",
                'evidence': {
                    'conversion_rate': conv_rate,
                    'sessions': sessions,
                    'revenue': revenue,
                    'conversion_percentile': row['conversion_percentile'],
                    'traffic_percentile': row['traffic_percentile']
                },
                'metrics': {
                    'current_conversion_rate': conv_rate,
                    'current_sessions': sessions,
                    'current_revenue': revenue
                },
                'hypothesis': f"This {entity_type} converts well but gets little traffic. Directing more qualified traffic here could multiply revenue with minimal additional effort.",
                'confidence_score': 0.85,
                'potential_impact_score': min(100, (conv_rate * 10)),
                'urgency_score': 70,
                'recommended_actions': [
                    'Increase paid ad budget for this target',
                    'Create more content linking to this page',
                    'Improve SEO for related keywords',
                    'Feature this in email campaigns',
                    'Add prominent CTAs from high-traffic pages'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} scale winner opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in scale_winners detector: {e}")
    
    return opportunities


def detect_fix_losers(organization_id: str) -> list:
    """
    Detect: Entities getting traffic but performing poorly
    Example: High-traffic page with terrible conversion rate
    """
    logger.info("🔍 Running Fix Losers detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(bounce_rate) as avg_bounce_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('page', 'campaign')
      GROUP BY canonical_entity_id, entity_type
      HAVING total_sessions > 50  -- Significant traffic
    ),
    ranked AS (
      SELECT 
        *,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY avg_conversion_rate) as conversion_percentile,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY total_sessions) as traffic_percentile
      FROM recent_metrics
    )
    SELECT *
    FROM ranked
    WHERE traffic_percentile > 0.5    -- Top 50% traffic
      AND conversion_percentile < 0.3  -- Bottom 30% conversion
    ORDER BY total_sessions DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            entity_id = row['canonical_entity_id']
            entity_type = row['entity_type']
            conv_rate = row['avg_conversion_rate']
            bounce_rate = row['avg_bounce_rate']
            sessions = row['total_sessions']
            cost = row['total_cost']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'fix_loser',
                'type': 'high_traffic_low_conversion',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🔧 Fix Opportunity: {entity_id}",
                'description': f"This {entity_type} gets {sessions} sessions but only {conv_rate:.1f}% conversion rate. Small improvements here could have huge impact.",
                'evidence': {
                    'conversion_rate': conv_rate,
                    'bounce_rate': bounce_rate,
                    'sessions': sessions,
                    'cost': cost,
                    'traffic_percentile': row['traffic_percentile']
                },
                'metrics': {
                    'current_conversion_rate': conv_rate,
                    'current_bounce_rate': bounce_rate,
                    'current_sessions': sessions
                },
                'hypothesis': f"With {sessions} sessions, even a 1% improvement in conversion could generate significant additional revenue. High bounce rate ({bounce_rate:.1f}%) suggests UX or messaging issues.",
                'confidence_score': 0.90,
                'potential_impact_score': min(100, (sessions / 10)),
                'urgency_score': 80,
                'recommended_actions': [
                    'A/B test different headlines and CTAs',
                    'Improve page load speed',
                    'Clarify value proposition',
                    'Add trust signals (testimonials, reviews)',
                    'Simplify the conversion process',
                    'Check mobile experience'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} fix loser opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in fix_losers detector: {e}")
    
    return opportunities


def detect_declining_performers(organization_id: str) -> list:
    """
    Detect: Entities that were performing well but are declining
    """
    logger.info("🔍 Running Declining Performers detector...")
    
    opportunities = []
    
    query = f"""
    WITH last_30_days AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
      GROUP BY canonical_entity_id, entity_type
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY canonical_entity_id, entity_type
    )
    SELECT 
      l.canonical_entity_id,
      l.entity_type,
      l.total_sessions as current_sessions,
      p.total_sessions as previous_sessions,
      l.total_revenue as current_revenue,
      p.total_revenue as previous_revenue,
      l.avg_conversion_rate as current_conversion_rate,
      p.avg_conversion_rate as previous_conversion_rate,
      SAFE_DIVIDE((l.total_sessions - p.total_sessions), p.total_sessions) * 100 as sessions_change_pct,
      SAFE_DIVIDE((l.total_revenue - p.total_revenue), p.total_revenue) * 100 as revenue_change_pct
    FROM last_30_days l
    INNER JOIN previous_30_days p 
      ON l.canonical_entity_id = p.canonical_entity_id 
      AND l.entity_type = p.entity_type
    WHERE p.total_sessions > 20  -- Had meaningful traffic
      AND SAFE_DIVIDE((l.total_sessions - p.total_sessions), p.total_sessions) < -0.2  -- 20%+ decline
    ORDER BY revenue_change_pct ASC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            entity_id = row['canonical_entity_id']
            entity_type = row['entity_type']
            sessions_change = row['sessions_change_pct'] or 0
            revenue_change = row['revenue_change_pct'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'declining_performer',
                'type': 'traffic_decline',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"📉 Declining: {entity_id}",
                'description': f"This {entity_type} has declined {abs(sessions_change):.0f}% in traffic over the past 30 days. Investigate and address quickly.",
                'evidence': {
                    'current_sessions': row['current_sessions'],
                    'previous_sessions': row['previous_sessions'],
                    'sessions_change_pct': sessions_change,
                    'revenue_change_pct': revenue_change
                },
                'metrics': {
                    'current_sessions': row['current_sessions'],
                    'current_revenue': row['current_revenue']
                },
                'hypothesis': f"Traffic decline of {abs(sessions_change):.0f}% suggests external factors (ranking loss, campaign pause, seasonal) or internal issues (site changes, broken links).",
                'confidence_score': 0.88,
                'potential_impact_score': min(100, abs(revenue_change)),
                'urgency_score': 90,
                'recommended_actions': [
                    'Check for SEO ranking drops',
                    'Review recent site changes',
                    'Check for broken links or 404s',
                    'Verify ad campaigns are still running',
                    'Look for seasonal patterns',
                    'Check competitor activity'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} declining performer opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in declining_performers detector: {e}")
    
    return opportunities


def write_opportunities_to_bigquery(opportunities: list):
    """Write opportunities to BigQuery"""
    if not opportunities:
        logger.warning("No opportunities to write")
        return
    
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
        
        # Run all detectors
        all_opportunities.extend(detect_scale_winners(organization_id))
        all_opportunities.extend(detect_fix_losers(organization_id))
        all_opportunities.extend(detect_declining_performers(organization_id))
        all_opportunities.extend(detect_cross_channel_gaps(organization_id))
        all_opportunities.extend(detect_keyword_cannibalization(organization_id))
        all_opportunities.extend(detect_cost_inefficiency(organization_id))
        all_opportunities.extend(detect_email_engagement_drop(organization_id))
        
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
                'seo_issues': len([o for o in all_opportunities if o['category'] == 'seo_issue']),
                'cost_inefficiency': len([o for o in all_opportunities if o['category'] == 'cost_inefficiency']),
                'email_issues': len([o for o in all_opportunities if o['category'] == 'email_issue'])
            }
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error running Scout AI: {e}")
        return {'error': str(e)}, 500
