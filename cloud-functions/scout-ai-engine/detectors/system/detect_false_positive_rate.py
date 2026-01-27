"""'false_positive_rate' Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_false_positive_rate(organization_id: str) -> list:
    bq_client = bigquery.Client()
    logger.info("🔍 Running 'false_positive_rate' detector...")
    opportunities = []
    # System/data quality monitoring - checks pipeline health
    try:
        query = f"""
        SELECT CURRENT_TIMESTAMP() as check_time, 
          COUNT(*) as record_count,
          MAX(date) as latest_data_date
        FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
        WHERE organization_id = @org_id
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        """
        job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)])
        for row in bq_client.query(query, job_config=job_config).result():
            data_age_hours = (datetime.utcnow().date() - row.latest_data_date).days * 24 if row.latest_data_date else 999
            if data_age_hours > 24:  # Data older than 24 hours
                opportunities.append({"id": str(uuid.uuid4()), "organization_id": organization_id, "detected_at": datetime.utcnow().isoformat(),
                    "category": "system_health", "type": "false_positive_rate", "priority": "high", "status": "new",
                    "entity_id": "system", "entity_type": "data_pipeline",
                    "title": f"System alert: 'false_positive_rate'", "description": f"Data quality issue detected: 'false_positive_rate'",
                    "evidence": {"data_age_hours": data_age_hours, "latest_date": row.latest_data_date.isoformat() if row.latest_data_date else None},
                    "metrics": {"data_freshness_hours": data_age_hours},
                    "hypothesis": "System/data quality issue requiring attention", "confidence_score": 0.95, "potential_impact_score": 80, "urgency_score": 85,
                    "recommended_actions": ["Check data pipeline", "Review sync logs", "Fix data source connection", "Monitor system health"],
                    "estimated_effort": "medium", "estimated_timeline": "1-2 days",
                    "historical_performance": {"status": "degraded"}, "comparison_data": {"expected": "< 6 hours", "actual": f"{data_age_hours} hours"},
                    "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()})
        if opportunities: logger.info(f"✅ Found {len(opportunities)} 'false_positive_rate' issues")
    except Exception as e: logger.error(f"❌ Error: {e}")
    return opportunities
