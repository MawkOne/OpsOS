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
        entity_name,
        SUM(revenue_attributed) as total_revenue,
        AVG(list_size) as avg_list_size,
        SAFE_DIVIDE(SUM(revenue_attributed), AVG(list_size)) as revenue_per_subscriber
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
        AND list_size > 0
      GROUP BY canonical_entity_id, entity_name
      HAVING SUM(revenue_attributed) > 0
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(revenue_attributed) as baseline_revenue,
        AVG(list_size) as baseline_list_size,
        SAFE_DIVIDE(SUM(revenue_attributed), AVG(list_size)) as baseline_revenue_per_subscriber
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email_campaign'
        AND list_size > 0
      GROUP BY canonical_entity_id
      HAVING SUM(revenue_attributed) > 0
    )
    SELECT 
      canonical_entity_id,
      entity_name,
      total_revenue,
      avg_list_size,
      revenue_per_subscriber,
      baseline_revenue,
      baseline_list_size,
      baseline_revenue_per_subscriber,
      SAFE_DIVIDE((revenue_per_subscriber - baseline_revenue_per_subscriber), baseline_revenue_per_subscriber) * 100 as rps_change_pct
    FROM recent_performance r
    WHERE baseline_revenue_per_subscriber > 0
      AND SAFE_DIVIDE((revenue_per_subscriber - baseline_revenue_per_subscriber), baseline_revenue_per_subscriber) < -0.20  -- >20% decline
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
                "category": "email_optimization",
                "type": "revenue_per_subscriber_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email_campaign",
                "title": f"Revenue Per Subscriber Down: {abs(row.rps_change_pct):.0f}%",
                "description": f"'{row.entity_name}' generating ${row.revenue_per_subscriber:.2f} per subscriber vs ${row.baseline_revenue_per_subscriber:.2f} baseline",
                "evidence": {
                    "current_revenue_per_subscriber": float(row.revenue_per_subscriber),
                    "baseline_revenue_per_subscriber": float(row.baseline_revenue_per_subscriber),
                    "rps_change_pct": float(row.rps_change_pct),
                    "current_list_size": int(row.avg_list_size),
                    "total_revenue": float(row.total_revenue)
                },
                "metrics": {
                    "revenue_per_subscriber": float(row.revenue_per_subscriber),
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
                    "baseline_rps": float(row.baseline_revenue_per_subscriber),
                    "current_rps": float(row.revenue_per_subscriber)
                },
                "comparison_data": {
                    "list_size_current": int(row.avg_list_size),
                    "list_size_baseline": int(row.baseline_list_size)
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} revenue per subscriber decline opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_revenue_per_subscriber_decline: {e}")
    
    return opportunities
