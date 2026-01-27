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
        AVG(unsubscribe_rate) as avg_unsubscribe_rate,
        SUM(unsubscribes) as total_unsubscribes,
        SUM(sends) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(unsubscribe_rate) as baseline_unsubscribe_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_unsubscribe_rate,
      h.baseline_unsubscribe_rate,
      r.total_unsubscribes,
      r.total_sends,
      SAFE_DIVIDE((r.avg_unsubscribe_rate - h.baseline_unsubscribe_rate), h.baseline_unsubscribe_rate) * 100 as unsubscribe_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.avg_unsubscribe_rate > 0.5  -- >0.5% unsubscribe rate is concerning
      OR (h.baseline_unsubscribe_rate > 0 AND r.avg_unsubscribe_rate > h.baseline_unsubscribe_rate * 1.5)  -- 50% increase
      AND r.total_sends > 100
    ORDER BY r.avg_unsubscribe_rate DESC
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
            priority = "high" if row.avg_unsubscribe_rate > 1.0 else "medium"
            
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
                "title": f"High Unsubscribe Rate: {row.avg_unsubscribe_rate:.2f}%",
                "description": f"Email unsubscribe rate is {row.avg_unsubscribe_rate:.2f}%, indicating list health issues",
                "evidence": {
                    "current_unsubscribe_rate": float(row.avg_unsubscribe_rate),
                    "baseline_unsubscribe_rate": float(row.baseline_unsubscribe_rate) if row.baseline_unsubscribe_rate else None,
                    "unsubscribe_increase": float(row.unsubscribe_increase_pct) if row.unsubscribe_increase_pct else None,
                    "total_unsubscribes": int(row.total_unsubscribes),
                    "total_sends": int(row.total_sends),
                },
                "metrics": {
                    "unsubscribe_rate": float(row.avg_unsubscribe_rate),
                },
                "hypothesis": "High unsubscribe rates indicate content relevance issues, sending frequency problems, or poor list acquisition",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, row.avg_unsubscribe_rate * 50),
                "urgency_score": 80 if row.avg_unsubscribe_rate > 1.0 else 60,
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
