"""
Transaction/Refund Anomalies Detector
Category: Revenue
Detects unusual transaction volumes or refund spikes
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_transaction_refund_anomalies(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Refund rate >5% OR refund spike >2x baseline
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Transaction/Refund Anomalies detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        SUM(transactions) as total_transactions,
        SUM(refund_count) as total_refunds,
        SUM(revenue) as total_revenue,
        SUM(refunds) as total_refund_amount,
        SAFE_DIVIDE(SUM(refund_count), SUM(transactions)) * 100 as refund_rate_pct
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND transactions > 0
    ),
    baseline_metrics AS (
      SELECT 
        SUM(transactions) as baseline_transactions,
        SUM(refund_count) as baseline_refunds,
        SAFE_DIVIDE(SUM(refund_count), SUM(transactions)) * 100 as baseline_refund_rate_pct
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND transactions > 0
    )
    SELECT 
      total_transactions,
      total_refunds,
      total_revenue,
      total_refund_amount,
      refund_rate_pct,
      baseline_refund_rate_pct,
      SAFE_DIVIDE((refund_rate_pct - baseline_refund_rate_pct), baseline_refund_rate_pct) * 100 as refund_rate_change_pct
    FROM recent_metrics r
    CROSS JOIN baseline_metrics b
    WHERE refund_rate_pct > 5  -- Refund rate >5%
       OR (baseline_refund_rate_pct > 0 AND total_refunds > baseline_refunds * 2)  -- Refunds >2x baseline
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
            refund_rate = row.refund_rate_pct if row.refund_rate_pct else 0
            
            if refund_rate > 10:
                priority = "high"
            elif refund_rate > 7:
                priority = "high"
            else:
                priority = "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "revenue_anomaly",
                "type": "refund_anomaly",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Refund Rate Spike: {refund_rate:.1f}% of transactions",
                "description": f"{row.total_refunds} refunds out of {row.total_transactions} transactions ({refund_rate:.1f}%) vs {row.baseline_refund_rate_pct:.1f}% baseline",
                "evidence": {
                    "current_refund_rate": float(refund_rate),
                    "baseline_refund_rate": float(row.baseline_refund_rate_pct),
                    "total_refunds": int(row.total_refunds),
                    "total_transactions": int(row.total_transactions),
                    "refund_amount": float(row.total_refund_amount),
                    "refund_rate_change_pct": float(row.refund_rate_change_pct) if row.refund_rate_change_pct else 0
                },
                "metrics": {
                    "refund_rate": float(refund_rate),
                    "total_refunds": int(row.total_refunds),
                    "refund_amount": float(row.total_refund_amount)
                },
                "hypothesis": "High refund rate indicates product quality issues, misaligned expectations, or customer satisfaction problems",
                "confidence_score": 0.90,
                "potential_impact_score": min(100, refund_rate * 10),
                "urgency_score": 90 if priority == "high" else 70,
                "recommended_actions": [
                    "Review recent product/service changes",
                    "Check product quality and delivery issues",
                    "Improve customer support response time",
                    "Address root causes in customer feedback",
                    "Review refund policies and abuse patterns",
                    "Improve product descriptions and expectations",
                    "Implement quality control measures",
                    "Analyze refund reasons by category"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "historical_performance": {
                    "current_rate": float(refund_rate),
                    "baseline_rate": float(row.baseline_refund_rate_pct)
                },
                "comparison_data": {
                    "target_rate": "<3%",
                    "current_rate": f"{refund_rate:.1f}%",
                    "financial_impact": f"${row.total_refund_amount:,.0f} refunded"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} refund anomalies")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_transaction_refund_anomalies: {e}")
    
    return opportunities
