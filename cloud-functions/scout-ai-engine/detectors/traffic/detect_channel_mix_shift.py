"""
Detect Channel Mix Shift Detector
Category: Traffic
Detects: Significant changes in traffic channel proportions
"""

from google.cloud import bigquery
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_channel_mix_shift(organization_id: str) -> list:
    """
    Detect when traffic channel proportions shift significantly (>20% change in share)
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Channel Mix Shift detector...")
    
    opportunities = []
    
    query = f"""
    WITH current_month AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND year_month = FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
      GROUP BY canonical_entity_id
    ),
    previous_month AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND year_month = FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH))
      GROUP BY canonical_entity_id
    ),
    current_total AS (
      SELECT SUM(sessions) as total FROM current_month
    ),
    previous_total AS (
      SELECT SUM(sessions) as total FROM previous_month
    ),
    channel_shares AS (
      SELECT 
        COALESCE(c.canonical_entity_id, p.canonical_entity_id) as canonical_entity_id,
        COALESCE(c.sessions, 0) as current_sessions,
        COALESCE(p.sessions, 0) as previous_sessions,
        SAFE_DIVIDE(COALESCE(c.sessions, 0), ct.total) * 100 as current_share,
        SAFE_DIVIDE(COALESCE(p.sessions, 0), pt.total) * 100 as previous_share
      FROM current_month c
      FULL OUTER JOIN previous_month p ON c.canonical_entity_id = p.canonical_entity_id
      CROSS JOIN current_total ct
      CROSS JOIN previous_total pt
    )
    SELECT 
      canonical_entity_id,
      current_sessions,
      previous_sessions,
      current_share,
      previous_share,
      current_share - previous_share as share_change,
      SAFE_DIVIDE(current_sessions - previous_sessions, NULLIF(previous_sessions, 0)) * 100 as sessions_change_pct
    FROM channel_shares
    WHERE ABS(current_share - previous_share) > 3
       OR ABS(SAFE_DIVIDE(current_sessions - previous_sessions, NULLIF(previous_sessions, 0))) > 0.3
    ORDER BY ABS(current_share - previous_share) DESC
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
            share_change = row['share_change'] or 0
            sessions_change = row['sessions_change_pct'] or 0
            is_growing = share_change > 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'traffic_channel_mix',
                'type': 'channel_share_increase' if is_growing else 'channel_share_decrease',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'traffic_source',
                'title': f"{'📈' if is_growing else '📉'} Channel Mix Shift: {entity_id}",
                'description': f"{entity_id} share {'increased' if is_growing else 'decreased'} from {row['previous_share']:.1f}% to {row['current_share']:.1f}% ({abs(share_change):.1f}pp change). Sessions: {row['current_sessions']:,.0f} vs {row['previous_sessions']:,.0f}.",
                'evidence': {
                    'current_share': float(row['current_share'] or 0),
                    'previous_share': float(row['previous_share'] or 0),
                    'share_change': float(share_change),
                    'sessions_change_pct': float(sessions_change),
                    'current_sessions': int(row['current_sessions'] or 0),
                    'previous_sessions': int(row['previous_sessions'] or 0)
                },
                'metrics': {
                    'current_share': float(row['current_share'] or 0),
                    'current_sessions': int(row['current_sessions'] or 0)
                },
                'hypothesis': f"{'This channel is becoming more important - consider investing more.' if is_growing else 'This channel is losing share - investigate if intentional or problematic.'}",
                'confidence_score': 0.82,
                'potential_impact_score': min(100, abs(share_change) * 10),
                'urgency_score': 50,
                'recommended_actions': [
                    'Review channel strategy',
                    'Analyze conversion rates by channel',
                    'Check for external factors (algorithm changes, market shifts)',
                    'Adjust budget allocation if needed',
                    'Document channel performance trends'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} channel mix shifts")
        
    except Exception as e:
        logger.error(f"❌ Error in channel_mix_shift detector: {e}")
    
    return opportunities
