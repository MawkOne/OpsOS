"""'featured_snippet_opportunities' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_featured_snippet_opportunities(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'featured_snippet_opportunities' detector...")
    opportunities = []
    query = f"""
    SELECT e.canonical_entity_id, e.entity_name, AVG(m.position) as avg_position, SUM(m.impressions) as impressions
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
    JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
    WHERE organization_id = @org_id AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      AND entity_type = 'seo_keyword' AND impressions > 100
    GROUP BY canonical_entity_id, entity_name
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity", "type": "featured_snippet_opportunities", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "seo_keyword",
                "title": f"SEO opportunity: 'featured_snippet_opportunities'", "description": f"Keyword '{row.entity_name}' detected for 'featured_snippet_opportunities' optimization",
                "evidence": {"avg_position": float(row.avg_position), "impressions": int(row.impressions)},
                "metrics": {"position": float(row.avg_position), "impressions": int(row.impressions)},
                "hypothesis": "SEO optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 65, "urgency_score": 55,
                "recommended_actions": ["Analyze SEO performance", "Implement optimization", "Monitor rankings", "Track improvements"],
                "estimated_effort": "medium", "estimated_timeline": "4-8 weeks",
                "historical_performance": {"position": float(row.avg_position)}, "comparison_data": {"impressions": int(row.impressions)},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'featured_snippet_opportunities' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
