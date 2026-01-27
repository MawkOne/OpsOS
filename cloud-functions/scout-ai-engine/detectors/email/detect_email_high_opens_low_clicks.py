"""
Detect Email High Opens Low Clicks Detector
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

def detect_email_high_opens_low_clicks(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #8: Email High Opens, Low Clicks
    Detect: Email campaigns with good open rates but poor click-through
    """
    logger.info("🔍 Running Email High Opens Low Clicks detector...")
    
    opportunities = []
    
    query = f"""
    WITH email_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        SUM(sends) as total_sends,
        SUM(opens) as total_opens,
        SUM(clicks) as total_clicks
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
      HAVING total_sends > 100  -- Meaningful send volume
    )
    SELECT *
    FROM email_performance
    WHERE avg_open_rate > 20  -- Good open rate (>20%)
      AND avg_ctr < 2  -- Poor click rate (<2%)
    ORDER BY total_opens DESC
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
            open_rate = row['avg_open_rate']
            ctr = row['avg_ctr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_optimization',
                'type': 'high_opens_low_clicks',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"📧 Email Copy Issue: {entity_id}",
                'description': f"Open rate is strong ({open_rate:.1f}%) but click rate is only {ctr:.1f}%. Subject works but body/CTA needs improvement.",
                'evidence': {
                    'open_rate': open_rate,
                    'click_through_rate': ctr,
                    'total_sends': row['total_sends'],
                    'total_opens': row['total_opens'],
                    'total_clicks': row['total_clicks']
                },
                'metrics': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'target_ctr': 3.0
                },
                'hypothesis': f"High opens prove the subject line works. Low clicks indicate body copy, CTA, or offer issues. Fixing this could 2-3x click-through.",
                'confidence_score': 0.82,
                'potential_impact_score': min(100, (3.0 - ctr) * 20),
                'urgency_score': 60,
                'recommended_actions': [
                    'Rewrite body copy to be more concise and action-oriented',
                    'Make primary CTA more prominent and compelling',
                    'Reduce number of CTAs (focus on one primary action)',
                    'Add urgency or scarcity to offer',
                    'Improve CTA button design and placement',
                    'A/B test different copy approaches',
                    'Simplify email design to reduce friction'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email high opens low clicks opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_high_opens_low_clicks detector: {e}")
    
    return opportunities
