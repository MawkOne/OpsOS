"""
Detect Scale Winners Multitimeframe Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_scale_winners_multitimeframe(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Enhanced Scale Winners with Monthly Momentum
    Detects: High CVR entities with low traffic, prioritizing those with improving CVR trends
    """
    logger.info("🔍 Running Scale Winners (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_performance AS (
      SELECT 
        m.canonical_entity_id,
        m.entity_type,
        m.year_month,
        m.conversion_rate,
        m.sessions,
        m.revenue,
        LAG(m.conversion_rate, 1) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_1_ago_cvr,
        LAG(m.conversion_rate, 2) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_2_ago_cvr,
        LAG(m.sessions, 1) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_1_ago_sessions,
        MAX(m.conversion_rate) OVER (PARTITION BY m.canonical_entity_id, m.entity_type) as best_cvr_ever,
        STDDEV(m.conversion_rate) OVER (PARTITION BY m.canonical_entity_id, m.entity_type) / AVG(m.conversion_rate) OVER (PARTITION BY m.canonical_entity_id, m.entity_type) as cvr_volatility
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
        
      WHERE m.organization_id = @org_id
        AND e.entity_type IN ('page', 'campaign')
        AND m.sessions > 10
    ),
    
    current_month AS (
      SELECT 
        e.canonical_entity_id,
        e.entity_type,
        conversion_rate as current_cvr,
        sessions as current_sessions,
        revenue as current_revenue,
        month_1_ago_cvr,
        month_2_ago_cvr,
        month_1_ago_sessions,
        best_cvr_ever,
        cvr_volatility,
        
        -- CVR momentum
        CASE 
          WHEN conversion_rate > month_1_ago_cvr AND month_1_ago_cvr > month_2_ago_cvr THEN 'Improving'
          WHEN conversion_rate < month_1_ago_cvr AND month_1_ago_cvr < month_2_ago_cvr THEN 'Declining'
          WHEN cvr_volatility < 0.15 THEN 'Stable'
          ELSE 'Volatile'
        END as cvr_momentum,
        
        SAFE_DIVIDE(conversion_rate - month_1_ago_cvr, month_1_ago_cvr) * 100 as mom_cvr_change
        
      FROM monthly_performance
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_performance)
        AND conversion_rate > 2.0  -- Minimum CVR threshold
    ),
    
    peer_benchmarks AS (
      SELECT 
        entity_type,
        APPROX_QUANTILES(current_cvr, 100)[OFFSET(70)] as cvr_p70,
        APPROX_QUANTILES(current_sessions, 100)[OFFSET(30)] as sessions_p30
      FROM current_month
      GROUP BY entity_type
    )
    
    SELECT 
      c.*,
      p.cvr_p70,
      p.sessions_p30
    FROM current_month c
    JOIN peer_benchmarks p ON c.entity_type = p.entity_type
    WHERE c.current_cvr > p.cvr_p70  -- Top 30% CVR
      AND c.current_sessions < p.sessions_p30  -- Bottom 30% traffic
    ORDER BY 
      CASE 
        WHEN cvr_momentum = 'Improving' THEN 1
        WHEN cvr_momentum = 'Stable' THEN 2
        ELSE 3
      END,
      current_cvr DESC
    LIMIT 20
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
            cvr = row['current_cvr']
            sessions = row['current_sessions']
            momentum = row['cvr_momentum']
            mom_cvr = row['mom_cvr_change'] or 0
            volatility = row['cvr_volatility'] or 0
            
            # Priority based on momentum
            if momentum == 'Improving':
                priority = 'high'
                confidence = 0.92
            elif momentum == 'Stable':
                priority = 'high'
                confidence = 0.88
            else:
                priority = 'medium'
                confidence = 0.75
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'scale_winner',
                'type': f'high_cvr_low_traffic_{momentum.lower()}',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🚀 Scale Winner ({momentum} CVR): {entity_id}",
                'description': f"CVR {cvr:.1f}% (top 30%) with only {sessions:,.0f} sessions. {momentum} trend ({mom_cvr:+.1f}% MoM). {'Low volatility' if volatility < 0.15 else 'Some volatility'} = {'High' if momentum == 'Improving' else 'Good'} confidence scale opportunity.",
                'evidence': {
                    'current_cvr': cvr,
                    'current_sessions': sessions,
                    'cvr_momentum': momentum,
                    'mom_cvr_change': mom_cvr,
                    'cvr_volatility': volatility,
                    'best_cvr_ever': row['best_cvr_ever'],
                    'month_1_ago_cvr': row['month_1_ago_cvr'],
                    'month_2_ago_cvr': row['month_2_ago_cvr']
                },
                'metrics': {
                    'current_conversion_rate': cvr,
                    'current_sessions': sessions,
                    'momentum': momentum
                },
                'hypothesis': f"{'Improving CVR over multiple months + proven conversion ability = HIGH confidence scale opportunity. CVR trend shows this is getting BETTER, not a fluke.' if momentum == 'Improving' else 'Stable CVR over time = Predictable, reliable performance. Low risk to scale.' if momentum == 'Stable' else 'High CVR but volatile. Test with caution before scaling aggressively.'}",
                'confidence_score': confidence,
                'potential_impact_score': min(100, cvr * 8),
                'urgency_score': 75 if momentum == 'Improving' else 65,
                'recommended_actions': [
                    f"MOMENTUM: CVR {momentum.lower()} monthly - {'capitalize on this positive trend!' if momentum == 'Improving' else 'proven stable performer' if momentum == 'Stable' else 'investigate volatility before scaling'}",
                    'Increase paid ad budget targeting this page/campaign',
                    'Create content linking to this high-converting asset',
                    'Feature prominently in email campaigns',
                    'Improve SEO for related keywords',
                    'Add CTAs from high-traffic pages',
                    'Monitor CVR as traffic scales to ensure it holds'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {
                    'best_cvr_ever': row['best_cvr_ever'],
                    'cvr_volatility': volatility
                },
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} scale winner (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in scale_winners_multitimeframe detector: {e}")
    
    return opportunities
