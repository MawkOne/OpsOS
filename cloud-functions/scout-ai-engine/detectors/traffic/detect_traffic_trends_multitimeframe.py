"""
Detect Traffic Trends Multi-Timeframe Detector
Category: Traffic
Detects: Long-term traffic trends across 1mo, 3mo, 6mo periods
"""

from google.cloud import bigquery
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_traffic_trends_multitimeframe(organization_id: str) -> list:
    """
    Detect traffic trends across multiple timeframes (1mo, 3mo, 6mo)
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Traffic Trends Multi-Timeframe detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_traffic AS (
      SELECT 
        year_month,
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
      GROUP BY year_month
      ORDER BY year_month DESC
      LIMIT 12
    ),
    ranked AS (
      SELECT 
        year_month,
        total_sessions,
        total_conversions,
        total_revenue,
        ROW_NUMBER() OVER (ORDER BY year_month DESC) as month_rank
      FROM monthly_traffic
    ),
    comparisons AS (
      SELECT
        -- Current month
        MAX(CASE WHEN month_rank = 1 THEN total_sessions END) as current_sessions,
        MAX(CASE WHEN month_rank = 1 THEN total_conversions END) as current_conversions,
        MAX(CASE WHEN month_rank = 1 THEN year_month END) as current_month,
        -- 1 month ago
        MAX(CASE WHEN month_rank = 2 THEN total_sessions END) as sessions_1mo_ago,
        -- 3 months ago
        MAX(CASE WHEN month_rank = 4 THEN total_sessions END) as sessions_3mo_ago,
        -- 6 months ago
        MAX(CASE WHEN month_rank = 7 THEN total_sessions END) as sessions_6mo_ago,
        -- 12 months ago (YoY)
        MAX(CASE WHEN month_rank = 13 THEN total_sessions END) as sessions_12mo_ago
      FROM ranked
    )
    SELECT 
      current_month,
      current_sessions,
      current_conversions,
      sessions_1mo_ago,
      sessions_3mo_ago,
      sessions_6mo_ago,
      sessions_12mo_ago,
      SAFE_DIVIDE(current_sessions - sessions_1mo_ago, NULLIF(sessions_1mo_ago, 0)) * 100 as change_1mo,
      SAFE_DIVIDE(current_sessions - sessions_3mo_ago, NULLIF(sessions_3mo_ago, 0)) * 100 as change_3mo,
      SAFE_DIVIDE(current_sessions - sessions_6mo_ago, NULLIF(sessions_6mo_ago, 0)) * 100 as change_6mo,
      SAFE_DIVIDE(current_sessions - sessions_12mo_ago, NULLIF(sessions_12mo_ago, 0)) * 100 as change_yoy
    FROM comparisons
    WHERE current_sessions IS NOT NULL
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = list(bq_client.query(query, job_config=job_config).result())
        
        for row in results:
            change_1mo = row['change_1mo'] or 0
            change_3mo = row['change_3mo'] or 0
            change_6mo = row['change_6mo'] or 0
            change_yoy = row['change_yoy'] or 0
            
            # Check for consistent decline
            declining_trend = (change_1mo < -10 and change_3mo < -15) or change_6mo < -25
            growing_trend = (change_1mo > 10 and change_3mo > 15) or change_6mo > 25
            
            if declining_trend:
                opportunities.append({
                    'id': str(uuid.uuid4()),
                    'organization_id': organization_id,
                    'detected_at': datetime.utcnow().isoformat(),
                    'category': 'traffic_trend',
                    'type': 'traffic_declining_trend',
                    'priority': 'high',
                    'status': 'new',
                    'entity_id': 'overall_traffic',
                    'entity_type': 'traffic_trend',
                    'title': f"📉 Declining Traffic Trend Detected",
                    'description': f"Traffic is in a declining trend: {change_1mo:.0f}% vs last month, {change_3mo:.0f}% vs 3 months ago, {change_6mo:.0f}% vs 6 months ago.",
                    'evidence': {
                        'current_sessions': int(row['current_sessions'] or 0),
                        'change_1mo': float(change_1mo),
                        'change_3mo': float(change_3mo),
                        'change_6mo': float(change_6mo),
                        'change_yoy': float(change_yoy)
                    },
                    'metrics': {
                        'current_sessions': int(row['current_sessions'] or 0),
                        'sessions_1mo_ago': int(row['sessions_1mo_ago'] or 0),
                        'sessions_3mo_ago': int(row['sessions_3mo_ago'] or 0)
                    },
                    'hypothesis': "Sustained traffic decline indicates systemic issues requiring strategic intervention.",
                    'confidence_score': 0.90,
                    'potential_impact_score': min(100, abs(change_3mo)),
                    'urgency_score': 85,
                    'recommended_actions': [
                        'Conduct comprehensive traffic audit',
                        'Check for SEO ranking drops',
                        'Review content publishing cadence',
                        'Analyze competitor traffic trends',
                        'Evaluate marketing spend ROI',
                        'Consider new traffic acquisition channels'
                    ],
                    'estimated_effort': 'high',
                    'estimated_timeline': '1-3 months',
                    'historical_performance': {},
                    'comparison_data': {},
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
            
            if growing_trend:
                opportunities.append({
                    'id': str(uuid.uuid4()),
                    'organization_id': organization_id,
                    'detected_at': datetime.utcnow().isoformat(),
                    'category': 'traffic_trend',
                    'type': 'traffic_growing_trend',
                    'priority': 'low',
                    'status': 'new',
                    'entity_id': 'overall_traffic',
                    'entity_type': 'traffic_trend',
                    'title': f"📈 Strong Traffic Growth Trend",
                    'description': f"Traffic is growing: +{change_1mo:.0f}% vs last month, +{change_3mo:.0f}% vs 3 months ago. Keep up the momentum!",
                    'evidence': {
                        'current_sessions': int(row['current_sessions'] or 0),
                        'change_1mo': float(change_1mo),
                        'change_3mo': float(change_3mo),
                        'change_6mo': float(change_6mo),
                        'change_yoy': float(change_yoy)
                    },
                    'metrics': {
                        'current_sessions': int(row['current_sessions'] or 0),
                        'growth_rate_3mo': float(change_3mo)
                    },
                    'hypothesis': "Strong growth trend - document what's working and double down.",
                    'confidence_score': 0.88,
                    'potential_impact_score': 60,
                    'urgency_score': 30,
                    'recommended_actions': [
                        'Document successful strategies',
                        'Increase investment in working channels',
                        'Ensure infrastructure can handle growth',
                        'Focus on conversion optimization',
                        'Build on momentum with new content'
                    ],
                    'estimated_effort': 'medium',
                    'estimated_timeline': 'ongoing',
                    'historical_performance': {},
                    'comparison_data': {},
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
        
        logger.info(f"✅ Found {len(opportunities)} traffic trend insights")
        
    except Exception as e:
        logger.error(f"❌ Error in traffic_trends_multitimeframe detector: {e}")
    
    return opportunities
