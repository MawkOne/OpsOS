"""'competitor_activity_alerts' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_competitor_activity_alerts(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'competitor_activity_alerts' detector...")
    opportunities = []
    query = f"""
    SELECT e.canonical_entity_id, e.entity_name, SUM(m.cost) as cost, SUM(m.conversions) as conversions,
      SAFE_DIVIDE(SUM(m.cost), SUM(m.conversions)) as cpa
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
    JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
    WHERE m.organization_id = @org_id AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      AND m.entity_type = 'ad_campaign' AND cost > 100
    GROUP BY e.canonical_entity_id, e.entity_name
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "advertising_optimization", "type": "competitor_activity_alerts", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "ad_campaign",
                "title": f"Ad opportunity: 'competitor_activity_alerts'", "description": f"Campaign '{row.entity_name}' detected for 'competitor_activity_alerts' optimization",
                "evidence": {"cost": float(row.cost), "conversions": int(row.conversions), "cpa": float(row.cpa) if row.cpa else 0},
                "metrics": {"cost": float(row.cost), "cpa": float(row.cpa) if row.cpa else 0},
                "hypothesis": "Advertising optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 70, "urgency_score": 60,
                "recommended_actions": ["Analyze ad performance", "Optimize campaigns", "Test variations", "Monitor ROI"],
                "estimated_effort": "medium", "estimated_timeline": "2-4 weeks",
                "historical_performance": {"cost": float(row.cost)}, "comparison_data": {"cpa": f"${row.cpa:.2f}" if row.cpa else "N/A"},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'competitor_activity_alerts' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
