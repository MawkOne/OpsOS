"""
Video/Content Engagement Gap Detector
Detects pages where engagement drops off mid-page
Low scroll depth + decent session time = users stop engaging partway through
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_video_engagement_gap(organization_id: str) -> list:
    """
    Detect pages where users engage initially but drop off.
    
    Logic (using scroll depth and engagement as proxy):
    - Decent session duration (users spend time)
    - But low scroll depth or low 75% scroll rate
    - Users are engaging with top content but not consuming full page
    - Could indicate video/content issues, or missing hooks mid-page
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Video/Content Engagement Gap detector...")
    opportunities = []
    
    query = f"""
    WITH page_engagement AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        AVG(avg_session_duration) as avg_duration,
        AVG(scroll_depth_avg) as avg_scroll_depth,
        SUM(scroll_depth_75) as scroll_75_count,
        SAFE_DIVIDE(SUM(scroll_depth_75), SUM(sessions)) * 100 as scroll_75_rate,
        AVG(avg_bounce_rate) as avg_bounce,
        AVG(conversion_rate) as avg_cvr,
        AVG(avg_engagement_rate) as avg_engagement
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type = 'page'
        AND sessions > 50
      GROUP BY canonical_entity_id
    ),
    site_stats AS (
      SELECT 
        AVG(avg_duration) as site_avg_duration,
        AVG(avg_scroll_depth) as site_avg_scroll,
        AVG(scroll_75_rate) as site_avg_scroll_75
      FROM page_engagement
    )
    SELECT 
      p.*,
      s.site_avg_duration,
      s.site_avg_scroll,
      s.site_avg_scroll_75,
      PERCENT_RANK() OVER (ORDER BY p.total_sessions) as traffic_percentile
    FROM page_engagement p
    CROSS JOIN site_stats s
    WHERE p.total_sessions >= 200
      AND (
        -- Decent time but low scroll depth (engaging with top but not scrolling)
        (p.avg_duration > 30 AND p.avg_scroll_depth < s.site_avg_scroll * 0.7)
        OR
        -- Low 75% scroll rate (users drop off mid-page)
        (p.scroll_75_rate IS NOT NULL AND p.scroll_75_rate < 20 AND p.avg_duration > 20)
        OR
        -- High engagement but low scroll (video/interactive at top consuming attention)
        (p.avg_engagement > 0.5 AND p.avg_scroll_depth < 40 AND p.total_sessions > 500)
      )
    ORDER BY p.total_sessions DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            sessions = int(row.total_sessions)
            duration = float(row.avg_duration) if row.avg_duration else 0
            scroll = float(row.avg_scroll_depth) if row.avg_scroll_depth else 0
            scroll_75 = float(row.scroll_75_rate) if row.scroll_75_rate else 0
            bounce = float(row.avg_bounce) if row.avg_bounce else 50
            cvr = float(row.avg_cvr) if row.avg_cvr else 0
            site_scroll = float(row.site_avg_scroll) if row.site_avg_scroll else scroll
            
            # Calculate engagement gap
            not_scrolling_75 = int(sessions * (1 - scroll_75/100))
            scroll_gap = site_scroll - scroll if site_scroll > scroll else 0
            
            # Determine the pattern
            if duration > 45 and scroll < 40:
                pattern = "spending time but not scrolling"
                hypothesis = "Users engage with top content (possibly video/hero) but don't explore further. Content below fold may not be compelling or visible."
            elif scroll_75 < 20:
                pattern = f"only {scroll_75:.0f}% reach mid-page"
                hypothesis = "Major drop-off mid-page. Content hook may be weak, or there's a visual break that stops engagement."
            else:
                pattern = f"scroll depth {scroll_gap:.0f}% below average"
                hypothesis = "Below-average scroll depth suggests content isn't compelling enough to continue reading."
            
            # Priority based on traffic
            if row.traffic_percentile >= 0.8:
                priority = "high"
            elif row.traffic_percentile >= 0.5:
                priority = "medium"
            else:
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "page_optimization",
                "type": "content_engagement_gap",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Content Drop-off: {pattern}",
                "description": f"Users spend {duration:.0f}s on page but only scroll {scroll:.0f}% ({pattern}). {not_scrolling_75:,} users never see content below mid-page. This often indicates video/content engagement issues or missing hooks.",
                "evidence": {
                    "sessions": sessions,
                    "avg_duration_seconds": duration,
                    "avg_scroll_depth": scroll,
                    "scroll_75_rate": scroll_75,
                    "site_avg_scroll": site_scroll,
                    "bounce_rate": bounce,
                    "conversion_rate": cvr,
                    "users_not_scrolling_75": not_scrolling_75,
                    "traffic_percentile": float(row.traffic_percentile)
                },
                "metrics": {
                    "scroll_depth": scroll,
                    "session_duration": duration,
                    "sessions": sessions
                },
                "hypothesis": hypothesis,
                "confidence_score": 0.72,
                "potential_impact_score": min(95, 50 + scroll_gap),
                "urgency_score": 65 if priority == "high" else 50,
                "recommended_actions": [
                    "Add compelling content/hook at 50% scroll point",
                    "Break up long content with visuals or CTAs",
                    "If video exists, add chapters or progress indicator",
                    "Test lazy-loading for below-fold content",
                    "Add scroll indicators or navigation aids",
                    "Review if important CTAs are below drop-off point",
                    f"Impact: {not_scrolling_75:,} users missing bottom content"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} content engagement gaps")
        else:
            logger.info("✅ No content engagement gaps detected")
            
    except Exception as e:
        logger.error(f"❌ Video/Content Engagement Gap detector error: {e}")
    
    return opportunities
