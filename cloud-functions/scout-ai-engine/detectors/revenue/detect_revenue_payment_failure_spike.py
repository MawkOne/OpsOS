"""
Detect Revenue Payment Failure Spike Detector
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

def detect_revenue_payment_failure_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Payment failure rate spiking
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Revenue Payment Failure Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(payment_failure_rate) as avg_failure_rate,
        SUM(payment_failures) as total_failures,
        SUM(transactions) as total_transactions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND m.date < CURRENT_DATE()
    ),
    historical_performance AS (
      SELECT 
        AVG(payment_failure_rate) as baseline_failure_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    )
    SELECT 
      r.avg_failure_rate as current_failure_rate,
      h.baseline_failure_rate,
      r.total_failures,
      r.total_transactions,
      SAFE_DIVIDE((r.avg_failure_rate - h.baseline_failure_rate), h.baseline_failure_rate) * 100 as failure_rate_increase_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE r.avg_failure_rate > 2  -- >2% failure rate
      OR (h.baseline_failure_rate > 0 AND r.avg_failure_rate > h.baseline_failure_rate * 1.5)  -- 50% increase
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
            priority = "high" if row.current_failure_rate > 5 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_protection",
                "type": "payment_failure_spike",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Payment Failure Rate Spiking: {row.current_failure_rate:.1f}%",
                "description": f"Payment failures at {row.current_failure_rate:.1f}% (up from {row.baseline_failure_rate:.1f}%), blocking revenue",
                "evidence": {
                    "current_failure_rate": float(row.current_failure_rate),
                    "baseline_failure_rate": float(row.baseline_failure_rate),
                    "failure_rate_increase_pct": float(row.failure_rate_increase_pct) if row.failure_rate_increase_pct else None,
                    "total_failures": int(row.total_failures),
                    "total_transactions": int(row.total_transactions),
                },
                "metrics": {
                    "payment_failure_rate": float(row.current_failure_rate),
                },
                "hypothesis": "Payment processor issues, expired cards, or fraud detection blocking legitimate purchases",
                "confidence_score": 0.9,
                "potential_impact_score": min(100, row.current_failure_rate * 10),
                "urgency_score": 90 if row.current_failure_rate > 5 else 70,
                "recommended_actions": [
                    "Check payment processor status - any outages?",
                    "Review fraud detection settings - too aggressive?",
                    "Send dunning emails to recover failed payments",
                    "Check for expired credit cards",
                    "Test checkout flow for technical issues",
                    "Consider backup payment processor",
                    f"Revenue at risk: ~${(row.total_failures / (row.total_transactions + row.total_failures)) * 100:,.0f} per transaction"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-3 days",
            })
        
        logger.info(f"✅ Payment Failure Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Payment Failure Spike detector failed: {e}")
    
    return opportunities
