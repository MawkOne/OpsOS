"""
Forecast Deviation Detector
Category: Revenue
Detects when actual revenue deviates significantly from forecast
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_forecast_deviation(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Actual revenue >15% different from forecast
    Strategic Layer: Monthly check
    NOTE: Requires forecast data in database
    """
    logger.info("🔍 Running Forecast Deviation detector...")
    
    opportunities = []
    
    # Proxy approach: Compare actual vs historical trend-based forecast
    query = f"""
    WITH monthly_revenue AS (
      SELECT 
        DATE_TRUNC(date, MONTH) as month,
        SUM(revenue) as actual_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        AND date < CURRENT_DATE()
      GROUP BY month
    ),
    forecast AS (
      SELECT 
        month,
        actual_revenue,
        AVG(actual_revenue) OVER (ORDER BY month ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) as forecasted_revenue
      FROM monthly_revenue
    )
    SELECT 
      month,
      actual_revenue,
      forecasted_revenue,
      SAFE_DIVIDE((actual_revenue - forecasted_revenue), forecasted_revenue) * 100 as deviation_pct
    FROM forecast
    WHERE forecasted_revenue IS NOT NULL
      AND month >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH)
      AND ABS(SAFE_DIVIDE((actual_revenue - forecasted_revenue), forecasted_revenue)) > 0.15  -- >15% deviation
    ORDER BY month DESC
    LIMIT 3
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
            deviation = row.deviation_pct if row.deviation_pct else 0
            
            if abs(deviation) > 30:
                priority = "high"
            elif abs(deviation) > 20:
                priority = "high"
            else:
                priority = "medium"
            
            if deviation > 0:
                direction = "above"
                impact = "positive"
            else:
                direction = "below"
                impact = "negative"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_anomaly",
                "type": "forecast_deviation",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Revenue {abs(deviation):.0f}% {direction} forecast",
                "description": f"Actual revenue ${row.actual_revenue:,.0f} is {abs(deviation):.0f}% {direction} forecast of ${row.forecasted_revenue:,.0f} for {row.month.strftime('%B %Y')}",
                "evidence": {
                    "actual_revenue": float(row.actual_revenue),
                    "forecasted_revenue": float(row.forecasted_revenue),
                    "deviation_pct": float(deviation),
                    "deviation_direction": direction,
                    "month": row.month.isoformat()
                },
                "metrics": {
                    "actual_revenue": float(row.actual_revenue),
                    "forecast_variance": float(deviation)
                },
                "hypothesis": f"Revenue {direction} expectations - investigate variance causes for better forecasting",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, abs(deviation) * 3),
                "urgency_score": 80 if abs(deviation) > 25 else 60,
                "recommended_actions": [
                    "Update forecast models with new data",
                    "Investigate variance root causes (market, seasonality, campaigns)",
                    "Adjust future plans based on actual performance",
                    "Communicate variance to stakeholders",
                    "Review assumptions in original forecast",
                    "Improve forecasting methodology",
                    f"{'Capitalize on momentum' if deviation > 0 else 'Course-correct immediately'}",
                    "Document learnings for future forecasts"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
                "historical_performance": {
                    "actual": float(row.actual_revenue),
                    "forecast": float(row.forecasted_revenue)
                },
                "comparison_data": {
                    "variance": f"{deviation:+.1f}%",
                    "dollar_difference": f"${abs(row.actual_revenue - row.forecasted_revenue):,.0f}",
                    "impact_type": impact
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} forecast deviations")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_forecast_deviation: {e}")
    
    return opportunities
