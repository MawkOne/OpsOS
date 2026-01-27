"""
Detect Page Micro Conversion Drop Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_page_micro_conversion_drop(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Micro-conversions (scroll, video, clicks) declining
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Micro-Conversion Drop detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(scroll_depth_avg) as avg_scroll_depth,
        SUM(scroll_depth_75) as total_scroll_75,
        SUM(sessions) as total_sessions,
        SAFE_DIVIDE(SUM(scroll_depth_75), SUM(sessions)) * 100 as scroll_75_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(scroll_depth_avg) as baseline_scroll_depth,
        SAFE_DIVIDE(SUM(scroll_depth_75), SUM(sessions)) * 100 as baseline_scroll_75_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_scroll_depth,
      h.baseline_scroll_depth,
      r.scroll_75_rate,
      h.baseline_scroll_75_rate,
      r.total_sessions,
      SAFE_DIVIDE((r.avg_scroll_depth - h.baseline_scroll_depth), h.baseline_scroll_depth) * 100 as scroll_depth_change_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.baseline_scroll_depth > 0
      AND r.avg_scroll_depth < h.baseline_scroll_depth * 0.85  -- 15%+ drop
      AND r.total_sessions > 100
    ORDER BY scroll_depth_change_pct ASC
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
            priority = "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "engagement_optimization",
                "type": "micro_conversion_drop",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Scroll Depth Declining: {row.scroll_depth_change_pct:+.1f}%",
                "description": f"Average scroll depth down to {row.avg_scroll_depth:.1f}% (from {row.baseline_scroll_depth:.1f}%)",
                "evidence": {
                    "current_scroll_depth": float(row.avg_scroll_depth),
                    "baseline_scroll_depth": float(row.baseline_scroll_depth),
                    "scroll_depth_change_pct": float(row.scroll_depth_change_pct),
                    "scroll_75_rate": float(row.scroll_75_rate),
                    "baseline_scroll_75_rate": float(row.baseline_scroll_75_rate) if row.baseline_scroll_75_rate else None,
                    "total_sessions": int(row.total_sessions),
                },
                "metrics": {
                    "scroll_depth": float(row.avg_scroll_depth),
                },
                "hypothesis": "Content quality declining, page too long, or engagement hooks missing",
                "confidence_score": 0.75,
                "potential_impact_score": min(100, abs(row.scroll_depth_change_pct)),
                "urgency_score": 60,
                "recommended_actions": [
                    "Review content quality - is it engaging?",
                    "Add engagement elements (videos, images, interactive)",
                    "Check page load speed - slow pages lose readers",
                    "Move important content higher up",
                    "Test different content formats",
                    "Add internal links to keep users engaged",
                    f"{int(row.total_sessions * (1 - row.avg_scroll_depth / 100))} sessions not seeing full content"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Micro-Conversion Drop detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Micro-Conversion Drop detector failed: {e}")
    
    return opportunities
