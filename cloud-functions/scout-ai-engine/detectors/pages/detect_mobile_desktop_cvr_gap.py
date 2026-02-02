"""Mobile vs Desktop CVR Gap Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_mobile_desktop_cvr_gap(organization_id: str) -> list:
    """Detect pages where mobile conversion rate is significantly lower than desktop"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Mobile vs Desktop CVR Gap detector...")
    opportunities = []
    
    query = f"""
    WITH device_performance AS (
      SELECT 
        canonical_entity_id,
        device_type,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SUM(pageviews) as pageviews,
        AVG(bounce_rate) as bounce_rate,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id 
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND entity_type = 'page'
        AND device_type IN ('mobile', 'desktop')
        AND sessions > 10
      GROUP BY canonical_entity_id, device_type
    ),
    cvr_comparison AS (
      SELECT 
        canonical_entity_id,
        MAX(IF(device_type = 'mobile', cvr, NULL)) as mobile_cvr,
        MAX(IF(device_type = 'desktop', cvr, NULL)) as desktop_cvr,
        MAX(IF(device_type = 'mobile', sessions, NULL)) as mobile_sessions,
        MAX(IF(device_type = 'desktop', sessions, NULL)) as desktop_sessions,
        MAX(IF(device_type = 'mobile', bounce_rate, NULL)) as mobile_bounce,
        MAX(IF(device_type = 'mobile', pageviews, NULL)) as mobile_pageviews
      FROM device_performance 
      GROUP BY canonical_entity_id
    )
    SELECT * FROM cvr_comparison
    WHERE mobile_cvr IS NOT NULL 
      AND desktop_cvr IS NOT NULL
      AND desktop_cvr > 0
      AND mobile_cvr < desktop_cvr * 0.6  -- Mobile CVR <60% of desktop
      AND mobile_sessions > 100  -- Meaningful traffic
      AND desktop_sessions > 50
    ORDER BY mobile_sessions DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            gap_pct = ((row.desktop_cvr - row.mobile_cvr) / row.desktop_cvr) * 100 if row.desktop_cvr > 0 else 0
            
            # Determine priority
            if gap_pct > 70 or row.mobile_sessions > 1000:
                priority = "high"
            elif gap_pct > 50:
                priority = "medium"
            else:
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "page_optimization",
                "type": "mobile_cvr_gap",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Mobile CVR {gap_pct:.0f}% Below Desktop: {row.canonical_entity_id}",
                "description": f"Mobile conversion rate ({row.mobile_cvr:.1f}%) is significantly lower than desktop ({row.desktop_cvr:.1f}%). Fix mobile experience.",
                "evidence": {
                    "mobile_cvr": float(row.mobile_cvr),
                    "desktop_cvr": float(row.desktop_cvr),
                    "gap_percentage": float(gap_pct),
                    "mobile_sessions": int(row.mobile_sessions),
                    "desktop_sessions": int(row.desktop_sessions),
                    "mobile_bounce_rate": float(row.mobile_bounce) if row.mobile_bounce else None
                },
                "metrics": {
                    "mobile_cvr": float(row.mobile_cvr),
                    "desktop_cvr": float(row.desktop_cvr),
                    "mobile_sessions": int(row.mobile_sessions)
                },
                "hypothesis": f"Fixing mobile UX could increase conversions by {gap_pct:.0f}%, capturing {int(row.mobile_sessions * gap_pct / 100)} more conversions",
                "confidence_score": 0.88,
                "potential_impact_score": min(95, 60 + gap_pct / 3),
                "urgency_score": 85 if priority == "high" else 65,
                "recommended_actions": [
                    "Test mobile checkout/form flow for friction points",
                    "Simplify mobile forms (fewer fields, autofill)",
                    "Improve mobile page speed and load times",
                    "Test mobile-specific layouts and CTAs",
                    "Check for mobile-specific bugs or errors",
                    "A/B test mobile-optimized design"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} mobile CVR gaps")
        else:
            logger.info("✅ No significant mobile/desktop CVR gaps detected")
            
    except Exception as e:
        logger.error(f"❌ Mobile vs Desktop CVR Gap detector error: {e}")
    
    return opportunities
