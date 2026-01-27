"""
Detect Traffic Spike Quality Check Detector
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

def detect_traffic_spike_quality_check(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Unexpected traffic spikes with quality concerns
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Traffic Spike Quality Check detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_traffic AS (
      SELECT 
        e.canonical_entity_id,
        e.entity_type,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(bounce_rate) as avg_bounce_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND m.date < CURRENT_DATE()
      GROUP BY e.canonical_entity_id, e.entity_type
    ),
    baseline_traffic AS (
      SELECT 
        canonical_entity_id,
        AVG(sessions_per_day) as avg_daily_sessions,
        AVG(avg_conversion_rate) as baseline_conversion_rate
      FROM (
        SELECT 
          canonical_entity_id,
          date,
          SUM(sessions) as sessions_per_day,
          AVG(conversion_rate) as avg_conversion_rate
        FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
        JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
          ON m.canonical_entity_id = e.canonical_entity_id
          
        WHERE m.organization_id = @org_id
          AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
          AND m.date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        GROUP BY canonical_entity_id, date
      )
      GROUP BY e.canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.entity_type,
      r.total_sessions,
      r.avg_conversion_rate,
      r.avg_bounce_rate,
      b.avg_daily_sessions * 7 as expected_weekly_sessions,
      b.baseline_conversion_rate,
      SAFE_DIVIDE((r.total_sessions - (b.avg_daily_sessions * 7)), (b.avg_daily_sessions * 7)) * 100 as traffic_spike_pct
    FROM recent_traffic r
    LEFT JOIN baseline_traffic b ON r.canonical_entity_id = b.canonical_entity_id
    WHERE b.avg_daily_sessions > 0
      AND r.total_sessions > b.avg_daily_sessions * 7 * 2  -- 2x normal traffic
      AND r.avg_conversion_rate < b.baseline_conversion_rate * 0.7  -- 30%+ CVR drop
    ORDER BY traffic_spike_pct DESC
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
                "type": "traffic_spike_quality_concern",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": row.entity_type,
                "title": f"Traffic Spike (+{row.traffic_spike_pct:.0f}%) with Low Quality",
                "description": f"Traffic up {row.traffic_spike_pct:.0f}% but CVR down to {row.avg_conversion_rate:.1f}% (from {row.baseline_conversion_rate:.1f}%)",
                "evidence": {
                    "current_sessions": int(row.total_sessions),
                    "expected_sessions": int(row.expected_weekly_sessions),
                    "traffic_spike_pct": float(row.traffic_spike_pct),
                    "current_conversion_rate": float(row.avg_conversion_rate),
                    "baseline_conversion_rate": float(row.baseline_conversion_rate),
                    "bounce_rate": float(row.avg_bounce_rate),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "hypothesis": "Viral traffic, media mention, or low-quality traffic source causing spike without conversions",
                "confidence_score": 0.85,
                "potential_impact_score": 75,
                "urgency_score": 70,
                "recommended_actions": [
                    "Identify traffic source - where is spike coming from?",
                    "Check if viral or media mention",
                    "Review landing page relevance for new traffic",
                    "Add CTAs to capture interest if viral",
                    "Consider emergency lead magnet/offer",
                    "Monitor for continuation or fade",
                    f"Opportunity: {int(row.total_sessions * row.baseline_conversion_rate / 100)} expected conversions vs {int(row.total_sessions * row.avg_conversion_rate / 100)} actual"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 days",
            })
        
        logger.info(f"✅ Traffic Spike Quality Check detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Traffic Spike Quality Check detector failed: {e}")
    
    return opportunities
