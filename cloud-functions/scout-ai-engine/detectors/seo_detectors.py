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
        canonical_entity_id as keyword_id,
        canonical_entity_id as page_id,
        AVG(position) as avg_position,
        SUM(sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      INNER JOIN `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
        ON organization_id = organization_id
        AND date = date
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'keyword'
        AND entity_type = 'page'
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
