"""
Detect Email Spam Complaint Spike Detector
Category: Email
"""

"""
EMAIL Detectors
All detection layers (Fast, Trend, Strategic) for email marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_email_spam_complaint_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email campaigns with spam complaints
    Fast Layer: Daily check for reputation damage
    """
    logger.info("🔍 Running Email Spam Complaint Spike detector...")
    
    opportunities = []
    
    query = f"""
    -- Note: Using bounce_rate as proxy for deliverability issues
    -- True spam complaint rate would need to come from ESP data
    WITH recent_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(open_rate) as avg_open_rate,
        SUM(sends) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
      GROUP BY canonical_entity_id
    ),
    baseline_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(bounce_rate) as baseline_bounce_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type IN ('email', 'email_campaign')
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_bounce_rate,
      r.avg_open_rate,
      b.baseline_bounce_rate,
      r.total_sends,
      SAFE_DIVIDE((r.avg_bounce_rate - b.baseline_bounce_rate), b.baseline_bounce_rate) * 100 as bounce_increase_pct
    FROM recent_campaigns r
    LEFT JOIN baseline_campaigns b ON r.canonical_entity_id = b.canonical_entity_id
    WHERE r.avg_bounce_rate > 10
      OR (b.baseline_bounce_rate > 0 AND r.avg_bounce_rate > b.baseline_bounce_rate * 2)
      AND r.total_sends > 50
    ORDER BY r.avg_bounce_rate DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            bounce_rate = row.avg_bounce_rate or 0
            priority = "high" if bounce_rate > 15 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "email_deliverability",
                "type": "deliverability_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"Deliverability Issue: {bounce_rate:.1f}% bounce rate",
                "description": f"Email campaign bounce rate is {bounce_rate:.1f}%, risking sender reputation and deliverability",
                "evidence": {
                    "current_bounce_rate": float(bounce_rate),
                    "baseline_bounce_rate": float(row.baseline_bounce_rate) if row.baseline_bounce_rate else None,
                    "bounce_increase": float(row.bounce_increase_pct) if row.bounce_increase_pct else None,
                    "total_sends": int(row.total_sends),
                },
                "metrics": {
                    "bounce_rate": float(bounce_rate),
                },
                "hypothesis": "High bounce rates damage sender reputation and will cause long-term deliverability issues",
                "confidence_score": 0.90,
                "potential_impact_score": min(100, bounce_rate * 5),
                "urgency_score": 95 if bounce_rate > 15 else 80,
                "recommended_actions": [
                    "Review content for spam triggers (excessive caps, misleading subject)",
                    "Segment audience better - stop sending to unengaged contacts",
                    "Check acquisition sources for quality",
                    "Make unsubscribe process easier and more prominent",
                    "Consider temporary pause if rate >0.1%"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "2-5 days",
            })
        
        logger.info(f"✅ Email Spam Complaint Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Spam Complaint Spike detector failed: {e}")
    
    return opportunities
