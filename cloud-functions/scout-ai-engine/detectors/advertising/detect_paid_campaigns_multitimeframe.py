"""
Detect Paid Campaigns Multitimeframe Detector
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

def detect_paid_campaigns_multitimeframe(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Enhanced Paid Campaign Analysis with Monthly Spend & ROAS Trends
    Detects: Campaign efficiency trends over time
    """
    logger.info("🔍 Running Paid Campaigns (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_campaigns AS (
      SELECT 
        m.canonical_entity_id,
        m.year_month,
        m.cost,
        m.revenue,
        m.conversions,
        m.avg_roas,
        m.avg_cpa,
        LAG(m.avg_roas, 1) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_1_ago_roas,
        LAG(m.avg_roas, 2) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_2_ago_roas,
        LAG(m.avg_cpa, 1) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_1_ago_cpa,
        MAX(m.avg_roas) OVER (PARTITION BY m.canonical_entity_id) as best_roas_ever
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND e.entity_type = 'campaign'
        AND cost > 0
    ),
    
    current AS (
      SELECT 
        canonical_entity_id,
        cost,
        revenue,
        conversions,
        avg_roas as current_roas,
        avg_cpa as current_cpa,
        month_1_ago_roas,
        month_2_ago_roas,
        month_1_ago_cpa,
        best_roas_ever,
        
        -- ROAS trend
        CASE 
          WHEN avg_roas < month_1_ago_roas AND month_1_ago_roas < month_2_ago_roas THEN 'Deteriorating'
          WHEN avg_roas > month_1_ago_roas AND month_1_ago_roas > month_2_ago_roas THEN 'Improving'
          WHEN avg_roas < month_1_ago_roas THEN 'Declining'
          WHEN avg_roas > month_1_ago_roas THEN 'Recovering'
          ELSE 'Stable'
        END as efficiency_trend,
        
        SAFE_DIVIDE(avg_roas - month_1_ago_roas, month_1_ago_roas) * 100 as mom_roas_change
        
      FROM monthly_campaigns
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_campaigns)
        AND cost > 100  -- Meaningful spend
    )
    
    SELECT *
    FROM current
    WHERE (
      current_roas < 2.0  -- Below efficiency threshold
      OR efficiency_trend = 'Deteriorating'  -- Getting worse
      OR (efficiency_trend = 'Declining' AND current_roas < 3.0)  -- Recently declined
    )
    ORDER BY 
      CASE 
        WHEN efficiency_trend = 'Deteriorating' THEN 1
        WHEN current_roas < 1.0 THEN 2
        ELSE 3
      END,
      cost DESC
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
            roas = row['current_roas'] or 0
            cpa = row['current_cpa'] or 0
            cost = row['cost']
            trend = row['efficiency_trend']
            mom_roas = row['mom_roas_change'] or 0
            
            is_deteriorating = trend == 'Deteriorating'
            priority = 'high' if is_deteriorating or roas < 1.0 else 'medium'
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cost_inefficiency',
                'type': f'poor_roas_{trend.lower()}',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'campaign',
                'title': f"💸 Campaign Efficiency ({trend}): {entity_id}",
                'description': f"ROAS {roas:.2f}x ({mom_roas:+.1f}% MoM), CPA ${cpa:.0f}. Trend: {trend}. {'URGENT - efficiency getting worse!' if is_deteriorating else 'Below target efficiency.'}",
                'evidence': {
                    'current_roas': roas,
                    'current_cpa': cpa,
                    'cost': cost,
                    'revenue': row['revenue'],
                    'efficiency_trend': trend,
                    'mom_roas_change': mom_roas,
                    'month_1_ago_roas': row['month_1_ago_roas'],
                    'best_roas_ever': row['best_roas_ever']
                },
                'metrics': {
                    'current_roas': roas,
                    'current_cpa': cpa,
                    'current_cost': cost,
                    'trend': trend
                },
                'hypothesis': f"{'Campaign efficiency deteriorating monthly - getting worse over time. Cut losses or fix immediately.' if is_deteriorating else 'Campaign below efficiency threshold. Consider pausing or optimizing.' if roas < 1.0 else 'Campaign efficiency declining. Intervention may prevent further deterioration.'}",
                'confidence_score': 0.90 if is_deteriorating else 0.80,
                'potential_impact_score': min(100, cost / 10),
                'urgency_score': 95 if is_deteriorating else 85 if roas < 1.0 else 70,
                'recommended_actions': [
                    f"TREND: Efficiency {trend.lower()} - {'immediate action required!' if is_deteriorating else 'needs optimization'}",
                    'Pause campaign to stop losses' if roas < 1.0 else 'Optimize targeting and keywords',
                    'Audit targeting, keywords, and landing pages',
                    'Compare to better-performing campaigns',
                    'Check conversion tracking accuracy',
                    'Test different audiences or ad creative',
                    'Consider reallocating budget to winners'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': 'immediate',
                'historical_performance': {
                    'best_roas_ever': row['best_roas_ever']
                },
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} paid campaign (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in paid_campaigns_multitimeframe detector: {e}")
    
    return opportunities



__all__ = ['detect_cost_inefficiency', 'detect_paid_waste', 'detect_paid_campaigns_multitimeframe']
