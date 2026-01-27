"""
Detect Declining Performers Multitimeframe Detector
Category: Traffic
"""

"""
TRAFFIC Detectors\nAll detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_declining_performers_multitimeframe(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Enhanced Declining Performers with Acceleration Detection
    Detects: Entities declining with analysis of whether decline is accelerating or decelerating
    """
    logger.info("🔍 Running Declining Performers (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_performance AS (
      SELECT 
        m.canonical_entity_id,
        m.entity_type,
        m.year_month,
        m.sessions,
        m.revenue,
        m.conversions,
        LAG(m.sessions, 1) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_1_ago,
        LAG(m.sessions, 2) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_2_ago,
        LAG(m.sessions, 3) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_3_ago
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE m.organization_id = @org_id
        AND e.entity_type IN ('page', 'campaign')
    ),
    
    current AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        sessions as current_sessions,
        month_1_ago,
        month_2_ago,
        month_3_ago,
        
        -- Calculate MoM changes
        SAFE_DIVIDE(sessions - month_1_ago, month_1_ago) * 100 as current_mom,
        SAFE_DIVIDE(month_1_ago - month_2_ago, month_2_ago) * 100 as prev_mom_1,
        SAFE_DIVIDE(month_2_ago - month_3_ago, month_3_ago) * 100 as prev_mom_2,
        
        -- Count consecutive declining months
        CASE 
          WHEN sessions < month_1_ago AND month_1_ago < month_2_ago AND month_2_ago < month_3_ago THEN 4
          WHEN sessions < month_1_ago AND month_1_ago < month_2_ago THEN 3
          WHEN sessions < month_1_ago THEN 2
          ELSE 0
        END as consecutive_declining,
        
        -- Detect acceleration/deceleration
        CASE 
          WHEN sessions < month_1_ago AND month_1_ago < month_2_ago THEN
            CASE 
              WHEN ABS(SAFE_DIVIDE(sessions - month_1_ago, month_1_ago)) > 
                   ABS(SAFE_DIVIDE(month_1_ago - month_2_ago, month_2_ago)) 
              THEN 'Accelerating Decline'
              WHEN ABS(SAFE_DIVIDE(sessions - month_1_ago, month_1_ago)) < 
                   ABS(SAFE_DIVIDE(month_1_ago - month_2_ago, month_2_ago)) 
              THEN 'Decelerating Decline'
              ELSE 'Steady Decline'
            END
          ELSE 'Not Declining'
        END as decline_pattern
        
      FROM monthly_performance
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_performance)
        AND month_1_ago IS NOT NULL
        AND month_1_ago > 100  -- Was getting meaningful traffic
    )
    
    SELECT *
    FROM current
    WHERE consecutive_declining >= 2
      AND ABS(current_mom) > 10  -- At least 10% decline
    ORDER BY consecutive_declining DESC, ABS(current_mom) DESC
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
            current = row['current_sessions']
            month_1 = row['month_1_ago']
            month_2 = row['month_2_ago']
            month_3 = row['month_3_ago']
            mom = row['current_mom'] or 0
            consecutive = row['consecutive_declining']
            pattern = row['decline_pattern']
            
            # Build monthly trend
            monthly_trend = []
            if month_3:
                monthly_trend.append({'month': '3mo ago', 'sessions': month_3})
            if month_2:
                monthly_trend.append({'month': '2mo ago', 'sessions': month_2, 'mom': f"{row['prev_mom_1']:+.1f}%"})
            if month_1:
                monthly_trend.append({'month': '1mo ago', 'sessions': month_1, 'mom': f"{row['prev_mom_1']:+.1f}%"})
            monthly_trend.append({'month': 'Current', 'sessions': current, 'mom': f"{mom:+.1f}%"})
            
            priority = 'high' if pattern == 'Accelerating Decline' or consecutive >= 3 else 'medium'
            urgency = 90 if pattern == 'Accelerating Decline' else 75 if consecutive >= 3 else 65
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'declining_performer',
                'type': pattern.lower().replace(' ', '_'),
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"📉 Declining: {entity_id} ({pattern})",
                'description': f"{consecutive} consecutive months declining. {pattern}. Sessions: {month_1:,.0f} → {current:,.0f} ({mom:+.1f}% MoM)",
                'evidence': {
                    'monthly_trend': monthly_trend,
                    'current_sessions': current,
                    'month_1_ago': month_1,
                    'mom_change_pct': mom,
                    'consecutive_declining': consecutive,
                    'decline_pattern': pattern
                },
                'metrics': {
                    'current_sessions': current,
                    'previous_month': month_1,
                    'mom_change': mom,
                    'pattern': pattern
                },
                'hypothesis': f"{pattern} over {consecutive} months. " + 
                             (f"URGENT: Decline is getting faster - immediate intervention needed!" if pattern == 'Accelerating Decline'
                              else f"Rate of decline is slowing - may stabilize soon." if pattern == 'Decelerating Decline'
                              else f"Steady decline suggests systematic issue."),
                'confidence_score': min(0.95, 0.75 + (consecutive * 0.08)),
                'potential_impact_score': min(100, abs(mom) * 2),
                'urgency_score': urgency,
                'recommended_actions': [
                    f"PATTERN: {pattern} over {consecutive} months",
                    'Investigate root cause of decline',
                    'Check for recent changes or external factors',
                    'Analyze competitor improvements',
                    'Review traffic sources and quality',
                    'Consider content refresh or technical audit',
                    'Act quickly before further deterioration' if pattern == 'Accelerating Decline' else 'Monitor for stabilization' if pattern == 'Decelerating Decline' else 'Address systematic issues'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-3 weeks',
                'historical_performance': {},
                'comparison_data': {
                    'timeframes': monthly_trend
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} declining performer (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in declining_performers_multitimeframe detector: {e}")
    
    return opportunities
