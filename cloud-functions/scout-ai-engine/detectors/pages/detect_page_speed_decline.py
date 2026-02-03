"""
Page Speed/Performance Decline Detector
Uses bounce rate + session duration trends as proxy for page performance issues
Increasing bounce + decreasing duration = likely performance degradation
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_page_speed_decline(organization_id: str) -> list:
    """
    Detect pages with performance degradation.
    
    Logic (using behavioral proxies since we don't have direct speed metrics):
    - Bounce rate increasing over time
    - Session duration decreasing over time
    - These patterns often indicate page speed/performance issues
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Page Speed/Performance Decline detector...")
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_bounce_rate) as recent_bounce,
        AVG(avg_session_duration) as recent_duration,
        SUM(sessions) as recent_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH))
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_bounce_rate) as hist_bounce,
        AVG(avg_session_duration) as hist_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH))
        AND year_month < FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH))
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.recent_bounce,
      r.recent_duration,
      r.recent_sessions,
      h.hist_bounce,
      h.hist_duration,
      SAFE_DIVIDE((r.recent_bounce - h.hist_bounce), h.hist_bounce) * 100 as bounce_increase_pct,
      SAFE_DIVIDE((r.recent_duration - h.hist_duration), h.hist_duration) * 100 as duration_change_pct,
      PERCENT_RANK() OVER (ORDER BY r.recent_sessions) as traffic_percentile
    FROM recent_performance r
    INNER JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.recent_sessions >= 100
      AND h.hist_bounce > 0
      AND h.hist_duration > 0
      AND (
        -- Bounce rate increased significantly
        (r.recent_bounce > h.hist_bounce * 1.2 AND r.recent_bounce > 50)
        OR
        -- Session duration dropped significantly 
        (r.recent_duration < h.hist_duration * 0.7 AND r.recent_sessions > 200)
        OR
        -- Both getting worse (strong signal)
        (r.recent_bounce > h.hist_bounce * 1.1 AND r.recent_duration < h.hist_duration * 0.85)
      )
    ORDER BY r.recent_sessions DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            sessions = int(row.recent_sessions)
            recent_bounce = float(row.recent_bounce) if row.recent_bounce else 0
            recent_duration = float(row.recent_duration) if row.recent_duration else 0
            hist_bounce = float(row.hist_bounce) if row.hist_bounce else recent_bounce
            hist_duration = float(row.hist_duration) if row.hist_duration else recent_duration
            bounce_change = float(row.bounce_increase_pct) if row.bounce_increase_pct else 0
            duration_change = float(row.duration_change_pct) if row.duration_change_pct else 0
            
            # Identify the symptoms
            symptoms = []
            if bounce_change > 10:
                symptoms.append(f"bounce rate +{bounce_change:.0f}%")
            if duration_change < -15:
                symptoms.append(f"time on page {duration_change:.0f}%")
            
            symptom_desc = " and ".join(symptoms) if symptoms else "performance declining"
            
            # Estimate impact
            users_bouncing = int(sessions * recent_bounce / 100)
            historical_bouncing = int(sessions * hist_bounce / 100)
            additional_bounces = users_bouncing - historical_bouncing
            
            # Priority based on traffic
            if row.traffic_percentile >= 0.8:
                priority = "high"
            elif row.traffic_percentile >= 0.5:
                priority = "medium"
            else:
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "page_optimization",
                "type": "page_performance_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Performance Decline: {symptom_desc}",
                "description": f"Page showing signs of performance degradation: {symptom_desc}. Bounce rate went from {hist_bounce:.1f}% to {recent_bounce:.1f}%. Session duration from {hist_duration:.0f}s to {recent_duration:.0f}s. This pattern often indicates page speed issues.",
                "evidence": {
                    "sessions": sessions,
                    "recent_bounce_rate": recent_bounce,
                    "historical_bounce_rate": hist_bounce,
                    "bounce_increase_pct": bounce_change,
                    "recent_duration_seconds": recent_duration,
                    "historical_duration_seconds": hist_duration,
                    "duration_change_pct": duration_change,
                    "additional_bounces": additional_bounces,
                    "traffic_percentile": float(row.traffic_percentile)
                },
                "metrics": {
                    "bounce_rate": recent_bounce,
                    "session_duration": recent_duration,
                    "sessions": sessions
                },
                "hypothesis": f"Increasing bounce + decreasing engagement suggests page performance issues. Could be slow load times, broken elements, or recent changes. {additional_bounces:,} more users are bouncing than before.",
                "confidence_score": 0.75,
                "potential_impact_score": min(95, 50 + abs(bounce_change) + abs(duration_change) / 2),
                "urgency_score": 80 if priority == "high" else 60,
                "recommended_actions": [
                    "Run Google PageSpeed Insights test",
                    "Check Core Web Vitals in Search Console",
                    "Review recent code deployments",
                    "Test on mobile devices (often slower)",
                    "Audit third-party scripts and tracking",
                    "Compress images and optimize assets",
                    f"Impact: {additional_bounces:,} additional users bouncing"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-5 days",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} page performance decline issues")
        else:
            logger.info("✅ No page performance decline detected")
            
    except Exception as e:
        logger.error(f"❌ Page Speed/Performance Decline detector error: {e}")
    
    return opportunities
