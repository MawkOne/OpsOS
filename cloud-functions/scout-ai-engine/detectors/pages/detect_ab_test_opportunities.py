"""
A/B Test Opportunities Detector
Identifies pages that are good candidates for A/B testing
High traffic + inconsistent CVR = high potential for optimization through testing
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_ab_test_opportunities(organization_id: str) -> list:
    """
    Identify pages that would benefit most from A/B testing.
    
    Logic:
    - High traffic (more data = faster tests)
    - High variance in CVR across months (inconsistent = room to find what works)
    - Below-average CVR (room for improvement)
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running A/B Test Opportunities detector...")
    opportunities = []
    
    query = f"""
    WITH monthly_cvr AS (
      SELECT 
        canonical_entity_id,
        year_month,
        SUM(sessions) as monthly_sessions,
        AVG(conversion_rate) as monthly_cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH))
        AND entity_type = 'page'
        AND sessions > 20
      GROUP BY canonical_entity_id, year_month
    ),
    page_stats AS (
      SELECT 
        canonical_entity_id,
        COUNT(DISTINCT year_month) as months_of_data,
        SUM(monthly_sessions) as total_sessions,
        AVG(monthly_cvr) as avg_cvr,
        STDDEV(monthly_cvr) as cvr_stddev,
        MAX(monthly_cvr) as max_cvr,
        MIN(monthly_cvr) as min_cvr,
        -- Coefficient of variation: higher = more inconsistent
        SAFE_DIVIDE(STDDEV(monthly_cvr), AVG(monthly_cvr)) * 100 as cvr_cv
      FROM monthly_cvr
      GROUP BY canonical_entity_id
      HAVING COUNT(DISTINCT year_month) >= 3  -- Need at least 3 months of data
    ),
    site_avg AS (
      SELECT AVG(avg_cvr) as site_avg_cvr FROM page_stats
    )
    SELECT 
      p.*,
      s.site_avg_cvr,
      PERCENT_RANK() OVER (ORDER BY p.total_sessions) as traffic_percentile
    FROM page_stats p
    CROSS JOIN site_avg s
    WHERE p.total_sessions >= 500  -- Need traffic for meaningful tests
      AND (
        -- High variance in CVR (inconsistent performance)
        p.cvr_cv > 30
        OR
        -- Below average CVR with decent traffic (room to improve)
        (p.avg_cvr < s.site_avg_cvr * 0.9 AND p.total_sessions >= 1000)
        OR
        -- Big gap between best and worst month (found something that works)
        (p.max_cvr > p.min_cvr * 2 AND p.total_sessions >= 500)
      )
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
            avg_cvr = float(row.avg_cvr) if row.avg_cvr else 0
            site_avg = float(row.site_avg_cvr) if row.site_avg_cvr else avg_cvr
            cvr_cv = float(row.cvr_cv) if row.cvr_cv else 0
            max_cvr = float(row.max_cvr) if row.max_cvr else avg_cvr
            min_cvr = float(row.min_cvr) if row.min_cvr else avg_cvr
            
            # Determine why this is a good test candidate
            if cvr_cv > 30:
                reason = f"CVR varies {cvr_cv:.0f}% month-to-month"
                test_hypothesis = "High variance suggests external factors or inconsistent UX. A/B test can isolate what works."
            elif max_cvr > min_cvr * 2:
                reason = f"Best month ({max_cvr:.2f}%) was {max_cvr/max(min_cvr, 0.01):.1f}x worst ({min_cvr:.2f}%)"
                test_hypothesis = "Something caused a high-performing month. A/B test can identify and replicate it."
            else:
                reason = f"CVR {avg_cvr:.2f}% vs site avg {site_avg:.2f}%"
                test_hypothesis = "Below-average performance with high traffic = high ROI testing opportunity."
            
            # Calculate test potential
            if avg_cvr < max_cvr:
                potential_lift = ((max_cvr - avg_cvr) / max(avg_cvr, 0.01)) * 100
                potential_conversions = int(sessions * (max_cvr - avg_cvr) / 100)
            else:
                potential_lift = 20  # Assume 20% potential improvement
                potential_conversions = int(sessions * avg_cvr * 0.2 / 100)
            
            # Days to reach statistical significance (rough estimate)
            daily_sessions = sessions / 180  # 6 months of data
            days_to_significance = max(14, int(1000 / max(daily_sessions, 1)))  # Need ~1000 sessions per variant
            
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
                "type": "ab_test_opportunity",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"A/B Test Candidate: {reason}",
                "description": f"This page has {sessions:,} sessions making it ideal for A/B testing. {reason}. Potential uplift: +{potential_lift:.0f}% ({potential_conversions:,} additional conversions).",
                "evidence": {
                    "sessions": sessions,
                    "avg_cvr": avg_cvr,
                    "site_avg_cvr": site_avg,
                    "cvr_variance_pct": cvr_cv,
                    "max_cvr": max_cvr,
                    "min_cvr": min_cvr,
                    "months_of_data": int(row.months_of_data),
                    "potential_lift_pct": potential_lift,
                    "potential_conversions": potential_conversions,
                    "days_to_significance": days_to_significance,
                    "traffic_percentile": float(row.traffic_percentile)
                },
                "metrics": {
                    "sessions": sessions,
                    "conversion_rate": avg_cvr,
                    "cvr_variance": cvr_cv
                },
                "hypothesis": test_hypothesis,
                "confidence_score": 0.80,
                "potential_impact_score": min(95, 50 + potential_lift / 2),
                "urgency_score": 70 if priority == "high" else 50,
                "recommended_actions": [
                    "Test headline variations (clarity, urgency, benefit-focused)",
                    "Test CTA button (color, text, placement)",
                    "Test page layout (single vs multi-column)",
                    "Test social proof placement",
                    "Test form length (fewer fields)",
                    f"Estimated test duration: {days_to_significance} days for significance"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": f"{days_to_significance}-{days_to_significance * 2} days",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} A/B test opportunities")
        else:
            logger.info("✅ No A/B test opportunities detected")
            
    except Exception as e:
        logger.error(f"❌ A/B Test Opportunities detector error: {e}")
    
    return opportunities
