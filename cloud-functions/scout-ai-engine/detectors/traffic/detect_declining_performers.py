"""
Detect Declining Performers Detector
Category: Traffic
"""

"""
TRAFFIC Detectors\nAll detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_declining_performers(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Entities that were performing well but are declining
    """
    logger.info("🔍 Running Declining Performers detector...")
    
    opportunities = []
    
    query = f"""
    WITH last_30_days AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
      GROUP BY canonical_entity_id, entity_type
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as prev_conversion_rate,
        SUM(sessions) as prev_sessions,
        SUM(revenue) as prev_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY canonical_entity_id, entity_type
    )
    SELECT 
      l.canonical_entity_id,
      l.entity_type,
      l.total_sessions as current_sessions,
      p.prev_sessions as previous_sessions,
      l.total_revenue as current_revenue,
      p.prev_revenue as previous_revenue,
      l.avg_conversion_rate as current_conversion_rate,
      p.prev_conversion_rate as previous_conversion_rate,
      SAFE_DIVIDE((l.total_sessions - p.prev_sessions), p.prev_sessions) * 100 as sessions_change_pct,
      SAFE_DIVIDE((l.total_revenue - p.prev_revenue), p.prev_revenue) * 100 as revenue_change_pct
    FROM last_30_days l
    INNER JOIN previous_30_days p ON l.canonical_entity_id = p.canonical_entity_id AND l.entity_type = p.entity_type
    WHERE p.prev_sessions > 20
      AND SAFE_DIVIDE((l.total_sessions - p.prev_sessions), p.prev_sessions) < -0.2
    ORDER BY SAFE_DIVIDE((l.total_revenue - p.prev_revenue), p.prev_revenue) ASC
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
            entity_type = row['entity_type']
            sessions_change = row['sessions_change_pct'] or 0
            revenue_change = row['revenue_change_pct'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'declining_performer',
                'type': 'traffic_decline',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"📉 Declining: {entity_id}",
                'description': f"This {entity_type} has declined {abs(sessions_change):.0f}% in traffic over the past 30 days. Investigate and address quickly.",
                'evidence': {
                    'current_sessions': row['current_sessions'],
                    'previous_sessions': row['previous_sessions'],
                    'sessions_change_pct': sessions_change,
                    'revenue_change_pct': revenue_change
                },
                'metrics': {
                    'current_sessions': row['current_sessions'],
                    'current_revenue': row['current_revenue']
                },
                'hypothesis': f"Traffic decline of {abs(sessions_change):.0f}% suggests external factors (ranking loss, campaign pause, seasonal) or internal issues (site changes, broken links).",
                'confidence_score': 0.88,
                'potential_impact_score': min(100, abs(revenue_change)),
                'urgency_score': 90,
                'recommended_actions': [
                    'Check for SEO ranking drops',
                    'Review recent site changes',
                    'Check for broken links or 404s',
                    'Verify ad campaigns are still running',
                    'Look for seasonal patterns',
                    'Check competitor activity'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} declining performer opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in declining_performers detector: {e}")
    
    return opportunities
