"""
Detect Traffic Bot Spam Spike Detector
Category: Traffic
"""

"""
TRAFFIC Detectors\nAll detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_traffic_bot_spam_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Bot/spam traffic spike (high bounce, low duration)
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Bot/Spam Traffic Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_traffic AS (
      SELECT 
        e.canonical_entity_id,
        e.entity_type,
        SUM(sessions) as total_sessions,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(avg_session_duration) as avg_duration,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND m.date < CURRENT_DATE()
      GROUP BY e.canonical_entity_id, e.entity_type
    ),
    baseline_traffic AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as baseline_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      GROUP BY e.canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.entity_type,
      r.total_sessions,
      b.baseline_sessions,
      r.avg_bounce_rate,
      r.avg_duration,
      r.avg_conversion_rate,
      SAFE_DIVIDE((r.total_sessions - b.baseline_sessions), b.baseline_sessions) * 100 as traffic_increase_pct
    FROM recent_traffic r
    LEFT JOIN baseline_traffic b ON r.canonical_entity_id = b.canonical_entity_id
    WHERE r.avg_bounce_rate > 80  -- >80% bounce
      AND r.avg_duration < 10  -- <10 seconds
      AND (b.baseline_sessions IS NULL OR r.total_sessions > b.baseline_sessions * 1.5)  -- 50%+ traffic increase
      AND r.total_sessions > 50
    ORDER BY r.total_sessions DESC
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
            priority = "high"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "traffic_quality",
                "type": "bot_spam_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": row.entity_type,
                "title": f"Bot/Spam Traffic Detected: {row.total_sessions:,.0f} sessions",
                "description": f"Traffic spike with {row.avg_bounce_rate:.1f}% bounce and {row.avg_duration:.1f}s duration - likely bot/spam",
                "evidence": {
                    "current_sessions": int(row.total_sessions),
                    "baseline_sessions": int(row.baseline_sessions) if row.baseline_sessions else None,
                    "traffic_increase_pct": float(row.traffic_increase_pct) if row.traffic_increase_pct else None,
                    "bounce_rate": float(row.avg_bounce_rate),
                    "avg_duration": float(row.avg_duration),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "bounce_rate": float(row.avg_bounce_rate),
                    "avg_duration": float(row.avg_duration),
                },
                "hypothesis": "Bot traffic or low-quality referral spam inflating session counts without real engagement",
                "confidence_score": 0.9,
                "potential_impact_score": 70,
                "urgency_score": 75,
                "recommended_actions": [
                    "Check GA4 for suspicious traffic sources",
                    "Implement bot filtering/reCAPTCHA if needed",
                    "Block suspicious referral domains",
                    "Review server logs for bot patterns",
                    "Filter bot traffic from analytics",
                    f"Clean up: {int(row.total_sessions)} suspicious sessions"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 days",
            })
        
        logger.info(f"✅ Bot/Spam Traffic Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Bot/Spam Traffic Spike detector failed: {e}")
    
    return opportunities
