"""
Detect Revenue Aov Decline Detector
Category: Revenue
"""

"""
REVENUE Detectors\nAll detection layers (Fast, Trend, Strategic) for revenue & metrics
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_revenue_aov_decline(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Average Order Value declining
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Revenue AOV Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(average_order_value) as avg_aov,
        SUM(transactions) as total_transactions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND average_order_value > 0
    ),
    historical_performance AS (
      SELECT 
        AVG(average_order_value) as baseline_aov
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND average_order_value > 0
    )
    SELECT 
      avg_aov as current_aov,
      baseline_aov,
      total_transactions,
      total_revenue,
      SAFE_DIVIDE((avg_aov - baseline_aov), baseline_aov) * 100 as aov_change_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE baseline_aov > 0
      AND avg_aov < baseline_aov * 0.9  -- 10%+ decline
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
            priority = "high" if row.aov_change_pct < -20 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "revenue_optimization",
                "type": "aov_decline",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Average Order Value Declining: ${row.current_aov:.2f} ({row.aov_change_pct:+.1f}%)",
                "description": f"AOV has declined {abs(row.aov_change_pct):.1f}% from ${row.baseline_aov:.2f} to ${row.current_aov:.2f}",
                "evidence": {
                    "current_aov": float(row.current_aov),
                    "baseline_aov": float(row.baseline_aov),
                    "aov_change_pct": float(row.aov_change_pct),
                    "total_transactions": int(row.total_transactions),
                    "total_revenue": float(row.total_revenue),
                },
                "metrics": {
                    "aov": float(row.current_aov),
                    "aov_change": float(row.aov_change_pct),
                },
                "hypothesis": "Customers are buying lower-value items or fewer items per order",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, abs(row.aov_change_pct) * 3),
                "urgency_score": 80 if row.aov_change_pct < -20 else 60,
                "recommended_actions": [
                    "Analyze product mix - are customers shifting to lower-value items?",
                    "Check for discount/coupon overuse",
                    "Implement upsell/cross-sell strategies",
                    "Test free shipping thresholds to encourage larger orders",
                    "Review pricing strategy",
                    f"Potential revenue recovery: ${(row.baseline_aov - row.current_aov) * row.total_transactions:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Revenue AOV Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Revenue AOV Decline detector failed: {e}")
    
    return opportunities
