"""
Detect Cross Channel Gaps Detector
Category: Traffic
"""

"""
TRAFFIC Detectors\nAll detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_cross_channel_gaps(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Pages performing well organically but not supported by paid
    or vice versa
    """
    logger.info("🔍 Running Cross-Channel Gaps detector...")
    
    opportunities = []
    
    query = f"""
    WITH ga_metrics AS (
      SELECT 
        m.canonical_entity_id,
        SUM(m.sessions) as organic_sessions,
        AVG(m.conversion_rate) as avg_conversion_rate,
        SUM(m.revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.entity_type = 'page'
        AND JSON_EXTRACT_SCALAR(m.source_breakdown, '$.ga4') IS NOT NULL
      GROUP BY m.canonical_entity_id
      HAVING organic_sessions > 100
    ),
    ads_spend AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_ad_spend
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
        AND cost > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      g.*,
      COALESCE(a.total_ad_spend, 0) as ad_spend
    FROM ga_metrics g
    LEFT JOIN ads_spend a ON g.canonical_entity_id = a.canonical_entity_id
    WHERE (a.total_ad_spend IS NULL OR a.total_ad_spend < 10)  -- Little to no ad spend
      AND g.avg_conversion_rate > 2.0  -- Good conversion rate
    ORDER BY g.total_revenue DESC
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
            sessions = row['organic_sessions']
            conv_rate = row['avg_conversion_rate']
            revenue = row['total_revenue']
            ad_spend = row['ad_spend']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cross_channel',
                'type': 'organic_winner_no_paid_support',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🎯 Cross-Channel Gap: {entity_id}",
                'description': f"This page gets {sessions} organic sessions with {conv_rate:.1f}% conversion but only ${ad_spend:.2f} in ad spend. Supporting with paid could amplify success.",
                'evidence': {
                    'organic_sessions': sessions,
                    'conversion_rate': conv_rate,
                    'revenue': revenue,
                    'ad_spend': ad_spend
                },
                'metrics': {
                    'current_sessions': sessions,
                    'current_conversion_rate': conv_rate,
                    'current_ad_spend': ad_spend
                },
                'hypothesis': f"This page proves it converts organically. Adding targeted paid traffic could scale revenue without the risk of testing an unproven page.",
                'confidence_score': 0.80,
                'potential_impact_score': min(100, (revenue / 100)),
                'urgency_score': 60,
                'recommended_actions': [
                    'Create Google Ads campaign targeting this page',
                    'Use high-converting organic keywords in paid campaigns',
                    'Start with small budget to test incrementality',
                    'Monitor if paid traffic converts at similar rate to organic',
                    'Scale budget based on performance'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} cross-channel gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cross_channel_gaps detector: {e}")
    
    return opportunities
