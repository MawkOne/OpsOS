"""
Detect Page Form Abandonment Spike Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_page_form_abandonment_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Form abandonment rate spiking
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Form Abandonment Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(form_abandonment_rate) as avg_abandonment_rate,
        SUM(form_starts) as total_form_starts,
        SUM(form_submits) as total_form_submits
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
        
        AND entity_type = 'page'
        AND form_starts > 0
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(form_abandonment_rate) as baseline_abandonment_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        
        AND entity_type = 'page'
        AND form_starts > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_abandonment_rate,
      baseline_abandonment_rate,
      total_form_starts,
      total_form_submits,
      SAFE_DIVIDE((avg_abandonment_rate - baseline_abandonment_rate), baseline_abandonment_rate) * 100 as abandonment_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance hWHERE avg_abandonment_rate > 50  -- >50% abandonment is concerning
      OR (baseline_abandonment_rate > 0 AND avg_abandonment_rate > baseline_abandonment_rate * 1.2)  -- 20%+ increase
      AND total_form_starts > 20
    ORDER BY avg_abandonment_rate DESC
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
            priority = "high" if row.avg_abandonment_rate > 70 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "conversion_optimization",
                "type": "form_abandonment_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Form Abandonment Spike: {row.avg_abandonment_rate:.1f}%",
                "description": f"Form abandonment at {row.avg_abandonment_rate:.1f}% (baseline: {row.baseline_abandonment_rate:.1f}%)",
                "evidence": {
                    "current_abandonment_rate": float(row.avg_abandonment_rate),
                    "baseline_abandonment_rate": float(row.baseline_abandonment_rate) if row.baseline_abandonment_rate else None,
                    "abandonment_increase_pct": float(row.abandonment_increase_pct) if row.abandonment_increase_pct else None,
                    "total_form_starts": int(row.total_form_starts),
                    "total_form_submits": int(row.total_form_submits),
                },
                "metrics": {
                    "form_abandonment_rate": float(row.avg_abandonment_rate),
                },
                "hypothesis": "Form friction, too many fields, technical errors, or trust issues causing abandonment",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, row.avg_abandonment_rate * 0.8),
                "urgency_score": 85 if row.avg_abandonment_rate > 70 else 65,
                "recommended_actions": [
                    "Reduce form fields - remove non-essential questions",
                    "Add progress indicators for multi-step forms",
                    "Check for technical errors (JavaScript console)",
                    "Add trust signals near submit button",
                    "Test autofill and validation",
                    "Consider breaking into smaller steps",
                    f"Potential conversions: {int(row.total_form_starts * (row.avg_abandonment_rate / 100))} form starts lost"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "3-5 days",
            })
        
        logger.info(f"✅ Form Abandonment Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Form Abandonment Spike detector failed: {e}")
    
    return opportunities
