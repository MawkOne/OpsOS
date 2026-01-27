"""
Detect Email Trends Multitimeframe Detector
Category: Email
"""

"""
EMAIL Detectors
All detection layers (Fast, Trend, Strategic) for email marketing
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_email_trends_multitimeframe(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Enhanced Email Analysis with Monthly Trends
    Detects: Email performance patterns across multiple months
    """
    logger.info("🔍 Running Email Trends (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_email AS (
      SELECT 
        m.canonical_entity_id,
        m.year_month,
        m.sends,
        m.opens,
        m.open_rate,
        m.click_through_rate,
        LAG(m.open_rate, 1) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_1_ago_open_rate,
        LAG(m.open_rate, 2) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_2_ago_open_rate,
        LAG(m.click_through_rate, 1) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as month_1_ago_ctr,
        MAX(m.open_rate) OVER (PARTITION BY m.canonical_entity_id) as best_open_rate,
        MIN(m.open_rate) OVER (PARTITION BY m.canonical_entity_id) as worst_open_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        
      WHERE m.organization_id = @org_id
        AND e.entity_type = 'email'
        AND m.sends > 0
    ),
    
    current AS (
      SELECT 
        canonical_entity_id,
        year_month,
        sends,
        opens,
        open_rate,
        click_through_rate,
        month_1_ago_open_rate,
        month_2_ago_open_rate,
        month_1_ago_ctr,
        best_open_rate,
        worst_open_rate,
        
        SAFE_DIVIDE(open_rate - month_1_ago_open_rate, month_1_ago_open_rate) * 100 as mom_open_change,
        SAFE_DIVIDE(month_1_ago_open_rate - month_2_ago_open_rate, month_2_ago_open_rate) * 100 as prev_mom_open_change,
        SAFE_DIVIDE(click_through_rate - month_1_ago_ctr, month_1_ago_ctr) * 100 as mom_ctr_change,
        
        -- Count declining months
        CASE 
          WHEN open_rate < month_1_ago_open_rate AND month_1_ago_open_rate < month_2_ago_open_rate THEN 3
          WHEN open_rate < month_1_ago_open_rate THEN 2
          ELSE 0
        END as consecutive_declining_months
        
      FROM monthly_email
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_email)
    )
    
    SELECT *
    FROM current
    WHERE (
      ABS(mom_open_change) > 15  -- 15%+ change in open rate
      OR consecutive_declining_months >= 2
      OR (open_rate > 20 AND click_through_rate < 2)  -- High opens, low clicks
    )
    ORDER BY consecutive_declining_months DESC, ABS(mom_open_change) DESC
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            entity_id = row['canonical_entity_id']
            open_rate = row['open_rate']
            ctr = row['click_through_rate']
            mom_open = row['mom_open_change'] or 0
            consecutive = row['consecutive_declining_months']
            
            # Determine issue type
            if open_rate > 20 and ctr < 2:
                issue_type = 'high_opens_low_clicks'
                title_prefix = '📧 Email Copy Issue'
            elif consecutive >= 2:
                issue_type = 'engagement_decline_multimo'
                title_prefix = '📉 Email Engagement Declining'
            else:
                issue_type = 'open_rate_change'
                title_prefix = '⚠️ Email Performance Change'
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_trend',
                'type': issue_type,
                'priority': 'high' if consecutive >= 2 else 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"{title_prefix}: {entity_id}",
                'description': f"Open rate: {open_rate:.1f}% ({mom_open:+.1f}% MoM), CTR: {ctr:.1f}%. " + 
                              (f"{consecutive} consecutive months declining." if consecutive >= 2 else f"Monthly change: {mom_open:+.1f}%"),
                'evidence': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'mom_open_change': mom_open,
                    'consecutive_declining_months': consecutive,
                    'best_open_rate': row['best_open_rate'],
                    'worst_open_rate': row['worst_open_rate']
                },
                'metrics': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'mom_change': mom_open
                },
                'hypothesis': f"{'Sustained email engagement decline over multiple months suggests list fatigue or content relevance issues.' if consecutive >= 2 else 'High opens but low clicks indicate subject line works but body/CTA needs improvement.' if issue_type == 'high_opens_low_clicks' else 'Significant change in email performance requires investigation.'}",
                'confidence_score': min(0.95, 0.72 + (consecutive * 0.10)),
                'potential_impact_score': min(100, abs(mom_open) * 3),
                'urgency_score': 75 if consecutive >= 2 else 60,
                'recommended_actions': [
                    f"PATTERN: {consecutive} months of decline" if consecutive >= 2 else "Recent performance change",
                    'Segment list by engagement level',
                    'Test different subject line approaches',
                    'Refresh content and offers',
                    'Check deliverability and spam scores',
                    'Remove inactive subscribers',
                    'A/B test send times and frequency'
                ] if consecutive >= 2 else [
                    'Rewrite body copy for clarity and action',
                    'Simplify to single primary CTA',
                    'Improve CTA button design',
                    'Add urgency or scarcity',
                    'Test different offer positioning'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email trend (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_trends_multitimeframe detector: {e}")
    
    return opportunities
