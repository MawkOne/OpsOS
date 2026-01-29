"""
Internal Link Opportunities Detector

Detects: Pages with broken internal links or poor internal linking
Layer: strategic
Category: seo
Data Source: DataForSEO broken links detection
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_internal_link_opportunities(organization_id: str) -> list:
    """
    Detect pages with broken links or internal linking opportunities
    """
    bq_client = bigquery.Client()
    logger.info(f"🔍 Running Internal Link Opportunities detector...")
    
    opportunities = []
    
    query = f"""
    WITH latest_links AS (
      SELECT 
        canonical_entity_id,
        date,
        broken_links_count,
        pageviews,
        sessions,
        seo_position,
        seo_search_volume,
        onpage_score,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND broken_links_count IS NOT NULL
    )
    SELECT 
      canonical_entity_id,
      broken_links_count,
      pageviews,
      sessions,
      seo_position,
      seo_search_volume,
      onpage_score
    FROM latest_links
    WHERE rn = 1
      AND broken_links_count > 0  -- Has broken links
      AND pageviews > 5  -- Has traffic
    ORDER BY 
      broken_links_count DESC,  -- Most broken links first
      pageviews DESC  -- Then by traffic
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
            broken_count = int(row.broken_links_count)
            
            # Determine severity and priority
            if broken_count > 10 or row.pageviews > 500:
                priority = "high"
                severity = "critical"
            elif broken_count > 5 or row.pageviews > 100:
                priority = "medium"
                severity = "significant"
            else:
                priority = "medium"
                severity = "moderate"
            
            # Build description
            impact_description = []
            if row.seo_position and row.seo_position < 20:
                impact_description.append(f"ranking in top 20 (position {row.seo_position:.0f})")
            if row.pageviews > 100:
                impact_description.append(f"{int(row.pageviews)} pageviews/week")
            
            impact_text = " with " + ", ".join(impact_description) if impact_description else ""
            
            # Recommended actions
            actions = [
                f"Audit and fix all {broken_count} broken internal links",
                "Use 301 redirects for moved pages",
                "Update links to current URLs",
                "Remove or replace links to deleted content",
                "Implement automated broken link monitoring",
                "Improve internal linking to important pages",
                "Create hub pages for better link distribution",
                "Use descriptive anchor text for internal links"
            ]
            
            # Calculate potential impact
            # Broken links hurt crawlability and pass link equity
            impact_multiplier = 1 + (broken_count / 10)  # More broken links = bigger impact
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity",
                "type": "internal_link_opportunities",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"{broken_count} Broken Internal Links: {row.canonical_entity_id}",
                "description": f"Page{impact_text} has {broken_count} broken internal links affecting crawlability and user experience. {severity.title()} SEO impact.",
                "evidence": {
                    "broken_links_count": broken_count,
                    "pageviews": int(row.pageviews),
                    "sessions": int(row.sessions) if row.sessions else 0,
                    "seo_position": float(row.seo_position) if row.seo_position else None,
                    "seo_search_volume": int(row.seo_search_volume) if row.seo_search_volume else 0,
                    "onpage_score": float(row.onpage_score) if row.onpage_score else None,
                    "severity": severity
                },
                "metrics": {
                    "broken_links": broken_count,
                    "pageviews": int(row.pageviews),
                    "onpage_score": float(row.onpage_score) if row.onpage_score else None
                },
                "hypothesis": f"Fixing {broken_count} broken links will improve crawlability, user experience, and internal link equity flow",
                "confidence_score": 0.92,
                "potential_impact_score": min(90, 50 + (broken_count * 3) + (row.pageviews / 50)),
                "urgency_score": 80 if severity == "critical" else 65,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium" if broken_count <= 10 else "high",
                "estimated_timeline": "1-3 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with broken internal links")
        else:
            logger.info("✅ No broken internal links detected")
            
    except Exception as e:
        logger.error(f"❌ Internal Link Opportunities detector failed: {e}")
    
    return opportunities
