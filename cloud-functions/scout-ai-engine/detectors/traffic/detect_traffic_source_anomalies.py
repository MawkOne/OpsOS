"""
Detect Traffic Source Anomalies Detector
Category: Traffic
Detects: Sudden spikes or drops in traffic from specific sources
"""

from google.cloud import bigquery
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_traffic_source_anomalies(organization_id: str) -> list:
    """
    Detect sudden traffic anomalies by source (>50% change vs 7-day baseline)
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Traffic Source Anomalies detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_daily AS (
      SELECT 
        canonical_entity_id,
        date,
        SUM(sessions) as daily_sessions,
        SUM(conversions) as daily_conversions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
      GROUP BY canonical_entity_id, date
    ),
    baseline AS (
      SELECT 
        canonical_entity_id,
        AVG(daily_sessions) as avg_sessions,
        STDDEV(daily_sessions) as stddev_sessions
      FROM recent_daily
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      GROUP BY canonical_entity_id
      HAVING AVG(daily_sessions) > 10
    ),
    yesterday AS (
      SELECT 
        canonical_entity_id,
        daily_sessions as yesterday_sessions
      FROM recent_daily
      WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    )
    SELECT 
      b.canonical_entity_id,
      y.yesterday_sessions,
      b.avg_sessions,
      b.stddev_sessions,
      SAFE_DIVIDE(y.yesterday_sessions - b.avg_sessions, b.avg_sessions) * 100 as change_pct,
      SAFE_DIVIDE(ABS(y.yesterday_sessions - b.avg_sessions), NULLIF(b.stddev_sessions, 0)) as z_score
    FROM baseline b
    JOIN yesterday y ON b.canonical_entity_id = y.canonical_entity_id
    WHERE ABS(SAFE_DIVIDE(y.yesterday_sessions - b.avg_sessions, b.avg_sessions)) > 0.5
       OR SAFE_DIVIDE(ABS(y.yesterday_sessions - b.avg_sessions), NULLIF(b.stddev_sessions, 0)) > 2
    ORDER BY ABS(SAFE_DIVIDE(y.yesterday_sessions - b.avg_sessions, b.avg_sessions)) DESC
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
            change_pct = row['change_pct'] or 0
            z_score = row['z_score'] or 0
            is_spike = change_pct > 0
            
            priority = "high" if abs(change_pct) > 100 or z_score > 3 else "medium"
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'traffic_anomaly',
                'type': 'traffic_spike' if is_spike else 'traffic_drop',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'traffic_source',
                'title': f"{'📈 Traffic Spike' if is_spike else '📉 Traffic Drop'}: {entity_id}",
                'description': f"Traffic from {entity_id} {'increased' if is_spike else 'decreased'} by {abs(change_pct):.0f}% yesterday vs 14-day average ({row['yesterday_sessions']:.0f} vs {row['avg_sessions']:.0f} sessions).",
                'evidence': {
                    'yesterday_sessions': int(row['yesterday_sessions'] or 0),
                    'avg_sessions': float(row['avg_sessions'] or 0),
                    'change_pct': float(change_pct),
                    'z_score': float(z_score)
                },
                'metrics': {
                    'yesterday_sessions': int(row['yesterday_sessions'] or 0),
                    'baseline_sessions': float(row['avg_sessions'] or 0)
                },
                'hypothesis': f"{'Sudden spike may indicate viral content, successful campaign, or bot traffic.' if is_spike else 'Sudden drop may indicate technical issues, campaign pause, or ranking loss.'}",
                'confidence_score': min(0.95, 0.7 + (z_score * 0.05)) if z_score else 0.75,
                'potential_impact_score': min(100, abs(change_pct)),
                'urgency_score': 95 if not is_spike else 60,
                'recommended_actions': [
                    'Verify data quality (check for bot traffic)' if is_spike else 'Check for technical issues immediately',
                    'Identify cause of change',
                    'Check recent campaigns or content',
                    'Review competitor activity',
                    'Monitor for continued trend'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 day',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} traffic source anomalies")
        
    except Exception as e:
        logger.error(f"❌ Error in traffic_source_anomalies detector: {e}")
    
    return opportunities
