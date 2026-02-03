"""
Detect Traffic Utm Parameter Gaps Detector
Category: Traffic
"""

"""
TRAFFIC Detectors\nAll detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_traffic_utm_parameter_gaps(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: High-value traffic missing UTM tracking
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running UTM Parameter Gaps detector...")
    
    opportunities = []
    
    # Note: This requires source_breakdown JSON parsing
    # For now, we'll identify high-traffic entities that might need better tracking
    query = f"""
    WITH recent_traffic AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('campaign', 'page')
      GROUP BY canonical_entity_id, entity_type
    )
    SELECT 
      canonical_entity_id,
      entity_type,
      total_sessions,
      total_conversions,
      total_revenue,
      avg_conversion_rate,
      CASE 
        WHEN canonical_entity_id NOT LIKE '%utm%' AND canonical_entity_id NOT LIKE '%source=%' THEN TRUE
        ELSE FALSE
      END as missing_utm_tracking
    FROM recent_traffic
    WHERE total_sessions > 100
      AND total_revenue > 0
      AND (canonical_entity_id NOT LIKE '%utm%' OR canonical_entity_id LIKE '%direct%' OR canonical_entity_id LIKE '%unattributed%')
    ORDER BY total_revenue DESC
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
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "tracking_optimization",
                "type": "utm_parameter_gaps",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": row.entity_type,
                "title": f"High-Value Traffic Missing UTM Tracking",
                "description": f"{row.total_sessions:,.0f} sessions generating ${row.total_revenue:,.0f} with unclear attribution",
                "evidence": {
                    "total_sessions": int(row.total_sessions),
                    "total_conversions": int(row.total_conversions),
                    "total_revenue": float(row.total_revenue),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "sessions": int(row.total_sessions),
                    "revenue": float(row.total_revenue),
                },
                "hypothesis": "Missing UTM parameters prevent accurate attribution and optimization decisions",
                "confidence_score": 0.7,
                "potential_impact_score": 60,
                "urgency_score": 50,
                "recommended_actions": [
                    "Add UTM parameters to all external links",
                    "Implement UTM builder for marketing team",
                    "Tag email campaigns with utm_medium=email",
                    "Tag social posts with utm_medium=social",
                    "Tag ads with campaign-specific parameters",
                    "Document UTM naming convention",
                    f"${row.total_revenue:,.0f} in revenue needs better attribution"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "2-3 days",
            })
        
        logger.info(f"✅ UTM Parameter Gaps detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ UTM Parameter Gaps detector failed: {e}")
    
    return opportunities
