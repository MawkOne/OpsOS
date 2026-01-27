"""
Detect Revenue Discount Cannibalization Detector
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

def detect_revenue_discount_cannibalization(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Discount usage increasing but revenue flat/declining
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Discount Cannibalization detector...")
    
    opportunities = []
    
    # Note: This requires discount data from Stripe
    # For now, we'll check if refund_rate is increasing as a proxy
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(refund_rate) as avg_refund_rate,
        SUM(refunds) as total_refunds,
        SUM(revenue) as total_revenue,
        SUM(transactions) as total_transactions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
    ),
    historical_performance AS (
      SELECT 
        AVG(refund_rate) as baseline_refund_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    )
    SELECT 
      r.avg_refund_rate,
      h.baseline_refund_rate,
      r.total_refunds,
      r.total_revenue,
      r.total_transactions,
      SAFE_DIVIDE((r.avg_refund_rate - h.baseline_refund_rate), h.baseline_refund_rate) * 100 as refund_rate_increase_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE r.avg_refund_rate > 3  -- >3% refund rate
      OR (h.baseline_refund_rate > 0 AND r.avg_refund_rate > h.baseline_refund_rate * 1.5)  -- 50% increase
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
                "category": "revenue_optimization",
                "type": "refund_rate_increase",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Refund Rate Increasing: {row.avg_refund_rate:.1f}%",
                "description": f"Refund rate at {row.avg_refund_rate:.1f}%, up from baseline of {row.baseline_refund_rate:.1f}%",
                "evidence": {
                    "current_refund_rate": float(row.avg_refund_rate),
                    "baseline_refund_rate": float(row.baseline_refund_rate),
                    "refund_rate_increase_pct": float(row.refund_rate_increase_pct) if row.refund_rate_increase_pct else None,
                    "total_refunds": float(row.total_refunds),
                    "total_revenue": float(row.total_revenue),
                },
                "metrics": {
                    "refund_rate": float(row.avg_refund_rate),
                },
                "hypothesis": "Product quality issues, expectation mismatch, or policy abuse",
                "confidence_score": 0.75,
                "potential_impact_score": min(100, row.avg_refund_rate * 10),
                "urgency_score": 60,
                "recommended_actions": [
                    "Analyze refund reasons - product, delivery, or policy issues?",
                    "Check for discount/coupon abuse patterns",
                    "Review product descriptions and images - setting wrong expectations?",
                    "Tighten refund policy if being abused",
                    "Improve product quality or fulfillment",
                    f"Revenue recovery potential: ${row.total_refunds:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
            })
        
        logger.info(f"✅ Refund Rate Increase detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Refund Rate Increase detector failed: {e}")
    
    return opportunities
