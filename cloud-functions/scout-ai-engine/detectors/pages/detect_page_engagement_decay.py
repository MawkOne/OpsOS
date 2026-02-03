"""
Detect Page Engagement Decay Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_page_engagement_decay(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #4: Page Engagement Decay
    Detect: Pages with declining engagement metrics (early warning before CVR drops)
    """
    logger.info("🔍 Running Page Engagement Decay detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_engagement AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_session_duration) as avg_duration,
        AVG(avg_bounce_rate) as avg_bounce,
        AVG(avg_engagement_rate) as avg_engagement,
        SUM(sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH))
        
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_engagement AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_session_duration) as hist_duration,
        AVG(avg_bounce_rate) as hist_bounce,
        AVG(avg_engagement_rate) as hist_engagement
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        
        
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_duration as recent_duration,
      h.hist_duration as historical_duration,
      r.avg_bounce as recent_bounce,
      h.hist_bounce as historical_bounce,
      r.total_sessions,
      SAFE_DIVIDE((r.avg_duration - h.hist_duration), h.hist_duration) * 100 as duration_change_pct,
      SAFE_DIVIDE((r.avg_bounce - h.hist_bounce), h.hist_bounce) * 100 as bounce_change_pct
    FROM recent_engagement r
    INNER JOIN historical_engagement h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.total_sessions > 50
      AND (
        SAFE_DIVIDE((r.avg_duration - h.hist_duration), h.hist_duration) < -0.20
        OR SAFE_DIVIDE((r.avg_bounce - h.hist_bounce), h.hist_bounce) > 0.15
      )
    ORDER BY ABS(SAFE_DIVIDE((r.avg_duration - h.hist_duration), h.hist_duration)) DESC
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
            duration_change = row['duration_change_pct'] or 0
            bounce_change = row['bounce_change_pct'] or 0
            
            primary_issue = 'duration' if abs(duration_change) > abs(bounce_change) else 'bounce_rate'
            primary_change = duration_change if primary_issue == 'duration' else bounce_change
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'pages_optimization',
                'type': 'engagement_decay',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"⚠️ Engagement Decay: {entity_id}",
                'description': f"{'Session duration dropped' if primary_issue == 'duration' else 'Bounce rate increased'} {abs(primary_change):.1f}% vs historical baseline. Early warning signal.",
                'evidence': {
                    'recent_duration': row['recent_duration'],
                    'historical_duration': row['historical_duration'],
                    'duration_change_pct': duration_change,
                    'recent_bounce': row['recent_bounce'],
                    'historical_bounce': row['historical_bounce'],
                    'bounce_change_pct': bounce_change
                },
                'metrics': {
                    'current_duration': row['recent_duration'],
                    'current_bounce': row['recent_bounce'],
                    'change_pct': primary_change
                },
                'hypothesis': f"Declining engagement metrics often precede conversion rate drops. Catching this early allows intervention before revenue is impacted.",
                'confidence_score': 0.72,
                'potential_impact_score': min(100, abs(primary_change) * 2),
                'urgency_score': 65,
                'recommended_actions': [
                    'Review recent page changes or updates',
                    'Check page load speed and performance',
                    'Analyze user behavior with heatmaps',
                    'Test different content above the fold',
                    'Improve internal linking to keep users engaged',
                    'Add more compelling CTAs earlier on page',
                    'Check mobile vs desktop experience'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} page engagement decay opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in page_engagement_decay detector: {e}")
    
    return opportunities
