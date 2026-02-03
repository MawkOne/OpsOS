"""
Detect New Traffic Opportunities Detector
Category: Traffic
Detects: Emerging traffic sources with high conversion potential
"""

from google.cloud import bigquery
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_new_traffic_opportunities(organization_id: str) -> list:
    """
    Detect emerging traffic sources with above-average conversion rates
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running New Traffic Opportunities detector...")
    
    opportunities = []
    
    query = f"""
    WITH source_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY canonical_entity_id
      HAVING SUM(sessions) >= 50 AND SUM(sessions) < 500
    ),
    avg_cvr AS (
      SELECT AVG(conversion_rate) as site_avg_cvr
      FROM source_performance
      WHERE conversion_rate > 0
    )
    SELECT 
      s.canonical_entity_id,
      s.total_sessions,
      s.total_conversions,
      s.total_revenue,
      s.conversion_rate,
      a.site_avg_cvr,
      SAFE_DIVIDE(s.conversion_rate - a.site_avg_cvr, a.site_avg_cvr) * 100 as cvr_vs_avg_pct
    FROM source_performance s
    CROSS JOIN avg_cvr a
    WHERE s.conversion_rate > a.site_avg_cvr * 1.2
    ORDER BY s.conversion_rate DESC
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
            cvr = row['conversion_rate'] or 0
            site_avg = row['site_avg_cvr'] or 0
            cvr_vs_avg = row['cvr_vs_avg_pct'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'traffic_opportunity',
                'type': 'emerging_traffic_source',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'traffic_source',
                'title': f"🌱 Emerging Opportunity: {entity_id}",
                'description': f"{entity_id} converts at {cvr:.1f}% vs site average {site_avg:.1f}% (+{cvr_vs_avg:.0f}% better). Currently only {row['total_sessions']:,.0f} sessions - growth potential.",
                'evidence': {
                    'sessions': int(row['total_sessions'] or 0),
                    'conversions': int(row['total_conversions'] or 0),
                    'conversion_rate': float(cvr),
                    'site_avg_cvr': float(site_avg),
                    'cvr_vs_avg_pct': float(cvr_vs_avg)
                },
                'metrics': {
                    'conversion_rate': float(cvr),
                    'sessions': int(row['total_sessions'] or 0)
                },
                'hypothesis': f"This source converts {cvr_vs_avg:.0f}% better than average. Investing more could yield strong returns.",
                'confidence_score': 0.75,
                'potential_impact_score': min(100, cvr_vs_avg),
                'urgency_score': 40,
                'recommended_actions': [
                    'Investigate this traffic source',
                    'Consider increasing investment',
                    'Create dedicated landing pages',
                    'Build partnerships if referral',
                    'Track growth over time'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} new traffic opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in new_traffic_opportunities detector: {e}")
    
    return opportunities
