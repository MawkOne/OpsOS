"""
Email Volume Gap Detector
Category: Email
Detects when email send volume is below benchmarks or declining significantly
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_email_volume_gap(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email send volume <50% of benchmark or declining >30% MoM
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Email Volume Gap detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_volume AS (
      SELECT 
        e.canonical_entity_id,
        e.entity_name,
        SUM(m.sends) as total_sends,
        COUNT(DISTINCT m.date) as days_with_sends,
        AVG(m.sends) as avg_daily_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
        AND sends > 0
      GROUP BY e.canonical_entity_id, e.entity_name
    ),
    historical_volume AS (
      SELECT 
        e.canonical_entity_id,
        SUM(m.sends) as baseline_total_sends,
        AVG(m.sends) as baseline_avg_daily_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email_campaign'
        AND sends > 0
      GROUP BY e.canonical_entity_id
    ),
    org_benchmark AS (
      SELECT 
        AVG(total_sends) as benchmark_volume
      FROM (
        SELECT 
          canonical_entity_id,
          SUM(sends) as total_sends
        FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
        WHERE organization_id = @org_id
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
          AND entity_type = 'email_campaign'
          AND sends > 0
        GROUP BY canonical_entity_id
      )
    )
    SELECT 
      r.canonical_entity_id,
      r.entity_name,
      r.total_sends,
      r.days_with_sends,
      r.avg_daily_sends,
      h.baseline_total_sends,
      h.baseline_avg_daily_sends,
      b.benchmark_volume,
      SAFE_DIVIDE((r.total_sends - h.baseline_total_sends), h.baseline_total_sends) * 100 as volume_change_pct,
      SAFE_DIVIDE(r.total_sends, b.benchmark_volume) * 100 as vs_benchmark_pct
    FROM recent_volume r
    LEFT JOIN historical_volume h ON r.canonical_entity_id = h.canonical_entity_id
    CROSS JOIN org_benchmark b
    WHERE 
      -- Either significantly below benchmark OR declining trend
      (r.total_sends < b.benchmark_volume * 0.5)  -- <50% of benchmark
      OR (h.baseline_total_sends > 0 AND 
          SAFE_DIVIDE((r.total_sends - h.baseline_total_sends), h.baseline_total_sends) < -0.30)  -- >30% decline
    ORDER BY volume_change_pct ASC
    LIMIT 20
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
            # Determine priority based on severity
            if row.volume_change_pct and row.volume_change_pct < -50:
                priority = "high"
            elif row.vs_benchmark_pct and row.vs_benchmark_pct < 30:
                priority = "high"
            else:
                priority = "medium"
            
            # Build title based on what triggered the alert
            if row.volume_change_pct and row.volume_change_pct < -30:
                title = f"Email Volume Declining: {abs(row.volume_change_pct):.0f}% drop"
            else:
                title = f"Email Volume Below Benchmark: {row.vs_benchmark_pct:.0f}% of target"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_optimization",
                "type": "volume_gap",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email_campaign",
                "title": title,
                "description": f"'{row.entity_name}' sending only {row.total_sends:,.0f} emails in last 30 days vs {row.baseline_total_sends:,.0f} in previous period",
                "evidence": {
                    "current_volume": int(row.total_sends),
                    "baseline_volume": int(row.baseline_total_sends) if row.baseline_total_sends else 0,
                    "benchmark_volume": int(row.benchmark_volume),
                    "volume_change_pct": float(row.volume_change_pct) if row.volume_change_pct else 0,
                    "vs_benchmark_pct": float(row.vs_benchmark_pct),
                    "days_with_sends": int(row.days_with_sends),
                    "avg_daily_sends": float(row.avg_daily_sends)
                },
                "metrics": {
                    "total_sends": int(row.total_sends),
                    "volume_change_pct": float(row.volume_change_pct) if row.volume_change_pct else 0,
                    "vs_benchmark_pct": float(row.vs_benchmark_pct)
                },
                "hypothesis": "Email frequency too low - missing revenue opportunities from existing subscribers",
                "confidence_score": 0.80,
                "potential_impact_score": min(100, abs(row.volume_change_pct) if row.volume_change_pct else 50),
                "urgency_score": 60 if priority == "high" else 40,
                "recommended_actions": [
                    "Increase email cadence within best practices (2-7x per week)",
                    "Create automated nurture sequences for key segments",
                    "Develop new campaign types (promotional, educational, seasonal)",
                    "Segment list for more targeted sends",
                    "Test optimal send frequency by segment"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 weeks",
                "historical_performance": {
                    "baseline_sends": int(row.baseline_total_sends) if row.baseline_total_sends else 0,
                    "current_sends": int(row.total_sends)
                },
                "comparison_data": {
                    "org_benchmark": int(row.benchmark_volume),
                    "vs_benchmark": f"{row.vs_benchmark_pct:.1f}%"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} email volume gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_email_volume_gap: {e}")
    
    return opportunities
