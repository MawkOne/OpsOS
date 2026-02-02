"""
A/B Test Recommendations Detector
Category: Email
Suggests A/B test opportunities for subject lines, send times, and content
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'
def detect_ab_test_recommendations(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Campaigns with high volume but no variation testing
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running A/B Test Recommendations detector...")
    
    opportunities = []
    
    query = f"""
    WITH campaign_stats AS (
      SELECT 
        canonical_entity_id,
        SUM(sends) as total_sends,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        STDDEV(open_rate) as stddev_open_rate,
        COUNT(DISTINCT date) as send_days,
        MIN(date) as first_send,
        MAX(date) as last_send
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
        AND sends > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      total_sends,
      avg_open_rate,
      avg_ctr,
      stddev_open_rate,
      send_days,
      first_send,
      last_send
    FROM campaign_stats
    WHERE total_sends > 5000
      AND send_days > 10
      AND (stddev_open_rate < 3 OR stddev_open_rate IS NULL)
    ORDER BY total_sends DESC
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
            # Determine test priority based on current performance
            if row.avg_open_rate < 20:
                priority = "high"
                test_focus = "subject lines"
            elif row.avg_ctr < 2:
                priority = "medium"
                test_focus = "content and CTAs"
            else:
                priority = "low"
                test_focus = "send time optimization"
            
            # Calculate potential uplift
            potential_uplift = min(30, (25 - row.avg_open_rate) if row.avg_open_rate < 25 else 5)
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_optimization",
                "type": "ab_test_recommendation",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email_campaign",
                "title": f"A/B Test Opportunity: {row.total_sends:,.0f} sends with no variation",
                "description": f"Campaign has high volume ({row.total_sends:,.0f} sends) but low performance variation - ideal for A/B testing {test_focus}",
                "evidence": {
                    "total_sends": int(row.total_sends),
                    "avg_open_rate": float(row.avg_open_rate),
                    "avg_ctr": float(row.avg_ctr),
                    "performance_variation": float(row.stddev_open_rate),
                    "send_frequency": int(row.send_days),
                    "potential_uplift_pct": float(potential_uplift)
                },
                "metrics": {
                    "total_volume": int(row.total_sends),
                    "current_open_rate": float(row.avg_open_rate),
                    "current_ctr": float(row.avg_ctr)
                },
                "hypothesis": f"High-volume campaign ready for optimization through A/B testing - focus on {test_focus}",
                "confidence_score": 0.90,
                "potential_impact_score": min(100, potential_uplift * 3),
                "urgency_score": 65 if priority == "high" else 45,
                "recommended_actions": [
                    "Test 2-3 subject line variations (personalization, urgency, curiosity)",
                    "A/B test send times (morning vs afternoon, weekday vs weekend)",
                    "Test different email content lengths (short vs detailed)",
                    "Experiment with CTA placement and copy",
                    "Test personalization vs generic content",
                    "Try different preview text variations",
                    "Test image-heavy vs text-focused layouts",
                    f"Aim for {potential_uplift:.0f}% improvement in {test_focus}"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "2-4 weeks per test",
                "historical_performance": {
                    "avg_open_rate": float(row.avg_open_rate),
                    "avg_ctr": float(row.avg_ctr),
                    "volume": int(row.total_sends)
                },
                "comparison_data": {
                    "test_focus": test_focus,
                    "potential_uplift": f"{potential_uplift:.0f}%",
                    "statistical_power": "High (sufficient volume for testing)"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} A/B test opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_ab_test_recommendations: {e}")
    
    return opportunities
