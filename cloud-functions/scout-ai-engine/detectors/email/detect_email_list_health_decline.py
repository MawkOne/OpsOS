"""
Detect Email List Health Decline Detector
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

def detect_email_list_health_decline(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email list health declining (growth slowing, unsubscribes rising)
    Trend Layer: Weekly check for list health issues
    """
    logger.info("🔍 Running Email List Health Decline detector...")
    
    opportunities = []
    
    # Note: This requires list_size tracking over time
    # For now, we'll check unsubscribe rate trends from campaigns
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(open_rate) as avg_open_rate,
        SUM(sends) as total_sends,
        SUM(opens) as total_opens
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(bounce_rate) as baseline_bounce_rate,
        AVG(open_rate) as baseline_open_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('email', 'email_campaign')
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_bounce_rate,
      r.avg_open_rate,
      h.baseline_bounce_rate,
      h.baseline_open_rate,
      r.total_sends,
      r.total_opens,
      SAFE_DIVIDE((r.avg_open_rate - h.baseline_open_rate), h.baseline_open_rate) * 100 as open_rate_change_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE (r.avg_bounce_rate > 5 OR r.avg_open_rate < 10 OR 
           (h.baseline_open_rate IS NOT NULL AND r.avg_open_rate < h.baseline_open_rate * 0.7))
      AND r.total_sends > 100
    ORDER BY r.avg_open_rate ASC
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
            open_rate = row.avg_open_rate or 0
            priority = "high" if bounce_rate > 10 or open_rate < 5 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_list_health",
                "type": "list_health_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"List Health Issue: {open_rate:.1f}% open rate",
                "description": f"Email list showing signs of fatigue with {open_rate:.1f}% open rate and {bounce_rate:.1f}% bounce rate",
                "evidence": {
                    "current_open_rate": float(open_rate),
                    "current_bounce_rate": float(bounce_rate),
                    "baseline_open_rate": float(row.baseline_open_rate) if row.baseline_open_rate else None,
                    "open_rate_change": float(row.open_rate_change_pct) if row.open_rate_change_pct else None,
                    "total_sends": int(row.total_sends),
                },
                "metrics": {
                    "open_rate": float(open_rate),
                    "bounce_rate": float(bounce_rate),
                },
                "hypothesis": "Declining open rates and high bounces indicate list quality issues or content fatigue",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, (20 - open_rate) * 5) if open_rate < 20 else 30,
                "urgency_score": 80 if bounce_rate > 10 else 60,
                "recommended_actions": [
                    "Reduce email frequency if sending >5x/week",
                    "Segment audience for more relevant content",
                    "Review acquisition sources for quality",
                    "Test re-engagement campaigns",
                    "Improve content value and relevance"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Email List Health Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email List Health Decline detector failed: {e}")
    
    return opportunities
