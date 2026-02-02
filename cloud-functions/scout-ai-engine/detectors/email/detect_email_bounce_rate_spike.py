"""
Detect Email Bounce Rate Spike Detector
Category: Email
"""

"""
EMAIL Detectors
All detection layers (Fast, Trend, Strategic) for email marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_email_bounce_rate_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email campaigns with dangerous bounce rates
    Fast Layer: Daily check for deliverability crises
    """
    logger.info("🔍 Running Email Bounce Rate Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(bounce_rate) as avg_bounce_rate,
        SUM(sends) as total_sends,
        -- Estimate bounces from bounce_rate and sends
        SUM(CAST(sends * bounce_rate / 100 AS INT64)) as total_bounces
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
        AND bounce_rate IS NOT NULL
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_bounce_rate,
      total_sends,
      total_bounces
    FROM recent_campaigns
    WHERE avg_bounce_rate > 5
      AND total_sends > 50
    ORDER BY avg_bounce_rate DESC
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
            priority = "high" if row.avg_bounce_rate > 10 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_deliverability",
                "type": "bounce_rate_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"High Bounce Rate: {row.avg_bounce_rate:.1f}%",
                "description": f"Email campaign bounce rate is {row.avg_bounce_rate:.1f}%, indicating deliverability issues",
                "evidence": {
                    "bounce_rate": float(row.avg_bounce_rate),
                    "total_sends": int(row.total_sends),
                    "total_bounces": int(row.total_bounces),
                },
                "metrics": {
                    "bounce_rate": float(row.avg_bounce_rate),
                },
                "hypothesis": "High bounce rate indicates list quality issues, invalid email addresses, or sender reputation problems",
                "confidence_score": 0.9 if row.avg_bounce_rate > 10 else 0.75,
                "potential_impact_score": min(100, row.avg_bounce_rate * 5),
                "urgency_score": 90 if row.avg_bounce_rate > 10 else 70,
                "recommended_actions": [
                    "Check sender reputation and authentication (SPF, DKIM, DMARC)",
                    "Review list quality and acquisition sources",
                    "Remove invalid email addresses immediately",
                    "Consider re-engagement campaign before removing soft bounces",
                    "Contact ESP support if reputation damaged"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 days",
            })
        
        logger.info(f"✅ Email Bounce Rate Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Bounce Rate Spike detector failed: {e}")
    
    return opportunities
