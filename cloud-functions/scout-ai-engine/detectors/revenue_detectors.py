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


def detect_revenue_trends_multitimeframe(organization_id: str) -> list:
    """
    Enhanced Revenue Analysis with Monthly Trends
    Detects: Revenue patterns across multiple timeframes
    """
    logger.info("🔍 Running Revenue Trends (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_revenue AS (
      SELECT 
        m.year_month,
        SUM(m.revenue) as total_revenue,
        SUM(m.conversions) as total_conversions,
        SUM(m.cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
      GROUP BY m.year_month
      ORDER BY m.year_month
    ),
    
    with_trends AS (
      SELECT 
        year_month,
        total_revenue,
        total_conversions,
        total_cost,
        
        LAG(total_revenue, 1) OVER (ORDER BY year_month) as month_1_ago_revenue,
        LAG(total_revenue, 2) OVER (ORDER BY year_month) as month_2_ago_revenue,
        LAG(total_revenue, 3) OVER (ORDER BY year_month) as month_3_ago_revenue,
        
        SAFE_DIVIDE(total_revenue - LAG(total_revenue, 1) OVER (ORDER BY year_month), 
                   LAG(total_revenue, 1) OVER (ORDER BY year_month)) * 100 as mom_change,
        
        SAFE_DIVIDE(LAG(total_revenue, 1) OVER (ORDER BY year_month) - LAG(total_revenue, 2) OVER (ORDER BY year_month),
                   LAG(total_revenue, 2) OVER (ORDER BY year_month)) * 100 as prev_mom_change,
        
        MAX(total_revenue) OVER () as all_time_peak,
        AVG(total_revenue) OVER () as all_time_avg
        
      FROM monthly_revenue
    ),
    
    current AS (
      SELECT *
      FROM with_trends
      WHERE year_month = (SELECT MAX(year_month) FROM with_trends)
        AND month_1_ago_revenue IS NOT NULL
    )
    
    SELECT 
      *,
      -- Count consecutive declining months
      CASE 
        WHEN total_revenue < month_1_ago_revenue 
         AND month_1_ago_revenue < month_2_ago_revenue 
         AND month_2_ago_revenue < month_3_ago_revenue THEN 4
        WHEN total_revenue < month_1_ago_revenue 
         AND month_1_ago_revenue < month_2_ago_revenue THEN 3
        WHEN total_revenue < month_1_ago_revenue THEN 2
        ELSE 0
      END as consecutive_declining_months,
      
      -- Classify trend pattern
      CASE 
        WHEN ABS(mom_change) > ABS(prev_mom_change) AND mom_change < 0 THEN 'Accelerating Decline'
        WHEN ABS(mom_change) < ABS(prev_mom_change) AND mom_change < 0 THEN 'Decelerating Decline'
        WHEN ABS(mom_change) > ABS(prev_mom_change) AND mom_change > 0 THEN 'Accelerating Growth'
        WHEN ABS(mom_change) < ABS(prev_mom_change) AND mom_change > 0 THEN 'Decelerating Growth'
        WHEN mom_change < -5 THEN 'Steady Decline'
        WHEN mom_change > 5 THEN 'Steady Growth'
        ELSE 'Stable'
      END as pattern
      
    FROM current
    WHERE (
      ABS(mom_change) > 10  -- 10%+ change
      OR consecutive_declining_months >= 2
      OR ABS(total_revenue - all_time_avg) / all_time_avg > 0.20  -- 20% deviation from average
    )
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            revenue_now = row['total_revenue'] or 0
            revenue_1mo = row['month_1_ago_revenue'] or 0
            revenue_2mo = row['month_2_ago_revenue'] or 0
            revenue_3mo = row['month_3_ago_revenue'] or 0
            mom = row['mom_change'] or 0
            prev_mom = row['prev_mom_change'] or 0
            consecutive = row['consecutive_declining_months']
            pattern = row['pattern']
            peak = row['all_time_peak']
            
            # Build monthly trend array
            monthly_trend = []
            if revenue_3mo:
                monthly_trend.append({'month': '3mo ago', 'revenue': f"${revenue_3mo:,.0f}", 'mom': None})
            if revenue_2mo:
                monthly_trend.append({'month': '2mo ago', 'revenue': f"${revenue_2mo:,.0f}", 'mom': f"{prev_mom:+.1f}%"})
            if revenue_1mo:
                monthly_trend.append({'month': '1mo ago', 'revenue': f"${revenue_1mo:,.0f}", 'mom': f"{prev_mom:+.1f}%"})
            monthly_trend.append({'month': 'Current', 'revenue': f"${revenue_now:,.0f}", 'mom': f"{mom:+.1f}%"})
            
            is_declining = mom < -5
            priority = 'high' if (pattern == 'Accelerating Decline' or consecutive >= 3) else 'medium'
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'revenue_trend',
                'type': pattern.lower().replace(' ', '_'),
                'priority': priority,
                'status': 'new',
                'entity_id': 'total_revenue',
                'entity_type': 'aggregate',
                'title': f"{'📉' if is_declining else '📈'} Revenue Trend: {pattern}",
                'description': f"Revenue: ${revenue_now:,.0f} ({mom:+.1f}% MoM). {consecutive} consecutive declining months." if consecutive >= 2 else f"Revenue: ${revenue_now:,.0f} ({mom:+.1f}% MoM). Pattern: {pattern}",
                'evidence': {
                    'monthly_trend': monthly_trend,
                    'current_revenue': revenue_now,
                    'previous_month': revenue_1mo,
                    'mom_change_pct': mom,
                    'previous_mom_change': prev_mom,
                    'consecutive_declining_months': consecutive,
                    'decay_pattern': pattern,
                    'all_time_peak': peak,
                    'vs_peak_pct': (revenue_now - peak) / peak * 100 if peak else 0
                },
                'metrics': {
                    'current_revenue': revenue_now,
                    'mom_change_pct': mom,
                    'pattern': pattern
                },
                'monthly_trend_array': monthly_trend,
                'hypothesis': f"{pattern} detected in monthly revenue. " + 
                             (f"Decline is ACCELERATING - each month worse than the last. URGENT intervention needed." if pattern == 'Accelerating Decline' 
                              else f"Growth is ACCELERATING - capitalize on this momentum!" if pattern == 'Accelerating Growth'
                              else f"Steady {('decline' if is_declining else 'growth')} suggests systematic cause."),
                'confidence_score': min(0.95, 0.75 + (consecutive * 0.07)),
                'potential_impact_score': min(100, abs(mom) * 5),
                'urgency_score': 95 if pattern == 'Accelerating Decline' else 70 if is_declining else 50,
                'recommended_actions': [
                    f"URGENT: {consecutive} months declining - revenue at risk" if consecutive >= 3 else f"{consecutive} months of {'decline' if is_declining else 'growth'}",
                    'Analyze revenue by channel to identify source of change',
                    'Check conversion rates across all funnels',
                    'Review pricing or product changes',
                    'Investigate traffic quality and sources',
                    'Compare to industry benchmarks',
                    f"Upside potential: Recovery to peak = ${peak - revenue_now:,.0f}" if is_declining else f"Capitalize on growth momentum"
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {
                    'all_time_peak': peak,
                    'current_vs_peak': (revenue_now - peak) / peak * 100 if peak else 0
                },
                'comparison_data': {
                    'timeframes': monthly_trend
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} revenue trend (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in revenue_trends_multitimeframe detector: {e}")
    
    return opportunities


def detect_revenue_aov_decline(organization_id: str) -> list:
    """
    Detect: Average Order Value declining
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Revenue AOV Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(average_order_value) as avg_aov,
        SUM(transactions) as total_transactions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND average_order_value > 0
    ),
    historical_performance AS (
      SELECT 
        AVG(average_order_value) as baseline_aov
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND average_order_value > 0
    )
    SELECT 
      r.avg_aov as current_aov,
      h.baseline_aov,
      r.total_transactions,
      r.total_revenue,
      SAFE_DIVIDE((r.avg_aov - h.baseline_aov), h.baseline_aov) * 100 as aov_change_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE h.baseline_aov > 0
      AND r.avg_aov < h.baseline_aov * 0.9  -- 10%+ decline
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
            priority = "high" if row.aov_change_pct < -20 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_optimization",
                "type": "aov_decline",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Average Order Value Declining: ${row.current_aov:.2f} ({row.aov_change_pct:+.1f}%)",
                "description": f"AOV has declined {abs(row.aov_change_pct):.1f}% from ${row.baseline_aov:.2f} to ${row.current_aov:.2f}",
                "evidence": {
                    "current_aov": float(row.current_aov),
                    "baseline_aov": float(row.baseline_aov),
                    "aov_change_pct": float(row.aov_change_pct),
                    "total_transactions": int(row.total_transactions),
                    "total_revenue": float(row.total_revenue),
                },
                "metrics": {
                    "aov": float(row.current_aov),
                    "aov_change": float(row.aov_change_pct),
                },
                "hypothesis": "Customers are buying lower-value items or fewer items per order",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, abs(row.aov_change_pct) * 3),
                "urgency_score": 80 if row.aov_change_pct < -20 else 60,
                "recommended_actions": [
                    "Analyze product mix - are customers shifting to lower-value items?",
                    "Check for discount/coupon overuse",
                    "Implement upsell/cross-sell strategies",
                    "Test free shipping thresholds to encourage larger orders",
                    "Review pricing strategy",
                    f"Potential revenue recovery: ${(row.baseline_aov - row.current_aov) * row.total_transactions:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Revenue AOV Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Revenue AOV Decline detector failed: {e}")
    
    return opportunities


def detect_revenue_payment_failure_spike(organization_id: str) -> list:
    """
    Detect: Payment failure rate spiking
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Revenue Payment Failure Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(payment_failure_rate) as avg_failure_rate,
        SUM(payment_failures) as total_failures,
        SUM(transactions) as total_transactions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
    ),
    historical_performance AS (
      SELECT 
        AVG(payment_failure_rate) as baseline_failure_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    )
    SELECT 
      r.avg_failure_rate as current_failure_rate,
      h.baseline_failure_rate,
      r.total_failures,
      r.total_transactions,
      SAFE_DIVIDE((r.avg_failure_rate - h.baseline_failure_rate), h.baseline_failure_rate) * 100 as failure_rate_increase_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE r.avg_failure_rate > 2  -- >2% failure rate
      OR (h.baseline_failure_rate > 0 AND r.avg_failure_rate > h.baseline_failure_rate * 1.5)  -- 50% increase
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
            priority = "high" if row.current_failure_rate > 5 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_protection",
                "type": "payment_failure_spike",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Payment Failure Rate Spiking: {row.current_failure_rate:.1f}%",
                "description": f"Payment failures at {row.current_failure_rate:.1f}% (up from {row.baseline_failure_rate:.1f}%), blocking revenue",
                "evidence": {
                    "current_failure_rate": float(row.current_failure_rate),
                    "baseline_failure_rate": float(row.baseline_failure_rate),
                    "failure_rate_increase_pct": float(row.failure_rate_increase_pct) if row.failure_rate_increase_pct else None,
                    "total_failures": int(row.total_failures),
                    "total_transactions": int(row.total_transactions),
                },
                "metrics": {
                    "payment_failure_rate": float(row.current_failure_rate),
                },
                "hypothesis": "Payment processor issues, expired cards, or fraud detection blocking legitimate purchases",
                "confidence_score": 0.9,
                "potential_impact_score": min(100, row.current_failure_rate * 10),
                "urgency_score": 90 if row.current_failure_rate > 5 else 70,
                "recommended_actions": [
                    "Check payment processor status - any outages?",
                    "Review fraud detection settings - too aggressive?",
                    "Send dunning emails to recover failed payments",
                    "Check for expired credit cards",
                    "Test checkout flow for technical issues",
                    "Consider backup payment processor",
                    f"Revenue at risk: ~${(row.total_failures / (row.total_transactions + row.total_failures)) * 100:,.0f} per transaction"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-3 days",
            })
        
        logger.info(f"✅ Payment Failure Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Payment Failure Spike detector failed: {e}")
    
    return opportunities


def detect_revenue_new_customer_decline(organization_id: str) -> list:
    """
    Detect: New customer revenue declining vs returning
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running New Customer Revenue Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        SUM(CASE WHEN first_time_customers > 0 THEN revenue ELSE 0 END) as new_customer_revenue,
        SUM(CASE WHEN returning_customers > 0 THEN revenue ELSE 0 END) as returning_customer_revenue,
        SUM(first_time_customers) as total_new_customers,
        SUM(returning_customers) as total_returning_customers,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
    ),
    historical_performance AS (
      SELECT 
        SUM(CASE WHEN first_time_customers > 0 THEN revenue ELSE 0 END) as baseline_new_customer_revenue,
        SUM(CASE WHEN returning_customers > 0 THEN revenue ELSE 0 END) as baseline_returning_customer_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    )
    SELECT 
      r.new_customer_revenue,
      r.returning_customer_revenue,
      h.baseline_new_customer_revenue,
      h.baseline_returning_customer_revenue,
      r.total_new_customers,
      r.total_returning_customers,
      r.total_revenue,
      SAFE_DIVIDE(r.new_customer_revenue, r.total_revenue) * 100 as new_customer_pct,
      SAFE_DIVIDE(h.baseline_new_customer_revenue, (h.baseline_new_customer_revenue + h.baseline_returning_customer_revenue)) * 100 as baseline_new_customer_pct,
      SAFE_DIVIDE((r.new_customer_revenue - h.baseline_new_customer_revenue), h.baseline_new_customer_revenue) * 100 as new_customer_revenue_change_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE h.baseline_new_customer_revenue > 0
      AND r.new_customer_revenue < h.baseline_new_customer_revenue * 0.85  -- 15%+ decline
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
            priority = "high" if row.new_customer_revenue_change_pct < -30 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_growth",
                "type": "new_customer_decline",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"New Customer Revenue Declining: {row.new_customer_revenue_change_pct:+.1f}%",
                "description": f"New customer revenue down {abs(row.new_customer_revenue_change_pct):.1f}% while returning customer revenue stable",
                "evidence": {
                    "current_new_customer_revenue": float(row.new_customer_revenue),
                    "baseline_new_customer_revenue": float(row.baseline_new_customer_revenue),
                    "new_customer_revenue_change_pct": float(row.new_customer_revenue_change_pct),
                    "new_customer_pct_of_total": float(row.new_customer_pct),
                    "baseline_new_customer_pct": float(row.baseline_new_customer_pct),
                    "total_new_customers": int(row.total_new_customers),
                },
                "metrics": {
                    "new_customer_revenue": float(row.new_customer_revenue),
                    "new_customer_pct": float(row.new_customer_pct),
                },
                "hypothesis": "Customer acquisition declining or new customer quality dropping",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, abs(row.new_customer_revenue_change_pct) * 2),
                "urgency_score": 80 if row.new_customer_revenue_change_pct < -30 else 60,
                "recommended_actions": [
                    "Review acquisition channels - where has new customer traffic dropped?",
                    "Check onboarding flow for friction",
                    "Review first-purchase offers and incentives",
                    "Analyze new customer CAC vs LTV",
                    "Test welcome campaigns and first-purchase nurture",
                    f"Growth opportunity: Recover to baseline = ${row.baseline_new_customer_revenue - row.new_customer_revenue:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-3 weeks",
            })
        
        logger.info(f"✅ New Customer Revenue Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ New Customer Revenue Decline detector failed: {e}")
    
    return opportunities


def detect_revenue_discount_cannibalization(organization_id: str) -> list:
    """
    Detect: Discount usage increasing but revenue flat/declining
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Discount Cannibalization detector...")
    
    opportunities = []
    
    # Note: This requires discount data from Stripe
    # For now, we'll check if refund_rate is increasing as a proxy
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(refund_rate) as avg_refund_rate,
        SUM(refunds) as total_refunds,
        SUM(revenue) as total_revenue,
        SUM(transactions) as total_transactions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
    ),
    historical_performance AS (
      SELECT 
        AVG(refund_rate) as baseline_refund_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    )
    SELECT 
      r.avg_refund_rate,
      h.baseline_refund_rate,
      r.total_refunds,
      r.total_revenue,
      r.total_transactions,
      SAFE_DIVIDE((r.avg_refund_rate - h.baseline_refund_rate), h.baseline_refund_rate) * 100 as refund_rate_increase_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE r.avg_refund_rate > 3  -- >3% refund rate
      OR (h.baseline_refund_rate > 0 AND r.avg_refund_rate > h.baseline_refund_rate * 1.5)  -- 50% increase
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
                "category": "revenue_optimization",
                "type": "refund_rate_increase",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Refund Rate Increasing: {row.avg_refund_rate:.1f}%",
                "description": f"Refund rate at {row.avg_refund_rate:.1f}%, up from baseline of {row.baseline_refund_rate:.1f}%",
                "evidence": {
                    "current_refund_rate": float(row.avg_refund_rate),
                    "baseline_refund_rate": float(row.baseline_refund_rate),
                    "refund_rate_increase_pct": float(row.refund_rate_increase_pct) if row.refund_rate_increase_pct else None,
                    "total_refunds": float(row.total_refunds),
                    "total_revenue": float(row.total_revenue),
                },
                "metrics": {
                    "refund_rate": float(row.avg_refund_rate),
                },
                "hypothesis": "Product quality issues, expectation mismatch, or policy abuse",
                "confidence_score": 0.75,
                "potential_impact_score": min(100, row.avg_refund_rate * 10),
                "urgency_score": 60,
                "recommended_actions": [
                    "Analyze refund reasons - product, delivery, or policy issues?",
                    "Check for discount/coupon abuse patterns",
                    "Review product descriptions and images - setting wrong expectations?",
                    "Tighten refund policy if being abused",
                    "Improve product quality or fulfillment",
                    f"Revenue recovery potential: ${row.total_refunds:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
            })
        
        logger.info(f"✅ Refund Rate Increase detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Refund Rate Increase detector failed: {e}")
    
    return opportunities


