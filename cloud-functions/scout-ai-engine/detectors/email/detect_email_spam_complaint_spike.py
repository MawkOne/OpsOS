"""
Detect Email Spam Complaint Spike Detector
Category: Email
"""

"""
EMAIL Detectors
All detection layers (Fast, Trend, Strategic) for email marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_email_spam_complaint_spike(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email campaigns with spam complaints
    Fast Layer: Daily check for reputation damage
    """
    logger.info("🔍 Running Email Spam Complaint Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(spam_complaint_rate) as avg_spam_rate,
        SUM(spam_complaints) as total_complaints,
        SUM(sends) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    ),
    baseline_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(spam_complaint_rate) as baseline_spam_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_spam_rate,
      baseline_spam_rate,
      total_complaints,
      total_sends,
      SAFE_DIVIDE((avg_spam_rate - baseline_spam_rate), baseline_spam_rate) * 100 as spam_rate_increase_pct
    FROM recent_campaigns r
    WHERE avg_spam_rate > 0.05  -- >0.05% is concerning, >0.1% is critical
      OR (baseline_spam_rate > 0 AND avg_spam_rate > baseline_spam_rate * 2)  -- 2x spike
      AND total_sends > 50
    ORDER BY avg_spam_rate DESC
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
            priority = "high" if row.avg_spam_rate > 0.1 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_deliverability",
                "type": "spam_complaint_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"Spam Complaints: {row.avg_spam_rate:.2f}%",
                "description": f"Email campaign spam complaint rate is {row.avg_spam_rate:.2f}%, risking sender reputation and deliverability",
                "evidence": {
                    "current_spam_rate": float(row.avg_spam_rate),
                    "baseline_spam_rate": float(row.baseline_spam_rate) if row.baseline_spam_rate else None,
                    "spam_rate_increase": float(row.spam_rate_increase_pct) if row.spam_rate_increase_pct else None,
                    "total_complaints": int(row.total_complaints),
                    "total_sends": int(row.total_sends),
                },
                "metrics": {
                    "spam_complaint_rate": float(row.avg_spam_rate),
                },
                "hypothesis": "High spam complaints damage sender reputation and will cause long-term deliverability issues (30-60 days to fix)",
                "confidence_score": 0.95,
                "potential_impact_score": min(100, row.avg_spam_rate * 500),  # Scale up since even 0.2% is serious
                "urgency_score": 95 if row.avg_spam_rate > 0.1 else 80,
                "recommended_actions": [
                    "Review content for spam triggers (excessive caps, misleading subject)",
                    "Segment audience better - stop sending to unengaged contacts",
                    "Check acquisition sources for quality",
                    "Make unsubscribe process easier and more prominent",
                    "Consider temporary pause if rate >0.1%"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "2-5 days",
            })
        
        logger.info(f"✅ Email Spam Complaint Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Spam Complaint Spike detector failed: {e}")
    
    return opportunities
