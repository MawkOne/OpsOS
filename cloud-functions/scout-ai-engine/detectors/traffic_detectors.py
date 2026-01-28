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
        canonical_entity_id,
        SUM(sessions) as organic_sessions,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
        AND JSON_EXTRACT_SCALAR(source_breakdown, '$.ga4') IS NOT NULL
      GROUP BY canonical_entity_id
      HAVING organic_sessions > 100
    ),
    ads_spend AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_ad_spend
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
        AND cost > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      g.*,
      COALESCE(total_ad_spend, 0) as ad_spend
    FROM ga_metrics g
    LEFT JOIN ads_spend aWHERE (total_ad_spend IS NULL OR total_ad_spend < 10)  -- Little to no ad spend
      AND avg_conversion_rate > 2.0  -- Good conversion rate
    ORDER BY total_revenue DESC
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


def detect_traffic_bot_spam_spike(organization_id: str) -> list:
    """
    Detect: Bot/spam traffic spike (high bounce, low duration)
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Bot/Spam Traffic Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_traffic AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(sessions) as total_sessions,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(avg_session_duration) as avg_duration,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
      GROUP BY canonical_entity_id, entity_type
    ),
    baseline_traffic AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as baseline_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.entity_type,
      r.total_sessions,
      b.baseline_sessions,
      r.avg_bounce_rate,
      r.avg_duration,
      r.avg_conversion_rate,
      SAFE_DIVIDE((r.total_sessions - b.baseline_sessions), b.baseline_sessions) * 100 as traffic_increase_pct
    FROM recent_traffic r
    LEFT JOIN baseline_traffic b ON r.canonical_entity_id = b.canonical_entity_id
    WHERE r.avg_bounce_rate > 80  -- >80% bounce
      AND r.avg_duration < 10  -- <10 seconds
      AND (b.baseline_sessions IS NULL OR r.total_sessions > b.baseline_sessions * 1.5)  -- 50%+ traffic increase
      AND r.total_sessions > 50
    ORDER BY r.total_sessions DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            priority = "high"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "traffic_quality",
                "type": "bot_spam_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": row.entity_type,
                "title": f"Bot/Spam Traffic Detected: {row.total_sessions:,.0f} sessions",
                "description": f"Traffic spike with {row.avg_bounce_rate:.1f}% bounce and {row.avg_duration:.1f}s duration - likely bot/spam",
                "evidence": {
                    "current_sessions": int(row.total_sessions),
                    "baseline_sessions": int(row.baseline_sessions) if row.baseline_sessions else None,
                    "traffic_increase_pct": float(row.traffic_increase_pct) if row.traffic_increase_pct else None,
                    "bounce_rate": float(row.avg_bounce_rate),
                    "avg_duration": float(row.avg_duration),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "bounce_rate": float(row.avg_bounce_rate),
                    "avg_duration": float(row.avg_duration),
                },
                "hypothesis": "Bot traffic or low-quality referral spam inflating session counts without real engagement",
                "confidence_score": 0.9,
                "potential_impact_score": 70,
                "urgency_score": 75,
                "recommended_actions": [
                    "Check GA4 for suspicious traffic sources",
                    "Implement bot filtering/reCAPTCHA if needed",
                    "Block suspicious referral domains",
                    "Review server logs for bot patterns",
                    "Filter bot traffic from analytics",
                    f"Clean up: {int(row.total_sessions)} suspicious sessions"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 days",
            })
        
        logger.info(f"✅ Bot/Spam Traffic Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Bot/Spam Traffic Spike detector failed: {e}")
    
    return opportunities


def detect_traffic_spike_quality_check(organization_id: str) -> list:
    """
    Detect: Unexpected traffic spikes with quality concerns
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Traffic Spike Quality Check detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_traffic AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(bounce_rate) as avg_bounce_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
      GROUP BY canonical_entity_id, entity_type
    ),
    baseline_traffic AS (
      SELECT 
        canonical_entity_id,
        AVG(sessions_per_day) as avg_daily_sessions,
        AVG(avg_conversion_rate) as baseline_conversion_rate
      FROM (
        SELECT 
          canonical_entity_id,
          date,
          SUM(sessions) as sessions_per_day,
          AVG(conversion_rate) as avg_conversion_rate
        FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
        JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
          ON m.canonical_entity_id = e.canonical_entity_id
          AND e.is_active = TRUE
        WHERE organization_id = @org_id
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
          AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        GROUP BY canonical_entity_id, date
      )
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.entity_type,
      r.total_sessions,
      r.avg_conversion_rate,
      r.avg_bounce_rate,
      b.avg_daily_sessions * 7 as expected_weekly_sessions,
      b.baseline_conversion_rate,
      SAFE_DIVIDE((r.total_sessions - (b.avg_daily_sessions * 7)), (b.avg_daily_sessions * 7)) * 100 as traffic_spike_pct
    FROM recent_traffic r
    LEFT JOIN baseline_traffic b ON r.canonical_entity_id = b.canonical_entity_id
    WHERE b.avg_daily_sessions > 0
      AND r.total_sessions > b.avg_daily_sessions * 7 * 2  -- 2x normal traffic
      AND r.avg_conversion_rate < b.baseline_conversion_rate * 0.7  -- 30%+ CVR drop
    ORDER BY traffic_spike_pct DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            priority = "high"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "traffic_quality",
                "type": "traffic_spike_quality_concern",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": row.entity_type,
                "title": f"Traffic Spike (+{row.traffic_spike_pct:.0f}%) with Low Quality",
                "description": f"Traffic up {row.traffic_spike_pct:.0f}% but CVR down to {row.avg_conversion_rate:.1f}% (from {row.baseline_conversion_rate:.1f}%)",
                "evidence": {
                    "current_sessions": int(row.total_sessions),
                    "expected_sessions": int(row.expected_weekly_sessions),
                    "traffic_spike_pct": float(row.traffic_spike_pct),
                    "current_conversion_rate": float(row.avg_conversion_rate),
                    "baseline_conversion_rate": float(row.baseline_conversion_rate),
                    "bounce_rate": float(row.avg_bounce_rate),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "hypothesis": "Viral traffic, media mention, or low-quality traffic source causing spike without conversions",
                "confidence_score": 0.85,
                "potential_impact_score": 75,
                "urgency_score": 70,
                "recommended_actions": [
                    "Identify traffic source - where is spike coming from?",
                    "Check if viral or media mention",
                    "Review landing page relevance for new traffic",
                    "Add CTAs to capture interest if viral",
                    "Consider emergency lead magnet/offer",
                    "Monitor for continuation or fade",
                    f"Opportunity: {int(row.total_sessions * row.baseline_conversion_rate / 100)} expected conversions vs {int(row.total_sessions * row.avg_conversion_rate / 100)} actual"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 days",
            })
        
        logger.info(f"✅ Traffic Spike Quality Check detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Traffic Spike Quality Check detector failed: {e}")
    
    return opportunities


def detect_traffic_utm_parameter_gaps(organization_id: str) -> list:
    """
    Detect: High-value traffic missing UTM tracking
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running UTM Parameter Gaps detector...")
    
    opportunities = []
    
    # Note: This requires source_breakdown JSON parsing
    # For now, we'll identify high-traffic entities that might need better tracking
    query = f"""
    WITH recent_traffic AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('campaign', 'page')
      GROUP BY canonical_entity_id, entity_type
    )
    SELECT 
      canonical_entity_id,
      entity_type,
      total_sessions,
      total_conversions,
      total_revenue,
      avg_conversion_rate,
      CASE 
        WHEN canonical_entity_id NOT LIKE '%utm%' AND canonical_entity_id NOT LIKE '%source=%' THEN TRUE
        ELSE FALSE
      END as missing_utm_tracking
    FROM recent_traffic
    WHERE total_sessions > 100
      AND total_revenue > 0
      AND (canonical_entity_id NOT LIKE '%utm%' OR canonical_entity_id LIKE '%direct%' OR canonical_entity_id LIKE '%unattributed%')
    ORDER BY total_revenue DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            priority = "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "tracking_optimization",
                "type": "utm_parameter_gaps",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": row.entity_type,
                "title": f"High-Value Traffic Missing UTM Tracking",
                "description": f"{row.total_sessions:,.0f} sessions generating ${row.total_revenue:,.0f} with unclear attribution",
                "evidence": {
                    "total_sessions": int(row.total_sessions),
                    "total_conversions": int(row.total_conversions),
                    "total_revenue": float(row.total_revenue),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "revenue": float(row.total_revenue),
                },
                "hypothesis": "Missing UTM parameters prevent accurate attribution and optimization decisions",
                "confidence_score": 0.7,
                "potential_impact_score": 60,
                "urgency_score": 50,
                "recommended_actions": [
                    "Add UTM parameters to all external links",
                    "Implement UTM builder for marketing team",
                    "Tag email campaigns with utm_medium=email",
                    "Tag social posts with utm_medium=social",
                    "Tag ads with campaign-specific parameters",
                    "Document UTM naming convention",
                    f"${row.total_revenue:,.0f} in revenue needs better attribution"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "2-3 days",
            })
        
        logger.info(f"✅ UTM Parameter Gaps detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ UTM Parameter Gaps detector failed: {e}")
    
    return opportunities


