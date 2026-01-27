"""
Detect Paid Waste Detector
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

def detect_paid_waste(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #7: Paid Waste Detection
    Detect: Campaigns spending money with 0 or very few conversions
    """
    logger.info("🔍 Running Paid Waste detector...")
    
    opportunities = []
    
    query = f"""
    WITH campaign_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_cost,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'campaign'
        AND cost > 0
      GROUP BY canonical_entity_id
      HAVING total_cost > 50  -- Spent at least $50
    )
    SELECT *
    FROM campaign_performance
    WHERE (total_conversions = 0 AND total_clicks > 30)  -- 0 conversions after meaningful clicks
       OR (total_cost > 100 AND total_conversions = 0)   -- Or $100+ spent with 0 conversions
       OR (total_conversions > 0 AND SAFE_DIVIDE(total_cost, total_conversions) > 200)  -- Or CPA > $200
    ORDER BY total_cost DESC
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
            cost = row['total_cost']
            clicks = row['total_clicks']
            conversions = row['total_conversions']
            
            is_zero_conv = conversions == 0
            cpa = cost / conversions if conversions > 0 else 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'paid_waste',
                'type': 'zero_conversions' if is_zero_conv else 'high_cpa',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'campaign',
                'title': f"🛑 Paid Waste: {entity_id}",
                'description': f"Spent ${cost:.2f} with {conversions} conversions ({clicks} clicks). {'Pause immediately.' if is_zero_conv else f'CPA ${cpa:.2f} too high.'}",
                'evidence': {
                    'total_cost': cost,
                    'total_clicks': clicks,
                    'total_conversions': conversions,
                    'cpa': cpa if not is_zero_conv else None
                },
                'metrics': {
                    'current_spend': cost,
                    'current_conversions': conversions,
                    'current_cpa': cpa if not is_zero_conv else None
                },
                'hypothesis': f"{'Zero conversions after significant spend indicates fundamental issues with targeting, messaging, or landing page.' if is_zero_conv else 'Extremely high CPA makes this campaign unprofitable. Budget should be reallocated.'}",
                'confidence_score': 0.95,
                'potential_impact_score': min(100, cost / 10),
                'urgency_score': 95,
                'recommended_actions': [
                    'Pause campaign immediately to stop losses',
                    'Audit campaign targeting and keywords',
                    'Review landing page conversion rate',
                    'Check conversion tracking is working',
                    'Analyze search terms triggering ads',
                    'Add negative keywords',
                    'Compare to successful campaigns',
                    'Either fix issues or reallocate budget'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': 'immediate',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} paid waste opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in paid_waste detector: {e}")
    
    return opportunities
