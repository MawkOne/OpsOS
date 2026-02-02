"""
Publishing Volume Gap Detector

Detects: Declining or inconsistent content publishing frequency
Layer: strategic
Category: content
Data Source: Content publish_date tracking
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_publishing_volume_gap(organization_id: str) -> list:
    """Detect declining content publishing volume"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Publishing Volume Gap detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_publishes AS (
      SELECT 
        FORMAT_DATE('%Y-%m', publish_date) as publish_month,
        DATE_TRUNC(publish_date, MONTH) as month_date,
        content_type,
        COUNT(DISTINCT canonical_entity_id) as content_published,
        -- Track performance of that month's content
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) 
            THEN pageviews END) as avg_recent_pageviews
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        AND publish_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        AND publish_date IS NOT NULL
      GROUP BY publish_month, month_date, content_type
    ),
    publishing_trends AS (
      SELECT 
        content_type,
        COUNT(*) as months_tracked,
        SUM(content_published) as total_published,
        AVG(content_published) as avg_per_month,
        STDDEV(content_published) as stddev_per_month,
        MIN(content_published) as min_month,
        MAX(content_published) as max_month,
        -- Recent 2 months
        SUM(CASE WHEN month_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH) 
            THEN content_published ELSE 0 END) as recent_2mo_published,
        -- Previous 4 months baseline
        AVG(CASE WHEN month_date < DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH)
                 AND month_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            THEN content_published END) as baseline_monthly_avg
      FROM monthly_publishes
      GROUP BY content_type
      HAVING months_tracked >= 3  -- At least 3 months of data
    ),
    overall_trend AS (
      SELECT 
        'all' as content_type,
        COUNT(*) as months_tracked,
        SUM(content_published) as total_published,
        AVG(content_published) as avg_per_month,
        STDDEV(content_published) as stddev_per_month,
        -- Recent vs baseline
        SUM(CASE WHEN month_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH) 
            THEN content_published ELSE 0 END) / 2.0 as recent_monthly_avg,
        AVG(CASE WHEN month_date < DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH)
                 AND month_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            THEN content_published END) as baseline_monthly_avg
      FROM monthly_publishes
      HAVING months_tracked >= 3
    )
    SELECT 
      content_type,
      total_published,
      avg_per_month,
      stddev_per_month,
      recent_2mo_published,
      baseline_monthly_avg,
      recent_2mo_published / 2.0 as recent_monthly_avg,
      -- Calculate decline
      SAFE_DIVIDE((recent_2mo_published / 2.0 - baseline_monthly_avg) * 100.0, 
                  NULLIF(baseline_monthly_avg, 0)) as volume_change_pct
    FROM publishing_trends
    WHERE baseline_monthly_avg > 0
      AND recent_2mo_published / 2.0 < baseline_monthly_avg * 0.7  -- 30%+ decline
    
    UNION ALL
    
    SELECT 
      content_type,
      total_published,
      avg_per_month,
      stddev_per_month,
      recent_monthly_avg * 2 as recent_2mo_published,
      baseline_monthly_avg,
      recent_monthly_avg,
      SAFE_DIVIDE((recent_monthly_avg - baseline_monthly_avg) * 100.0,
                  NULLIF(baseline_monthly_avg, 0)) as volume_change_pct
    FROM overall_trend
    WHERE baseline_monthly_avg > 0
      AND recent_monthly_avg < baseline_monthly_avg * 0.7  -- 30%+ decline
    
    ORDER BY total_published DESC, ABS(volume_change_pct) DESC
    LIMIT 3
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            decline_pct = abs(float(row.volume_change_pct))
            content_type = row.content_type if row.content_type != 'all' else "overall"
            
            # Determine severity
            if decline_pct > 50 or row.baseline_monthly_avg > 20:
                priority = "high"
                severity = "critical"
            elif decline_pct > 35:
                priority = "medium"
                severity = "significant"
            else:
                priority = "medium"
                severity = "moderate"
            
            # Build recommended actions
            actions = [
                f"Restore {content_type} publishing frequency to baseline ({row.baseline_monthly_avg:.0f}/month)",
                "Audit content production process for bottlenecks",
                "Consider hiring additional content creators",
                "Implement content calendar for consistent publishing",
                "Repurpose existing content into new formats",
                "Use AI tools to accelerate content creation",
                "Set up content production workflows and templates"
            ]
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "content_opportunity",
                "type": "publishing_volume_gap",
                "priority": priority,
                "status": "new",
                "entity_id": content_type,
                "entity_type": "content_category",
                "title": f"Publishing Volume Down {decline_pct:.0f}%: {content_type.title()} Content",
                "description": f"{content_type.title()} content publishing dropped from {row.baseline_monthly_avg:.0f}/month to {row.recent_monthly_avg:.0f}/month. Consistent publishing is critical for traffic growth.",
                "evidence": {
                    "content_type": content_type,
                    "recent_monthly_avg": float(row.recent_monthly_avg),
                    "baseline_monthly_avg": float(row.baseline_monthly_avg),
                    "volume_decline_pct": decline_pct,
                    "total_published_6mo": int(row.total_published),
                    "avg_per_month": float(row.avg_per_month),
                    "stddev_per_month": float(row.stddev_per_month) if row.stddev_per_month else None,
                    "severity": severity
                },
                "metrics": {
                    "current_monthly_volume": float(row.recent_monthly_avg),
                    "baseline_monthly_volume": float(row.baseline_monthly_avg),
                    "decline_percentage": decline_pct
                },
                "hypothesis": f"Restoring publishing frequency will drive {decline_pct/2:.0f}%+ more organic traffic as Google rewards consistent content",
                "confidence_score": 0.87,
                "potential_impact_score": min(90, 65 + (decline_pct / 2)),
                "urgency_score": 80 if severity == "critical" else 65,
                "recommended_actions": actions[:6],
                "estimated_effort": "high",
                "estimated_timeline": "Ongoing - process improvement",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} publishing volume gaps")
        else:
            logger.info("✅ No publishing volume gaps detected")
            
    except Exception as e:
        logger.error(f"❌ Publishing Volume Gap detector failed: {e}")
    
    return opportunities