def detect_traffic_referral_opportunities(organization_id: str) -> list:
    """
    Detect: High-converting referral sources worth pursuing
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Referral Opportunities detector...")
    
    opportunities = []
    
    query = f"""
    WITH referral_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(revenue) as total_revenue,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND (entity_type = 'source' OR entity_type = 'campaign')
        AND canonical_entity_id LIKE '%referral%'
      GROUP BY canonical_entity_id
    ),
    overall_avg AS (
      SELECT 
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    )
    SELECT 
      r.canonical_entity_id,
      r.total_sessions,
      r.total_conversions,
      r.avg_conversion_rate,
      r.total_revenue,
      r.avg_duration,
      o.avg_conversion_rate as site_avg_conversion_rate,
      SAFE_DIVIDE((r.avg_conversion_rate - o.avg_conversion_rate), o.avg_conversion_rate) * 100 as cvr_vs_avg_pct
    FROM referral_performance r
    CROSS JOIN overall_avg o
    WHERE r.avg_conversion_rate > o.avg_conversion_rate * 1.2  -- 20%+ better than average
      AND r.total_sessions > 20
      AND r.total_sessions < 500  -- Not maxed out yet
    ORDER BY cvr_vs_avg_pct DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            priority = "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "traffic_growth",
                "type": "referral_opportunity",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "referral",
                "title": f"High-Quality Referral Source: {row.avg_conversion_rate:.1f}% CVR",
                "description": f"Referral converting {row.cvr_vs_avg_pct:+.0f}% better than average with only {row.total_sessions:,.0f} sessions",
                "evidence": {
                    "total_sessions": int(row.total_sessions),
                    "total_conversions": int(row.total_conversions),
                    "conversion_rate": float(row.avg_conversion_rate),
                    "site_avg_conversion_rate": float(row.site_avg_conversion_rate),
                    "cvr_vs_avg_pct": float(row.cvr_vs_avg_pct),
                    "total_revenue": float(row.total_revenue),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "conversion_rate": float(row.avg_conversion_rate),
                    "revenue": float(row.total_revenue),
                },
                "hypothesis": "High-converting referral source worth investing in for more exposure",
                "confidence_score": 0.8,
                "potential_impact_score": min(100, row.cvr_vs_avg_pct * 0.5),
                "urgency_score": 55,
                "recommended_actions": [
                    "Build relationship with this referral source",
                    "Pitch guest post or partnership",
                    "Create dedicated landing page for this traffic",
                    "Offer exclusive content/discount for their audience",
                    "Request featured placement or more mentions",
                    "Consider paid sponsorship if available",
                    f"Scale potential: {row.cvr_vs_avg_pct:+.0f}% better CVR than average"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
            })
        
        logger.info(f"✅ Referral Opportunities detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Referral Opportunities detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_cross_channel_gaps', 
    'detect_declining_performers_multitimeframe', 
    'detect_declining_performers',
    'detect_traffic_bot_spam_spike',
    'detect_traffic_spike_quality_check',
    'detect_traffic_utm_parameter_gaps',
    'detect_traffic_referral_opportunities'
]
