"""
Detect Seo Rank Trends Multitimeframe Detector
Category: Seo
"""

"""
SEO Detectors\nAll detection layers (Fast, Trend, Strategic) for SEO & organic search
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
        m.canonical_entity_id,
        m.year_month,
        m.avg_position,
        m.avg_search_volume,
        LAG(m.avg_position, 1) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_1_ago_position,
        LAG(m.avg_position, 2) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_2_ago_position,
        LAG(m.avg_position, 3) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_3_ago_position,
        MIN(m.avg_position) OVER (PARTITION BY m.canonical_entity_id) as best_position_ever,
        MAX(m.avg_position) OVER (PARTITION BY m.canonical_entity_id) as worst_position_ever
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.entity_type = 'keyword'
        AND m.avg_position IS NOT NULL
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


__all__ = ['detect_keyword_cannibalization', 'detect_seo_striking_distance', 'detect_seo_rank_drops', 'detect_seo_rank_trends_multitimeframe']
