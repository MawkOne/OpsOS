"""
Detect Revenue Seasonality Deviation Detector
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

def detect_revenue_seasonality_deviation(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Revenue deviating from expected seasonal patterns
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Revenue Seasonality Deviation detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_revenue AS (
      SELECT 
        DATE_TRUNC(date, MONTH) as month,
        EXTRACT(MONTH FROM date) as month_number,
        SUM(revenue) as monthly_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 24 MONTH)  -- 2 years of data
      GROUP BY month, month_number
    ),
    current_month AS (
      SELECT 
        month,
        month_number,
        monthly_revenue as current_revenue
      FROM monthly_revenue
      WHERE month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)
    ),
    same_month_history AS (
      SELECT 
        cm.month_number,
        cm.current_revenue,
        AVG(mr.monthly_revenue) as avg_same_month_revenue,
        STDDEV(mr.monthly_revenue) as stddev_same_month_revenue,
        COUNT(*) as years_of_data
      FROM current_month cm
      JOIN monthly_revenue mr ON mr.month_number = cm.month_number
        AND mr.month < cm.month  -- Only historical data
      GROUP BY cm.month_number, cm.current_revenue
    )
    SELECT 
      month_number,
      current_revenue,
      avg_same_month_revenue,
      stddev_same_month_revenue,
      years_of_data,
      SAFE_DIVIDE((current_revenue - avg_same_month_revenue), stddev_same_month_revenue) as z_score,
      SAFE_DIVIDE((current_revenue - avg_same_month_revenue), avg_same_month_revenue) * 100 as deviation_pct
    FROM same_month_history
    WHERE years_of_data >= 2  -- Need at least 2 years of history
      AND ABS(SAFE_DIVIDE((current_revenue - avg_same_month_revenue), stddev_same_month_revenue)) > 2  -- 2 standard deviations
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
            is_underperforming = row.current_revenue < row.avg_same_month_revenue
            priority = "high" if is_underperforming and abs(row.deviation_pct) > 20 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_trend",
                "type": "seasonality_deviation",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Revenue {'Under' if is_underperforming else 'Over'}performing vs Seasonal Baseline: {row.deviation_pct:+.1f}%",
                "description": f"Revenue ${row.current_revenue:,.0f} vs expected ${row.avg_same_month_revenue:,.0f} for this month ({abs(row.deviation_pct):.1f}% deviation)",
                "evidence": {
                    "current_revenue": float(row.current_revenue),
                    "expected_revenue": float(row.avg_same_month_revenue),
                    "deviation_pct": float(row.deviation_pct),
                    "z_score": float(row.z_score),
                    "years_of_history": int(row.years_of_data),
                },
                "metrics": {
                    "revenue": float(row.current_revenue),
                    "deviation_from_seasonal": float(row.deviation_pct),
                },
                "hypothesis": "Revenue significantly deviating from historical seasonal patterns" if is_underperforming else "Revenue exceeding seasonal expectations - identify what's working",
                "confidence_score": 0.8,
                "potential_impact_score": min(100, abs(row.deviation_pct)),
                "urgency_score": 70 if is_underperforming else 40,
                "recommended_actions": [
                    f"Investigate why revenue is {'below' if is_underperforming else 'above'} seasonal baseline",
                    "Compare to industry seasonal patterns",
                    "Review marketing campaigns vs same period last year",
                    "Check for external factors (economy, competition, events)",
                    f"{'Recovery' if is_underperforming else 'Scale'} opportunity: ${abs(row.current_revenue - row.avg_same_month_revenue):,.0f}"
                ] if is_underperforming else [
                    "Identify what's driving outperformance",
                    "Scale successful tactics",
                    "Document learnings for future seasons",
                    f"Excess revenue vs baseline: ${row.current_revenue - row.avg_same_month_revenue:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Seasonality Deviation detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Seasonality Deviation detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_revenue_anomaly', 
    'detect_metric_anomalies', 
    'detect_revenue_trends_multitimeframe',
    'detect_revenue_aov_decline',
    'detect_revenue_payment_failure_spike',
    'detect_revenue_new_customer_decline',
    'detect_revenue_discount_cannibalization',
    'detect_revenue_seasonality_deviation'
]
