"""
Detect Metric Anomalies Detector
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

def detect_metric_anomalies(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #2: Anomaly Detection for All Metrics
    Detect: Any metric with significant deviation from baseline
    """
    logger.info("🔍 Running Metric Anomaly detector...")
    
    opportunities = []
    
    # Check multiple entity types and metrics
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        date,
        sessions,
        conversion_rate,
        cost,
        revenue,
        ctr,
        bounce_rate,
        position
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY)
    ),
    yesterday AS (
      SELECT *
      FROM recent_metrics
      WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    ),
    baseline AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(sessions) as avg_sessions,
        AVG(conversion_rate) as avg_cvr,
        AVG(cost) as avg_cost,
        AVG(revenue) as avg_revenue,
        AVG(ctr) as avg_ctr,
        AVG(bounce_rate) as avg_bounce,
        AVG(position) as avg_position,
        STDDEV(sessions) as stddev_sessions
      FROM recent_metrics
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      GROUP BY canonical_entity_id, entity_type
      HAVING AVG(sessions) > 10  -- Meaningful traffic
    )
    SELECT 
      y.canonical_entity_id,
      y.entity_type,
      y.sessions,
      b.avg_sessions,
      y.conversion_rate,
      b.avg_cvr,
      y.cost,
      b.avg_cost,
      SAFE_DIVIDE((y.sessions - b.avg_sessions), b.avg_sessions) * 100 as sessions_change_pct,
      SAFE_DIVIDE((y.conversion_rate - b.avg_cvr), b.avg_cvr) * 100 as cvr_change_pct,
      SAFE_DIVIDE((y.cost - b.avg_cost), b.avg_cost) * 100 as cost_change_pct
    FROM yesterday y
    INNER JOIN baseline b 
      ON y.canonical_entity_id = b.canonical_entity_id 
      AND y.entity_type = b.entity_type
    WHERE (
      ABS(SAFE_DIVIDE((y.sessions - b.avg_sessions), b.avg_sessions)) > 0.40  -- 40%+ session change
      OR ABS(SAFE_DIVIDE((y.conversion_rate - b.avg_cvr), b.avg_cvr)) > 0.30  -- 30%+ CVR change
      OR ABS(SAFE_DIVIDE((y.cost - b.avg_cost), b.avg_cost)) > 0.50  -- 50%+ cost change
    )
    ORDER BY ABS(sessions_change_pct) DESC
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
            entity_type = row['entity_type']
            
            # Determine which metric changed most
            changes = {
                'sessions': row['sessions_change_pct'] or 0,
                'conversion_rate': row['cvr_change_pct'] or 0,
                'cost': row['cost_change_pct'] or 0
            }
            
            max_change_metric = max(changes, key=lambda k: abs(changes[k]))
            max_change_pct = changes[max_change_metric]
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'anomaly',
                'type': f'{max_change_metric}_anomaly',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"⚠️ {max_change_metric.replace('_', ' ').title()} Anomaly: {entity_id}",
                'description': f"Yesterday's {max_change_metric} changed {abs(max_change_pct):.1f}% vs 7-day average. {'↑' if max_change_pct > 0 else '↓'}",
                'evidence': {
                    'metric': max_change_metric,
                    'yesterday_value': row[max_change_metric.replace('_change_pct', '')],
                    'baseline_value': row[f"avg_{max_change_metric.split('_')[0]}"],
                    'change_pct': max_change_pct,
                    'all_changes': changes
                },
                'metrics': {
                    'current_value': row[max_change_metric.replace('_change_pct', '')],
                    'baseline_value': row[f"avg_{max_change_metric.split('_')[0]}"],
                    'deviation_pct': max_change_pct
                },
                'hypothesis': f"Sudden changes in {max_change_metric} may indicate campaign changes, external events, technical issues, or seasonal patterns requiring investigation.",
                'confidence_score': 0.80,
                'potential_impact_score': min(100, abs(max_change_pct)),
                'urgency_score': 70,
                'recommended_actions': [
                    f'Investigate cause of {max_change_metric} change',
                    'Check for recent campaign or site changes',
                    'Compare to same day last week',
                    'Review traffic sources and user behavior',
                    'Determine if intervention is needed'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '1-2 days',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} metric anomaly opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in metric_anomalies detector: {e}")
    
    return opportunities
