"""
Detect Pricing Page Optimization Detector
Category: Pages
Detects: Pricing pages with optimization opportunities
"""

from google.cloud import bigquery
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_pricing_page_optimization(organization_id: str) -> list:
    """
    Detect pricing pages with high traffic but low conversion or high bounce
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Pricing Page Optimization detector...")
    
    opportunities = []
    
    query = f"""
    WITH pricing_pages AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as cvr,
        AVG(avg_bounce_rate) as bounce_rate,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND (
          LOWER(canonical_entity_id) LIKE '%pricing%'
          OR LOWER(canonical_entity_id) LIKE '%plans%'
          OR LOWER(canonical_entity_id) LIKE '%subscribe%'
          OR LOWER(canonical_entity_id) LIKE '%buy%'
          OR LOWER(canonical_entity_id) LIKE '%checkout%'
        )
      GROUP BY canonical_entity_id
      HAVING SUM(sessions) > 100
    ),
    site_avg AS (
      SELECT 
        AVG(SAFE_DIVIDE(conversions, sessions) * 100) as avg_cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND sessions > 100
    )
    SELECT 
      p.canonical_entity_id,
      p.total_sessions,
      p.total_conversions,
      p.cvr,
      p.bounce_rate,
      p.avg_duration,
      s.avg_cvr as site_avg_cvr
    FROM pricing_pages p
    CROSS JOIN site_avg s
    WHERE p.cvr < s.avg_cvr * 1.5  -- Pricing pages should convert better than average
       OR p.bounce_rate > 50
    ORDER BY p.total_sessions DESC
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
            cvr = row['cvr'] or 0
            bounce = row['bounce_rate'] or 0
            site_avg = row['site_avg_cvr'] or 0
            
            issues = []
            if cvr < site_avg:
                issues.append(f"CVR below site average ({cvr:.1f}% vs {site_avg:.1f}%)")
            if bounce > 50:
                issues.append(f"High bounce rate ({bounce:.0f}%)")
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'pages_optimization',
                'type': 'pricing_page_optimization',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"💰 Optimize Pricing Page: {entity_id}",
                'description': f"Pricing page has {row['total_sessions']:,.0f} sessions but needs optimization. Issues: {'; '.join(issues) if issues else 'Below potential'}",
                'evidence': {
                    'sessions': int(row['total_sessions'] or 0),
                    'conversions': int(row['total_conversions'] or 0),
                    'cvr': float(cvr),
                    'bounce_rate': float(bounce),
                    'site_avg_cvr': float(site_avg),
                    'avg_duration': float(row['avg_duration'] or 0)
                },
                'metrics': {
                    'cvr': float(cvr),
                    'sessions': int(row['total_sessions'] or 0)
                },
                'hypothesis': "Pricing pages are high-intent; optimizing them can significantly impact revenue.",
                'confidence_score': 0.85,
                'potential_impact_score': 90,
                'urgency_score': 80,
                'recommended_actions': [
                    'Simplify pricing tiers',
                    'Add social proof and testimonials',
                    'Highlight value proposition clearly',
                    'Add FAQ section',
                    'Test different pricing displays',
                    'Add comparison table',
                    'Include money-back guarantee'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} pricing page optimizations")
        
    except Exception as e:
        logger.error(f"❌ Error in pricing_page_optimization detector: {e}")
    
    return opportunities
