"""
MRR/ARR Tracking Detector
Category: Revenue
Monitors monthly and annual recurring revenue metrics
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_mrr_arr_tracking(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: MRR growth <5% MoM or negative growth
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running MRR/ARR Tracking detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_recurring_revenue AS (
      SELECT 
        DATE_TRUNC(date, MONTH) as month,
        SUM(m.mrr) as total_mrr,
        COUNT(DISTINCT m.canonical_entity_id) as active_subscriptions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        AND m.date < CURRENT_DATE()
        AND mrr > 0
      GROUP BY month
    ),
    mrr_growth AS (
      SELECT 
        month,
        total_mrr,
        active_subscriptions,
        LAG(total_mrr) OVER (ORDER BY month) as prev_month_mrr,
        SAFE_DIVIDE((total_mrr - LAG(total_mrr) OVER (ORDER BY month)), LAG(total_mrr) OVER (ORDER BY month)) * 100 as mom_growth_pct
      FROM monthly_recurring_revenue
    )
    SELECT 
      month,
      total_mrr,
      prev_month_mrr,
      mom_growth_pct,
      active_subscriptions,
      total_mrr * 12 as arr
    FROM mrr_growth
    WHERE month >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
      AND prev_month_mrr IS NOT NULL
      AND (mom_growth_pct < 5 OR mom_growth_pct IS NULL)  -- Growth <5% or negative
    ORDER BY month DESC
    LIMIT 3
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
            growth_pct = row.mom_growth_pct if row.mom_growth_pct else 0
            
            if growth_pct < 0:
                priority = "high"
                status = "declining"
            elif growth_pct < 2:
                priority = "high"
                status = "stagnant"
            else:
                priority = "medium"
                status = "slow growth"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_growth",
                "type": "mrr_arr_tracking",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"MRR {status.title()}: {growth_pct:+.1f}% MoM",
                "description": f"Monthly recurring revenue {status} at ${row.total_mrr:,.0f} with {growth_pct:+.1f}% growth vs last month",
                "evidence": {
                    "current_mrr": float(row.total_mrr),
                    "previous_mrr": float(row.prev_month_mrr),
                    "mom_growth_pct": float(growth_pct),
                    "arr": float(row.arr),
                    "active_subscriptions": int(row.active_subscriptions),
                    "month": row.month.isoformat()
                },
                "metrics": {
                    "mrr": float(row.total_mrr),
                    "arr": float(row.arr),
                    "mom_growth_pct": float(growth_pct)
                },
                "hypothesis": "MRR growth insufficient - need to focus on retention, expansion, or acquisition",
                "confidence_score": 0.95,
                "potential_impact_score": min(100, abs(5 - growth_pct) * 10),
                "urgency_score": 85 if growth_pct < 0 else 70,
                "recommended_actions": [
                    "Focus on customer retention to prevent churn",
                    "Improve onboarding to reduce early cancellations",
                    "Implement upsell/cross-sell programs for existing customers",
                    "Reduce churn through proactive customer success",
                    "Increase new subscriber acquisition",
                    "Analyze cohort retention curves",
                    "Review pricing strategy for optimization",
                    "Target 10-20% MoM growth for healthy SaaS business"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "3-6 months",
                "historical_performance": {
                    "current_mrr": float(row.total_mrr),
                    "previous_mrr": float(row.prev_month_mrr)
                },
                "comparison_data": {
                    "target_growth": "5-10% MoM",
                    "current_growth": f"{growth_pct:+.1f}%",
                    "arr_projection": f"${row.arr:,.0f}"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} MRR/ARR tracking alerts")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_mrr_arr_tracking: {e}")
    
    return opportunities
