"""
Detect Referral Quality Decline Detector
Category: Traffic
Detects: Declining quality metrics from referral traffic sources
"""

from google.cloud import bigquery
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_referral_quality_decline(organization_id: str) -> list:
    """
    Detect declining conversion rates or engagement from referral sources
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Referral Quality Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH current_period AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as cvr,
        AVG(avg_bounce_rate) as bounce_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND LOWER(canonical_entity_id) LIKE '%referral%'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY canonical_entity_id
      HAVING SUM(sessions) > 50
    ),
    previous_period AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as cvr,
        AVG(avg_bounce_rate) as bounce_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND LOWER(canonical_entity_id) LIKE '%referral%'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY canonical_entity_id
      HAVING SUM(sessions) > 50
    )
    SELECT 
      c.canonical_entity_id,
      c.sessions as current_sessions,
      p.sessions as previous_sessions,
      c.cvr as current_cvr,
      p.cvr as previous_cvr,
      c.bounce_rate as current_bounce,
      p.bounce_rate as previous_bounce,
      SAFE_DIVIDE(c.cvr - p.cvr, p.cvr) * 100 as cvr_change_pct,
      c.bounce_rate - p.bounce_rate as bounce_change
    FROM current_period c
    JOIN previous_period p ON c.canonical_entity_id = p.canonical_entity_id
    WHERE SAFE_DIVIDE(c.cvr - p.cvr, p.cvr) < -0.2
       OR (c.bounce_rate - p.bounce_rate) > 10
    ORDER BY SAFE_DIVIDE(c.cvr - p.cvr, p.cvr) ASC
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
            cvr_change = row['cvr_change_pct'] or 0
            bounce_change = row['bounce_change'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'traffic_quality',
                'type': 'referral_quality_decline',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'traffic_source',
                'title': f"📉 Referral Quality Declining: {entity_id}",
                'description': f"Traffic quality from {entity_id} is declining. CVR: {row['current_cvr']:.1f}% (was {row['previous_cvr']:.1f}%), Bounce: {row['current_bounce']:.0f}% (was {row['previous_bounce']:.0f}%).",
                'evidence': {
                    'current_cvr': float(row['current_cvr'] or 0),
                    'previous_cvr': float(row['previous_cvr'] or 0),
                    'cvr_change_pct': float(cvr_change),
                    'current_bounce': float(row['current_bounce'] or 0),
                    'previous_bounce': float(row['previous_bounce'] or 0),
                    'bounce_change': float(bounce_change)
                },
                'metrics': {
                    'current_cvr': float(row['current_cvr'] or 0),
                    'current_sessions': int(row['current_sessions'] or 0)
                },
                'hypothesis': "Declining referral quality may indicate changed audience, broken links, or misaligned content.",
                'confidence_score': 0.78,
                'potential_impact_score': min(100, abs(cvr_change)),
                'urgency_score': 55,
                'recommended_actions': [
                    'Review referrer site for changes',
                    'Check landing page relevance',
                    'Verify links are working correctly',
                    'Consider reaching out to referrer',
                    'Update content to match audience expectations'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} referral quality declines")
        
    except Exception as e:
        logger.error(f"❌ Error in referral_quality_decline detector: {e}")
    
    return opportunities
