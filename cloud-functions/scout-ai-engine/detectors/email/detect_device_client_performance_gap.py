"""
Device/Client Performance Gap Detector  
Category: Email
Detects conversion gaps by email client or device (proxy version using engagement data)
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_device_client_performance_gap(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: >30% CVR difference between top clients/devices (PROXY: using engagement patterns)
    Strategic Layer: Monthly check
    
    NOTE: This is a proxy detector using engagement rate as indicator.
    Full implementation requires device/client dimension in data.
    """
    logger.info("🔍 Running Device/Client Performance Gap detector (proxy)...")
    
    opportunities = []
    
    # Proxy approach: Look for campaigns with abnormally high open:click ratio variance
    # which often indicates device/client rendering or UX issues
    query = f"""
    WITH campaign_metrics AS (
      SELECT 
        e.canonical_entity_id,
        e.entity_name,
        SUM(m.opens) as total_opens,
        SUM(m.clicks) as total_clicks,
        SUM(m.sends) as total_sends,
        SAFE_DIVIDE(SUM(m.opens), SUM(m.sends)) * 100 as open_rate,
        SAFE_DIVIDE(SUM(m.clicks), SUM(m.opens)) * 100 as click_to_open_rate,
        SAFE_DIVIDE(SUM(m.clicks), SUM(m.sends)) * 100 as click_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
        AND sends > 100  -- Minimum volume for statistical significance
      GROUP BY e.canonical_entity_id, e.entity_name
    ),
    org_benchmarks AS (
      SELECT 
        AVG(open_rate) as avg_open_rate,
        AVG(click_to_open_rate) as avg_ctor,
        STDDEV(click_to_open_rate) as stddev_ctor
      FROM campaign_metrics
    )
    SELECT 
      c.canonical_entity_id,
      c.entity_name,
      c.open_rate,
      c.click_to_open_rate,
      c.click_rate,
      c.total_sends,
      b.avg_ctor,
      b.stddev_ctor,
      ABS(c.click_to_open_rate - b.avg_ctor) / NULLIF(b.stddev_ctor, 0) as z_score
    FROM campaign_metrics c
    CROSS JOIN org_benchmarks b
    WHERE c.open_rate > 15  -- Good opens
      AND c.click_to_open_rate < b.avg_ctor * 0.7  -- But poor CTOR (30%+ below avg)
      AND c.total_sends > 500  -- Sufficient volume
    ORDER BY z_score DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            gap_pct = ((row.avg_ctor - row.click_to_open_rate) / row.avg_ctor) * 100 if row.avg_ctor > 0 else 0
            priority = "medium" if gap_pct > 40 else "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_optimization",
                "type": "device_client_performance_gap",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email_campaign",
                "title": f"Suspected Device/Client Issue: {gap_pct:.0f}% engagement gap",
                "description": f"'{row.entity_name}' has {row.open_rate:.1f}% opens but only {row.click_to_open_rate:.1f}% CTOR vs {row.avg_ctor:.1f}% org avg - may indicate device rendering issues",
                "evidence": {
                    "open_rate": float(row.open_rate),
                    "click_to_open_rate": float(row.click_to_open_rate),
                    "org_avg_ctor": float(row.avg_ctor),
                    "gap_pct": float(gap_pct),
                    "z_score": float(row.z_score) if row.z_score else 0,
                    "total_sends": int(row.total_sends)
                },
                "metrics": {
                    "click_to_open_rate": float(row.click_to_open_rate),
                    "gap_vs_avg": float(gap_pct)
                },
                "hypothesis": "Possible device/client rendering or UX issues causing lower engagement despite good opens",
                "confidence_score": 0.65,  # Lower confidence - proxy indicator only
                "potential_impact_score": min(100, gap_pct),
                "urgency_score": 50 if priority == "medium" else 30,
                "recommended_actions": [
                    "Test email rendering across top email clients (Gmail, Outlook, Apple Mail)",
                    "Optimize for mobile viewing (65%+ of opens are mobile)",
                    "Use responsive design templates",
                    "Test CTA button sizes and placement for mobile",
                    "Check image loading and fallback text",
                    "Consider adding device/client tracking for deeper analysis",
                    "A/B test mobile-specific vs desktop-specific layouts"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-3 weeks",
                "historical_performance": {
                    "click_to_open_rate": float(row.click_to_open_rate),
                    "org_average": float(row.avg_ctor)
                },
                "comparison_data": {
                    "gap_percentage": f"{gap_pct:.1f}%",
                    "statistical_significance": f"{row.z_score:.2f} standard deviations" if row.z_score else "N/A"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} potential device/client performance gaps")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_device_client_performance_gap: {e}")
    
    return opportunities