def detect_revenue_seasonality_deviation(organization_id: str) -> list:
    """
    Detect: Revenue deviating from expected seasonal patterns
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Revenue Seasonality Deviation detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_revenue AS (
      SELECT 
        DATE_TRUNC(date, MONTH) as month,
        EXTRACT(MONTH FROM date) as month_number,
        SUM(revenue) as monthly_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 24 MONTH)  -- 2 years of data
      GROUP BY month, month_number
    ),
    current_month AS (
      SELECT 
        month,
        month_number,
        monthly_revenue as current_revenue
      FROM monthly_revenue
      WHERE month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)
    ),
    same_month_history AS (
      SELECT 
        cm.month_number,
        cm.current_revenue,
        AVG(mr.monthly_revenue) as avg_same_month_revenue,
        STDDEV(mr.monthly_revenue) as stddev_same_month_revenue,
        COUNT(*) as years_of_data
      FROM current_month cm
      JOIN monthly_revenue mr ON mr.month_number = cm.month_number
        AND mr.month < cm.month  -- Only historical data
      GROUP BY cm.month_number, cm.current_revenue
    )
    SELECT 
      month_number,
      current_revenue,
      avg_same_month_revenue,
      stddev_same_month_revenue,
      years_of_data,
      SAFE_DIVIDE((current_revenue - avg_same_month_revenue), stddev_same_month_revenue) as z_score,
      SAFE_DIVIDE((current_revenue - avg_same_month_revenue), avg_same_month_revenue) * 100 as deviation_pct
    FROM same_month_history
    WHERE years_of_data >= 2  -- Need at least 2 years of history
      AND ABS(SAFE_DIVIDE((current_revenue - avg_same_month_revenue), stddev_same_month_revenue)) > 2  -- 2 standard deviations
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
            is_underperforming = row.current_revenue < row.avg_same_month_revenue
            priority = "high" if is_underperforming and abs(row.deviation_pct) > 20 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_trend",
                "type": "seasonality_deviation",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Revenue {'Under' if is_underperforming else 'Over'}performing vs Seasonal Baseline: {row.deviation_pct:+.1f}%",
                "description": f"Revenue ${row.current_revenue:,.0f} vs expected ${row.avg_same_month_revenue:,.0f} for this month ({abs(row.deviation_pct):.1f}% deviation)",
                "evidence": {
                    "current_revenue": float(row.current_revenue),
                    "expected_revenue": float(row.avg_same_month_revenue),
                    "deviation_pct": float(row.deviation_pct),
                    "z_score": float(row.z_score),
                    "years_of_history": int(row.years_of_data),
                },
                "metrics": {
                    "revenue": float(row.current_revenue),
                    "deviation_from_seasonal": float(row.deviation_pct),
                },
                "hypothesis": "Revenue significantly deviating from historical seasonal patterns" if is_underperforming else "Revenue exceeding seasonal expectations - identify what's working",
                "confidence_score": 0.8,
                "potential_impact_score": min(100, abs(row.deviation_pct)),
                "urgency_score": 70 if is_underperforming else 40,
                "recommended_actions": [
                    f"Investigate why revenue is {'below' if is_underperforming else 'above'} seasonal baseline",
                    "Compare to industry seasonal patterns",
                    "Review marketing campaigns vs same period last year",
                    "Check for external factors (economy, competition, events)",
                    f"{'Recovery' if is_underperforming else 'Scale'} opportunity: ${abs(row.current_revenue - row.avg_same_month_revenue):,.0f}"
                ] if is_underperforming else [
                    "Identify what's driving outperformance",
                    "Scale successful tactics",
                    "Document learnings for future seasons",
                    f"Excess revenue vs baseline: ${row.current_revenue - row.avg_same_month_revenue:,.0f}"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Seasonality Deviation detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Seasonality Deviation detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_revenue_anomaly', 
    'detect_metric_anomalies', 
    'detect_revenue_trends_multitimeframe',
    'detect_revenue_aov_decline',
    'detect_revenue_payment_failure_spike',
    'detect_revenue_new_customer_decline',
    'detect_revenue_discount_cannibalization',
    'detect_revenue_seasonality_deviation'
]
