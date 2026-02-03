"""
Revenue Per Subscriber Decline Detector
Category: Email
Detects declining revenue per subscriber over time
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'
def detect_revenue_per_subscriber_decline(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Revenue per subscriber down >20% vs 3-month average
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Revenue Per Subscriber Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(revenue) as total_revenue,
        SUM(sends) as total_sends,
        SAFE_DIVIDE(SUM(revenue), SUM(sends)) as revenue_per_send
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
        AND sends > 0
      GROUP BY canonical_entity_id
      HAVING SUM(revenue) > 0
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(revenue) as baseline_revenue,
        SUM(sends) as baseline_sends,
        SAFE_DIVIDE(SUM(revenue), SUM(sends)) as baseline_revenue_per_send
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('email', 'email_campaign')
        AND sends > 0
      GROUP BY canonical_entity_id
      HAVING SUM(revenue) > 0
    )
    SELECT 
      r.canonical_entity_id,
      r.total_revenue,
      r.total_sends,
      r.revenue_per_send,
      h.baseline_revenue,
      h.baseline_sends,
      h.baseline_revenue_per_send,
      SAFE_DIVIDE((r.revenue_per_send - h.baseline_revenue_per_send), h.baseline_revenue_per_send) * 100 as rps_change_pct
    FROM recent_performance r
    JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.baseline_revenue_per_send > 0
      AND SAFE_DIVIDE((r.revenue_per_send - h.baseline_revenue_per_send), h.baseline_revenue_per_send) < -0.20
    ORDER BY rps_change_pct ASC
    LIMIT 20
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
            priority = "high" if row.rps_change_pct < -40 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "email_optimization",
                "type": "revenue_per_send_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"Revenue Per Send Down: {abs(row.rps_change_pct):.0f}%",
                "description": f"Generating ${row.revenue_per_send:.2f} per send vs ${row.baseline_revenue_per_send:.2f} baseline",
                "evidence": {
                    "current_revenue_per_send": float(row.revenue_per_send),
                    "baseline_revenue_per_send": float(row.baseline_revenue_per_send),
                    "rps_change_pct": float(row.rps_change_pct),
                    "total_sends": int(row.total_sends),
                    "total_revenue": float(row.total_revenue)
                },
                "metrics": {
                    "revenue_per_send": float(row.revenue_per_send),
                    "rps_change_pct": float(row.rps_change_pct)
                },
                "hypothesis": "Declining subscriber value - need better offers, targeting, or frequency optimization",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, abs(row.rps_change_pct) * 1.5),
                "urgency_score": 75 if priority == "high" else 55,
                "recommended_actions": [
                    "Improve offers and promotional content",
                    "Segment by subscriber value (high/medium/low)",
                    "Test urgency tactics (limited time, scarcity)",
                    "Increase purchase frequency with winback campaigns",
                    "A/B test product recommendations and upsells",
                    "Re-engagement campaign for inactive subscribers"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "historical_performance": {
                    "baseline_rps": float(row.baseline_revenue_per_send),
                    "current_rps": float(row.revenue_per_send)
                },
                "comparison_data": {
                    "sends_current": int(row.total_sends),
                    "sends_baseline": int(row.baseline_sends)
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} revenue per subscriber decline opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_revenue_per_subscriber_decline: {e}")
    
    return opportunities
