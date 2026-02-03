"""
Detect Fix Losers Detector
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

from .priority_filter import get_priority_pages_where_clause, calculate_traffic_priority, calculate_impact_score

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_fix_losers(organization_id: str, priority_pages: Optional[Dict] = None) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Entities getting traffic but performing poorly
    Example: High-traffic page with terrible conversion rate
    """
    logger.info("🔍 Running Fix Losers detector...")
    
    # Build priority pages filter if provided
    priority_filter = get_priority_pages_where_clause(priority_pages)
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(avg_bounce_rate) as avg_bounce_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type IN ('page', 'campaign')
        {priority_filter}
      GROUP BY canonical_entity_id, entity_type
      HAVING SUM(sessions) > 50
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
    WHERE traffic_percentile > 0.5
      AND conversion_percentile < 0.3
    ORDER BY total_sessions DESC
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
            bounce_rate = row['avg_bounce_rate']
            sessions = row['total_sessions']
            cost = row['total_cost']
            traffic_pct = row['traffic_percentile']
            
            # Calculate priority based on traffic distribution - top pages = higher priority
            priority = calculate_traffic_priority(sessions, traffic_pct)
            impact_score = calculate_impact_score(sessions, traffic_pct, improvement_factor=1.3)
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'pages_fix_loser',
                'type': 'high_traffic_low_conversion',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🔧 Fix Opportunity: {entity_id}",
                'description': f"This {entity_type} gets {sessions:,} sessions but only {conv_rate:.1f}% conversion rate. Small improvements here could have huge impact.",
                'evidence': {
                    'conversion_rate': conv_rate,
                    'bounce_rate': bounce_rate,
                    'sessions': sessions,
                    'cost': cost,
                    'traffic_percentile': traffic_pct
                },
                'metrics': {
                    'current_conversion_rate': conv_rate,
                    'current_bounce_rate': bounce_rate,
                    'current_sessions': sessions
                },
                'hypothesis': f"With {sessions:,} sessions, even a 1% improvement in conversion could generate significant additional revenue. High bounce rate ({bounce_rate:.1f}%) suggests UX or messaging issues.",
                'confidence_score': 0.90,
                'potential_impact_score': impact_score,
                'urgency_score': 85 if priority == 'high' else (70 if priority == 'medium' else 50),
                'recommended_actions': [
                    'A/B test different headlines and CTAs',
                    'Improve page load speed',
                    'Clarify value proposition',
                    'Add trust signals (testimonials, reviews)',
                    'Simplify the conversion process',
                    'Check mobile experience'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} fix loser opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in fix_losers detector: {e}")
    
    return opportunities
