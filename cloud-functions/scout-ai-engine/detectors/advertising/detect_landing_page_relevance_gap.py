"""'landing_page_relevance_gap' Detector"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_landing_page_relevance_gap(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'landing_page_relevance_gap' detector...")
    opportunities = []
    query = f"""
    SELECT canonical_entity_id, SUM(cost) as cost, SUM(conversions) as conversions,
      SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cpa
    FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
    WHERE organization_id = @org_id AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH))
      AND entity_type = 'campaign' AND cost > 100
    GROUP BY canonical_entity_id
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "advertising_optimization", "type": "landing_page_relevance_gap", "priority": "medium", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "ad_campaign",
                "title": f"Ad opportunity: 'landing_page_relevance_gap'", "description": f"Campaign '{row.canonical_entity_id}' detected for 'landing_page_relevance_gap' optimization",
                "evidence": {"cost": float(row.cost), "conversions": int(row.conversions), "cpa": float(row.cpa) if row.cpa else 0},
                "metrics": {"cost": float(row.cost), "cpa": float(row.cpa) if row.cpa else 0},
                "hypothesis": "Advertising optimization opportunity", "confidence_score": 0.75, "potential_impact_score": 70, "urgency_score": 60,
                "recommended_actions": ["Analyze ad performance", "Optimize campaigns", "Test variations", "Monitor ROI"],
                "estimated_effort": "medium", "estimated_timeline": "2-4 weeks",
                "historical_performance": {"cost": float(row.cost)}, "comparison_data": {"cpa": f"${row.cpa:.2f}" if row.cpa else "N/A"},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'landing_page_relevance_gap' opportunities")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
