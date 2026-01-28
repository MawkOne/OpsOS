"""
Content Freshness Decay Detector

Detects: Pages with old/stale content that need updates
Layer: strategic
Category: seo
Data Source: DataForSEO publish_date / last_update_date
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_content_freshness_decay(organization_id: str) -> list:
    """Detect pages with old content that may benefit from updates"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Content Freshness Decay detector...")
    
    opportunities = []
    
    query = f"""
    WITH latest_content AS (
      SELECT 
        canonical_entity_id,
        date,
        publish_date,
        last_update_date,
        content_type,
        pageviews,
        sessions,
        seo_position,
        seo_search_volume,
        conversions,
        -- Calculate days since last update
        DATE_DIFF(CURRENT_DATE(), COALESCE(last_update_date, publish_date), DAY) as days_since_update,
        -- Calculate days since publish
        DATE_DIFF(CURRENT_DATE(), publish_date, DAY) as days_since_publish,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND (publish_date IS NOT NULL OR last_update_date IS NOT NULL)
    )
    SELECT 
      canonical_entity_id,
      publish_date,
      last_update_date,
      content_type,
      pageviews,
      sessions,
      seo_position,
      seo_search_volume,
      conversions,
      days_since_update,
      days_since_publish
    FROM latest_content
    WHERE rn = 1
      AND days_since_update > 365  -- Not updated in over a year
      AND pageviews > 10  -- Has traffic worth preserving
      AND (
        content_type IN ('blog', 'article', 'guide')  -- Content that becomes stale
        OR seo_position > 10  -- Or ranking but could improve
      )
    ORDER BY 
      pageviews DESC,  -- Prioritize high-traffic pages
      days_since_update DESC  -- Then oldest content
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
            days_old = int(row.days_since_update)
            years_old = days_old / 365.25
            
            # Determine urgency based on age and traffic
            if days_old > 730 or row.pageviews > 500:  # 2+ years or high traffic
                priority = "high"
                urgency = "urgent"
            elif days_old > 545:  # 1.5+ years
                priority = "medium"
                urgency = "soon"
            else:
                priority = "medium"
                urgency = "moderate"
            
            # Content freshness is more important for certain types
            content_type = row.content_type or "page"
            if content_type in ['blog', 'article', 'guide', 'tutorial']:
                freshness_importance = "critical"
            else:
                freshness_importance = "moderate"
            
            # Build recommended actions
            actions = [
                "Update statistics and data with current information",
                "Add recent examples and case studies",
                "Refresh outdated screenshots or media",
                "Check for broken external links",
                "Update copyright date and publish date",
                "Add new sections covering recent developments",
                "Improve content depth and comprehensiveness",
                "Optimize for current search intent"
            ]
            
            # Calculate impact - fresh content can boost rankings
            ranking_boost_potential = 5 if row.seo_position and row.seo_position < 20 else 10
            
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
                "title": f"Stale Content ({years_old:.1f}yr old): {row.canonical_entity_id}",
                "description": f"{content_type.title()} content hasn't been updated in {days_old:,} days ({years_old:.1f} years) despite {int(row.pageviews)} pageviews/week. Freshness is {freshness_importance} for this content type.",
                "evidence": {
                    "publish_date": row.publish_date.isoformat() if row.publish_date else None,
                    "last_update_date": row.last_update_date.isoformat() if row.last_update_date else None,
                    "days_since_update": days_old,
                    "years_since_update": round(years_old, 2),
                    "content_type": content_type,
                    "pageviews": int(row.pageviews),
                    "sessions": int(row.sessions) if row.sessions else 0,
                    "seo_position": float(row.seo_position) if row.seo_position else None,
                    "seo_search_volume": int(row.seo_search_volume) if row.seo_search_volume else 0,
                    "conversions": int(row.conversions) if row.conversions else 0,
                    "urgency": urgency,
                    "freshness_importance": freshness_importance
                },
                "metrics": {
                    "days_since_update": days_old,
                    "pageviews": int(row.pageviews),
                    "search_volume": int(row.seo_search_volume) if row.seo_search_volume else 0
                },
                "hypothesis": f"Updating {years_old:.1f}-year-old content will signal freshness to Google, potentially improving rankings by {ranking_boost_potential}+ positions",
                "confidence_score": 0.82,
                "potential_impact_score": min(90, 55 + (min(row.pageviews / 100, 20)) + (min(days_old / 100, 15))),
                "urgency_score": 75 if urgency == "urgent" else 60,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with stale content")
        else:
            logger.info("✅ No stale content detected")
            
    except Exception as e:
        logger.error(f"❌ Content Freshness Decay detector failed: {e}")
    
    return opportunities
