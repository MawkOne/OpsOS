"""
Technical SEO Health Score Detector

Detects: Pages with poor technical SEO health (low onpage_score)
Layer: fast
Category: seo
Data Source: DataForSEO onpage_score and technical checks
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_technical_seo_health_score(organization_id: str) -> list:
    """Detect pages with low technical SEO health scores needing fixes"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Technical SEO Health Score detector...")
    
    opportunities = []
    
    query = f"""
    WITH latest_health AS (
      SELECT 
        canonical_entity_id,
        date,
        onpage_score,
        broken_links_count,
        missing_meta_description,
        missing_h1_tag,
        duplicate_content_detected,
        page_size_bytes,
        pageviews,
        sessions,
        seo_position,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND onpage_score IS NOT NULL
    )
    SELECT 
      canonical_entity_id,
      onpage_score,
      broken_links_count,
      missing_meta_description,
      missing_h1_tag,
      duplicate_content_detected,
      page_size_bytes,
      pageviews,
      sessions,
      seo_position
    FROM latest_health
    WHERE rn = 1
      AND (
        onpage_score < 70  -- Poor overall health
        OR broken_links_count > 0  -- Has broken links
        OR missing_meta_description = TRUE  -- Missing meta description
        OR missing_h1_tag = TRUE  -- Missing H1
        OR duplicate_content_detected = TRUE  -- Duplicate content
      )
      AND pageviews > 5  -- Only pages with some traffic
    ORDER BY 
      pageviews DESC,  -- Prioritize high-traffic pages
      onpage_score ASC  -- Worst scores first
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
            score = float(row.onpage_score)
            
            # Count issues
            issues = []
            if score < 70:
                issues.append(f"Low SEO health score: {score:.0f}/100")
            if row.broken_links_count and row.broken_links_count > 0:
                issues.append(f"{row.broken_links_count} broken links")
            if row.missing_meta_description:
                issues.append("Missing meta description")
            if row.missing_h1_tag:
                issues.append("Missing H1 tag")
            if row.duplicate_content_detected:
                issues.append("Duplicate content detected")
            if row.page_size_bytes and row.page_size_bytes > 3000000:  # > 3MB
                issues.append(f"Large page size ({row.page_size_bytes / 1000000:.1f}MB)")
            
            issue_count = len(issues)
            
            # Determine priority
            if score < 50 or issue_count >= 3 or row.pageviews > 500:
                priority = "high"
                severity = "critical"
            elif score < 60 or issue_count >= 2:
                priority = "medium"
                severity = "significant"
            else:
                priority = "medium"
                severity = "moderate"
            
            # Build recommended actions
            actions = []
            if row.broken_links_count and row.broken_links_count > 0:
                actions.append(f"Fix {row.broken_links_count} broken links")
            if row.missing_meta_description:
                actions.append("Add compelling meta description (155-160 characters)")
            if row.missing_h1_tag:
                actions.append("Add H1 tag with primary keyword")
            if row.duplicate_content_detected:
                actions.append("Resolve duplicate content with canonical tags or 301 redirects")
            if row.page_size_bytes and row.page_size_bytes > 3000000:
                actions.append("Optimize page size (compress images, minify code)")
            
            # Generic technical SEO actions
            actions.extend([
                "Validate HTML and fix errors",
                "Improve internal linking structure",
                "Optimize image alt text",
                "Ensure mobile responsiveness",
                "Check robots.txt and sitemap inclusion"
            ])
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity",
                "type": "technical_seo_health_score",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Technical SEO Issues: {row.canonical_entity_id}",
                "description": f"Page has {issue_count} technical SEO issues affecting health score ({score:.0f}/100): {', '.join(issues[:3])}",
                "evidence": {
                    "onpage_score": score,
                    "broken_links_count": int(row.broken_links_count) if row.broken_links_count else 0,
                    "missing_meta_description": bool(row.missing_meta_description),
                    "missing_h1_tag": bool(row.missing_h1_tag),
                    "duplicate_content_detected": bool(row.duplicate_content_detected),
                    "page_size_bytes": int(row.page_size_bytes) if row.page_size_bytes else None,
                    "pageviews": int(row.pageviews),
                    "sessions": int(row.sessions) if row.sessions else 0,
                    "seo_position": float(row.seo_position) if row.seo_position else None,
                    "issue_count": issue_count,
                    "severity": severity,
                    "issues_list": issues
                },
                "metrics": {
                    "onpage_score": score,
                    "issue_count": issue_count,
                    "pageviews": int(row.pageviews),
                    "broken_links": int(row.broken_links_count) if row.broken_links_count else 0
                },
                "hypothesis": f"Fixing {issue_count} technical issues will improve SEO health from {score:.0f} to 80+ and boost search visibility",
                "confidence_score": 0.9,
                "potential_impact_score": min(95, 50 + (issue_count * 10) + (row.pageviews / 50)),
                "urgency_score": 85 if severity == "critical" else 70,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium" if issue_count <= 3 else "high",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with technical SEO issues")
        else:
            logger.info("✅ No technical SEO issues detected")
            
    except Exception as e:
        logger.error(f"❌ Technical SEO Health Score detector failed: {e}")
    
    return opportunities
