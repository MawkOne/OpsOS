"""
Growth Velocity Trends Detector
Category: Revenue
Tracks revenue growth acceleration or deceleration
"""

from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_growth_velocity_trends(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running Growth Velocity Trends detector...")
    opportunities = []
    
    query = f"""
    WITH monthly_revenue AS (
      SELECT DATE_TRUNC(date, MONTH) as month, SUM(revenue) as revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      GROUP BY month
    ),
    growth_rates AS (
      SELECT month, revenue,
        SAFE_DIVIDE((revenue - LAG(revenue) OVER (ORDER BY month)), LAG(revenue) OVER (ORDER BY month)) * 100 as mom_growth
      FROM monthly_revenue
    )
    SELECT month, revenue, mom_growth,
      LAG(mom_growth) OVER (ORDER BY month) as prev_month_growth,
      (mom_growth - LAG(mom_growth) OVER (ORDER BY month)) as growth_acceleration
    FROM growth_rates
    WHERE month >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
      AND LAG(mom_growth) OVER (ORDER BY month) IS NOT NULL
      AND (mom_growth - LAG(mom_growth) OVER (ORDER BY month)) < -20
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        for row in results:
            opportunities.append({
                "id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_growth", "type": "growth_velocity", "priority": "high", "status": "new",
                "entity_id": "aggregate", "entity_type": "revenue",
                "title": f"Growth Slowing: {row.mom_growth:.1f}% vs {row.prev_month_growth:.1f}% prior month",
                "description": f"Revenue growth rate declining from {row.prev_month_growth:.1f}% to {row.mom_growth:.1f}%",
                "evidence": {"current_growth": float(row.mom_growth), "previous_growth": float(row.prev_month_growth), "deceleration": float(row.growth_acceleration)},
                "metrics": {"mom_growth": float(row.mom_growth)},
                "hypothesis": "Growth rate slowing - identify and address constraints",
                "confidence_score": 0.90, "potential_impact_score": 85, "urgency_score": 80,
                "recommended_actions": ["Identify growth constraints", "Invest in acquisition", "Improve conversion funnels", "Expand market reach"],
                "estimated_effort": "high", "estimated_timeline": "3-6 months",
                "historical_performance": {"current_growth": float(row.mom_growth), "previous_growth": float(row.prev_month_growth)},
                "comparison_data": {"deceleration": f"{row.growth_acceleration:.1f} percentage points"},
                "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()
            })
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} growth velocity issues")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
    return opportunities
