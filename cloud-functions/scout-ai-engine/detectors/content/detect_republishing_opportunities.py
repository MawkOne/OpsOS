"""'republishing_opportunities' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_republishing_opportunities(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'republishing_opportunities' detector...")
    opportunities = []
    query = f"""
    SELECT e.canonical_entity_id SUM(m.sessions) as sessions, SUM(m.conversions) as conversions
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
    JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
    WHERE m.organization_id = @org_id AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      AND e.entity_type = 'content' AND sessions > 100
    GROUP BY e.canonical_entity_id, e.entity_name
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "content_optimization", "type": "republishing_opportunities", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "content",
                "title": f"Content opportunity: 'republishing_opportunities'", "description": f"Content '{row.canonical_entity_id}' detected for 'republishing_opportunities' optimization",
                "evidence": {"sessions": int(row.sessions), "conversions": int(row.conversions)},
                "metrics": {"sessions": int(row.sessions), "conversions": int(row.conversions)},
                "hypothesis": "Content optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 65, "urgency_score": 50,
                "recommended_actions": ["Analyze content performance", "Optimize content strategy", "Test improvements", "Track engagement"],
                "estimated_effort": "medium", "estimated_timeline": "2-6 weeks",
                "historical_performance": {"sessions": int(row.sessions)}, "comparison_data": {"conversions": int(row.conversions)},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'republishing_opportunities' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
