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
bq_client = bigquery.Client()


def detect_email_engagement_drop(organization_id: str) -> list:
    """
    Detect: Email campaigns with declining engagement
    """
    logger.info("🔍 Running Email Engagement Drop detector...")
    
    opportunities = []
    
    query = f"""
    WITH last_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        SUM(sends) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
    )
    SELECT 
      l.canonical_entity_id,
      l.avg_open_rate as current_open_rate,
      p.avg_open_rate as previous_open_rate,
      l.avg_ctr as current_ctr,
      p.avg_ctr as previous_ctr,
      l.total_sends,
      SAFE_DIVIDE((l.avg_open_rate - p.avg_open_rate), p.avg_open_rate) * 100 as open_rate_change
    FROM last_30_days l
    INNER JOIN previous_30_days p ON l.canonical_entity_id = p.canonical_entity_id
    WHERE SAFE_DIVIDE((l.avg_open_rate - p.avg_open_rate), p.avg_open_rate) < -0.15  -- 15%+ decline
      AND l.total_sends > 100
    ORDER BY open_rate_change ASC
    LIMIT 10
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
            open_change = row['open_rate_change'] or 0
            current_open = row['current_open_rate']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_issue',
                'type': 'engagement_decline',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"📧 Email Engagement Drop: {entity_id}",
                'description': f"Open rate declined {abs(open_change):.1f}% to {current_open:.1f}%. Audience may be fatiguing or content needs refresh.",
                'evidence': {
                    'current_open_rate': current_open,
                    'previous_open_rate': row['previous_open_rate'],
                    'open_rate_change': open_change
                },
                'metrics': {
                    'current_open_rate': current_open,
                    'change_pct': open_change
                },
                'hypothesis': f"Declining email engagement suggests list fatigue, irrelevant content, or deliverability issues. Early intervention prevents further decline.",
                'confidence_score': 0.78,
                'potential_impact_score': min(100, abs(open_change) * 3),
                'urgency_score': 65,
                'recommended_actions': [
                    'Segment list and test different content for each',
                    'Refresh subject line strategies',
                    'Check email deliverability and spam scores',
                    'Remove inactive subscribers',
                    'A/B test send times and frequency',
                    'Survey subscribers for content preferences'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email engagement drop opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_engagement_drop detector: {e}")
    
    return opportunities


def detect_email_high_opens_low_clicks(organization_id: str) -> list:
    """
    PHASE 2A #8: Email High Opens, Low Clicks
    Detect: Email campaigns with good open rates but poor click-through
    """
    logger.info("🔍 Running Email High Opens Low Clicks detector...")
    
    opportunities = []
    
    query = f"""
    WITH email_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        SUM(sends) as total_sends,
        SUM(opens) as total_opens,
        SUM(clicks) as total_clicks
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email'
      GROUP BY canonical_entity_id
      HAVING total_sends > 100  -- Meaningful send volume
    )
    SELECT *
    FROM email_performance
    WHERE avg_open_rate > 20  -- Good open rate (>20%)
      AND avg_ctr < 2  -- Poor click rate (<2%)
    ORDER BY total_opens DESC
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
            entity_id = row['canonical_entity_id']
            open_rate = row['avg_open_rate']
            ctr = row['avg_ctr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_optimization',
                'type': 'high_opens_low_clicks',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'email',
                'title': f"📧 Email Copy Issue: {entity_id}",
                'description': f"Open rate is strong ({open_rate:.1f}%) but click rate is only {ctr:.1f}%. Subject works but body/CTA needs improvement.",
                'evidence': {
                    'open_rate': open_rate,
                    'click_through_rate': ctr,
                    'total_sends': row['total_sends'],
                    'total_opens': row['total_opens'],
                    'total_clicks': row['total_clicks']
                },
                'metrics': {
                    'current_open_rate': open_rate,
                    'current_ctr': ctr,
                    'target_ctr': 3.0
                },
                'hypothesis': f"High opens prove the subject line works. Low clicks indicate body copy, CTA, or offer issues. Fixing this could 2-3x click-through.",
                'confidence_score': 0.82,
                'potential_impact_score': min(100, (3.0 - ctr) * 20),
                'urgency_score': 60,
                'recommended_actions': [
                    'Rewrite body copy to be more concise and action-oriented',
                    'Make primary CTA more prominent and compelling',
                    'Reduce number of CTAs (focus on one primary action)',
                    'Add urgency or scarcity to offer',
                    'Improve CTA button design and placement',
                    'A/B test different copy approaches',
                    'Simplify email design to reduce friction'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '1 week',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email high opens low clicks opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_high_opens_low_clicks detector: {e}")
    
    return opportunities


def detect_email_trends_multitimeframe(organization_id: str) -> list:
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
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.entity_type = 'email'
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


__all__ = [
    'detect_email_engagement_drop',
    'detect_email_high_opens_low_clicks',
    'detect_email_trends_multitimeframe',
]


# Detector metadata
DETECTOR_INFO = {
    'detect_email_engagement_drop': {
        'layer': 'trend',
        'timeframe': '30d vs 30d',
        'priority': 'medium',
        'description': 'Detects email campaigns with declining engagement rates'
    },
    'detect_email_high_opens_low_clicks': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'low',
        'description': 'Emails with good opens but poor click-through (content/CTA issue)'
    },
    'detect_email_trends_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Long-term email performance trends and patterns'
    },
}
