"""Traffic Quality by Source Detector"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_traffic_quality_by_source(organization_id: str) -> list:
    """Detect traffic sources with poor quality metrics"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Traffic Quality by Source detector...")
    opportunities = []
    
    query = f"""
    WITH source_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions,
        SUM(pageviews) as pageviews,
        SUM(conversions) as conversions,
        SUM(revenue) as revenue,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(pages_per_session) as avg_pages_per_session,
        AVG(dwell_time) as avg_dwell_time,
        AVG(engagement_rate) as avg_engagement_rate,
        -- Calculate quality score
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as cvr,
        SAFE_DIVIDE(SUM(revenue), SUM(sessions)) as revenue_per_session
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND entity_type = 'traffic_source'
        AND sessions > 50
      GROUP BY canonical_entity_id
    ),
    overall_benchmarks AS (
      SELECT 
        AVG(avg_bounce_rate) as benchmark_bounce,
        AVG(cvr) as benchmark_cvr,
        AVG(avg_engagement_rate) as benchmark_engagement,
        AVG(revenue_per_session) as benchmark_rps
      FROM source_performance
      WHERE sessions > 100  -- Use substantial sources for benchmark
    )
    SELECT 
      sp.*,
      ob.benchmark_bounce,
      ob.benchmark_cvr,
      ob.benchmark_engagement,
      ob.benchmark_rps,
      -- Calculate quality score (0-100)
      CAST(
        (
          -- Bounce rate (lower is better, 25 points)
          (1 - SAFE_DIVIDE(sp.avg_bounce_rate, NULLIF(ob.benchmark_bounce, 0))) * 25 +
          -- CVR (higher is better, 35 points)
          SAFE_DIVIDE(sp.cvr, NULLIF(ob.benchmark_cvr, 0)) * 35 +
          -- Engagement (higher is better, 20 points)
          SAFE_DIVIDE(sp.avg_engagement_rate, NULLIF(ob.benchmark_engagement, 0)) * 20 +
          -- Pages per session (higher is better, 20 points)
          SAFE_DIVIDE(sp.avg_pages_per_session, 3.0) * 20
        ) AS INT64
      ) as quality_score
    FROM source_performance sp
    CROSS JOIN overall_benchmarks ob
    WHERE sp.sessions > 100  -- Meaningful volume
    ORDER BY 
      CASE 
        WHEN quality_score < 50 THEN sessions  -- Prioritize high-volume low-quality
        ELSE -quality_score  -- Then by worst quality
      END DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            quality_score = int(row.quality_score) if row.quality_score else 50
            
            # Identify quality issues
            issues = []
            if row.avg_bounce_rate and row.benchmark_bounce and row.avg_bounce_rate > row.benchmark_bounce * 1.3:
                issues.append(f"High bounce rate ({row.avg_bounce_rate:.0f}%)")
            if row.cvr and row.benchmark_cvr and row.cvr < row.benchmark_cvr * 0.5:
                issues.append(f"Low conversion rate ({row.cvr:.1f}%)")
            if row.avg_engagement_rate and row.benchmark_engagement and row.avg_engagement_rate < row.benchmark_engagement * 0.7:
                issues.append(f"Low engagement ({row.avg_engagement_rate:.0f}%)")
            if row.avg_pages_per_session and row.avg_pages_per_session < 1.5:
                issues.append(f"Low pages/session ({row.avg_pages_per_session:.1f})")
            
            # Determine priority based on volume + quality
            if quality_score < 40 or (quality_score < 60 and row.sessions > 1000):
                priority = "high"
            elif quality_score < 60:
                priority = "medium"
            else:
                priority = "low"
            
            # Skip if actually high quality
            if quality_score > 70:
                continue
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "traffic_optimization",
                "type": "traffic_quality_by_source",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "traffic_source",
                "title": f"Low Quality Traffic (Score: {quality_score}/100): {row.canonical_entity_id}",
                "description": f"Traffic source has quality score of {quality_score}/100 with {int(row.sessions)} sessions. Issues: {', '.join(issues)}",
                "evidence": {
                    "quality_score": quality_score,
                    "sessions": int(row.sessions),
                    "conversions": int(row.conversions) if row.conversions else 0,
                    "cvr": float(row.cvr) if row.cvr else 0,
                    "bounce_rate": float(row.avg_bounce_rate) if row.avg_bounce_rate else None,
                    "engagement_rate": float(row.avg_engagement_rate) if row.avg_engagement_rate else None,
                    "pages_per_session": float(row.avg_pages_per_session) if row.avg_pages_per_session else None,
                    "revenue_per_session": float(row.revenue_per_session) if row.revenue_per_session else 0,
                    "benchmark_cvr": float(row.benchmark_cvr) if row.benchmark_cvr else None,
                    "quality_issues": issues
                },
                "metrics": {
                    "quality_score": quality_score,
                    "sessions": int(row.sessions),
                    "conversion_rate": float(row.cvr) if row.cvr else 0
                },
                "hypothesis": f"Improving traffic quality or reallocating budget could increase conversions by {int(row.sessions * 0.03)} with same traffic volume",
                "confidence_score": 0.82,
                "potential_impact_score": min(90, 50 + (100 - quality_score) / 2),
                "urgency_score": 80 if priority == "high" else 60,
                "recommended_actions": [
                    "Analyze landing pages this source sends traffic to",
                    "Review ad copy/messaging for relevance",
                    "Consider reducing spend on this source",
                    "Test different audience targeting",
                    "Optimize landing page experience for this source",
                    "Check for bot/spam traffic",
                    "A/B test source-specific landing pages"
                ][:6],
                "estimated_effort": "medium",
                "estimated_timeline": "2-4 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} low-quality traffic sources")
        else:
            logger.info("✅ No low-quality traffic sources detected")
            
    except Exception as e:
        logger.error(f"❌ Traffic Quality by Source detector error: {e}")
    
    return opportunities
