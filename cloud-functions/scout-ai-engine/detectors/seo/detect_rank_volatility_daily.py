"""
Rank Volatility Daily Detector

Detects: Keywords with unstable/volatile rankings day-over-day
Layer: fast
Category: seo
Data Source: DataForSEO keyword position tracking
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_rank_volatility_daily(organization_id: str) -> list:
    """Detect keywords with high ranking volatility that need stability investigation"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Rank Volatility Daily detector...")
    
    opportunities = []
    
    query = f"""
    WITH daily_positions AS (
      SELECT 
        m.canonical_entity_id,
        m.date,
        m.seo_position,
        m.seo_position_change,
        m.seo_search_volume,
        m.sessions,
        LAG(m.seo_position) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.date) as prev_position,
        ABS(m.seo_position_change) as abs_change
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      WHERE m.organization_id = @org_id
        AND m.entity_type = 'page'
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND m.seo_position IS NOT NULL
        AND m.seo_search_volume > 100  -- Focus on keywords with meaningful volume
    ),
    volatility_stats AS (
      SELECT 
        canonical_entity_id,
        AVG(seo_position) as avg_position,
        STDDEV(seo_position) as position_stddev,
        MAX(seo_position) - MIN(seo_position) as position_range,
        AVG(abs_change) as avg_daily_change,
        MAX(abs_change) as max_daily_change,
        COUNT(DISTINCT date) as days_tracked,
        MAX(seo_search_volume) as search_volume,
        SUM(sessions) as total_sessions
      FROM daily_positions
      GROUP BY canonical_entity_id
      HAVING COUNT(DISTINCT date) >= 7  -- At least 7 days of data
    )
    SELECT 
      canonical_entity_id,
      avg_position,
      position_stddev,
      position_range,
      avg_daily_change,
      max_daily_change,
      days_tracked,
      search_volume,
      total_sessions,
      -- Volatility score (0-100, higher = more volatile)
      LEAST(100, 
        (position_stddev * 10) +  -- Standard deviation weight
        (avg_daily_change * 5) +  -- Average change weight
        (position_range / 2)      -- Range weight
      ) as volatility_score
    FROM volatility_stats
    WHERE 
      position_stddev > 2  -- Significant standard deviation
      OR avg_daily_change > 3  -- Average change > 3 positions per day
      OR position_range > 10  -- Range > 10 positions
    ORDER BY 
      search_volume DESC,  -- Prioritize high-volume keywords
      volatility_score DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            volatility_score = float(row.volatility_score)
            
            # Determine severity and priority
            if volatility_score > 60 or row.search_volume > 1000:
                priority = "high"
                severity = "severe"
            elif volatility_score > 40:
                priority = "medium"
                severity = "moderate"
            else:
                priority = "medium"
                severity = "mild"
            
            # Build recommended actions based on patterns
            actions = [
                "Investigate algorithm updates or competitor changes",
                "Analyze content for consistency and relevance",
                "Check for technical issues affecting crawlability",
                "Review backlink profile for sudden changes",
                "Monitor for negative SEO attacks",
                "Stabilize on-page optimization factors",
                "Consider canonical URL issues"
            ]
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "seo_opportunity",
                "type": "rank_volatility_daily",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"High Rank Volatility: {row.canonical_entity_id}",
                "description": f"Keyword rankings fluctuating {row.avg_daily_change:.1f} positions/day on average (range: {row.position_range:.0f} positions). {severity.title()} volatility affecting SEO stability.",
                "evidence": {
                    "avg_position": float(row.avg_position),
                    "position_stddev": float(row.position_stddev),
                    "position_range": int(row.position_range),
                    "avg_daily_change": float(row.avg_daily_change),
                    "max_daily_change": float(row.max_daily_change),
                    "volatility_score": volatility_score,
                    "search_volume": int(row.search_volume),
                    "days_tracked": int(row.days_tracked),
                    "total_sessions": int(row.total_sessions),
                    "severity": severity
                },
                "metrics": {
                    "volatility_score": volatility_score,
                    "avg_position": float(row.avg_position),
                    "position_range": int(row.position_range),
                    "search_volume": int(row.search_volume)
                },
                "hypothesis": f"Stabilizing rankings will protect {int(row.search_volume):,} monthly search volume and improve traffic predictability",
                "confidence_score": 0.85,
                "potential_impact_score": min(90, 50 + (row.search_volume / 100)),
                "urgency_score": min(95, 60 + (volatility_score / 2)),
                "recommended_actions": actions[:5],
                "estimated_effort": "medium",
                "estimated_timeline": "2-6 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} keywords with high rank volatility")
        else:
            logger.info("✅ No significant rank volatility detected")
            
    except Exception as e:
        logger.error(f"❌ Rank Volatility detector failed: {e}")
    
    return opportunities
