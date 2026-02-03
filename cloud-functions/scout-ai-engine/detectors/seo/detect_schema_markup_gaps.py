"""
Schema Markup Gaps Detector

Detects: Pages missing structured data (schema.org markup)
Layer: strategic
Category: seo
Data Source: DataForSEO technical checks
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_schema_markup_gaps(organization_id: str) -> list:
    """
    Detect high-value pages missing schema markup that could boost rich snippets
    """
    bq_client = bigquery.Client()
    logger.info(f"🔍 Running Schema Markup Gaps detector...")
    
    opportunities = []
    
    query = f"""
    WITH latest_pages AS (
      SELECT 
        canonical_entity_id,
        date,
        has_schema_markup,
        pageviews,
        sessions,
        conversions,
        seo_position,
        seo_search_volume,
        onpage_score,
        content_type,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND has_schema_markup IS NOT NULL
    )
    SELECT 
      canonical_entity_id,
      has_schema_markup,
      pageviews,
      sessions,
      conversions,
      seo_position,
      seo_search_volume,
      onpage_score,
      content_type
    FROM latest_pages
    WHERE rn = 1
      AND has_schema_markup = FALSE
      AND pageviews > 5  -- Only pages with traffic
      AND (
        seo_position IS NOT NULL  -- Ranking for keywords
        OR pageviews > 50  -- OR has decent traffic
        OR conversions > 0  -- OR drives conversions
      )
    ORDER BY 
      pageviews DESC,
      seo_search_volume DESC
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
            # Determine recommended schema types based on content type and URL patterns
            content_type = row.content_type or "page"
            recommended_schemas = []
            
            url_lower = row.canonical_entity_id.lower()
            
            if content_type == "blog" or "/blog/" in url_lower or "/article/" in url_lower:
                recommended_schemas = ["Article", "BlogPosting", "Organization", "BreadcrumbList"]
            elif content_type == "product" or "/product/" in url_lower:
                recommended_schemas = ["Product", "AggregateRating", "Offer", "BreadcrumbList"]
            elif "/faq" in url_lower or "faq" in url_lower:
                recommended_schemas = ["FAQPage", "Organization"]
            elif "/about" in url_lower:
                recommended_schemas = ["Organization", "Person"]
            elif "/contact" in url_lower:
                recommended_schemas = ["Organization", "LocalBusiness"]
            elif content_type == "video" or "/video/" in url_lower:
                recommended_schemas = ["VideoObject", "BreadcrumbList"]
            elif content_type == "case_study":
                recommended_schemas = ["Article", "Organization", "BreadcrumbList"]
            else:
                recommended_schemas = ["WebPage", "Organization", "BreadcrumbList"]
            
            # Calculate priority based on traffic and position
            if row.pageviews > 500 or (row.seo_search_volume and row.seo_search_volume > 1000):
                priority = "high"
            elif row.pageviews > 100 or row.conversions > 5:
                priority = "medium"
            else:
                priority = "low"
            
            # Build actions
            actions = [
                f"Add {recommended_schemas[0]} schema markup to page",
                "Include Organization schema for branding",
                "Add BreadcrumbList for navigation context",
                "Test markup with Google Rich Results Test",
                "Monitor Search Console for rich snippet eligibility",
                "Consider adding FAQ or HowTo schema if applicable"
            ]
            
            # Estimate CTR lift from rich snippets
            estimated_ctr_lift = "15-30%" if priority == "high" else "10-20%"
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "seo_opportunity",
                "type": "schema_markup_gaps",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Missing Schema Markup: {row.canonical_entity_id}",
                "description": f"Page with {int(row.pageviews)} pageviews/week lacks structured data. Adding {', '.join(recommended_schemas[:2])} schema could boost CTR by {estimated_ctr_lift}.",
                "evidence": {
                    "has_schema_markup": False,
                    "pageviews": int(row.pageviews),
                    "sessions": int(row.sessions) if row.sessions else 0,
                    "conversions": int(row.conversions) if row.conversions else 0,
                    "seo_position": float(row.seo_position) if row.seo_position else None,
                    "seo_search_volume": int(row.seo_search_volume) if row.seo_search_volume else 0,
                    "onpage_score": float(row.onpage_score) if row.onpage_score else None,
                    "content_type": content_type,
                    "recommended_schemas": recommended_schemas
                },
                "metrics": {
                    "pageviews": int(row.pageviews),
                    "search_volume": int(row.seo_search_volume) if row.seo_search_volume else 0,
                    "onpage_score": float(row.onpage_score) if row.onpage_score else None
                },
                "hypothesis": f"Adding {recommended_schemas[0]} schema will enable rich snippets, improving CTR and visibility in search results",
                "confidence_score": 0.8,
                "potential_impact_score": min(85, 50 + (row.pageviews / 50)),
                "urgency_score": 65 if priority == "high" else 50,
                "recommended_actions": actions[:5],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages missing schema markup")
        else:
            logger.info("✅ No schema markup gaps detected")
            
    except Exception as e:
        logger.error(f"❌ Schema Markup Gaps detector failed: {e}")
    
    return opportunities
