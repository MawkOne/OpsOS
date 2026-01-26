"""
Multi-Timeframe Detectors with Monthly Trend Analysis
These detectors analyze patterns across Daily, Weekly, 30d, 60d, 90d, and All-Time windows
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


def detect_content_decay_multitimeframe(organization_id: str) -> list:
    """
    Enhanced Content Decay with Monthly Trends
    Detects: Pages declining across multiple timeframes with acceleration/deceleration analysis
    """
    logger.info("🔍 Running Content Decay (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_trends AS (
      SELECT 
        canonical_entity_id,
        year_month,
        sessions,
        mom_change_pct,
        LAG(sessions, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_1_ago,
        LAG(sessions, 2) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_2_ago,
        LAG(sessions, 3) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_3_ago,
        MAX(sessions) OVER (PARTITION BY canonical_entity_id) as all_time_peak
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
      ORDER BY canonical_entity_id, year_month
    ),
    
    current_month AS (
      SELECT 
        canonical_entity_id,
        sessions as current_sessions,
        month_1_ago,
        month_2_ago,
        month_3_ago,
        all_time_peak,
        mom_change_pct as current_mom,
        
        -- Calculate previous MoM changes
        SAFE_DIVIDE(month_1_ago - month_2_ago, month_2_ago) * 100 as prev_mom_1,
        SAFE_DIVIDE(month_2_ago - month_3_ago, month_3_ago) * 100 as prev_mom_2,
        
        -- Count consecutive declining months
        CASE 
          WHEN sessions < month_1_ago AND month_1_ago < month_2_ago AND month_2_ago < month_3_ago THEN 4
          WHEN sessions < month_1_ago AND month_1_ago < month_2_ago THEN 3
          WHEN sessions < month_1_ago THEN 2
          ELSE 0
        END as consecutive_declining_months,
        
        -- Calculate vs all-time peak
        SAFE_DIVIDE(sessions - all_time_peak, all_time_peak) * 100 as vs_all_time_peak_pct,
        
        year_month
        
      FROM monthly_trends
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_trends)
        AND month_1_ago IS NOT NULL  -- Need at least 2 months of data
    )
    
    SELECT 
      canonical_entity_id,
      current_sessions,
      month_1_ago,
      month_2_ago,
      month_3_ago,
      current_mom,
      prev_mom_1,
      prev_mom_2,
      consecutive_declining_months,
      all_time_peak,
      vs_all_time_peak_pct,
      
      -- Classify decay pattern
      CASE 
        WHEN ABS(current_mom) > ABS(prev_mom_1) AND ABS(prev_mom_1) > ABS(prev_mom_2) THEN 'Accelerating'
        WHEN ABS(current_mom) < ABS(prev_mom_1) AND ABS(prev_mom_1) < ABS(prev_mom_2) THEN 'Decelerating'
        ELSE 'Steady'
      END as decay_pattern
      
    FROM current_month
    WHERE consecutive_declining_months >= 2  -- At least 2 months declining
      AND month_1_ago > 500  -- Was getting meaningful traffic
    ORDER BY consecutive_declining_months DESC, ABS(current_mom) DESC
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
            current = row['current_sessions']
            month_1 = row['month_1_ago']
            month_2 = row['month_2_ago']
            month_3 = row['month_3_ago']
            current_mom = row['current_mom'] or 0
            prev_mom_1 = row['prev_mom_1'] or 0
            prev_mom_2 = row['prev_mom_2'] or 0
            consecutive = row['consecutive_declining_months']
            pattern = row['decay_pattern']
            peak = row['all_time_peak']
            vs_peak_pct = row['vs_all_time_peak_pct'] or 0
            
            # Build monthly trend array
            monthly_trend = []
            if month_3:
                monthly_trend.append({'month': '3mo ago', 'sessions': month_3, 'mom': None})
            if month_2:
                monthly_trend.append({'month': '2mo ago', 'sessions': month_2, 'mom': f"{prev_mom_2:+.1f}%"})
            if month_1:
                monthly_trend.append({'month': '1mo ago', 'sessions': month_1, 'mom': f"{prev_mom_1:+.1f}%"})
            monthly_trend.append({'month': 'Current', 'sessions': current, 'mom': f"{current_mom:+.1f}%"})
            
            # Determine priority
            if pattern == 'Accelerating' and consecutive >= 3:
                priority = 'high'
                urgency = 85
            elif consecutive >= 4:
                priority = 'high'
                urgency = 80
            else:
                priority = 'medium'
                urgency = 60
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'content_decay',
                'type': f'{pattern.lower()}_decay',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"📉 Content Decay ({pattern}): {entity_id}",
                'description': f"{consecutive} consecutive months declining. {'Getting worse each month!' if pattern == 'Accelerating' else 'Steady decline.' if pattern == 'Steady' else 'Rate of decline slowing.'} Sessions: {month_1:,.0f} → {current:,.0f} ({current_mom:+.1f}% MoM)",
                'evidence': {
                    'monthly_trend': monthly_trend,
                    'consecutive_declining_months': consecutive,
                    'decay_pattern': pattern,
                    'current_sessions': current,
                    'month_1_ago': month_1,
                    'current_mom_pct': current_mom,
                    'all_time_peak': peak,
                    'vs_peak_pct': vs_peak_pct,
                    'sessions_lost_from_peak': peak - current
                },
                'metrics': {
                    'current_sessions': current,
                    'previous_month': month_1,
                    'mom_change_pct': current_mom,
                    'consecutive_months': consecutive
                },
                'hypothesis': f"{pattern} decay pattern over {consecutive} months. " + 
                             (f"Rate of decline is ACCELERATING - urgent intervention needed." if pattern == 'Accelerating' 
                              else f"Steady decline suggests systematic issue." if pattern == 'Steady'
                              else f"Decline is slowing - may be recovering."),
                'confidence_score': min(0.95, 0.70 + (consecutive * 0.08)),  # More months = more confidence
                'potential_impact_score': min(100, abs(vs_peak_pct) / 2),
                'urgency_score': urgency,
                'recommended_actions': [
                    f"CRITICAL: {consecutive} months of decline - immediate action required" if consecutive >= 3 else f"{consecutive} months declining",
                    'Refresh content with latest data and examples',
                    'Check for broken links, images, or technical issues',
                    'Analyze competitors who may be overtaking you',
                    'Expand thin sections with more comprehensive content',
                    'Improve internal linking to this page',
                    'Consider technical SEO audit',
                    f"Potential upside: Recover to peak could add {peak - current:,.0f} sessions/month"
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {
                    'all_time_peak': peak,
                    'current_vs_peak': vs_peak_pct
                },
                'comparison_data': {
                    'timeframes': monthly_trend
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} content decay (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in content_decay_multitimeframe detector: {e}")
    
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
        year_month,
        SUM(revenue) as total_revenue,
        SUM(conversions) as total_conversions,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
      GROUP BY year_month
      ORDER BY year_month
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


def detect_email_trends_multitimeframe(organization_id: str) -> list:
    """
    Enhanced Email Analysis with Monthly Trends
    Detects: Email performance patterns across multiple months
    """
    logger.info("🔍 Running Email Trends (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_email AS (
      SELECT 
        canonical_entity_id,
        year_month,
        sends,
        opens,
        open_rate,
        click_through_rate,
        LAG(open_rate, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_1_ago_open_rate,
        LAG(open_rate, 2) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_2_ago_open_rate,
        LAG(click_through_rate, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_1_ago_ctr,
        MAX(open_rate) OVER (PARTITION BY canonical_entity_id) as best_open_rate,
        MIN(open_rate) OVER (PARTITION BY canonical_entity_id) as worst_open_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'email'
        AND sends > 0
    ),
    
    current AS (
      SELECT 
        canonical_entity_id,
        year_month,
        sends,
        opens,
        open_rate,
        click_through_rate,
        month_1_ago_open_rate,
        month_2_ago_open_rate,
        month_1_ago_ctr,
        best_open_rate,
        worst_open_rate,
        
        SAFE_DIVIDE(open_rate - month_1_ago_open_rate, month_1_ago_open_rate) * 100 as mom_open_change,
        SAFE_DIVIDE(month_1_ago_open_rate - month_2_ago_open_rate, month_2_ago_open_rate) * 100 as prev_mom_open_change,
        SAFE_DIVIDE(click_through_rate - month_1_ago_ctr, month_1_ago_ctr) * 100 as mom_ctr_change,
        
        -- Count declining months
        CASE 
          WHEN open_rate < month_1_ago_open_rate AND month_1_ago_open_rate < month_2_ago_open_rate THEN 3
          WHEN open_rate < month_1_ago_open_rate THEN 2
          ELSE 0
        END as consecutive_declining_months
        
      FROM monthly_email
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_email)
    )
    
    SELECT *
    FROM current
    WHERE (
      ABS(mom_open_change) > 15  -- 15%+ change in open rate
      OR consecutive_declining_months >= 2
      OR (open_rate > 20 AND click_through_rate < 2)  -- High opens, low clicks
    )
    ORDER BY consecutive_declining_months DESC, ABS(mom_open_change) DESC
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
            open_rate = row['open_rate']
            ctr = row['click_through_rate']
            mom_open = row['mom_open_change'] or 0
            consecutive = row['consecutive_declining_months']
            
            # Determine issue type
            if open_rate > 20 and ctr < 2:
                issue_type = 'high_opens_low_clicks'
                title_prefix = '📧 Email Copy Issue'
            elif consecutive >= 2:
                issue_type = 'engagement_decline_multimo'
                title_prefix = '📉 Email Engagement Declining'
            else:
                issue_type = 'open_rate_change'
                title_prefix = '⚠️ Email Performance Change'
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_trend',
                'type': issue_type,
                'priority': 'high' if consecutive >= 2 else 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"{title_prefix}: {entity_id}",
                'description': f"Open rate: {open_rate:.1f}% ({mom_open:+.1f}% MoM), CTR: {ctr:.1f}%. " + 
                              (f"{consecutive} consecutive months declining." if consecutive >= 2 else f"Monthly change: {mom_open:+.1f}%"),
                'evidence': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'mom_open_change': mom_open,
                    'consecutive_declining_months': consecutive,
                    'best_open_rate': row['best_open_rate'],
                    'worst_open_rate': row['worst_open_rate']
                },
                'metrics': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'mom_change': mom_open
                },
                'hypothesis': f"{'Sustained email engagement decline over multiple months suggests list fatigue or content relevance issues.' if consecutive >= 2 else 'High opens but low clicks indicate subject line works but body/CTA needs improvement.' if issue_type == 'high_opens_low_clicks' else 'Significant change in email performance requires investigation.'}",
                'confidence_score': min(0.95, 0.72 + (consecutive * 0.10)),
                'potential_impact_score': min(100, abs(mom_open) * 3),
                'urgency_score': 75 if consecutive >= 2 else 60,
                'recommended_actions': [
                    f"PATTERN: {consecutive} months of decline" if consecutive >= 2 else "Recent performance change",
                    'Segment list by engagement level',
                    'Test different subject line approaches',
                    'Refresh content and offers',
                    'Check deliverability and spam scores',
                    'Remove inactive subscribers',
                    'A/B test send times and frequency'
                ] if consecutive >= 2 else [
                    'Rewrite body copy for clarity and action',
                    'Simplify to single primary CTA',
                    'Improve CTA button design',
                    'Add urgency or scarcity',
                    'Test different offer positioning'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email trend (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_trends_multitimeframe detector: {e}")
    
    return opportunities


def detect_seo_rank_trends_multitimeframe(organization_id: str) -> list:
    """
    Enhanced SEO Rank Analysis with Monthly Trends
    Detects: Rank changes and patterns across multiple months
    """
    logger.info("🔍 Running SEO Rank Trends (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_ranks AS (
      SELECT 
        canonical_entity_id,
        year_month,
        avg_position,
        avg_search_volume,
        LAG(avg_position, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_1_ago_position,
        LAG(avg_position, 2) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_2_ago_position,
        LAG(avg_position, 3) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_3_ago_position,
        MIN(avg_position) OVER (PARTITION BY canonical_entity_id) as best_position_ever,
        MAX(avg_position) OVER (PARTITION BY canonical_entity_id) as worst_position_ever
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'keyword'
        AND avg_position IS NOT NULL
    ),
    
    current AS (
      SELECT 
        canonical_entity_id,
        year_month,
        avg_position as current_position,
        avg_search_volume,
        month_1_ago_position,
        month_2_ago_position,
        month_3_ago_position,
        best_position_ever,
        worst_position_ever,
        
        -- Calculate position changes
        avg_position - month_1_ago_position as mom_position_change,
        month_1_ago_position - month_2_ago_position as prev_mom_position_change,
        
        -- Detect pattern
        CASE 
          WHEN avg_position > month_1_ago_position 
           AND month_1_ago_position > month_2_ago_position 
           AND month_2_ago_position > month_3_ago_position THEN 'Accelerating Decline'
          WHEN avg_position < month_1_ago_position 
           AND month_1_ago_position < month_2_ago_position 
           AND month_2_ago_position < month_3_ago_position THEN 'Accelerating Improvement'
          WHEN avg_position > month_1_ago_position 
           AND month_1_ago_position > month_2_ago_position THEN 'Declining'
          WHEN avg_position < month_1_ago_position 
           AND month_1_ago_position < month_2_ago_position THEN 'Improving'
          ELSE 'Stable'
        END as rank_trend
        
      FROM monthly_ranks
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_ranks)
        AND month_1_ago_position IS NOT NULL
    )
    
    SELECT *
    FROM current
    WHERE (
      ABS(mom_position_change) > 5  -- 5+ position change
      OR rank_trend IN ('Accelerating Decline', 'Declining', 'Accelerating Improvement')
    )
      AND avg_search_volume > 100  -- Meaningful search volume
      AND month_1_ago_position <= 30  -- Was ranking decently
    ORDER BY 
      CASE 
        WHEN rank_trend = 'Accelerating Decline' THEN 1
        WHEN rank_trend = 'Declining' THEN 2
        WHEN rank_trend = 'Accelerating Improvement' THEN 3
        ELSE 4
      END,
      ABS(mom_position_change) DESC
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
            current_pos = row['current_position']
            pos_1mo = row['month_1_ago_position']
            pos_2mo = row['month_2_ago_position']
            pos_3mo = row['month_3_ago_position']
            change = row['mom_position_change']
            trend = row['rank_trend']
            best_ever = row['best_position_ever']
            
            is_decline = change > 0  # Higher position number = decline
            
            # Build monthly position trend
            monthly_positions = []
            if pos_3mo:
                monthly_positions.append({'month': '3mo ago', 'position': f"#{pos_3mo:.1f}"})
            if pos_2mo:
                monthly_positions.append({'month': '2mo ago', 'position': f"#{pos_2mo:.1f}"})
            if pos_1mo:
                monthly_positions.append({'month': '1mo ago', 'position': f"#{pos_1mo:.1f}"})
            monthly_positions.append({'month': 'Current', 'position': f"#{current_pos:.1f}"})
            
            priority = 'high' if trend == 'Accelerating Decline' else 'medium'
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_rank_trend',
                'type': trend.lower().replace(' ', '_'),
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'keyword',
                'title': f"{'📉' if is_decline else '📈'} SEO Rank: {trend} - {entity_id}",
                'description': f"Position: #{current_pos:.1f} ({'↓' if is_decline else '↑'}{abs(change):.1f} positions MoM). Trend: {trend}. Best ever: #{best_ever:.1f}",
                'evidence': {
                    'monthly_positions': monthly_positions,
                    'current_position': current_pos,
                    'month_1_ago_position': pos_1mo,
                    'mom_change': change,
                    'rank_trend': trend,
                    'best_position_ever': best_ever,
                    'positions_lost_from_best': current_pos - best_ever,
                    'search_volume': row['avg_search_volume']
                },
                'metrics': {
                    'current_position': current_pos,
                    'mom_change': change,
                    'trend': trend
                },
                'hypothesis': f"{trend} in rankings. " + 
                             (f"URGENT: Rank deteriorating monthly - losing visibility." if trend == 'Accelerating Decline' 
                              else f"Positive momentum - capitalize on this SEO improvement!" if 'Improvement' in trend
                              else f"Sustained rank change requires investigation."),
                'confidence_score': 0.88,
                'potential_impact_score': min(100, abs(change) * 8),
                'urgency_score': 90 if trend == 'Accelerating Decline' else 70 if is_decline else 50,
                'recommended_actions': [
                    f"Pattern: {trend} detected in monthly ranking data",
                    'Analyze SERP changes and new competitors',
                    'Technical SEO audit of this page',
                    'Refresh content with updated information',
                    'Build high-quality backlinks',
                    'Improve internal linking',
                    f"Recovery potential: From #{current_pos:.1f} to best ever #{best_ever:.1f}"
                ] if is_decline else [
                    f"Positive momentum: {trend}",
                    'Document what is working to replicate',
                    'Increase content depth on this topic',
                    'Build more supporting content',
                    'Amplify with paid/email support'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': {
                    'best_position_ever': best_ever,
                    'worst_position_ever': row['worst_position_ever']
                },
                'comparison_data': {
                    'monthly_positions': monthly_positions
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} SEO rank trend (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in seo_rank_trends_multitimeframe detector: {e}")
    
    return opportunities
