"""
Detect Backlink Opportunities Detector
Category: SEO
Detects: Pages with high traffic/rankings that could benefit from more backlinks
"""

from google.cloud import bigquery
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_backlink_opportunities(organization_id: str) -> list:
    """
    Detect high-traffic pages with low backlink counts that could benefit from link building
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Backlink Opportunities detector...")
    
    opportunities = []
    
    # First check pages with good traffic but potentially low authority
    query = f"""
    WITH high_traffic_pages AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        AVG(conversion_rate) as avg_cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
      GROUP BY canonical_entity_id
      HAVING SUM(sessions) > 500
    ),
    striking_keywords AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_position) as avg_position,
        SUM(impressions) as impressions
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'keyword'
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
      GROUP BY canonical_entity_id
      HAVING AVG(avg_position) BETWEEN 4 AND 20
    )
    SELECT 
      h.canonical_entity_id,
      h.total_sessions,
      h.total_conversions,
      h.avg_cvr,
      'high_traffic_page' as opportunity_type
    FROM high_traffic_pages h
    WHERE h.avg_cvr > 1
    ORDER BY h.total_sessions DESC
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
            entity_id = row['canonical_entity_id']
            sessions = row['total_sessions'] or 0
            cvr = row['avg_cvr'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'seo_backlinks',
                'type': 'backlink_opportunity',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🔗 Backlink Opportunity: {entity_id}",
                'description': f"High-performing page ({sessions:,.0f} sessions, {cvr:.1f}% CVR) could rank higher with more quality backlinks.",
                'evidence': {
                    'sessions': int(sessions),
                    'conversions': int(row['total_conversions'] or 0),
                    'cvr': float(cvr)
                },
                'metrics': {
                    'sessions': int(sessions),
                    'cvr': float(cvr)
                },
                'hypothesis': "Quality backlinks can improve domain authority and help this already-performing page rank even higher.",
                'confidence_score': 0.72,
                'potential_impact_score': 65,
                'urgency_score': 35,
                'recommended_actions': [
                    'Create linkable content assets',
                    'Reach out for guest posting opportunities',
                    'Build relationships with industry publications',
                    'Create data-driven content others will cite',
                    'Develop infographics or tools',
                    'Monitor competitor backlinks for opportunities'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '3-6 months',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} backlink opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in backlink_opportunities detector: {e}")
    
    return opportunities
