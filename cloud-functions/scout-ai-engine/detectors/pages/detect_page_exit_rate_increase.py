"""
Detect Page Exit Rate Increase Detector
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

def detect_page_exit_rate_increase(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Exit rate increasing on important pages
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Exit Rate Increase detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        e.canonical_entity_id,
        AVG(exit_rate) as avg_exit_rate,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.date < CURRENT_DATE()
        AND e.entity_type = 'page'
      GROUP BY e.canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(exit_rate) as baseline_exit_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND m.date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND e.entity_type = 'page'
      GROUP BY e.canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_exit_rate,
      h.baseline_exit_rate,
      r.total_sessions,
      r.avg_conversion_rate,
      SAFE_DIVIDE((r.avg_exit_rate - h.baseline_exit_rate), h.baseline_exit_rate) * 100 as exit_rate_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.baseline_exit_rate > 0
      AND r.avg_exit_rate > h.baseline_exit_rate * 1.2  -- 20%+ increase
      AND r.total_sessions > 100
    ORDER BY exit_rate_increase_pct DESC
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
            priority = "high" if row.exit_rate_increase_pct > 50 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "engagement_optimization",
                "type": "exit_rate_increase",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Exit Rate Increasing: {row.avg_exit_rate:.1f}% (+{row.exit_rate_increase_pct:.1f}%)",
                "description": f"Exit rate up to {row.avg_exit_rate:.1f}% from {row.baseline_exit_rate:.1f}%",
                "evidence": {
                    "current_exit_rate": float(row.avg_exit_rate),
                    "baseline_exit_rate": float(row.baseline_exit_rate),
                    "exit_rate_increase_pct": float(row.exit_rate_increase_pct),
                    "total_sessions": int(row.total_sessions),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "exit_rate": float(row.avg_exit_rate),
                },
                "hypothesis": "Missing next steps, broken links, or content not meeting user intent",
                "confidence_score": 0.80,
                "potential_impact_score": min(100, row.exit_rate_increase_pct * 0.8),
                "urgency_score": 75 if row.exit_rate_increase_pct > 50 else 60,
                "recommended_actions": [
                    "Add clear next steps and CTAs",
                    "Check for broken internal links",
                    "Add related content links",
                    "Review page intent vs actual content",
                    "Test different CTA placements",
                    "Add exit-intent popups with offers",
                    f"{int(row.total_sessions * (row.avg_exit_rate / 100))} sessions exiting - keep them engaged"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "3-5 days",
            })
        
        logger.info(f"✅ Exit Rate Increase detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Exit Rate Increase detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_high_traffic_low_conversion_pages', 
    'detect_page_engagement_decay', 
    'detect_scale_winners_multitimeframe', 
    'detect_scale_winners', 
    'detect_fix_losers',
    'detect_page_form_abandonment_spike',
    'detect_page_cart_abandonment_increase',
    'detect_page_error_rate_spike',
    'detect_page_micro_conversion_drop',
    'detect_page_exit_rate_increase'
]
