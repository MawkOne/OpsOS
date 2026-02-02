"""'content_pillar_opportunities' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_content_pillar_opportunities(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'content_pillar_opportunities' detector...")
    opportunities = []
    query = f"""
    SELECT canonical_entity_id SUM(sessions) as sessions, SUM(conversions) as conversions
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
    WHERE organization_id = @org_id AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      AND entity_type = 'content' AND sessions > 100
    GROUP BY canonical_entity_id, entity_name
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "content_optimization", "type": "content_pillar_opportunities", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "content",
                "title": f"Content opportunity: 'content_pillar_opportunities'", "description": f"Content '{row.canonical_entity_id}' detected for 'content_pillar_opportunities' optimization",
                "evidence": {"sessions": int(row.sessions), "conversions": int(row.conversions)},
                "metrics": {"sessions": int(row.sessions), "conversions": int(row.conversions)},
                "hypothesis": "Content optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 65, "urgency_score": 50,
                "recommended_actions": ["Analyze content performance", "Optimize content strategy", "Test improvements", "Track engagement"],
                "estimated_effort": "medium", "estimated_timeline": "2-6 weeks",
                "historical_performance": {"sessions": int(row.sessions)}, "comparison_data": {"conversions": int(row.conversions)},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'content_pillar_opportunities' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
