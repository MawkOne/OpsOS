"""Mobile vs Desktop CVR Gap Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_mobile_desktop_cvr_gap(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running Mobile vs Desktop CVR Gap detector...")
    opportunities = []
    query = f"""
    WITH device_performance AS (
      SELECT e.canonical_entity_id m.device_type,
        SUM(m.sessions) as sessions, SUM(m.conversions) as conversions,
        SAFE_DIVIDE(SUM(m.conversions), SUM(m.sessions)) * 100 as cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
      WHERE m.organization_id = @org_id AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND m.entity_type = 'page' AND device_type IN ('mobile', 'desktop') AND sessions > 100
      GROUP BY e.canonical_entity_id device_type
    ),
    cvr_comparison AS (
      SELECT canonical_entity_id, entity_name,
        MAX(IF(device_type = 'mobile', cvr, NULL)) as mobile_cvr,
        MAX(IF(device_type = 'desktop', cvr, NULL)) as desktop_cvr,
        MAX(IF(device_type = 'mobile', sessions, NULL)) as mobile_sessions
      FROM device_performance GROUP BY e.canonical_entity_id, e.entity_name
    )
    SELECT * FROM cvr_comparison
    WHERE mobile_cvr IS NOT NULL AND desktop_cvr IS NOT NULL
      AND mobile_cvr < desktop_cvr * 0.5 AND mobile_sessions > 100
    LIMIT 20
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            gap_pct = ((row.desktop_cvr - row.mobile_cvr) / row.desktop_cvr) * 100
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "page_optimization", "type": "mobile_cvr_gap", "priority": "high", "status": "new",
                "entity_id": row.canonical_entity_id, "entity_type": "page",
                "title": f"Mobile CVR Gap: {gap_pct:.0f}% below desktop",
                "description": f"'{row.canonical_entity_id}' mobile CVR {row.mobile_cvr:.1f}% vs desktop {row.desktop_cvr:.1f}%",
                "evidence": {"mobile_cvr": float(row.mobile_cvr), "desktop_cvr": float(row.desktop_cvr), "gap_pct": float(gap_pct), "mobile_sessions": int(row.mobile_sessions)},
                "metrics": {"mobile_cvr": float(row.mobile_cvr), "desktop_cvr": float(row.desktop_cvr)},
                "hypothesis": "Mobile experience issues preventing conversions", "confidence_score": 0.85, "potential_impact_score": min(100, gap_pct),
                "urgency_score": 80, "recommended_actions": ["Optimize mobile UX", "Simplify mobile forms", "Test mobile-specific layouts", "Improve mobile page speed"],
                "estimated_effort": "medium", "estimated_timeline": "2-4 weeks",
                "historical_performance": {"mobile": float(row.mobile_cvr), "desktop": float(row.desktop_cvr)},
                "comparison_data": {"gap": f"{gap_pct:.0f}%"}, "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} mobile CVR gaps")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
