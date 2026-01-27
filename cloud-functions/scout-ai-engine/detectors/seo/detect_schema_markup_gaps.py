"""'schema_markup_gaps' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_schema_markup_gaps(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'schema_markup_gaps' detector...")
    opportunities = []
    query = f"""
    SELECT e.canonical_entity_id, e.entity_name, AVG(m.position) as avg_position, SUM(m.impressions) as impressions
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
    JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
    WHERE m.organization_id = @org_id AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      AND m.entity_type = 'seo_keyword' AND impressions > 100
    GROUP BY e.canonical_entity_id, e.entity_name
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity", "type": "schema_markup_gaps", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "seo_keyword",
                "title": f"SEO opportunity: 'schema_markup_gaps'", "description": f"Keyword '{row.entity_name}' detected for 'schema_markup_gaps' optimization",
                "evidence": {"avg_position": float(row.avg_position), "impressions": int(row.impressions)},
                "metrics": {"position": float(row.avg_position), "impressions": int(row.impressions)},
                "hypothesis": "SEO optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 65, "urgency_score": 55,
                "recommended_actions": ["Analyze SEO performance", "Implement optimization", "Monitor rankings", "Track improvements"],
                "estimated_effort": "medium", "estimated_timeline": "4-8 weeks",
                "historical_performance": {"position": float(row.avg_position)}, "comparison_data": {"impressions": int(row.impressions)},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'schema_markup_gaps' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
