"""
Detect Scale Winners Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict

from .priority_filter import get_priority_pages_where_clause, calculate_impact_score

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_scale_winners(organization_id: str, priority_pages: Optional[Dict] = None) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Entities performing well but not getting enough resources
    Example: Page with high conversion rate but low traffic
    """
    logger.info("🔍 Running Scale Winners detector...")
    
    # Build priority pages filter if provided
    priority_filter = get_priority_pages_where_clause(priority_pages)
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(avg_roas) as avg_roas,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type IN ('page', 'campaign')
        {priority_filter}
      GROUP BY canonical_entity_id, entity_type
      HAVING SUM(sessions) > 10
    ),
    ranked AS (
      SELECT 
        *,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY avg_conversion_rate) as conversion_percentile,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY total_sessions) as traffic_percentile
      FROM recent_metrics
    )
    SELECT *
    FROM ranked
    WHERE conversion_percentile > 0.7
      AND traffic_percentile < 0.3
      AND avg_conversion_rate > 2.0
    ORDER BY avg_conversion_rate DESC
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
            conv_rate = row['avg_conversion_rate']
            sessions = row['total_sessions']
            revenue = row['total_revenue']
            conv_pct = row['conversion_percentile']
            
            # For scale winners, priority is based on CVR (higher CVR = more valuable to scale)
            # They already have low traffic, so the value is in their conversion potential
            if conv_rate >= 5.0 or conv_pct >= 0.9:  # Top 10% CVR or 5%+ CVR
                priority = 'high'
            elif conv_rate >= 3.0 or conv_pct >= 0.8:  # Top 20% CVR or 3%+ CVR
                priority = 'medium'
            else:
                priority = 'low'
            
            # Impact based on CVR potential (scale winners have low traffic but high CVR)
            potential_additional_revenue = sessions * (conv_rate / 100) * 50  # Assume $50 avg value
            # Use conversion percentile for impact since traffic is intentionally low
            impact_score = calculate_impact_score(sessions, conv_pct, improvement_factor=conv_rate / 3)
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'pages_scale_winner',
                'type': 'high_conversion_low_traffic',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🚀 Scale Winner: {entity_id}",
                'description': f"This {entity_type} has {conv_rate:.1f}% conversion rate (top 30%) but only {sessions:,} sessions (bottom 30%). Increasing traffic could significantly boost revenue.",
                'evidence': {
                    'conversion_rate': conv_rate,
                    'sessions': sessions,
                    'revenue': revenue,
                    'conversion_percentile': conv_pct,
                    'traffic_percentile': row['traffic_percentile']
                },
                'metrics': {
                    'current_conversion_rate': conv_rate,
                    'current_sessions': sessions,
                    'current_revenue': revenue
                },
                'hypothesis': f"This {entity_type} converts at {conv_rate:.1f}% but gets little traffic. Doubling traffic could add ~${potential_additional_revenue:,.0f} in revenue.",
                'confidence_score': 0.85,
                'potential_impact_score': impact_score,
                'urgency_score': 75 if priority == 'high' else (60 if priority == 'medium' else 45),
                'recommended_actions': [
                    'Increase paid ad budget for this target',
                    'Create more content linking to this page',
                    'Improve SEO for related keywords',
                    'Feature this in email campaigns',
                    'Add prominent CTAs from high-traffic pages'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} scale winner opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in scale_winners detector: {e}")
    
    return opportunities
