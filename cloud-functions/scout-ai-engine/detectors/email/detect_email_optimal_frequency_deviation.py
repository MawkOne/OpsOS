"""
Detect Email Optimal Frequency Deviation Detector
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

def detect_email_optimal_frequency_deviation(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Email send frequency too high or too low
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Email Optimal Frequency Deviation detector...")
    
    opportunities = []
    
    query = f"""
    WITH weekly_sends AS (
      SELECT 
        canonical_entity_id,
        DATE_TRUNC(date, WEEK) as week,
        SUM(sends) as weekly_sends,
        AVG(open_rate) as avg_open_rate,
        AVG(unsubscribe_rate) as avg_unsubscribe_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email'
      GROUP BY canonical_entity_id, week
    )
    SELECT 
      canonical_entity_id,
      AVG(weekly_sends) as avg_weekly_sends,
      AVG(avg_open_rate) as overall_open_rate,
      AVG(avg_unsubscribe_rate) as overall_unsubscribe_rate,
      COUNT(DISTINCT week) as weeks_tracked
    FROM weekly_sends
    GROUP BY canonical_entity_id
    HAVING AVG(weekly_sends) > 7  -- Sending more than 1/day average
      OR AVG(weekly_sends) < 1  -- Less than 1/week
    ORDER BY avg_weekly_sends DESC
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
            is_too_high = row.avg_weekly_sends > 7
            is_too_low = row.avg_weekly_sends < 1
            
            if is_too_high:
                title = f"Email Frequency Too High: {row.avg_weekly_sends:.1f}/week"
                desc = f"Sending {row.avg_weekly_sends:.1f} emails per week on average may lead to fatigue and higher unsubscribes"
                priority = "high" if row.overall_unsubscribe_rate > 0.5 else "medium"
            else:
                title = f"Email Frequency Too Low: {row.avg_weekly_sends:.1f}/week"
                desc = f"Sending only {row.avg_weekly_sends:.1f} emails per week may be missing engagement opportunities"
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_optimization",
                "type": "frequency_deviation",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": title,
                "description": desc,
                "evidence": {
                    "avg_weekly_sends": float(row.avg_weekly_sends),
                    "open_rate": float(row.overall_open_rate),
                    "unsubscribe_rate": float(row.overall_unsubscribe_rate),
                    "weeks_tracked": int(row.weeks_tracked),
                },
                "metrics": {
                    "weekly_frequency": float(row.avg_weekly_sends),
                    "unsubscribe_rate": float(row.overall_unsubscribe_rate),
                },
                "hypothesis": "Too high frequency causes fatigue; too low frequency misses opportunities" if is_too_high else "Low send frequency may be missing revenue and engagement opportunities",
                "confidence_score": 0.7,
                "potential_impact_score": 60 if is_too_high else 40,
                "urgency_score": 60 if is_too_high else 30,
                "recommended_actions": [
                    "Test reducing frequency to 3-5/week" if is_too_high else "Test increasing to 2-4/week",
                    "Segment by engagement level - send more to engaged, less to at-risk",
                    "Use preference center to let subscribers choose frequency",
                    "Monitor unsubscribe rate impact",
                    "A/B test frequency changes with small segment first"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1 week",
            })
        
        logger.info(f"✅ Email Optimal Frequency Deviation detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Optimal Frequency Deviation detector failed: {e}")
    
    return opportunities
__all__ = [
    'detect_email_engagement_drop',
    'detect_email_high_opens_low_clicks',
    'detect_email_trends_multitimeframe',
    'detect_email_bounce_rate_spike',
    'detect_email_spam_complaint_spike',
    'detect_email_list_health_decline',
    'detect_email_click_to_open_rate_decline',
    'detect_email_optimal_frequency_deviation',
]
# Detector metadata
DETECTOR_INFO = {
    'detect_email_engagement_drop': {
        'layer': 'trend',
        'timeframe': '30d vs 30d',
        'priority': 'medium',
        'description': 'Detects email campaigns with declining engagement rates'
    },
    'detect_email_high_opens_low_clicks': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'low',
        'description': 'Emails with good opens but poor click-through (content/CTA issue)'
    },
    'detect_email_trends_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Long-term email performance trends and patterns'
    },
    'detect_email_bounce_rate_spike': {
        'layer': 'fast',
        'timeframe': '7d',
        'priority': 'high',
        'description': 'Detects dangerous bounce rates indicating deliverability crises'
    },
    'detect_email_spam_complaint_spike': {
        'layer': 'fast',
        'timeframe': '7d vs baseline',
        'priority': 'high',
        'description': 'Detects spam complaints that damage sender reputation'
    },
    'detect_email_list_health_decline': {
        'layer': 'trend',
        'timeframe': '30d vs 90d',
        'priority': 'medium',
        'description': 'Detects list health issues via unsubscribe rate increases'
    },
    'detect_email_click_to_open_rate_decline': {
        'layer': 'trend',
        'timeframe': '30d',
        'priority': 'medium',
        'description': 'Opens stable but clicks declining - content/CTA issue'
    },
    'detect_email_optimal_frequency_deviation': {
        'layer': 'strategic',
        'timeframe': '90d',
        'priority': 'low',
        'description': 'Send frequency too high (>7/week) or too low (<1/week)'
    },
}
