"""
Detect Revenue Trends Multitimeframe Detector
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
