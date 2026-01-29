"""
Core Web Vitals Failing Detector

Detects: Pages with poor Core Web Vitals (LCP, FID, CLS)
Layer: fast
Category: seo
Data Source: DataForSEO page_timing metrics
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os
import sys

# Add parent directory to path to import utils
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.priority_pages import get_priority_pages_only_clause

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_core_web_vitals_failing(organization_id: str, priority_pages_only: bool = False) -> list:
    """
    Detect pages with failing Core Web Vitals that need performance optimization
    
    Args:
        organization_id: Organization ID to analyze
        priority_pages_only: If True, only analyze priority pages
    """
    bq_client = bigquery.Client()
    logger.info(f"🔍 Running Core Web Vitals Failing detector (priority_pages_only={priority_pages_only})...")
    
    opportunities = []
    
    # Build priority pages filter
    priority_filter = ""
    if priority_pages_only:
        priority_filter = f"AND {get_priority_pages_only_clause()}"
        logger.info("Focusing analysis on priority pages only")
    
    # Core Web Vitals thresholds (Google's standards):
    # LCP: < 2.5s (good), 2.5-4s (needs improvement), > 4s (poor)
    # FID: < 100ms (good), 100-300ms (needs improvement), > 300ms (poor)
    # CLS: < 0.1 (good), 0.1-0.25 (needs improvement), > 0.25 (poor)
    
    query = f"""
    WITH latest_vitals AS (
      SELECT 
        canonical_entity_id,
        date,
        core_web_vitals_lcp,
        core_web_vitals_fid,
        core_web_vitals_cls,
        pageviews,
        sessions,
        conversions,
        onpage_score,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND core_web_vitals_lcp IS NOT NULL
        {priority_filter}
    )
    SELECT 
      canonical_entity_id,
      core_web_vitals_lcp,
      core_web_vitals_fid,
      core_web_vitals_cls,
      pageviews,
      sessions,
      conversions,
      onpage_score,
      -- Failure flags
      CASE 
        WHEN core_web_vitals_lcp > 4000 THEN 'poor'
        WHEN core_web_vitals_lcp > 2500 THEN 'needs_improvement'
        ELSE 'good'
      END as lcp_status,
      CASE 
        WHEN core_web_vitals_fid > 300 THEN 'poor'
        WHEN core_web_vitals_fid > 100 THEN 'needs_improvement'
        ELSE 'good'
      END as fid_status,
      CASE 
        WHEN core_web_vitals_cls > 0.25 THEN 'poor'
        WHEN core_web_vitals_cls > 0.1 THEN 'needs_improvement'
        ELSE 'good'
      END as cls_status
    FROM latest_vitals
    WHERE rn = 1
      AND (
        core_web_vitals_lcp > 2500  -- LCP needs improvement or poor
        OR core_web_vitals_fid > 100  -- FID needs improvement or poor
        OR core_web_vitals_cls > 0.1  -- CLS needs improvement or poor
      )
      AND pageviews > 10  -- Only pages with meaningful traffic
    ORDER BY 
      pageviews DESC,  -- Prioritize high-traffic pages
      core_web_vitals_lcp DESC
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
            # Calculate priority based on traffic and severity
            failing_count = sum([
                1 if row.lcp_status == 'poor' else 0,
                1 if row.fid_status == 'poor' else 0,
                1 if row.cls_status == 'poor' else 0
            ])
            
            priority = "high" if failing_count >= 2 or row.pageviews > 1000 else "medium"
            
            # Build failure details
            failures = []
            if row.lcp_status != 'good':
                failures.append(f"LCP: {row.core_web_vitals_lcp/1000:.2f}s ({row.lcp_status})")
            if row.fid_status != 'good':
                failures.append(f"FID: {row.core_web_vitals_fid:.0f}ms ({row.fid_status})")
            if row.cls_status != 'good':
                failures.append(f"CLS: {row.core_web_vitals_cls:.3f} ({row.cls_status})")
            
            # Build recommended actions
            actions = []
            if row.lcp_status != 'good':
                actions.extend([
                    "Optimize largest contentful paint (LCP)",
                    "Compress and optimize images",
                    "Minimize render-blocking resources",
                    "Use CDN for faster asset delivery"
                ])
            if row.fid_status != 'good':
                actions.extend([
                    "Reduce JavaScript execution time",
                    "Break up long tasks",
                    "Minimize main thread work"
                ])
            if row.cls_status != 'good':
                actions.extend([
                    "Add size attributes to images and videos",
                    "Avoid inserting content above existing content",
                    "Use transform animations instead of layout shifts"
                ])
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity",
                "type": "core_web_vitals_failing",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Core Web Vitals Failing: {row.canonical_entity_id}",
                "description": f"Page has {len(failures)} failing Core Web Vitals metrics affecting SEO and user experience. {', '.join(failures)}",
                "evidence": {
                    "lcp_ms": float(row.core_web_vitals_lcp) if row.core_web_vitals_lcp else None,
                    "fid_ms": float(row.core_web_vitals_fid) if row.core_web_vitals_fid else None,
                    "cls_score": float(row.core_web_vitals_cls) if row.core_web_vitals_cls else None,
                    "lcp_status": row.lcp_status,
                    "fid_status": row.fid_status,
                    "cls_status": row.cls_status,
                    "pageviews": int(row.pageviews),
                    "conversions": int(row.conversions) if row.conversions else 0,
                    "failing_metrics_count": failing_count
                },
                "metrics": {
                    "lcp": float(row.core_web_vitals_lcp) if row.core_web_vitals_lcp else None,
                    "fid": float(row.core_web_vitals_fid) if row.core_web_vitals_fid else None,
                    "cls": float(row.core_web_vitals_cls) if row.core_web_vitals_cls else None,
                    "pageviews": int(row.pageviews),
                    "onpage_score": float(row.onpage_score) if row.onpage_score else None
                },
                "hypothesis": f"Improving Core Web Vitals will boost SEO rankings and user experience for this {int(row.pageviews)} pageview/week page",
                "confidence_score": 0.9,  # High confidence - direct Google ranking factor
                "potential_impact_score": min(95, 60 + (failing_count * 10) + (min(row.pageviews / 100, 25))),
                "urgency_score": 75 if failing_count >= 2 else 60,
                "recommended_actions": actions[:5],  # Top 5 actions
                "estimated_effort": "high" if failing_count >= 2 else "medium",
                "estimated_timeline": "4-8 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with failing Core Web Vitals")
        else:
            logger.info("✅ No Core Web Vitals issues detected")
            
    except Exception as e:
        logger.error(f"❌ Core Web Vitals detector failed: {e}")
    
    return opportunities
