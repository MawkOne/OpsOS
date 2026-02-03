"""
Republishing Opportunities Detector

Detects: Old high-performing content that could benefit from republishing/updating
Layer: strategic
Category: content
Data Source: Content age + performance history
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_republishing_opportunities(organization_id: str) -> list:
    """Identify old content worth updating and republishing"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Republishing Opportunities detector...")
    
    opportunities = []
    
    query = f"""
    WITH content_age_and_performance AS (
      SELECT 
        canonical_entity_id,
        publish_date,
        last_update_date,
        content_type,
        DATE_DIFF(CURRENT_DATE(), COALESCE(last_update_date, publish_date), DAY) as days_since_update,
        -- Recent 30 days performance
        SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) 
            THEN pageviews ELSE 0 END) as recent_pageviews,
        SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) 
            THEN conversions ELSE 0 END) as recent_conversions,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) 
            THEN engagement_rate END) as recent_engagement,
        -- Historical peak (90-365 days ago)
        MAX(CASE WHEN date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY) 
                                  AND DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
            THEN pageviews ELSE 0 END) as peak_daily_pageviews,
        AVG(CASE WHEN date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY) 
                                  AND DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
            THEN pageviews END) as avg_historical_pageviews
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
        AND (publish_date IS NOT NULL OR last_update_date IS NOT NULL)
      GROUP BY 
        canonical_entity_id,
        publish_date,
        last_update_date,
        content_type
      HAVING 
        days_since_update > 180  -- Not updated in 6+ months
        AND recent_pageviews > 50  -- Still getting decent traffic
        AND peak_daily_pageviews > 0  -- Had historical performance
    )
    SELECT 
      canonical_entity_id,
      publish_date,
      last_update_date,
      content_type,
      days_since_update,
      recent_pageviews,
      recent_conversions,
      recent_engagement,
      peak_daily_pageviews,
      avg_historical_pageviews,
      -- Calculate opportunity score
      recent_pageviews * (days_since_update / 365.0) as republish_score
    FROM content_age_and_performance
    WHERE 
      peak_daily_pageviews > recent_pageviews / 30  -- Used to perform better
      OR (avg_historical_pageviews IS NOT NULL 
          AND avg_historical_pageviews > (recent_pageviews / 30) * 1.5)  -- 50% better historically
    ORDER BY 
      republish_score DESC,
      recent_pageviews DESC
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
            days_old = int(row.days_since_update)
            years_old = days_old / 365.25
            content_type = row.content_type or "page"
            
            # Determine priority
            if row.recent_pageviews > 500 or days_old > 730:  # High traffic or 2+ years old
                priority = "high"
            elif row.recent_pageviews > 200 or days_old > 545:  # Medium traffic or 1.5+ years
                priority = "medium"
            else:
                priority = "low"
            
            # Build recommended actions
            actions = [
                f"Update {content_type.lower()} with latest information and statistics",
                "Refresh all screenshots, images, and examples",
                "Add new sections covering recent developments",
                "Update copyright date and republish with current date",
                "Promote updated content via email and social",
                "Update internal links to other relevant content",
                "Check and fix any broken external links",
                "Improve SEO optimization based on current keywords"
            ]
            
            # Estimate potential traffic boost
            if row.avg_historical_pageviews:
                potential_boost_pct = ((row.avg_historical_pageviews * 30 / row.recent_pageviews) - 1) * 100
            else:
                potential_boost_pct = 50  # Conservative estimate
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "content_opportunity",
                "type": "republishing_opportunities",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Republish Opportunity ({years_old:.1f}yr old): {row.canonical_entity_id}",
                "description": f"{content_type.title()} hasn't been updated in {days_old:,} days but still gets {int(row.recent_pageviews)} pageviews/month. Updating could boost traffic {potential_boost_pct:.0f}%+.",
                "evidence": {
                    "publish_date": row.publish_date.isoformat() if row.publish_date else None,
                    "last_update_date": row.last_update_date.isoformat() if row.last_update_date else None,
                    "days_since_update": days_old,
                    "years_since_update": round(years_old, 2),
                    "recent_pageviews_30d": int(row.recent_pageviews),
                    "recent_conversions_30d": int(row.recent_conversions) if row.recent_conversions else 0,
                    "recent_engagement_rate": float(row.recent_engagement) if row.recent_engagement else None,
                    "peak_daily_pageviews": int(row.peak_daily_pageviews),
                    "avg_historical_pageviews": float(row.avg_historical_pageviews) if row.avg_historical_pageviews else None,
                    "potential_boost_pct": round(potential_boost_pct, 1),
                    "content_type": content_type,
                    "republish_score": float(row.republish_score)
                },
                "metrics": {
                    "days_since_update": days_old,
                    "current_monthly_pageviews": int(row.recent_pageviews),
                    "peak_pageviews": int(row.peak_daily_pageviews)
                },
                "hypothesis": f"Updating and republishing this {years_old:.1f}-year-old content will restore historical traffic levels and boost SEO rankings",
                "confidence_score": 0.82,
                "potential_impact_score": min(90, 60 + (min(row.recent_pageviews / 100, 20)) + (min(days_old / 100, 10))),
                "urgency_score": 70 if priority == "high" else 55,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium",
                "estimated_timeline": "1-3 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} republishing opportunities")
        else:
            logger.info("✅ No republishing opportunities detected")
            
    except Exception as e:
        logger.error(f"❌ Republishing Opportunities detector failed: {e}")
    
    return opportunities
