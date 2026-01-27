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
bq_client = bigquery.Client()


def detect_cross_channel_gaps(organization_id: str) -> list:
    """
    Detect: Pages performing well organically but not supported by paid
    or vice versa
    """
    logger.info("🔍 Running Cross-Channel Gaps detector...")
    
    opportunities = []
    
    query = f"""
    WITH ga_metrics AS (
      SELECT 
        m.canonical_entity_id,
        SUM(m.sessions) as organic_sessions,
        AVG(m.conversion_rate) as avg_conversion_rate,
        SUM(m.revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.entity_type = 'page'
        AND JSON_EXTRACT_SCALAR(m.source_breakdown, '$.ga4') IS NOT NULL
      GROUP BY m.canonical_entity_id
      HAVING organic_sessions > 100
    ),
    ads_spend AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_ad_spend
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
        AND cost > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      g.*,
      COALESCE(a.total_ad_spend, 0) as ad_spend
    FROM ga_metrics g
    LEFT JOIN ads_spend a ON g.canonical_entity_id = a.canonical_entity_id
    WHERE (a.total_ad_spend IS NULL OR a.total_ad_spend < 10)  -- Little to no ad spend
      AND g.avg_conversion_rate > 2.0  -- Good conversion rate
    ORDER BY g.total_revenue DESC
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
            sessions = row['organic_sessions']
            conv_rate = row['avg_conversion_rate']
            revenue = row['total_revenue']
            ad_spend = row['ad_spend']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cross_channel',
                'type': 'organic_winner_no_paid_support',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🎯 Cross-Channel Gap: {entity_id}",
                'description': f"This page gets {sessions} organic sessions with {conv_rate:.1f}% conversion but only ${ad_spend:.2f} in ad spend. Supporting with paid could amplify success.",
                'evidence': {
                    'organic_sessions': sessions,
                    'conversion_rate': conv_rate,
                    'revenue': revenue,
                    'ad_spend': ad_spend
                },
                'metrics': {
                    'current_sessions': sessions,
                    'current_conversion_rate': conv_rate,
                    'current_ad_spend': ad_spend
                },
                'hypothesis': f"This page proves it converts organically. Adding targeted paid traffic could scale revenue without the risk of testing an unproven page.",
                'confidence_score': 0.80,
                'potential_impact_score': min(100, (revenue / 100)),
                'urgency_score': 60,
                'recommended_actions': [
                    'Create Google Ads campaign targeting this page',
                    'Use high-converting organic keywords in paid campaigns',
                    'Start with small budget to test incrementality',
                    'Monitor if paid traffic converts at similar rate to organic',
                    'Scale budget based on performance'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} cross-channel gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cross_channel_gaps detector: {e}")
    
    return opportunities


def detect_declining_performers_multitimeframe(organization_id: str) -> list:
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
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.entity_type IN ('page', 'campaign')
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



def detect_declining_performers(organization_id: str) -> list:
    """
    Detect: Entities that were performing well but are declining
    """
    logger.info("🔍 Running Declining Performers detector...")
    
    opportunities = []
    
    query = f"""
    WITH last_30_days AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
      GROUP BY canonical_entity_id, entity_type
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY canonical_entity_id, entity_type
    )
    SELECT 
      l.canonical_entity_id,
      l.entity_type,
      l.total_sessions as current_sessions,
      p.total_sessions as previous_sessions,
      l.total_revenue as current_revenue,
      p.total_revenue as previous_revenue,
      l.avg_conversion_rate as current_conversion_rate,
      p.avg_conversion_rate as previous_conversion_rate,
      SAFE_DIVIDE((l.total_sessions - p.total_sessions), p.total_sessions) * 100 as sessions_change_pct,
      SAFE_DIVIDE((l.total_revenue - p.total_revenue), p.total_revenue) * 100 as revenue_change_pct
    FROM last_30_days l
    INNER JOIN previous_30_days p 
      ON l.canonical_entity_id = p.canonical_entity_id 
      AND l.entity_type = p.entity_type
    WHERE p.total_sessions > 20  -- Had meaningful traffic
      AND SAFE_DIVIDE((l.total_sessions - p.total_sessions), p.total_sessions) < -0.2  -- 20%+ decline
    ORDER BY revenue_change_pct ASC
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
            sessions_change = row['sessions_change_pct'] or 0
            revenue_change = row['revenue_change_pct'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'declining_performer',
                'type': 'traffic_decline',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"📉 Declining: {entity_id}",
                'description': f"This {entity_type} has declined {abs(sessions_change):.0f}% in traffic over the past 30 days. Investigate and address quickly.",
                'evidence': {
                    'current_sessions': row['current_sessions'],
                    'previous_sessions': row['previous_sessions'],
                    'sessions_change_pct': sessions_change,
                    'revenue_change_pct': revenue_change
                },
                'metrics': {
                    'current_sessions': row['current_sessions'],
                    'current_revenue': row['current_revenue']
                },
                'hypothesis': f"Traffic decline of {abs(sessions_change):.0f}% suggests external factors (ranking loss, campaign pause, seasonal) or internal issues (site changes, broken links).",
                'confidence_score': 0.88,
                'potential_impact_score': min(100, abs(revenue_change)),
                'urgency_score': 90,
                'recommended_actions': [
                    'Check for SEO ranking drops',
                    'Review recent site changes',
                    'Check for broken links or 404s',
                    'Verify ad campaigns are still running',
                    'Look for seasonal patterns',
                    'Check competitor activity'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} declining performer opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in declining_performers detector: {e}")
    
    return opportunities


__all__ = ['detect_cross_channel_gaps', 'detect_declining_performers_multitimeframe', 'detect_declining_performers']
