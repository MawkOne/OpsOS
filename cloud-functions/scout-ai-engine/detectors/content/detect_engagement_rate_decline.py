"""
Engagement Rate Decline Detector

Detects: Content with declining engagement rate (engaged sessions / total sessions)
Layer: trend
Category: content
Data Source: GA4 engagement metrics
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_engagement_rate_decline(organization_id: str) -> list:
    """Detect content with declining engagement rate"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Engagement Rate Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH weekly_engagement AS (
      SELECT 
        m.canonical_entity_id,
        m.content_type,
        DATE_TRUNC(m.date, WEEK) as week,
        AVG(m.engagement_rate) as avg_engagement_rate,
        AVG(m.bounce_rate) as avg_bounce_rate,
        SUM(m.pageviews) as pageviews,
        SUM(m.sessions) as sessions,
        SUM(m.conversions) as conversions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      WHERE m.organization_id = @org_id
        AND m.entity_type = 'page'
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 WEEK)
        AND m.engagement_rate IS NOT NULL
        AND m.sessions > 3
      GROUP BY m.canonical_entity_id, m.content_type, week
    ),
    recent_vs_previous AS (
      SELECT 
        canonical_entity_id,
        content_type,
        -- Recent 2 weeks
        AVG(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN avg_engagement_rate END) as recent_engagement,
        AVG(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN avg_bounce_rate END) as recent_bounce,
        SUM(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN pageviews END) as recent_pageviews,
        SUM(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN sessions END) as recent_sessions,
        -- Previous 4 weeks
        AVG(CASE WHEN week < DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
                 AND week >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 WEEK)
            THEN avg_engagement_rate END) as baseline_engagement,
        AVG(CASE WHEN week < DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
                 AND week >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 WEEK)
            THEN avg_bounce_rate END) as baseline_bounce
      FROM weekly_engagement
      GROUP BY canonical_entity_id, content_type
      HAVING recent_engagement IS NOT NULL 
        AND baseline_engagement IS NOT NULL
    )
    SELECT 
      canonical_entity_id,
      content_type,
      recent_engagement,
      baseline_engagement,
      recent_bounce,
      baseline_bounce,
      recent_pageviews,
      recent_sessions,
      -- Calculate changes
      recent_engagement - baseline_engagement as engagement_change,
      SAFE_DIVIDE((recent_engagement - baseline_engagement) * 100.0, NULLIF(baseline_engagement, 0)) as engagement_pct_change
    FROM recent_vs_previous
    WHERE recent_engagement < baseline_engagement  -- Declining
      AND baseline_engagement > 20  -- Baseline was meaningful
      AND SAFE_DIVIDE((baseline_engagement - recent_engagement) * 100.0, NULLIF(baseline_engagement, 0)) > 15  -- >15% decline
      AND recent_sessions > 15  -- Meaningful traffic
    ORDER BY 
      recent_pageviews DESC,
      ABS(engagement_pct_change) DESC
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
            decline_pct = abs(float(row.engagement_pct_change))
            
            # Determine severity
            if decline_pct > 30 or row.recent_pageviews > 500:
                priority = "high"
                severity = "critical"
            elif decline_pct > 20:
                priority = "medium"
                severity = "significant"
            else:
                priority = "medium"
                severity = "moderate"
            
            content_type = row.content_type or "page"
            
            # Build recommended actions
            actions = [
                f"Analyze why engagement dropped from {row.baseline_engagement:.1f}% to {row.recent_engagement:.1f}%",
                "Improve content hook and introduction to capture attention",
                "Add more interactive elements (CTAs, forms, quizzes)",
                "Enhance visual appeal with better images/formatting",
                "Check if content matches search intent",
                "Add related content recommendations",
                "Improve page load speed",
                "Test different content layouts"
            ]
            
            # Check if bounce rate also increased
            bounce_increased = row.recent_bounce and row.baseline_bounce and row.recent_bounce > row.baseline_bounce
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "content_opportunity",
                "type": "engagement_rate_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Engagement Declining {decline_pct:.0f}%: {row.canonical_entity_id}",
                "description": f"{content_type.title()} engagement rate dropped from {row.baseline_engagement:.1f}% to {row.recent_engagement:.1f}%. {'Bounce rate also increased. ' if bounce_increased else ''}Users less engaged with content.",
                "evidence": {
                    "recent_engagement_rate": float(row.recent_engagement),
                    "baseline_engagement_rate": float(row.baseline_engagement),
                    "engagement_decline_pct": decline_pct,
                    "recent_bounce_rate": float(row.recent_bounce) if row.recent_bounce else None,
                    "baseline_bounce_rate": float(row.baseline_bounce) if row.baseline_bounce else None,
                    "bounce_increased": bounce_increased,
                    "recent_pageviews": int(row.recent_pageviews),
                    "recent_sessions": int(row.recent_sessions),
                    "content_type": content_type,
                    "severity": severity
                },
                "metrics": {
                    "current_engagement_rate": float(row.recent_engagement),
                    "previous_engagement_rate": float(row.baseline_engagement),
                    "decline_percentage": decline_pct,
                    "pageviews": int(row.recent_pageviews)
                },
                "hypothesis": f"Improving content engagement will restore rate to {row.baseline_engagement:.1f}%+ and improve conversion potential",
                "confidence_score": 0.88,
                "potential_impact_score": min(95, 60 + (decline_pct / 2) + (row.recent_pageviews / 100)),
                "urgency_score": 80 if severity == "critical" else 65,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with declining engagement")
        else:
            logger.info("✅ No engagement rate decline detected")
            
    except Exception as e:
        logger.error(f"❌ Engagement Rate Decline detector failed: {e}")
    
    return opportunities
