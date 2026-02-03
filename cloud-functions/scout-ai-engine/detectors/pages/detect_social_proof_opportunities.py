"""
Social Proof Opportunities Detector
Detects pages where users engage but don't convert
High engagement (scroll, time) + low CVR = users are interested but need convincing
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_social_proof_opportunities(organization_id: str) -> list:
    """
    Detect pages where users are engaged but not converting.
    
    Logic:
    - Good engagement signals (scroll depth, session duration)
    - But low conversion rate
    - This suggests users are interested but need social proof to commit
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Social Proof Opportunities detector...")
    opportunities = []
    
    query = f"""
    WITH engagement_metrics AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        AVG(avg_session_duration) as avg_duration,
        AVG(scroll_depth_avg) as avg_scroll_depth,
        AVG(avg_bounce_rate) as avg_bounce_rate,
        AVG(conversion_rate) as avg_cvr,
        SUM(conversions) as total_conversions
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type = 'page'
        AND sessions > 50
      GROUP BY canonical_entity_id
    ),
    site_stats AS (
      SELECT 
        AVG(avg_duration) as site_avg_duration,
        AVG(avg_scroll_depth) as site_avg_scroll,
        AVG(avg_cvr) as site_avg_cvr,
        PERCENTILE_CONT(avg_cvr, 0.5) OVER() as median_cvr
      FROM engagement_metrics
      LIMIT 1
    )
    SELECT 
      e.*,
      s.site_avg_duration,
      s.site_avg_scroll,
      s.site_avg_cvr,
      PERCENT_RANK() OVER (ORDER BY e.total_sessions) as traffic_percentile,
      PERCENT_RANK() OVER (ORDER BY e.avg_duration) as engagement_percentile
    FROM engagement_metrics e
    CROSS JOIN site_stats s
    WHERE e.total_sessions >= 200
      AND (
        -- High engagement but low CVR
        (e.avg_duration > s.site_avg_duration * 1.2 AND e.avg_cvr < s.site_avg_cvr * 0.7)
        OR
        -- Good scroll depth but low CVR  
        (e.avg_scroll_depth > 60 AND e.avg_cvr < s.site_avg_cvr * 0.8)
        OR
        -- Low bounce + low CVR (users stay but don't convert)
        (e.avg_bounce_rate < 40 AND e.avg_cvr < s.site_avg_cvr * 0.7 AND e.total_sessions > 500)
      )
    ORDER BY e.total_sessions DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            sessions = int(row.total_sessions)
            duration = float(row.avg_duration) if row.avg_duration else 0
            scroll = float(row.avg_scroll_depth) if row.avg_scroll_depth else 0
            bounce = float(row.avg_bounce_rate) if row.avg_bounce_rate else 50
            cvr = float(row.avg_cvr) if row.avg_cvr else 0
            site_cvr = float(row.site_avg_cvr) if row.site_avg_cvr else cvr
            
            # Identify the engagement signals
            engagement_signals = []
            if duration > 60:
                engagement_signals.append(f"{duration:.0f}s avg time on page")
            if scroll > 60:
                engagement_signals.append(f"{scroll:.0f}% scroll depth")
            if bounce < 40:
                engagement_signals.append(f"only {bounce:.0f}% bounce")
            
            engagement_desc = ", ".join(engagement_signals) if engagement_signals else "good engagement"
            
            # Calculate opportunity
            engaged_non_converters = int(sessions * (1 - bounce/100) * (1 - cvr/100))
            potential_if_site_avg = int(sessions * site_cvr / 100)
            additional_conversions = potential_if_site_avg - int(row.total_conversions or 0)
            
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
                "type": "social_proof_opportunity",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Engaged but Not Converting: {cvr:.2f}% CVR",
                "description": f"Users show strong engagement ({engagement_desc}) but only {cvr:.2f}% convert vs {site_cvr:.2f}% site average. {engaged_non_converters:,} engaged visitors leave without converting. Social proof could push them over the edge.",
                "evidence": {
                    "sessions": sessions,
                    "avg_duration_seconds": duration,
                    "scroll_depth": scroll,
                    "bounce_rate": bounce,
                    "conversion_rate": cvr,
                    "site_avg_cvr": site_cvr,
                    "engaged_non_converters": engaged_non_converters,
                    "potential_additional_conversions": additional_conversions,
                    "traffic_percentile": float(row.traffic_percentile),
                    "engagement_percentile": float(row.engagement_percentile)
                },
                "metrics": {
                    "sessions": sessions,
                    "conversion_rate": cvr,
                    "engagement_score": (duration/60 + scroll/100 + (100-bounce)/100) / 3 * 100
                },
                "hypothesis": f"High engagement + low conversion = users are interested but need convincing. Adding social proof (reviews, testimonials, case studies) could convert {additional_conversions:,} more visitors.",
                "confidence_score": 0.78,
                "potential_impact_score": min(95, 50 + additional_conversions / 5),
                "urgency_score": 70 if priority == "high" else 55,
                "recommended_actions": [
                    "Add customer testimonials above the fold",
                    "Display star ratings and review counts",
                    "Add 'X customers served' or 'Y people viewing' badges",
                    "Include case studies or success stories",
                    "Show trust badges (security, guarantees)",
                    f"Potential: +{additional_conversions:,} conversions with social proof"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-3 days",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} social proof opportunities")
        else:
            logger.info("✅ No social proof opportunities detected")
            
    except Exception as e:
        logger.error(f"❌ Social Proof Opportunities detector error: {e}")
    
    return opportunities
