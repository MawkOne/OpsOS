"""
Additional Scout AI Detectors
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


def detect_keyword_cannibalization(organization_id: str) -> list:
    """
    Detect: Multiple pages competing for the same keywords
    causing ranking dilution
    """
    logger.info("🔍 Running Keyword Cannibalization detector...")
    
    opportunities = []
    
    query = f"""
    WITH keyword_page_mapping AS (
      SELECT 
        k.canonical_entity_id as keyword_id,
        p.canonical_entity_id as page_id,
        AVG(k.position) as avg_position,
        SUM(k.sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` k
      INNER JOIN `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` p
        ON k.organization_id = p.organization_id
        AND k.date = p.date
      WHERE k.organization_id = @org_id
        AND k.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND k.entity_type = 'keyword'
        AND p.entity_type = 'page'
      GROUP BY keyword_id, page_id
    ),
    cannibalization_cases AS (
      SELECT 
        keyword_id,
        COUNT(DISTINCT page_id) as competing_pages,
        AVG(avg_position) as avg_position,
        SUM(total_sessions) as total_sessions
      FROM keyword_page_mapping
      GROUP BY keyword_id
      HAVING COUNT(DISTINCT page_id) > 1  -- Multiple pages
        AND AVG(avg_position) > 10  -- Not ranking great
    )
    SELECT *
    FROM cannibalization_cases
    ORDER BY competing_pages DESC, avg_position DESC
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
            keyword_id = row['keyword_id']
            competing_pages = row['competing_pages']
            position = row['avg_position']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_issue',
                'type': 'keyword_cannibalization',
                'priority': 'medium',
                'status': 'new',
                'entity_id': keyword_id,
                'entity_type': 'keyword',
                'title': f"⚠️ Keyword Cannibalization: {keyword_id}",
                'description': f"{competing_pages} pages are competing for this keyword (avg position: {position:.1f}). Consolidating could improve rankings.",
                'evidence': {
                    'competing_pages': competing_pages,
                    'avg_position': position
                },
                'metrics': {
                    'competing_pages': competing_pages,
                    'current_position': position
                },
                'hypothesis': f"When multiple pages target the same keyword, search engines struggle to determine which to rank, diluting authority and resulting in poor rankings for all.",
                'confidence_score': 0.75,
                'potential_impact_score': min(100, (competing_pages * 15)),
                'urgency_score': 50,
                'recommended_actions': [
                    'Audit all pages ranking for this keyword',
                    'Consolidate content into one authoritative page',
                    '301 redirect weaker pages to the main page',
                    'Update internal linking to point to canonical page',
                    'Add canonical tags if pages must stay separate',
                    'Monitor rankings after consolidation'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} keyword cannibalization opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in keyword_cannibalization detector: {e}")
    
    return opportunities


def detect_cost_inefficiency(organization_id: str) -> list:
    """
    Detect: High-cost entities with poor ROI
    """
    logger.info("🔍 Running Cost Inefficiency detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(cost) as total_cost,
        SUM(revenue) as total_revenue,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(revenue), SUM(cost)) as roas,
        SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cpa
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND cost > 0
      GROUP BY canonical_entity_id, entity_type
      HAVING total_cost > 100  -- Spending at least $100
    )
    SELECT *
    FROM recent_performance
    WHERE roas < 1.0  -- Losing money
    ORDER BY total_cost DESC
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
            cost = row['total_cost']
            revenue = row['total_revenue']
            roas = row['roas'] or 0
            cpa = row['cpa'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cost_inefficiency',
                'type': 'negative_roi',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"💸 Cost Inefficiency: {entity_id}",
                'description': f"This {entity_type} has spent ${cost:.2f} but only generated ${revenue:.2f} (ROAS: {roas:.2f}x). Consider pausing or optimizing.",
                'evidence': {
                    'total_cost': cost,
                    'total_revenue': revenue,
                    'roas': roas,
                    'cpa': cpa
                },
                'metrics': {
                    'current_cost': cost,
                    'current_revenue': revenue,
                    'current_roas': roas
                },
                'hypothesis': f"With ROAS below 1.0x, every dollar spent loses money. Either optimize or reallocate budget to better-performing entities.",
                'confidence_score': 0.92,
                'potential_impact_score': min(100, (cost - revenue) / 10),
                'urgency_score': 85,
                'recommended_actions': [
                    'Pause this campaign immediately to stop losses',
                    'Audit targeting and keywords',
                    'Review landing page conversion rate',
                    'Check if tracking is working correctly',
                    'Compare to better-performing campaigns',
                    'Either fix or reallocate budget'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} cost inefficiency opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cost_inefficiency detector: {e}")
    
    return opportunities


def detect_email_engagement_drop(organization_id: str) -> list:
    """
    Detect: Email campaigns with declining engagement
    """
    logger.info("🔍 Running Email Engagement Drop detector...")
    
    opportunities = []
    
    query = f"""
    WITH last_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        SUM(sends) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    )
    SELECT 
      l.canonical_entity_id,
      l.avg_open_rate as current_open_rate,
      p.avg_open_rate as previous_open_rate,
      l.avg_ctr as current_ctr,
      p.avg_ctr as previous_ctr,
      l.total_sends,
      SAFE_DIVIDE((l.avg_open_rate - p.avg_open_rate), p.avg_open_rate) * 100 as open_rate_change
    FROM last_30_days l
    INNER JOIN previous_30_days p ON l.canonical_entity_id = p.canonical_entity_id
    WHERE SAFE_DIVIDE((l.avg_open_rate - p.avg_open_rate), p.avg_open_rate) < -0.15  -- 15%+ decline
      AND l.total_sends > 100
    ORDER BY open_rate_change ASC
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
            open_change = row['open_rate_change'] or 0
            current_open = row['current_open_rate']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_issue',
                'type': 'engagement_decline',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"📧 Email Engagement Drop: {entity_id}",
                'description': f"Open rate declined {abs(open_change):.1f}% to {current_open:.1f}%. Audience may be fatiguing or content needs refresh.",
                'evidence': {
                    'current_open_rate': current_open,
                    'previous_open_rate': row['previous_open_rate'],
                    'open_rate_change': open_change
                },
                'metrics': {
                    'current_open_rate': current_open,
                    'change_pct': open_change
                },
                'hypothesis': f"Declining email engagement suggests list fatigue, irrelevant content, or deliverability issues. Early intervention prevents further decline.",
                'confidence_score': 0.78,
                'potential_impact_score': min(100, abs(open_change) * 3),
                'urgency_score': 65,
                'recommended_actions': [
                    'Segment list and test different content for each',
                    'Refresh subject line strategies',
                    'Check email deliverability and spam scores',
                    'Remove inactive subscribers',
                    'A/B test send times and frequency',
                    'Survey subscribers for content preferences'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email engagement drop opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_engagement_drop detector: {e}")
    
    return opportunities


# =============================================================================
# PHASE 2A: THE "FREE 9" - NEW DETECTORS WITH EXISTING DATA
# =============================================================================


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


def detect_metric_anomalies(organization_id: str) -> list:
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


def detect_high_traffic_low_conversion_pages(organization_id: str) -> list:
    """
    PHASE 2A #3: High Traffic, Low Conversion Pages
    Detect: Pages getting significant traffic but converting poorly
    """
    logger.info("🔍 Running High Traffic Low CVR Pages detector...")
    
    opportunities = []
    
    query = f"""
    WITH page_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_cvr,
        SUM(conversions) as total_conversions,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
      HAVING total_sessions > 100  -- Meaningful traffic
    ),
    peer_avg AS (
      SELECT 
        AVG(avg_cvr) as site_avg_cvr
      FROM page_performance
    )
    SELECT 
      p.*,
      pa.site_avg_cvr,
      PERCENT_RANK() OVER (ORDER BY total_sessions) as traffic_percentile,
      PERCENT_RANK() OVER (ORDER BY avg_cvr) as cvr_percentile
    FROM page_performance p
    CROSS JOIN peer_avg pa
    WHERE traffic_percentile > 0.70  -- Top 30% traffic
      AND avg_cvr < pa.site_avg_cvr * 0.80  -- 20% below site average
    ORDER BY total_sessions DESC
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
            sessions = row['total_sessions']
            cvr = row['avg_cvr']
            site_avg = row['site_avg_cvr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'page_optimization',
                'type': 'high_traffic_low_cvr',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🎯 High-Traffic, Low-CVR Page: {entity_id}",
                'description': f"This page gets {sessions:,.0f} sessions (top 30%) but converts at {cvr:.2f}% vs site avg {site_avg:.2f}%. Huge optimization opportunity.",
                'evidence': {
                    'total_sessions': sessions,
                    'conversion_rate': cvr,
                    'site_avg_cvr': site_avg,
                    'cvr_vs_avg': ((cvr / site_avg) - 1) * 100,
                    'traffic_percentile': row['traffic_percentile'],
                    'bounce_rate': row['avg_bounce_rate']
                },
                'metrics': {
                    'current_sessions': sessions,
                    'current_cvr': cvr,
                    'target_cvr': site_avg
                },
                'hypothesis': f"If this page converted at site average, it would generate {sessions * (site_avg / 100):.0f} conversions vs current {row['total_conversions']}. Massive leverage opportunity.",
                'confidence_score': 0.88,
                'potential_impact_score': min(100, ((site_avg - cvr) / cvr) * sessions / 10),
                'urgency_score': 75,
                'recommended_actions': [
                    'A/B test new headline and value proposition',
                    'Simplify primary CTA',
                    'Add social proof and trust signals',
                    'Reduce form fields if applicable',
                    'Improve page load speed',
                    'Test different page layouts',
                    'Add exit-intent popup for high-bounce visitors'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} high-traffic low-CVR page opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in high_traffic_low_conversion_pages detector: {e}")
    
    return opportunities


def detect_page_engagement_decay(organization_id: str) -> list:
    """
    PHASE 2A #4: Page Engagement Decay
    Detect: Pages with declining engagement metrics (early warning before CVR drops)
    """
    logger.info("🔍 Running Page Engagement Decay detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_engagement AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_session_duration) as avg_duration,
        AVG(bounce_rate) as avg_bounce,
        AVG(engagement_rate) as avg_engagement,
        SUM(sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_engagement AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_session_duration) as avg_duration,
        AVG(bounce_rate) as avg_bounce,
        AVG(engagement_rate) as avg_engagement
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_duration as recent_duration,
      h.avg_duration as historical_duration,
      r.avg_bounce as recent_bounce,
      h.avg_bounce as historical_bounce,
      r.total_sessions,
      SAFE_DIVIDE((r.avg_duration - h.avg_duration), h.avg_duration) * 100 as duration_change_pct,
      SAFE_DIVIDE((r.avg_bounce - h.avg_bounce), h.avg_bounce) * 100 as bounce_change_pct
    FROM recent_engagement r
    INNER JOIN historical_engagement h 
      ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.total_sessions > 50  -- Meaningful traffic
      AND (
        SAFE_DIVIDE((r.avg_duration - h.avg_duration), h.avg_duration) < -0.20  -- 20%+ drop in duration
        OR SAFE_DIVIDE((r.avg_bounce - h.avg_bounce), h.avg_bounce) > 0.15  -- 15%+ increase in bounce
      )
    ORDER BY ABS(duration_change_pct) DESC
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
            duration_change = row['duration_change_pct'] or 0
            bounce_change = row['bounce_change_pct'] or 0
            
            primary_issue = 'duration' if abs(duration_change) > abs(bounce_change) else 'bounce_rate'
            primary_change = duration_change if primary_issue == 'duration' else bounce_change
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'page_optimization',
                'type': 'engagement_decay',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"⚠️ Engagement Decay: {entity_id}",
                'description': f"{'Session duration dropped' if primary_issue == 'duration' else 'Bounce rate increased'} {abs(primary_change):.1f}% vs historical baseline. Early warning signal.",
                'evidence': {
                    'recent_duration': row['recent_duration'],
                    'historical_duration': row['historical_duration'],
                    'duration_change_pct': duration_change,
                    'recent_bounce': row['recent_bounce'],
                    'historical_bounce': row['historical_bounce'],
                    'bounce_change_pct': bounce_change
                },
                'metrics': {
                    'current_duration': row['recent_duration'],
                    'current_bounce': row['recent_bounce'],
                    'change_pct': primary_change
                },
                'hypothesis': f"Declining engagement metrics often precede conversion rate drops. Catching this early allows intervention before revenue is impacted.",
                'confidence_score': 0.72,
                'potential_impact_score': min(100, abs(primary_change) * 2),
                'urgency_score': 65,
                'recommended_actions': [
                    'Review recent page changes or updates',
                    'Check page load speed and performance',
                    'Analyze user behavior with heatmaps',
                    'Test different content above the fold',
                    'Improve internal linking to keep users engaged',
                    'Add more compelling CTAs earlier on page',
                    'Check mobile vs desktop experience'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} page engagement decay opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in page_engagement_decay detector: {e}")
    
    return opportunities


def detect_seo_striking_distance(organization_id: str) -> list:
    """
    PHASE 2A #5: SEO Striking Distance Keywords
    Detect: Keywords ranking 4-15 that could reach page 1 with effort
    """
    logger.info("🔍 Running SEO Striking Distance detector...")
    
    opportunities = []
    
    query = f"""
    WITH keyword_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(position) as avg_position,
        AVG(search_volume) as avg_search_volume,
        SUM(impressions) as total_impressions,
        AVG(ctr) as avg_ctr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'keyword'
        AND position IS NOT NULL
      GROUP BY canonical_entity_id
      HAVING avg_position BETWEEN 4 AND 15  -- Striking distance
        AND avg_search_volume > 100  -- Meaningful volume
    )
    SELECT 
      *,
      -- Estimate traffic gain if moving to position 1-3
      CASE 
        WHEN avg_position >= 11 THEN total_impressions * 0.30  -- Page 2 -> Page 1 = ~30% CTR
        WHEN avg_position >= 7 THEN total_impressions * 0.20   -- Mid page 1 -> Top 3 = ~20% more
        ELSE total_impressions * 0.10  -- Position 4-6 -> Top 3 = ~10% more
      END as estimated_traffic_gain
    FROM keyword_performance
    WHERE avg_search_volume > 100
    ORDER BY 
      CASE 
        WHEN avg_position <= 10 THEN 0  -- Page 1 keywords first
        ELSE 1
      END,
      estimated_traffic_gain DESC
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
            position = row['avg_position']
            volume = row['avg_search_volume']
            traffic_gain = row['estimated_traffic_gain']
            
            on_page_1 = position <= 10
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_opportunity',
                'type': 'striking_distance' if on_page_1 else 'page_2_opportunity',
                'priority': 'high' if on_page_1 else 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'keyword',
                'title': f"🎯 SEO Striking Distance: {entity_id} (pos {position:.1f})",
                'description': f"Ranking #{position:.1f} for keyword with {volume:.0f} monthly searches. Moving to top 3 could add {traffic_gain:.0f} clicks/month.",
                'evidence': {
                    'current_position': position,
                    'search_volume': volume,
                    'current_impressions': row['total_impressions'],
                    'estimated_traffic_gain': traffic_gain,
                    'on_page_1': on_page_1
                },
                'metrics': {
                    'current_position': position,
                    'search_volume': volume,
                    'potential_clicks_gain': traffic_gain
                },
                'hypothesis': f"Keywords in striking distance represent low-hanging SEO fruit. Small improvements can move them to high-CTR positions with significant traffic gains.",
                'confidence_score': 0.78,
                'potential_impact_score': min(100, (traffic_gain / 50)),
                'urgency_score': 70 if on_page_1 else 55,
                'recommended_actions': [
                    'Refresh and expand page content for this keyword',
                    'Add more internal links to this page',
                    'Improve title tag to increase relevance',
                    'Add schema markup if applicable',
                    'Build high-quality backlinks',
                    'Optimize for featured snippets',
                    'Improve page load speed'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} SEO striking distance opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in seo_striking_distance detector: {e}")
    
    return opportunities


def detect_seo_rank_drops(organization_id: str) -> list:
    """
    PHASE 2A #6: SEO Rank Drops
    Detect: Keywords with significant rank declines
    """
    logger.info("🔍 Running SEO Rank Drops detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_ranks AS (
      SELECT 
        canonical_entity_id,
        AVG(position) as avg_position_recent,
        AVG(search_volume) as avg_volume
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'keyword'
        AND position IS NOT NULL
      GROUP BY canonical_entity_id
    ),
    historical_ranks AS (
      SELECT 
        canonical_entity_id,
        AVG(position) as avg_position_historical
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'keyword'
        AND position IS NOT NULL
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_position_recent,
      h.avg_position_historical,
      r.avg_volume,
      (r.avg_position_recent - h.avg_position_historical) as position_drop
    FROM recent_ranks r
    INNER JOIN historical_ranks h 
      ON r.canonical_entity_id = h.canonical_entity_id
    WHERE (r.avg_position_recent - h.avg_position_historical) > 5  -- Dropped 5+ positions
      AND h.avg_position_historical <= 20  -- Was ranking reasonably well
    ORDER BY position_drop DESC
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
            current_pos = row['avg_position_recent']
            historical_pos = row['avg_position_historical']
            drop = row['position_drop']
            
            fell_off_page_1 = historical_pos <= 10 and current_pos > 10
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_issue',
                'type': 'rank_drop_urgent' if fell_off_page_1 else 'rank_drop',
                'priority': 'high' if fell_off_page_1 else 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'keyword',
                'title': f"📉 Rank Drop: {entity_id} (↓{drop:.1f} positions)",
                'description': f"Dropped from position {historical_pos:.1f} to {current_pos:.1f} ({drop:.1f} positions). {'Fell off page 1!' if fell_off_page_1 else 'Requires investigation.'}",
                'evidence': {
                    'current_position': current_pos,
                    'historical_position': historical_pos,
                    'position_drop': drop,
                    'search_volume': row['avg_volume'],
                    'fell_off_page_1': fell_off_page_1
                },
                'metrics': {
                    'current_position': current_pos,
                    'previous_position': historical_pos,
                    'positions_lost': drop
                },
                'hypothesis': f"Rank drops can result from algorithm updates, competitor improvements, content decay, or technical issues. Quick action can prevent further losses.",
                'confidence_score': 0.85,
                'potential_impact_score': min(100, drop * 8),
                'urgency_score': 85 if fell_off_page_1 else 65,
                'recommended_actions': [
                    'Check Google Search Console for manual actions',
                    'Review recent SERP changes and new competitors',
                    'Audit page for technical SEO issues',
                    'Refresh content with updated information',
                    'Check if page has been de-indexed',
                    'Analyze top-ranking competitor pages',
                    'Improve E-A-T signals and backlinks',
                    'Monitor for further drops'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} SEO rank drop opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in seo_rank_drops detector: {e}")
    
    return opportunities


def detect_paid_waste(organization_id: str) -> list:
    """
    PHASE 2A #7: Paid Waste Detection
    Detect: Campaigns spending money with 0 or very few conversions
    """
    logger.info("🔍 Running Paid Waste detector...")
    
    opportunities = []
    
    query = f"""
    WITH campaign_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_cost,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'campaign'
        AND cost > 0
      GROUP BY canonical_entity_id
      HAVING total_cost > 50  -- Spent at least $50
    )
    SELECT *
    FROM campaign_performance
    WHERE (total_conversions = 0 AND total_clicks > 30)  -- 0 conversions after meaningful clicks
       OR (total_cost > 100 AND total_conversions = 0)   -- Or $100+ spent with 0 conversions
       OR (total_conversions > 0 AND SAFE_DIVIDE(total_cost, total_conversions) > 200)  -- Or CPA > $200
    ORDER BY total_cost DESC
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
            cost = row['total_cost']
            clicks = row['total_clicks']
            conversions = row['total_conversions']
            
            is_zero_conv = conversions == 0
            cpa = cost / conversions if conversions > 0 else 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'paid_waste',
                'type': 'zero_conversions' if is_zero_conv else 'high_cpa',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'campaign',
                'title': f"🛑 Paid Waste: {entity_id}",
                'description': f"Spent ${cost:.2f} with {conversions} conversions ({clicks} clicks). {'Pause immediately.' if is_zero_conv else f'CPA ${cpa:.2f} too high.'}",
                'evidence': {
                    'total_cost': cost,
                    'total_clicks': clicks,
                    'total_conversions': conversions,
                    'cpa': cpa if not is_zero_conv else None
                },
                'metrics': {
                    'current_spend': cost,
                    'current_conversions': conversions,
                    'current_cpa': cpa if not is_zero_conv else None
                },
                'hypothesis': f"{'Zero conversions after significant spend indicates fundamental issues with targeting, messaging, or landing page.' if is_zero_conv else 'Extremely high CPA makes this campaign unprofitable. Budget should be reallocated.'}",
                'confidence_score': 0.95,
                'potential_impact_score': min(100, cost / 10),
                'urgency_score': 95,
                'recommended_actions': [
                    'Pause campaign immediately to stop losses',
                    'Audit campaign targeting and keywords',
                    'Review landing page conversion rate',
                    'Check conversion tracking is working',
                    'Analyze search terms triggering ads',
                    'Add negative keywords',
                    'Compare to successful campaigns',
                    'Either fix issues or reallocate budget'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': 'immediate',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} paid waste opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in paid_waste detector: {e}")
    
    return opportunities


def detect_email_high_opens_low_clicks(organization_id: str) -> list:
    """
    PHASE 2A #8: Email High Opens, Low Clicks
    Detect: Email campaigns with good open rates but poor click-through
    """
    logger.info("🔍 Running Email High Opens Low Clicks detector...")
    
    opportunities = []
    
    query = f"""
    WITH email_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        SUM(sends) as total_sends,
        SUM(opens) as total_opens,
        SUM(clicks) as total_clicks
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
      HAVING total_sends > 100  -- Meaningful send volume
    )
    SELECT *
    FROM email_performance
    WHERE avg_open_rate > 20  -- Good open rate (>20%)
      AND avg_ctr < 2  -- Poor click rate (<2%)
    ORDER BY total_opens DESC
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
            open_rate = row['avg_open_rate']
            ctr = row['avg_ctr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_optimization',
                'type': 'high_opens_low_clicks',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"📧 Email Copy Issue: {entity_id}",
                'description': f"Open rate is strong ({open_rate:.1f}%) but click rate is only {ctr:.1f}%. Subject works but body/CTA needs improvement.",
                'evidence': {
                    'open_rate': open_rate,
                    'click_through_rate': ctr,
                    'total_sends': row['total_sends'],
                    'total_opens': row['total_opens'],
                    'total_clicks': row['total_clicks']
                },
                'metrics': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'target_ctr': 3.0
                },
                'hypothesis': f"High opens prove the subject line works. Low clicks indicate body copy, CTA, or offer issues. Fixing this could 2-3x click-through.",
                'confidence_score': 0.82,
                'potential_impact_score': min(100, (3.0 - ctr) * 20),
                'urgency_score': 60,
                'recommended_actions': [
                    'Rewrite body copy to be more concise and action-oriented',
                    'Make primary CTA more prominent and compelling',
                    'Reduce number of CTAs (focus on one primary action)',
                    'Add urgency or scarcity to offer',
                    'Improve CTA button design and placement',
                    'A/B test different copy approaches',
                    'Simplify email design to reduce friction'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email high opens low clicks opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_high_opens_low_clicks detector: {e}")
    
    return opportunities


def detect_content_decay(organization_id: str) -> list:
    """
    PHASE 2A #9: Content Decay
    Detect: Previously strong pages losing traffic/performance over time
    """
    logger.info("🔍 Running Content Decay detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions_recent,
        AVG(conversion_rate) as cvr_recent
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions_historical,
        AVG(conversion_rate) as cvr_historical
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.sessions_recent,
      h.sessions_historical,
      r.cvr_recent,
      h.cvr_historical,
      SAFE_DIVIDE((r.sessions_recent - h.sessions_historical), h.sessions_historical) * 100 as sessions_change_pct,
      SAFE_DIVIDE((r.cvr_recent - h.cvr_historical), h.cvr_historical) * 100 as cvr_change_pct
    FROM recent_performance r
    INNER JOIN historical_performance h 
      ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.sessions_historical > 500  -- Was getting meaningful traffic
      AND SAFE_DIVIDE((r.sessions_recent - h.sessions_historical), h.sessions_historical) < -0.30  -- 30%+ traffic drop
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
            sessions_change = row['sessions_change_pct'] or 0
            sessions_lost = row['sessions_historical'] - row['sessions_recent']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'content_decay',
                'type': 'traffic_decline',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"📉 Content Decay: {entity_id}",
                'description': f"Traffic dropped {abs(sessions_change):.1f}% ({sessions_lost:.0f} sessions lost). This page needs a refresh to recover.",
                'evidence': {
                    'sessions_recent': row['sessions_recent'],
                    'sessions_historical': row['sessions_historical'],
                    'sessions_change_pct': sessions_change,
                    'sessions_lost': sessions_lost,
                    'cvr_recent': row['cvr_recent'],
                    'cvr_historical': row['cvr_historical']
                },
                'metrics': {
                    'current_sessions': row['sessions_recent'],
                    'previous_sessions': row['sessions_historical'],
                    'sessions_lost': sessions_lost
                },
                'hypothesis': f"Content decay occurs when pages become outdated, competitors improve, or rankings slip. Refreshing content can recover lost traffic.",
                'confidence_score': 0.80,
                'potential_impact_score': min(100, abs(sessions_change) / 2),
                'urgency_score': 60,
                'recommended_actions': [
                    'Refresh content with latest data and examples',
                    'Update statistics and references',
                    'Expand thin sections',
                    'Check for broken links and images',
                    'Improve internal linking to this page',
                    'Analyze why competitors may be overtaking',
                    'Add new sections addressing emerging topics',
                    'Improve technical SEO (speed, mobile, etc.)'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} content decay opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in content_decay detector: {e}")
    
    return opportunities
