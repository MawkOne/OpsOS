"""
Detect Cost Inefficiency Detector
Category: Advertising
"""

"""
ADVERTISING Detectors\nAll detection layers (Fast, Trend, Strategic) for paid advertising
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_cost_inefficiency(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: High-cost entities with poor ROI
    """
    logger.info("🔍 Running Cost Inefficiency detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(cost) as total_cost,
        SUM(revenue) as total_revenue,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(revenue), SUM(cost)) as roas,
        SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cpa
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND cost > 0
      GROUP BY canonical_entity_id, entity_type
      HAVING total_cost > 100  -- Spending at least $100
    )
    SELECT *
    FROM recent_performance
    WHERE roas < 1.0  -- Losing money
    ORDER BY total_cost DESC
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
            cost = row['total_cost']
            revenue = row['total_revenue']
            roas = row['roas'] or 0
            cpa = row['cpa'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cost_inefficiency',
                'type': 'negative_roi',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"💸 Cost Inefficiency: {entity_id}",
                'description': f"This {entity_type} has spent ${cost:.2f} but only generated ${revenue:.2f} (ROAS: {roas:.2f}x). Consider pausing or optimizing.",
                'evidence': {
                    'total_cost': cost,
                    'total_revenue': revenue,
                    'roas': roas,
                    'cpa': cpa
                },
                'metrics': {
                    'current_cost': cost,
                    'current_revenue': revenue,
                    'current_roas': roas
                },
                'hypothesis': f"With ROAS below 1.0x, every dollar spent loses money. Either optimize or reallocate budget to better-performing entities.",
                'confidence_score': 0.92,
                'potential_impact_score': min(100, (cost - revenue) / 10),
                'urgency_score': 85,
                'recommended_actions': [
                    'Pause this campaign immediately to stop losses',
                    'Audit targeting and keywords',
                    'Review landing page conversion rate',
                    'Check if tracking is working correctly',
                    'Compare to better-performing campaigns',
                    'Either fix or reallocate budget'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} cost inefficiency opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cost_inefficiency detector: {e}")
    
    return opportunities
