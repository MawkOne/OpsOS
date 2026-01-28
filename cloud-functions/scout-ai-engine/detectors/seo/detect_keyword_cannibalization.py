"""
Detect Keyword Cannibalization Detector
Category: Seo
"""

"""
SEO Detectors\nAll detection layers (Fast, Trend, Strategic) for SEO & organic search
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_keyword_cannibalization(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Multiple pages competing for the same keywords
    causing ranking dilution
    """
    logger.info("🔍 Running Keyword Cannibalization detector...")
    
    opportunities = []
    
    query = f"""
    WITH keyword_page_mapping AS (
      SELECT 
        canonical_entity_id as keyword_id,
        canonical_entity_id as page_id,
        AVG(position) as avg_position,
        SUM(sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      INNER JOIN `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
        ON organization_id = organization_id
        AND date = date
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'keyword'
        AND entity_type = 'page'
      GROUP BY keyword_id, page_id
    ),
    cannibalization_cases AS (
      SELECT 
        keyword_id,
        COUNT(DISTINCT page_id) as competing_pages,
        AVG(avg_position) as avg_position,
        SUM(total_sessions) as total_sessions
      FROM keyword_page_mapping
      GROUP BY keyword_id
      HAVING COUNT(DISTINCT page_id) > 1  -- Multiple pages
        AND AVG(avg_position) > 10  -- Not ranking great
    )
    SELECT *
    FROM cannibalization_cases
    ORDER BY competing_pages DESC, avg_position DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            keyword_id = row['keyword_id']
            competing_pages = row['competing_pages']
            position = row['avg_position']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_issue',
                'type': 'keyword_cannibalization',
                'priority': 'medium',
                'status': 'new',
                'entity_id': keyword_id,
                'entity_type': 'keyword',
                'title': f"⚠️ Keyword Cannibalization: {keyword_id}",
                'description': f"{competing_pages} pages are competing for this keyword (avg position: {position:.1f}). Consolidating could improve rankings.",
                'evidence': {
                    'competing_pages': competing_pages,
                    'avg_position': position
                },
                'metrics': {
                    'competing_pages': competing_pages,
                    'current_position': position
                },
                'hypothesis': f"When multiple pages target the same keyword, search engines struggle to determine which to rank, diluting authority and resulting in poor rankings for all.",
                'confidence_score': 0.75,
                'potential_impact_score': min(100, (competing_pages * 15)),
                'urgency_score': 50,
                'recommended_actions': [
                    'Audit all pages ranking for this keyword',
                    'Consolidate content into one authoritative page',
                    '301 redirect weaker pages to the main page',
                    'Update internal linking to point to canonical page',
                    'Add canonical tags if pages must stay separate',
                    'Monitor rankings after consolidation'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} keyword cannibalization opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in keyword_cannibalization detector: {e}")
    
    return opportunities
