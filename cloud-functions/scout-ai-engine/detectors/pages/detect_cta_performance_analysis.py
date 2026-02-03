"""
CTA Performance Analysis Detector
Detects pages where users leave before engaging with CTAs
Uses bounce rate + scroll depth as proxy for CTA visibility/effectiveness
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_cta_performance_analysis(organization_id: str) -> list:
    """
    Detect pages where users aren't reaching or engaging with CTAs.
    
    Logic:
    - High bounce rate (>60%) + Low scroll depth (<50%) = users leave before seeing CTA
    - High traffic makes this a priority issue
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running CTA Performance Analysis detector...")
    opportunities = []
    
    query = f"""
    WITH page_cta_metrics AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        AVG(avg_bounce_rate) as avg_bounce_rate,
        AVG(scroll_depth_avg) as avg_scroll_depth,
        AVG(conversion_rate) as avg_cvr,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type = 'page'
        AND sessions > 50
      GROUP BY canonical_entity_id
    ),
    site_averages AS (
      SELECT 
        AVG(avg_bounce_rate) as site_bounce_rate,
        AVG(avg_scroll_depth) as site_scroll_depth,
        AVG(avg_cvr) as site_cvr
      FROM page_cta_metrics
    )
    SELECT 
      p.*,
      s.site_bounce_rate,
      s.site_scroll_depth,
      s.site_cvr,
      PERCENT_RANK() OVER (ORDER BY p.total_sessions) as traffic_percentile
    FROM page_cta_metrics p
    CROSS JOIN site_averages s
    WHERE p.avg_bounce_rate > 60  -- High bounce
      AND (p.avg_scroll_depth < 50 OR p.avg_scroll_depth IS NULL)  -- Low scroll depth
      AND p.total_sessions >= 100  -- Meaningful traffic
    ORDER BY p.total_sessions DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            sessions = int(row.total_sessions)
            bounce = float(row.avg_bounce_rate) if row.avg_bounce_rate else 0
            scroll = float(row.avg_scroll_depth) if row.avg_scroll_depth else 0
            site_bounce = float(row.site_bounce_rate) if row.site_bounce_rate else 50
            cvr = float(row.avg_cvr) if row.avg_cvr else 0
            
            # Priority based on traffic
            if row.traffic_percentile >= 0.8:
                priority = "high"
            elif row.traffic_percentile >= 0.5:
                priority = "medium"
            else:
                priority = "low"
            
            # Calculate potential - users who bounce never see CTA
            users_not_seeing_cta = int(sessions * (bounce / 100))
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "page_optimization",
                "type": "cta_performance_issue",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"CTA Not Reached: {bounce:.0f}% bounce, {scroll:.0f}% scroll",
                "description": f"High bounce ({bounce:.1f}%) combined with low scroll depth ({scroll:.0f}%) suggests users leave before seeing your CTA. {users_not_seeing_cta:,} users/month never see your call-to-action.",
                "evidence": {
                    "sessions": sessions,
                    "bounce_rate": bounce,
                    "scroll_depth": scroll,
                    "site_avg_bounce": site_bounce,
                    "conversion_rate": cvr,
                    "users_not_seeing_cta": users_not_seeing_cta,
                    "traffic_percentile": float(row.traffic_percentile)
                },
                "metrics": {
                    "bounce_rate": bounce,
                    "scroll_depth": scroll,
                    "sessions": sessions
                },
                "hypothesis": f"CTA may be below the fold or page content isn't compelling enough to scroll. Moving CTA higher or improving above-fold content could capture {users_not_seeing_cta:,} additional engaged users.",
                "confidence_score": 0.82,
                "potential_impact_score": min(95, 50 + (bounce - 50) / 2),
                "urgency_score": 75 if priority == "high" else 55,
                "recommended_actions": [
                    "Move primary CTA above the fold",
                    "Add a compelling hook in first 100 words",
                    "Test sticky CTA that follows scroll",
                    "Improve page load speed to reduce bounce",
                    "Add visual hierarchy to guide eye to CTA",
                    f"Potential: {users_not_seeing_cta:,} users/month could see CTA"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-3 days",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} CTA performance issues")
        else:
            logger.info("✅ No CTA performance issues detected")
            
    except Exception as e:
        logger.error(f"❌ CTA Performance Analysis detector error: {e}")
    
    return opportunities
