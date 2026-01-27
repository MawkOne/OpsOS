"""
Detect Email Engagement Drop Detector
Category: Email
"""

"""
EMAIL Detectors
All detection layers (Fast, Trend, Strategic) for email marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_email_engagement_drop(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email campaigns with declining engagement
    """
    logger.info("🔍 Running Email Engagement Drop detector...")
    
    opportunities = []
    
    query = f"""
    WITH last_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        SUM(sends) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    )
    SELECT 
      l.canonical_entity_id,
      l.avg_open_rate as current_open_rate,
      p.avg_open_rate as previous_open_rate,
      l.avg_ctr as current_ctr,
      p.avg_ctr as previous_ctr,
      l.total_sends,
      SAFE_DIVIDE((l.avg_open_rate - p.avg_open_rate), p.avg_open_rate) * 100 as open_rate_change
    FROM last_30_days l
    INNER JOIN previous_30_days p ON l.canonical_entity_id = p.canonical_entity_id
    WHERE SAFE_DIVIDE((l.avg_open_rate - p.avg_open_rate), p.avg_open_rate) < -0.15  -- 15%+ decline
      AND l.total_sends > 100
    ORDER BY open_rate_change ASC
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
            open_change = row['open_rate_change'] or 0
            current_open = row['current_open_rate']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_issue',
                'type': 'engagement_decline',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"📧 Email Engagement Drop: {entity_id}",
                'description': f"Open rate declined {abs(open_change):.1f}% to {current_open:.1f}%. Audience may be fatiguing or content needs refresh.",
                'evidence': {
                    'current_open_rate': current_open,
                    'previous_open_rate': row['previous_open_rate'],
                    'open_rate_change': open_change
                },
                'metrics': {
                    'current_open_rate': current_open,
                    'change_pct': open_change
                },
                'hypothesis': f"Declining email engagement suggests list fatigue, irrelevant content, or deliverability issues. Early intervention prevents further decline.",
                'confidence_score': 0.78,
                'potential_impact_score': min(100, abs(open_change) * 3),
                'urgency_score': 65,
                'recommended_actions': [
                    'Segment list and test different content for each',
                    'Refresh subject line strategies',
                    'Check email deliverability and spam scores',
                    'Remove inactive subscribers',
                    'A/B test send times and frequency',
                    'Survey subscribers for content preferences'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email engagement drop opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_engagement_drop detector: {e}")
    
    return opportunities
