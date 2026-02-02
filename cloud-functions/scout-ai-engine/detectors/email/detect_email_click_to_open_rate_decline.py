"""
Detect Email Click To Open Rate Decline Detector
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

def detect_email_click_to_open_rate_decline(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Opens stable but clicks declining (content/CTA issue)
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Email Click-to-Open Rate Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        -- Calculate click-to-open rate from clicks and opens
        SAFE_DIVIDE(SUM(clicks), SUM(opens)) * 100 as avg_ctor,
        SUM(sends) as total_sends,
        SUM(opens) as total_opens,
        SUM(clicks) as total_clicks
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_open_rate,
      avg_ctr,
      avg_ctor,
      total_sends,
      total_opens,
      total_clicks
    FROM recent_performance
    WHERE avg_open_rate > 20
      AND avg_ctor < 15
      AND total_sends > 50
    ORDER BY avg_open_rate DESC, avg_ctor ASC
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
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_engagement",
                "type": "click_to_open_decline",
                "priority": "medium",
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"Low Click-to-Open Rate: {row.avg_ctor:.1f}%",
                "description": f"Email has good open rate ({row.avg_open_rate:.1f}%) but poor click-to-open rate ({row.avg_ctor:.1f}%), indicating content or CTA issues",
                "evidence": {
                    "open_rate": float(row.avg_open_rate),
                    "click_through_rate": float(row.avg_ctr),
                    "click_to_open_rate": float(row.avg_ctor),
                    "total_sends": int(row.total_sends),
                    "total_opens": int(row.total_opens),
                    "total_clicks": int(row.total_clicks),
                },
                "metrics": {
                    "open_rate": float(row.avg_open_rate),
                    "click_to_open_rate": float(row.avg_ctor),
                },
                "hypothesis": "Subject line is working (good opens) but email content or CTA isn't compelling enough to drive clicks",
                "confidence_score": 0.8,
                "potential_impact_score": 70,
                "urgency_score": 50,
                "recommended_actions": [
                    "Improve CTA placement - put primary CTA above the fold",
                    "Reduce number of links (too many choices = decision paralysis)",
                    "Clarify value proposition of clicking",
                    "Test different CTA copy and button styles",
                    "Add urgency or scarcity elements"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-3 days",
            })
        
        logger.info(f"✅ Email Click-to-Open Rate Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Click-to-Open Rate Decline detector failed: {e}")
    
    return opportunities
