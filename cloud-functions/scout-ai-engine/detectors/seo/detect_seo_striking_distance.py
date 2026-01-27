"""
Detect Seo Striking Distance Detector
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

def detect_seo_striking_distance(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #5: SEO Striking Distance Keywords
    Detect: Keywords ranking 4-15 that could reach page 1 with effort
    """
    logger.info("🔍 Running SEO Striking Distance detector...")
    
    opportunities = []
    
    query = f"""
    WITH keyword_performance AS (
      SELECT 
        e.canonical_entity_id,
        AVG(position) as avg_position,
        AVG(search_volume) as avg_search_volume,
        SUM(impressions) as total_impressions,
        AVG(ctr) as avg_ctr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.entity_type = 'keyword'
        AND position IS NOT NULL
      GROUP BY e.canonical_entity_id
      HAVING avg_position BETWEEN 4 AND 15  -- Striking distance
        AND avg_search_volume > 100  -- Meaningful volume
    )
    SELECT 
      *,
      -- Estimate traffic gain if moving to position 1-3
      CASE 
        WHEN avg_position >= 11 THEN total_impressions * 0.30  -- Page 2 -> Page 1 = ~30% CTR
        WHEN avg_position >= 7 THEN total_impressions * 0.20   -- Mid page 1 -> Top 3 = ~20% more
        ELSE total_impressions * 0.10  -- Position 4-6 -> Top 3 = ~10% more
      END as estimated_traffic_gain
    FROM keyword_performance
    WHERE avg_search_volume > 100
    ORDER BY 
      CASE 
        WHEN avg_position <= 10 THEN 0  -- Page 1 keywords first
        ELSE 1
      END,
      estimated_traffic_gain DESC
    LIMIT 20
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
            position = row['avg_position']
            volume = row['avg_search_volume']
            traffic_gain = row['estimated_traffic_gain']
            
            on_page_1 = position <= 10
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_opportunity',
                'type': 'striking_distance' if on_page_1 else 'page_2_opportunity',
                'priority': 'high' if on_page_1 else 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'keyword',
                'title': f"🎯 SEO Striking Distance: {entity_id} (pos {position:.1f})",
                'description': f"Ranking #{position:.1f} for keyword with {volume:.0f} monthly searches. Moving to top 3 could add {traffic_gain:.0f} clicks/month.",
                'evidence': {
                    'current_position': position,
                    'search_volume': volume,
                    'current_impressions': row['total_impressions'],
                    'estimated_traffic_gain': traffic_gain,
                    'on_page_1': on_page_1
                },
                'metrics': {
                    'current_position': position,
                    'search_volume': volume,
                    'potential_clicks_gain': traffic_gain
                },
                'hypothesis': f"Keywords in striking distance represent low-hanging SEO fruit. Small improvements can move them to high-CTR positions with significant traffic gains.",
                'confidence_score': 0.78,
                'potential_impact_score': min(100, (traffic_gain / 50)),
                'urgency_score': 70 if on_page_1 else 55,
                'recommended_actions': [
                    'Refresh and expand page content for this keyword',
                    'Add more internal links to this page',
                    'Improve title tag to increase relevance',
                    'Add schema markup if applicable',
                    'Build high-quality backlinks',
                    'Optimize for featured snippets',
                    'Improve page load speed'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} SEO striking distance opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in seo_striking_distance detector: {e}")
    
    return opportunities
