"""
Detect Content Decay Multitimeframe Detector
Category: Content
"""

"""
CONTENT Detectors\nAll detection layers (Fast, Trend, Strategic) for content marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_content_decay_multitimeframe(organization_id: str) -> list:
    bq_client = bigquery.Client()
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
__all__ = ['detect_content_decay', 'detect_content_decay_multitimeframe']
