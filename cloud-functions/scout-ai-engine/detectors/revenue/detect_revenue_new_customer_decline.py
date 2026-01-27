"""
Detect Revenue New Customer Decline Detector
Category: Revenue
"""

"""
REVENUE Detectors\nAll detection layers (Fast, Trend, Strategic) for revenue & metrics
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_revenue_new_customer_decline(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: New customer revenue declining vs returning
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running New Customer Revenue Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        SUM(CASE WHEN first_time_customers > 0 THEN revenue ELSE 0 END) as new_customer_revenue,
        SUM(CASE WHEN returning_customers > 0 THEN revenue ELSE 0 END) as returning_customer_revenue,
        SUM(first_time_customers) as total_new_customers,
        SUM(returning_customers) as total_returning_customers,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.date < CURRENT_DATE()
    ),
    historical_performance AS (
      SELECT 
        SUM(CASE WHEN first_time_customers > 0 THEN revenue ELSE 0 END) as baseline_new_customer_revenue,
        SUM(CASE WHEN returning_customers > 0 THEN revenue ELSE 0 END) as baseline_returning_customer_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND m.date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    )
    SELECT 
      r.new_customer_revenue,
      r.returning_customer_revenue,
      h.baseline_new_customer_revenue,
      h.baseline_returning_customer_revenue,
      r.total_new_customers,
      r.total_returning_customers,
      r.total_revenue,
      SAFE_DIVIDE(r.new_customer_revenue, r.total_revenue) * 100 as new_customer_pct,
      SAFE_DIVIDE(h.baseline_new_customer_revenue, (h.baseline_new_customer_revenue + h.baseline_returning_customer_revenue)) * 100 as baseline_new_customer_pct,
      SAFE_DIVIDE((r.new_customer_revenue - h.baseline_new_customer_revenue), h.baseline_new_customer_revenue) * 100 as new_customer_revenue_change_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE h.baseline_new_customer_revenue > 0
      AND r.new_customer_revenue < h.baseline_new_customer_revenue * 0.85  -- 15%+ decline
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
            priority = "high" if row.new_customer_revenue_change_pct < -30 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_growth",
                "type": "new_customer_decline",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"New Customer Revenue Declining: {row.new_customer_revenue_change_pct:+.1f}%",
                "description": f"New customer revenue down {abs(row.new_customer_revenue_change_pct):.1f}% while returning customer revenue stable",
                "evidence": {
                    "current_new_customer_revenue": float(row.new_customer_revenue),
                    "baseline_new_customer_revenue": float(row.baseline_new_customer_revenue),
                    "new_customer_revenue_change_pct": float(row.new_customer_revenue_change_pct),
                    "new_customer_pct_of_total": float(row.new_customer_pct),
                    "baseline_new_customer_pct": float(row.baseline_new_customer_pct),
                    "total_new_customers": int(row.total_new_customers),
                },
                "metrics": {
                    "new_customer_revenue": float(row.new_customer_revenue),
                    "new_customer_pct": float(row.new_customer_pct),
                },
                "hypothesis": "Customer acquisition declining or new customer quality dropping",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, abs(row.new_customer_revenue_change_pct) * 2),
                "urgency_score": 80 if row.new_customer_revenue_change_pct < -30 else 60,
                "recommended_actions": [
                    "Review acquisition channels - where has new customer traffic dropped?",
                    "Check onboarding flow for friction",
                    "Review first-purchase offers and incentives",
                    "Analyze new customer CAC vs LTV",
                    "Test welcome campaigns and first-purchase nurture",
                    f"Growth opportunity: Recover to baseline = ${row.baseline_new_customer_revenue - row.new_customer_revenue:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-3 weeks",
            })
        
        logger.info(f"✅ New Customer Revenue Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ New Customer Revenue Decline detector failed: {e}")
    
    return opportunities
