"""Cohort Performance Trends Detector - Tracks revenue by customer cohort"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_cohort_performance_trends(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running Cohort Performance Trends detector...")
    opportunities = []
    query = f"""
    WITH cohorts AS (
      SELECT DATE_TRUNC(first_purchase_date, MONTH) as cohort_month, canonical_entity_id, SUM(revenue) as cohort_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e ON m.canonical_entity_id = e.canonical_entity_id
      WHERE organization_id = @org_id AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH) AND first_purchase_date IS NOT NULL
      GROUP BY cohort_month, canonical_entity_id
    ),
    cohort_stats AS (
      SELECT cohort_month, AVG(cohort_revenue) as avg_cohort_value, COUNT(*) as cohort_size
      FROM cohorts GROUP BY cohort_month
    )
    SELECT cohort_month, avg_cohort_value, cohort_size,
      AVG(avg_cohort_value) OVER () as overall_avg
    FROM cohort_stats
    WHERE cohort_month >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
      AND avg_cohort_value < (AVG(avg_cohort_value) OVER ()) * 0.7
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
    try:
        for row in bq_client.query(query, job_config=job_config).result():
            opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                "category": "revenue_growth", "type": "cohort_performance", "priority": "high", "status": "new", "entity_id": "aggregate", "entity_type": "revenue",
                "title": f"Recent Cohort Underperforming: {row.avg_cohort_value/row.overall_avg*100:.0f}% of average",
                "description": f"Cohort from {row.cohort_month.strftime('%B %Y')} generating ${row.avg_cohort_value:.0f} vs ${row.overall_avg:.0f} org average",
                "evidence": {"cohort_value": float(row.avg_cohort_value), "overall_avg": float(row.overall_avg), "cohort_size": int(row.cohort_size)},
                "metrics": {"cohort_ltv": float(row.avg_cohort_value)}, "hypothesis": "Recent cohorts showing lower value - quality or targeting issues",
                "confidence_score": 0.85, "potential_impact_score": 75, "urgency_score": 70,
                "recommended_actions": ["Improve customer quality in acquisition", "Enhance onboarding process", "Refine targeting criteria", "Address early retention issues"],
                "estimated_effort": "high", "estimated_timeline": "3-6 months",
                "historical_performance": {"cohort_value": float(row.avg_cohort_value), "benchmark": float(row.overall_avg)},
                "comparison_data": {"vs_average": f"{row.avg_cohort_value/row.overall_avg*100:.0f}%"}, "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} cohort performance issues")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
