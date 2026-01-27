"""'cac_by_channel' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_cac_by_channel(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'cac_by_channel' detector...")
    opportunities = []
    query = f"""
    SELECT e.canonical_entity_id, e.entity_name, m.source, SUM(m.sessions) as sessions, SUM(m.revenue) as revenue
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
    JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
    WHERE m.organization_id = @org_id AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      AND m.entity_type = 'traffic_source' AND sessions > 100
    GROUP BY e.canonical_entity_id, e.entity_name, source
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "traffic_optimization", "type": "cac_by_channel", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "traffic_source",
                "title": f"Traffic opportunity: 'cac_by_channel'", "description": f"Source '{row.entity_name}' detected for 'cac_by_channel' analysis",
                "evidence": {"sessions": int(row.sessions), "revenue": float(row.revenue) if row.revenue else 0},
                "metrics": {"sessions": int(row.sessions), "revenue": float(row.revenue) if row.revenue else 0},
                "hypothesis": "Traffic optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 65, "urgency_score": 55,
                "recommended_actions": ["Analyze traffic patterns", "Optimize traffic mix", "Test improvements", "Monitor changes"],
                "estimated_effort": "medium", "estimated_timeline": "2-4 weeks",
                "historical_performance": {"sessions": int(row.sessions)}, "comparison_data": {"baseline": "established"},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'cac_by_channel' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
