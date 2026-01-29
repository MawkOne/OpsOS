"""
Content Freshness Decay Detector

Detects: Pages with declining traffic/rankings indicating content decay
Layer: strategic
Category: seo
Data Source: Traffic trend analysis (pageviews, position changes over time)
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os
from ..utils.priority_pages import get_priority_pages_only_clause

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_content_freshness_decay(organization_id: str, priority_pages_only: bool = False) -> list:
    """Detect pages with old content that may benefit from updates"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Content Freshness Decay detector...")
    
    opportunities = []
    
    # Get priority filter if needed
    priority_filter = get_priority_pages_only_clause(priority_pages_only)
    
    query = f"""
    WITH page_trends AS (
      SELECT 
        canonical_entity_id,
        -- Recent 7 days
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN pageviews END) as pageviews_recent,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN seo_position END) as position_recent,
        -- 30 days ago (historical)
        AVG(CASE WHEN date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN pageviews END) as pageviews_historical,
        AVG(CASE WHEN date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN seo_position END) as position_historical,
        -- Current data
        MAX(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN seo_search_volume END) as search_volume,
        MAX(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN content_type END) as content_type,
        MAX(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN publish_date END) as publish_date,
        MAX(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN last_update_date END) as last_update_date,
        SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN sessions END) as total_sessions,
        SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN conversions END) as total_conversions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY)
        {priority_filter}
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      pageviews_recent,
      pageviews_historical,
      position_recent,
      position_historical,
      search_volume,
      content_type,
      publish_date,
      last_update_date,
      total_sessions,
      total_conversions,
      -- Calculate decay metrics
      (pageviews_historical - pageviews_recent) as pageviews_decline,
      SAFE_DIVIDE((pageviews_historical - pageviews_recent) * 100.0, NULLIF(pageviews_historical, 0)) as decline_pct,
      (position_recent - position_historical) as position_drop
    FROM page_trends
    WHERE pageviews_recent > 5  -- Has some traffic
      AND pageviews_historical > 0  -- Had historical traffic
      AND (
        -- Traffic declining significantly
        SAFE_DIVIDE((pageviews_historical - pageviews_recent) * 100.0, NULLIF(pageviews_historical, 0)) > 30
        -- OR position dropping
        OR (position_recent - position_historical) > 5
      )
    ORDER BY 
      decline_pct DESC,
      pageviews_historical DESC
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
            decline_pct = float(row.decline_pct) if row.decline_pct else 0
            pageviews_decline = int(row.pageviews_decline) if row.pageviews_decline else 0
            position_drop = float(row.position_drop) if row.position_drop else 0
            
            # Determine urgency based on decline severity and traffic
            if decline_pct > 50 or row.pageviews_historical > 500:
                priority = "high"
                urgency = "urgent"
            elif decline_pct > 30:
                priority = "medium"
                urgency = "soon"
            else:
                priority = "medium"
                urgency = "moderate"
            
            # Infer content type from URL if not set
            content_type = row.content_type or "page"
            url_lower = row.canonical_entity_id.lower()
            if not row.content_type:
                if '/blog/' in url_lower or '/article/' in url_lower:
                    content_type = "blog"
                elif '/guide/' in url_lower or '/tutorial/' in url_lower:
                    content_type = "guide"
            
            # Build recommended actions
            actions = [
                "Investigate cause of traffic decline",
                "Update content with fresh information and examples",
                "Improve content depth and comprehensiveness",
                "Optimize for current search intent",
                "Add recent statistics and data",
                "Check for technical SEO issues",
                "Review and update internal links",
                "Consider content refresh or republishing"
            ]
            
            # Build decline description
            decline_parts = []
            if decline_pct > 0:
                decline_parts.append(f"{decline_pct:.0f}% traffic decline")
            if position_drop > 0:
                decline_parts.append(f"position dropped {position_drop:.0f} spots")
            
            decline_text = " - ".join(decline_parts) if decline_parts else "declining engagement"
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity",
                "type": "content_freshness_decay",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Content Decay: {row.canonical_entity_id[:60]}",
                "description": f"Page experiencing {decline_text}. Recent traffic: {int(row.pageviews_recent)}/week (was {int(row.pageviews_historical)}/week). Content may need updating.",
                "evidence": {
                    "pageviews_recent": int(row.pageviews_recent),
                    "pageviews_historical": int(row.pageviews_historical),
                    "pageviews_decline": pageviews_decline,
                    "decline_percentage": decline_pct,
                    "position_recent": float(row.position_recent) if row.position_recent else None,
                    "position_historical": float(row.position_historical) if row.position_historical else None,
                    "position_drop": position_drop,
                    "content_type": content_type,
                    "search_volume": int(row.search_volume) if row.search_volume else 0,
                    "total_sessions": int(row.total_sessions) if row.total_sessions else 0,
                    "total_conversions": int(row.total_conversions) if row.total_conversions else 0,
                    "urgency": urgency,
                    "publish_date": row.publish_date.isoformat() if row.publish_date else None,
                    "last_update_date": row.last_update_date.isoformat() if row.last_update_date else None
                },
                "metrics": {
                    "decline_percentage": decline_pct,
                    "pageviews_recent": int(row.pageviews_recent),
                    "pageviews_lost": pageviews_decline
                },
                "hypothesis": f"Content showing signs of decay with {decline_pct:.0f}% traffic decline. Refreshing content will restore relevance and improve rankings.",
                "confidence_score": 0.82,
                "potential_impact_score": min(90, 50 + (decline_pct / 2)),
                "urgency_score": 80 if urgency == "urgent" else 65,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with content decay")
        else:
            logger.info("✅ No content decay detected")
            
    except Exception as e:
        logger.error(f"❌ Content Freshness Decay detector failed: {e}")
    
    return opportunities
