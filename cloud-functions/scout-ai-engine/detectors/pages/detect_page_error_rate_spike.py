"""
Detect Page Error Rate Spike Detector
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

def detect_page_error_rate_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Page error rate spiking (JS errors, 404s, etc.)
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Page Error Rate Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(error_count) as total_errors,
        SUM(sessions) as total_sessions,
        SAFE_DIVIDE(SUM(error_count), SUM(sessions)) * 100 as error_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        SAFE_DIVIDE(SUM(error_count), SUM(sessions)) * 100 as baseline_error_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.error_rate as current_error_rate,
      h.baseline_error_rate,
      r.total_errors,
      r.total_sessions,
      SAFE_DIVIDE((r.error_rate - h.baseline_error_rate), h.baseline_error_rate) * 100 as error_rate_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.error_rate > 5  -- >5% error rate is concerning
      OR (h.baseline_error_rate > 0 AND r.error_rate > h.baseline_error_rate * 2)  -- 2x increase
      AND r.total_sessions > 50
    ORDER BY r.error_rate DESC
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
            priority = "high" if row.current_error_rate > 10 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "technical_health",
                "type": "page_error_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Page Error Rate Spiking: {row.current_error_rate:.1f}%",
                "description": f"Page errors at {row.current_error_rate:.1f}% of sessions (baseline: {row.baseline_error_rate:.1f}%)",
                "evidence": {
                    "current_error_rate": float(row.current_error_rate),
                    "baseline_error_rate": float(row.baseline_error_rate) if row.baseline_error_rate else None,
                    "error_rate_increase_pct": float(row.error_rate_increase_pct) if row.error_rate_increase_pct else None,
                    "total_errors": int(row.total_errors),
                    "total_sessions": int(row.total_sessions),
                },
                "metrics": {
                    "error_rate": float(row.current_error_rate),
                },
                "hypothesis": "JavaScript errors, broken API calls, or deployment issues affecting user experience",
                "confidence_score": 0.95,
                "potential_impact_score": min(100, row.current_error_rate * 5),
                "urgency_score": 95 if row.current_error_rate > 10 else 75,
                "recommended_actions": [
                    "Check browser console for JavaScript errors",
                    "Review recent deployments - rollback if needed",
                    "Test page functionality across browsers/devices",
                    "Check API endpoints for failures",
                    "Monitor error tracking (Sentry, Bugsnag, etc.)",
                    "Test with ad blockers disabled",
                    f"{int(row.total_errors)} errors affecting user experience"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "1-3 days",
            })
        
        logger.info(f"✅ Page Error Rate Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Page Error Rate Spike detector failed: {e}")
    
    return opportunities
