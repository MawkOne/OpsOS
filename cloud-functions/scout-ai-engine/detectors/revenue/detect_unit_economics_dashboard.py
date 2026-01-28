"""
Unit Economics Dashboard Detector
Category: Revenue
Monitors key unit economics metrics (partial implementation)
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_unit_economics_dashboard(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: LTV:CAC <3.0 or gross margin <60%
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Unit Economics Dashboard detector...")
    
    opportunities = []
    
    query = f"""
    WITH economics AS (
      SELECT 
        AVG(ltv) as avg_ltv,
        AVG(cac) as avg_cac,
        SAFE_DIVIDE(AVG(ltv), AVG(cac)) as ltv_cac_ratio,
        AVG(gross_margin) as avg_gross_margin,
        SUM(revenue) as total_revenue,
        SUM(transactions) as total_transactions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND (ltv > 0 OR cac > 0 OR gross_margin > 0)
    )
    SELECT 
      avg_ltv,
      avg_cac,
      ltv_cac_ratio,
      avg_gross_margin,
      total_revenue,
      total_transactions
    FROM economics
    WHERE (ltv_cac_ratio < 3.0 AND ltv_cac_ratio > 0)
       OR (avg_gross_margin < 60 AND avg_gross_margin > 0)
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
            ltv_cac = row.ltv_cac_ratio if row.ltv_cac_ratio else 0
            
            issues = []
            if ltv_cac < 3.0 and ltv_cac > 0:
                issues.append(f"LTV:CAC ratio {ltv_cac:.1f}:1 (target 3:1)")
            if row.avg_gross_margin < 60 and row.avg_gross_margin > 0:
                issues.append(f"Gross margin {row.avg_gross_margin:.0f}% (target 60%+)")
            
            priority = "high" if ltv_cac < 2.0 or row.avg_gross_margin < 50 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_growth",
                "type": "unit_economics",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "revenue",
                "title": f"Unit Economics Below Target: {', '.join(issues)}",
                "description": f"Key unit economics metrics deteriorating below healthy thresholds",
                "evidence": {
                    "ltv": float(row.avg_ltv) if row.avg_ltv else 0,
                    "cac": float(row.avg_cac) if row.avg_cac else 0,
                    "ltv_cac_ratio": float(ltv_cac),
                    "gross_margin": float(row.avg_gross_margin) if row.avg_gross_margin else 0,
                    "issues": issues
                },
                "metrics": {
                    "ltv_cac_ratio": float(ltv_cac),
                    "gross_margin": float(row.avg_gross_margin) if row.avg_gross_margin else 0
                },
                "hypothesis": "Unit economics unsustainable - need to improve LTV, reduce CAC, or optimize margins",
                "confidence_score": 0.85,
                "potential_impact_score": 90,
                "urgency_score": 85 if priority == "high" else 65,
                "recommended_actions": [
                    "Improve customer lifetime value through retention",
                    "Reduce customer acquisition costs",
                    "Increase prices if market allows",
                    "Optimize cost structure and margins",
                    "Focus on higher-value customer segments",
                    "Improve conversion rates to lower CAC",
                    "Reduce churn to increase LTV",
                    "Target 3:1 or higher LTV:CAC ratio"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "3-6 months",
                "historical_performance": {
                    "ltv_cac": float(ltv_cac),
                    "margin": float(row.avg_gross_margin) if row.avg_gross_margin else 0
                },
                "comparison_data": {
                    "ltv_cac_target": "3.0:1 or higher",
                    "ltv_cac_current": f"{ltv_cac:.1f}:1",
                    "margin_target": "60%+",
                    "margin_current": f"{row.avg_gross_margin:.0f}%" if row.avg_gross_margin else "N/A"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} unit economics issues")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_unit_economics_dashboard: {e}")
    
    return opportunities
