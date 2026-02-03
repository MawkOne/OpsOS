"""
List Segmentation Opportunities Detector
Category: Email
Identifies under-segmented audiences with engagement variance
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import logging
import uuid
import os

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'
def detect_list_segmentation_opportunities(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Lists with high engagement variance suggesting segmentation opportunities
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running List Segmentation Opportunities detector...")
    
    opportunities = []
    
    query = f"""
    WITH campaign_engagement AS (
      SELECT 
        canonical_entity_id,
        date,
        open_rate,
        click_through_rate,
        sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND entity_type IN ('email', 'email_campaign')
        AND sends > 100
    ),
    list_stats AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        STDDEV(open_rate) as stddev_open_rate,
        AVG(click_through_rate) as avg_ctr,
        STDDEV(click_through_rate) as stddev_ctr,
        SUM(sends) as total_sends,
        COUNT(DISTINCT date) as send_count
      FROM campaign_engagement
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_open_rate,
      stddev_open_rate,
      avg_ctr,
      stddev_ctr,
      total_sends,
      send_count,
      SAFE_DIVIDE(stddev_open_rate, avg_open_rate) * 100 as cv_open_rate
    FROM list_stats
    WHERE total_sends > 500
      AND send_count > 5
      AND stddev_open_rate > 5
      AND SAFE_DIVIDE(stddev_open_rate, avg_open_rate) > 0.25
    ORDER BY cv_open_rate DESC
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
            cv = row.cv_open_rate if row.cv_open_rate else 0
            priority = "high" if cv > 40 else "medium"
            
            # Estimate segments based on variance
            suggested_segments = 3 if cv > 50 else 2
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "email_optimization",
                "type": "segmentation_opportunity",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email_campaign",
                "title": f"Segmentation Opportunity: {cv:.0f}% engagement variance",
                "description": f"Campaign shows high engagement variance ({row.stddev_open_rate:.1f}% stdev) across {row.total_sends:,.0f} sends - segment for better targeting",
                "evidence": {
                    "avg_open_rate": float(row.avg_open_rate),
                    "stddev_open_rate": float(row.stddev_open_rate),
                    "coefficient_of_variation": float(cv),
                    "avg_ctr": float(row.avg_ctr) if row.avg_ctr else 0,
                    "total_sends": int(row.total_sends),
                    "send_count": int(row.send_count),
                    "suggested_segments": suggested_segments
                },
                "metrics": {
                    "engagement_variance": float(cv),
                    "total_sends": int(row.total_sends)
                },
                "hypothesis": "High engagement variance indicates diverse audience behaviors - segmentation will improve relevance and performance",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, cv * 1.5),
                "urgency_score": 60 if priority == "high" else 45,
                "recommended_actions": [
                    f"Create {suggested_segments} engagement-based segments (high/medium/low)",
                    "Segment by last engagement date (active vs dormant)",
                    "Test different content for each segment",
                    "Adjust send frequency by engagement level",
                    "Create re-engagement campaign for low-engagement segment",
                    "Use behavioral data (clicks, purchases) for segmentation",
                    "Implement lead scoring for prioritization",
                    "A/B test personalized vs generic content by segment"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "2-3 weeks",
                "historical_performance": {
                    "avg_open_rate": float(row.avg_open_rate),
                    "engagement_variance": float(row.stddev_open_rate),
                    "total_sends": int(row.total_sends)
                },
                "comparison_data": {
                    "variance_level": "High" if cv > 40 else "Medium",
                    "suggested_segments": suggested_segments,
                    "total_sends": f"{row.total_sends:,.0f} sends"
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} list segmentation opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in detect_list_segmentation_opportunities: {e}")
    
    return opportunities
