"""
Detect Content Decay Detector
Category: Content
"""

"""
CONTENT Detectors\nAll detection layers (Fast, Trend, Strategic) for content marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
bq_client = bigquery.Client()

def detect_content_decay(organization_id: str) -> list:
    """
    PHASE 2A #9: Content Decay
    Detect: Previously strong pages losing traffic/performance over time
    """
    logger.info("🔍 Running Content Decay detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions_recent,
        AVG(conversion_rate) as cvr_recent
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions_historical,
        AVG(conversion_rate) as cvr_historical
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.sessions_recent,
      h.sessions_historical,
      r.cvr_recent,
      h.cvr_historical,
      SAFE_DIVIDE((r.sessions_recent - h.sessions_historical), h.sessions_historical) * 100 as sessions_change_pct,
      SAFE_DIVIDE((r.cvr_recent - h.cvr_historical), h.cvr_historical) * 100 as cvr_change_pct
    FROM recent_performance r
    INNER JOIN historical_performance h 
      ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.sessions_historical > 500  -- Was getting meaningful traffic
      AND SAFE_DIVIDE((r.sessions_recent - h.sessions_historical), h.sessions_historical) < -0.30  -- 30%+ traffic drop
    ORDER BY ABS(sessions_change_pct) DESC
    LIMIT 15
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
            sessions_change = row['sessions_change_pct'] or 0
            sessions_lost = row['sessions_historical'] - row['sessions_recent']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'content_decay',
                'type': 'traffic_decline',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"📉 Content Decay: {entity_id}",
                'description': f"Traffic dropped {abs(sessions_change):.1f}% ({sessions_lost:.0f} sessions lost). This page needs a refresh to recover.",
                'evidence': {
                    'sessions_recent': row['sessions_recent'],
                    'sessions_historical': row['sessions_historical'],
                    'sessions_change_pct': sessions_change,
                    'sessions_lost': sessions_lost,
                    'cvr_recent': row['cvr_recent'],
                    'cvr_historical': row['cvr_historical']
                },
                'metrics': {
                    'current_sessions': row['sessions_recent'],
                    'previous_sessions': row['sessions_historical'],
                    'sessions_lost': sessions_lost
                },
                'hypothesis': f"Content decay occurs when pages become outdated, competitors improve, or rankings slip. Refreshing content can recover lost traffic.",
                'confidence_score': 0.80,
                'potential_impact_score': min(100, abs(sessions_change) / 2),
                'urgency_score': 60,
                'recommended_actions': [
                    'Refresh content with latest data and examples',
                    'Update statistics and references',
                    'Expand thin sections',
                    'Check for broken links and images',
                    'Improve internal linking to this page',
                    'Analyze why competitors may be overtaking',
                    'Add new sections addressing emerging topics',
                    'Improve technical SEO (speed, mobile, etc.)'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} content decay opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in content_decay detector: {e}")
    
    return opportunities
