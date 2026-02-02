"""
Dwell Time Decline Detector

Detects: Content with declining average time on page (dwell time)
Layer: trend
Category: content
Data Source: GA4 user engagement duration per page
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_dwell_time_decline(organization_id: str) -> list:
    """Detect content pages with declining dwell time indicating engagement issues"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Dwell Time Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH weekly_dwell AS (
      SELECT 
        canonical_entity_id,
        content_type,
        DATE_TRUNC(date, WEEK) as week,
        AVG(dwell_time) as avg_dwell_time,
        SUM(pageviews) as pageviews,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 WEEK)
        AND dwell_time IS NOT NULL
        AND pageviews > 5
      GROUP BY canonical_entity_id, content_type, week
    ),
    recent_vs_previous AS (
      SELECT 
        canonical_entity_id,
        content_type,
        -- Recent 2 weeks
        AVG(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN avg_dwell_time END) as recent_dwell,
        SUM(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN pageviews END) as recent_pageviews,
        SUM(CASE WHEN week >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
            THEN conversions END) as recent_conversions,
        -- Previous 4 weeks (baseline)
        AVG(CASE WHEN week < DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
                 AND week >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 WEEK)
            THEN avg_dwell_time END) as baseline_dwell,
        SUM(CASE WHEN week < DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK) 
                 AND week >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 WEEK)
            THEN pageviews END) as baseline_pageviews
      FROM weekly_dwell
      GROUP BY canonical_entity_id, content_type
      HAVING recent_dwell IS NOT NULL 
        AND baseline_dwell IS NOT NULL
        AND baseline_dwell > 10  -- Baseline > 10 seconds
    )
    SELECT 
      canonical_entity_id,
      content_type,
      recent_dwell,
      baseline_dwell,
      recent_pageviews,
      recent_conversions,
      -- Calculate decline percentage
      SAFE_DIVIDE((recent_dwell - baseline_dwell) * 100.0, baseline_dwell) as dwell_pct_change,
      recent_dwell - baseline_dwell as dwell_absolute_change
    FROM recent_vs_previous
    WHERE recent_dwell < baseline_dwell  -- Declining
      AND SAFE_DIVIDE((baseline_dwell - recent_dwell) * 100.0, baseline_dwell) > 15  -- >15% decline
      AND recent_pageviews > 20  -- Meaningful traffic
    ORDER BY 
      recent_pageviews DESC,
      ABS(dwell_pct_change) DESC
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
            decline_pct = abs(float(row.dwell_pct_change))
            
            # Determine severity
            if decline_pct > 40 or row.recent_pageviews > 500:
                priority = "high"
                severity = "severe"
            elif decline_pct > 25 or row.recent_pageviews > 200:
                priority = "medium"
                severity = "significant"
            else:
                priority = "medium"
                severity = "moderate"
            
            content_type = row.content_type or "page"
            
            # Build recommended actions
            actions = [
                "Review content quality and depth - may be too thin",
                "Check if content answers user's search intent",
                "Improve content structure with better headings and formatting",
                "Add more engaging media (images, videos, infographics)",
                "Update outdated information or statistics",
                "Improve readability (shorter paragraphs, bullet points)",
                "Add internal links to related content",
                "Check for technical issues (slow load, broken elements)"
            ]
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "content_opportunity",
                "type": "dwell_time_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Dwell Time Declining {decline_pct:.0f}%: {row.canonical_entity_id}",
                "description": f"{content_type.title()} dwell time dropped from {row.baseline_dwell:.0f}s to {row.recent_dwell:.0f}s ({decline_pct:.0f}% decline). Users spending less time engaging with content.",
                "evidence": {
                    "recent_dwell_seconds": float(row.recent_dwell),
                    "baseline_dwell_seconds": float(row.baseline_dwell),
                    "dwell_decline_pct": decline_pct,
                    "dwell_decline_seconds": abs(float(row.dwell_absolute_change)),
                    "recent_pageviews": int(row.recent_pageviews),
                    "recent_conversions": int(row.recent_conversions) if row.recent_conversions else 0,
                    "content_type": content_type,
                    "severity": severity
                },
                "metrics": {
                    "current_dwell_time": float(row.recent_dwell),
                    "previous_dwell_time": float(row.baseline_dwell),
                    "decline_percentage": decline_pct,
                    "pageviews": int(row.recent_pageviews)
                },
                "hypothesis": f"Improving content depth and engagement will restore dwell time to {row.baseline_dwell:.0f}s+ and boost SEO signals",
                "confidence_score": 0.85,
                "potential_impact_score": min(90, 55 + (decline_pct / 2) + (row.recent_pageviews / 100)),
                "urgency_score": 75 if severity == "severe" else 60,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with declining dwell time")
        else:
            logger.info("✅ No dwell time decline detected")
            
    except Exception as e:
        logger.error(f"❌ Dwell Time Decline detector failed: {e}")
    
    return opportunities
