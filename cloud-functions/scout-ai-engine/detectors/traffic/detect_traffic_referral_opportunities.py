"""
Detect Traffic Referral Opportunities Detector
Category: Traffic
"""

"""
TRAFFIC Detectors\nAll detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
bq_client = bigquery.Client()

def detect_traffic_referral_opportunities(organization_id: str) -> list:
    """
    Detect: High-converting referral sources worth pursuing
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Referral Opportunities detector...")
    
    opportunities = []
    
    query = f"""
    WITH referral_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(revenue) as total_revenue,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND (entity_type = 'source' OR entity_type = 'campaign')
        AND canonical_entity_id LIKE '%referral%'
      GROUP BY canonical_entity_id
    ),
    overall_avg AS (
      SELECT 
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    )
    SELECT 
      r.canonical_entity_id,
      r.total_sessions,
      r.total_conversions,
      r.avg_conversion_rate,
      r.total_revenue,
      r.avg_duration,
      o.avg_conversion_rate as site_avg_conversion_rate,
      SAFE_DIVIDE((r.avg_conversion_rate - o.avg_conversion_rate), o.avg_conversion_rate) * 100 as cvr_vs_avg_pct
    FROM referral_performance r
    CROSS JOIN overall_avg o
    WHERE r.avg_conversion_rate > o.avg_conversion_rate * 1.2  -- 20%+ better than average
      AND r.total_sessions > 20
      AND r.total_sessions < 500  -- Not maxed out yet
    ORDER BY cvr_vs_avg_pct DESC
    LIMIT 10
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
            priority = "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "traffic_growth",
                "type": "referral_opportunity",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "referral",
                "title": f"High-Quality Referral Source: {row.avg_conversion_rate:.1f}% CVR",
                "description": f"Referral converting {row.cvr_vs_avg_pct:+.0f}% better than average with only {row.total_sessions:,.0f} sessions",
                "evidence": {
                    "total_sessions": int(row.total_sessions),
                    "total_conversions": int(row.total_conversions),
                    "conversion_rate": float(row.avg_conversion_rate),
                    "site_avg_conversion_rate": float(row.site_avg_conversion_rate),
                    "cvr_vs_avg_pct": float(row.cvr_vs_avg_pct),
                    "total_revenue": float(row.total_revenue),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "conversion_rate": float(row.avg_conversion_rate),
                    "revenue": float(row.total_revenue),
                },
                "hypothesis": "High-converting referral source worth investing in for more exposure",
                "confidence_score": 0.8,
                "potential_impact_score": min(100, row.cvr_vs_avg_pct * 0.5),
                "urgency_score": 55,
                "recommended_actions": [
                    "Build relationship with this referral source",
                    "Pitch guest post or partnership",
                    "Create dedicated landing page for this traffic",
                    "Offer exclusive content/discount for their audience",
                    "Request featured placement or more mentions",
                    "Consider paid sponsorship if available",
                    f"Scale potential: {row.cvr_vs_avg_pct:+.0f}% better CVR than average"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
            })
        
        logger.info(f"✅ Referral Opportunities detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Referral Opportunities detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_cross_channel_gaps', 
    'detect_declining_performers_multitimeframe', 
    'detect_declining_performers',
    'detect_traffic_bot_spam_spike',
    'detect_traffic_spike_quality_check',
    'detect_traffic_utm_parameter_gaps',
    'detect_traffic_referral_opportunities'
]
