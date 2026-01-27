"""
Detect High Traffic Low Conversion Pages Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_high_traffic_low_conversion_pages(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #3: High Traffic, Low Conversion Pages
    Detect: Pages getting significant traffic but converting poorly
    """
    logger.info("🔍 Running High Traffic Low CVR Pages detector...")
    
    opportunities = []
    
    query = f"""
    WITH page_performance AS (
      SELECT 
        e.canonical_entity_id,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_cvr,
        SUM(conversions) as total_conversions,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND e.entity_type = 'page'
      GROUP BY e.canonical_entity_id
      HAVING total_sessions > 100  -- Meaningful traffic
    ),
    peer_avg AS (
      SELECT 
        AVG(avg_cvr) as site_avg_cvr
      FROM page_performance
    )
    SELECT 
      p.*,
      pa.site_avg_cvr,
      PERCENT_RANK() OVER (ORDER BY total_sessions) as traffic_percentile,
      PERCENT_RANK() OVER (ORDER BY avg_cvr) as cvr_percentile
    FROM page_performance p
    CROSS JOIN peer_avg pa
    WHERE traffic_percentile > 0.70  -- Top 30% traffic
      AND avg_cvr < pa.site_avg_cvr * 0.80  -- 20% below site average
    ORDER BY total_sessions DESC
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
            sessions = row['total_sessions']
            cvr = row['avg_cvr']
            site_avg = row['site_avg_cvr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'page_optimization',
                'type': 'high_traffic_low_cvr',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🎯 High-Traffic, Low-CVR Page: {entity_id}",
                'description': f"This page gets {sessions:,.0f} sessions (top 30%) but converts at {cvr:.2f}% vs site avg {site_avg:.2f}%. Huge optimization opportunity.",
                'evidence': {
                    'total_sessions': sessions,
                    'conversion_rate': cvr,
                    'site_avg_cvr': site_avg,
                    'cvr_vs_avg': ((cvr / site_avg) - 1) * 100,
                    'traffic_percentile': row['traffic_percentile'],
                    'bounce_rate': row['avg_bounce_rate']
                },
                'metrics': {
                    'current_sessions': sessions,
                    'current_cvr': cvr,
                    'target_cvr': site_avg
                },
                'hypothesis': f"If this page converted at site average, it would generate {sessions * (site_avg / 100):.0f} conversions vs current {row['total_conversions']}. Massive leverage opportunity.",
                'confidence_score': 0.88,
                'potential_impact_score': min(100, ((site_avg - cvr) / cvr) * sessions / 10),
                'urgency_score': 75,
                'recommended_actions': [
                    'A/B test new headline and value proposition',
                    'Simplify primary CTA',
                    'Add social proof and trust signals',
                    'Reduce form fields if applicable',
                    'Improve page load speed',
                    'Test different page layouts',
                    'Add exit-intent popup for high-bounce visitors'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} high-traffic low-CVR page opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in high_traffic_low_conversion_pages detector: {e}")
    
    return opportunities
