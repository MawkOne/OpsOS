"""
Backlink Quality Decline Detector

Detects: Pages/domains losing backlinks or referring domains
Layer: trend
Category: seo
Data Source: DataForSEO backlinks API
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_backlink_quality_decline(organization_id: str) -> list:
    """Detect pages experiencing backlink loss or declining domain authority"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Backlink Quality Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH backlink_trends AS (
      SELECT 
        m.canonical_entity_id,
        m.date,
        m.backlinks_total,
        m.referring_domains,
        m.domain_rank,
        m.seo_position,
        m.pageviews,
        LAG(m.backlinks_total, 7) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.date) as backlinks_7d_ago,
        LAG(m.referring_domains, 7) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.date) as domains_7d_ago,
        LAG(m.domain_rank, 7) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.date) as rank_7d_ago
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      WHERE m.organization_id = @org_id
        AND m.entity_type = 'page'
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND m.backlinks_total IS NOT NULL
    ),
    latest_with_change AS (
      SELECT 
        canonical_entity_id,
        backlinks_total,
        referring_domains,
        domain_rank,
        seo_position,
        pageviews,
        backlinks_7d_ago,
        domains_7d_ago,
        rank_7d_ago,
        backlinks_total - COALESCE(backlinks_7d_ago, backlinks_total) as backlinks_change,
        referring_domains - COALESCE(domains_7d_ago, referring_domains) as domains_change,
        COALESCE(domain_rank, 0) - COALESCE(rank_7d_ago, 0) as rank_change,
        -- Calculate decline percentage
        SAFE_DIVIDE(
          (backlinks_total - COALESCE(backlinks_7d_ago, backlinks_total)) * 100.0,
          NULLIF(backlinks_7d_ago, 0)
        ) as backlinks_pct_change,
        ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
      FROM backlink_trends
      WHERE backlinks_7d_ago IS NOT NULL  -- Must have historical data
    )
    SELECT 
      canonical_entity_id,
      backlinks_total,
      referring_domains,
      domain_rank,
      seo_position,
      pageviews,
      backlinks_change,
      domains_change,
      rank_change,
      backlinks_pct_change
    FROM latest_with_change
    WHERE rn = 1
      AND (
        backlinks_change < -5  -- Lost 5+ backlinks
        OR domains_change < -2  -- Lost 2+ referring domains
        OR (backlinks_pct_change < -10 AND backlinks_total < 100)  -- 10%+ decline for smaller sites
        OR rank_change < -5  -- Domain rank declined by 5+
      )
    ORDER BY 
      ABS(backlinks_change) DESC,
      ABS(domains_change) DESC
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
            # Calculate severity based on decline
            decline_severity = "severe" if (
                row.backlinks_change < -20 or 
                row.domains_change < -5 or
                (row.backlinks_pct_change and row.backlinks_pct_change < -25)
            ) else "moderate" if (
                row.backlinks_change < -10 or 
                row.domains_change < -3
            ) else "mild"
            
            priority = "high" if decline_severity == "severe" else "medium"
            
            # Build description
            decline_parts = []
            if row.backlinks_change < 0:
                decline_parts.append(f"{abs(row.backlinks_change)} backlinks lost")
            if row.domains_change < 0:
                decline_parts.append(f"{abs(row.domains_change)} referring domains lost")
            if row.rank_change < 0:
                decline_parts.append(f"domain rank down {abs(row.rank_change)}")
            
            actions = [
                "Audit recent content changes that may have caused link removal",
                "Check for broken pages that previously had backlinks",
                "Monitor competitor backlink activity",
                "Reach out to sites that removed links",
                "Build new high-quality backlinks to compensate",
                "Fix any technical issues affecting link equity flow",
                "Create linkable assets (infographics, research, tools)"
            ]
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity",
                "type": "backlink_quality_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Backlink Decline: {row.canonical_entity_id}",
                "description": f"Backlink profile declining: {', '.join(decline_parts)} in past 7 days. {decline_severity.title()} impact on SEO authority.",
                "evidence": {
                    "current_backlinks": int(row.backlinks_total),
                    "backlinks_change": int(row.backlinks_change),
                    "backlinks_pct_change": float(row.backlinks_pct_change) if row.backlinks_pct_change else None,
                    "current_referring_domains": int(row.referring_domains) if row.referring_domains else 0,
                    "domains_change": int(row.domains_change) if row.domains_change else 0,
                    "domain_rank": float(row.domain_rank) if row.domain_rank else None,
                    "rank_change": float(row.rank_change) if row.rank_change else None,
                    "current_position": float(row.seo_position) if row.seo_position else None,
                    "pageviews": int(row.pageviews) if row.pageviews else 0,
                    "severity": decline_severity
                },
                "metrics": {
                    "backlinks_total": int(row.backlinks_total),
                    "backlinks_change": int(row.backlinks_change),
                    "referring_domains": int(row.referring_domains) if row.referring_domains else 0,
                    "domain_rank": float(row.domain_rank) if row.domain_rank else None
                },
                "hypothesis": f"Recovering lost backlinks will restore SEO authority and protect search rankings",
                "confidence_score": 0.88,
                "potential_impact_score": min(95, 55 + abs(row.backlinks_change)),
                "urgency_score": 85 if decline_severity == "severe" else 70,
                "recommended_actions": actions[:5],
                "estimated_effort": "high",
                "estimated_timeline": "6-12 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} pages with declining backlinks")
        else:
            logger.info("✅ No backlink decline detected")
            
    except Exception as e:
        logger.error(f"❌ Backlink Quality Decline detector failed: {e}")
    
    return opportunities
