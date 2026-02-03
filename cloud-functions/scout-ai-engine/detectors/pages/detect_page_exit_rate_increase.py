"""
Detect Page Exit Rate Increase Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict

from .priority_filter import get_priority_pages_where_clause, calculate_traffic_priority, calculate_impact_score

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_page_exit_rate_increase(organization_id: str, priority_pages: Optional[Dict] = None) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Exit rate increasing on important pages
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Exit Rate Increase detector...")
    
    # Build priority pages filter if provided
    priority_filter = get_priority_pages_where_clause(priority_pages)
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(exit_rate) as avg_exit_rate,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type = 'page'
        {priority_filter}
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(exit_rate) as baseline_exit_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        
      WHERE organization_id = @org_id
        AND entity_type = 'page'
        {priority_filter}
      GROUP BY canonical_entity_id
    ),
    ranked AS (
      SELECT 
        r.*,
        h.baseline_exit_rate,
        SAFE_DIVIDE((r.avg_exit_rate - h.baseline_exit_rate), h.baseline_exit_rate) * 100 as exit_rate_increase_pct,
        PERCENT_RANK() OVER (ORDER BY r.total_sessions) as traffic_percentile
      FROM recent_performance r
      LEFT JOIN historical_performance h USING (canonical_entity_id)
      WHERE h.baseline_exit_rate > 0
    )
    SELECT *
    FROM ranked
    WHERE avg_exit_rate > baseline_exit_rate * 1.2  -- 20%+ increase
      AND total_sessions > 100
    ORDER BY exit_rate_increase_pct DESC
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
            sessions = int(row.total_sessions)
            exit_increase = float(row.exit_rate_increase_pct)
            traffic_pct = float(row.traffic_percentile)
            
            # Priority based on traffic distribution from last 3 months
            traffic_priority = calculate_traffic_priority(sessions, traffic_pct)
            
            # Boost priority if exit rate increase is severe (>50% increase)
            if traffic_priority == 'medium' and exit_increase > 50:
                priority = 'high'
            elif traffic_priority == 'low' and exit_increase > 75:
                priority = 'medium'
            else:
                priority = traffic_priority
            
            # Impact based on traffic percentile × severity
            exiting_sessions = int(sessions * (row.avg_exit_rate / 100))
            impact_score = calculate_impact_score(sessions, traffic_pct, improvement_factor=min(exit_increase / 30, 1.4))
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "engagement_optimization",
                "type": "exit_rate_increase",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Exit Rate Increasing: {row.avg_exit_rate:.1f}% (+{exit_increase:.1f}%)",
                "description": f"Exit rate up to {row.avg_exit_rate:.1f}% from {row.baseline_exit_rate:.1f}% on page with {sessions:,} sessions",
                "evidence": {
                    "current_exit_rate": float(row.avg_exit_rate),
                    "baseline_exit_rate": float(row.baseline_exit_rate),
                    "exit_rate_increase_pct": exit_increase,
                    "total_sessions": sessions,
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "exit_rate": float(row.avg_exit_rate),
                },
                "hypothesis": f"{exiting_sessions:,} sessions are exiting this page. Missing next steps, broken links, or content not meeting user intent.",
                "confidence_score": 0.80,
                "potential_impact_score": impact_score,
                "urgency_score": 85 if priority == 'high' else (70 if priority == 'medium' else 55),
                "recommended_actions": [
                    "Add clear next steps and CTAs",
                    "Check for broken internal links",
                    "Add related content links",
                    "Review page intent vs actual content",
                    "Test different CTA placements",
                    "Add exit-intent popups with offers",
                    f"{exiting_sessions:,} sessions exiting - keep them engaged"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "3-5 days",
            })
        
        logger.info(f"✅ Exit Rate Increase detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Exit Rate Increase detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_high_traffic_low_conversion_pages', 
    'detect_page_engagement_decay', 
    'detect_scale_winners_multitimeframe', 
    'detect_scale_winners', 
    'detect_fix_losers',
    'detect_page_form_abandonment_spike',
    'detect_page_cart_abandonment_increase',
    'detect_page_error_rate_spike',
    'detect_page_micro_conversion_drop',
    'detect_page_exit_rate_increase'
]
