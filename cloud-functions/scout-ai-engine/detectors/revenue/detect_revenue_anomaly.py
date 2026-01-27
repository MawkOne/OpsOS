"""
Detect Revenue Anomaly Detector
Category: Revenue
"""

"""
REVENUE Detectors\nAll detection layers (Fast, Trend, Strategic) for revenue & metrics
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
bq_client = bigquery.Client()

def detect_revenue_anomaly(organization_id: str) -> list:
    """
    PHASE 2A #1: Revenue Anomaly Detection
    Detect: Revenue deviations from baseline (1 day vs 7d/28d avg)
    """
    logger.info("🔍 Running Revenue Anomaly detector...")
    
    opportunities = []
    
    query = f"""
    WITH daily_revenue AS (
      SELECT 
        date,
        SUM(revenue) as total_revenue,
        SUM(conversions) as total_conversions,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY date
    ),
    yesterday AS (
      SELECT *
      FROM daily_revenue
      WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    ),
    baseline_7d AS (
      SELECT 
        AVG(total_revenue) as avg_revenue_7d,
        AVG(total_conversions) as avg_conversions_7d
      FROM daily_revenue
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    ),
    baseline_28d AS (
      SELECT 
        AVG(total_revenue) as avg_revenue_28d
      FROM daily_revenue
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    )
    SELECT 
      y.*,
      b7.avg_revenue_7d,
      b7.avg_conversions_7d,
      b28.avg_revenue_28d,
      SAFE_DIVIDE((y.total_revenue - b7.avg_revenue_7d), b7.avg_revenue_7d) * 100 as change_7d_pct,
      SAFE_DIVIDE((y.total_revenue - b28.avg_revenue_28d), b28.avg_revenue_28d) * 100 as change_28d_pct
    FROM yesterday y
    CROSS JOIN baseline_7d b7
    CROSS JOIN baseline_28d b28
    WHERE ABS(SAFE_DIVIDE((y.total_revenue - b7.avg_revenue_7d), b7.avg_revenue_7d)) > 0.20  -- 20%+ deviation
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            revenue = row['total_revenue'] or 0
            avg_7d = row['avg_revenue_7d'] or 0
            change_pct = row['change_7d_pct'] or 0
            
            is_spike = change_pct > 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'revenue_anomaly',
                'type': 'revenue_spike' if is_spike else 'revenue_drop',
                'priority': 'high' if not is_spike else 'medium',
                'status': 'new',
                'entity_id': 'total_revenue',
                'entity_type': 'aggregate',
                'title': f"{'📈 Revenue Spike' if is_spike else '📉 Revenue Drop'}: {abs(change_pct):.1f}% vs 7d avg",
                'description': f"Yesterday's revenue (${revenue:,.2f}) {'increased' if is_spike else 'dropped'} {abs(change_pct):.1f}% compared to 7-day average (${avg_7d:,.2f}). {'Investigate cause to amplify.' if is_spike else 'Requires immediate investigation.'}",
                'evidence': {
                    'yesterday_revenue': revenue,
                    'avg_7d_revenue': avg_7d,
                    'avg_28d_revenue': row['avg_revenue_28d'],
                    'change_7d_pct': change_pct,
                    'change_28d_pct': row['change_28d_pct']
                },
                'metrics': {
                    'current_revenue': revenue,
                    'baseline_revenue': avg_7d,
                    'deviation_pct': change_pct
                },
                'hypothesis': f"Revenue anomalies signal changes in traffic quality, conversion rates, or external factors. {'Positive spikes may reveal successful campaigns or market opportunities.' if is_spike else 'Drops require immediate attention to prevent sustained losses.'}",
                'confidence_score': 0.95,
                'potential_impact_score': min(100, abs(change_pct) * 2),
                'urgency_score': 90 if not is_spike else 60,
                'recommended_actions': [
                    'Check traffic sources for unusual patterns',
                    'Review conversion rates by channel',
                    'Verify payment processing is working',
                    'Check for site errors or downtime',
                    'Compare to same day last week/month',
                    'Investigate any campaign changes'
                ] if not is_spike else [
                    'Identify source of revenue spike',
                    'Analyze if it\'s sustainable or one-time',
                    'Investigate traffic sources driving increase',
                    'Check if specific products/campaigns drove it',
                    'Document learnings to replicate success'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': 'immediate',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} revenue anomaly opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in revenue_anomaly detector: {e}")
    
    return opportunities
