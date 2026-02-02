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
        SUM(COALESCE(sends, 0)) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    ),
    previous_30_days AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email_campaign'
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
        SUM(COALESCE(sends, 0)) as total_sends,
        SUM(opens) as total_opens,
        SUM(clicks) as total_clicks
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
      HAVING SUM(emails_sent) > 100  -- Meaningful send volume
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
        canonical_entity_id,
        year_month,
        COALESCE(sends, 0) as sends,
        opens,
        open_rate,
        click_through_rate,
        LAG(open_rate, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_1_ago_open_rate,
        LAG(open_rate, 2) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_2_ago_open_rate,
        LAG(click_through_rate, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as month_1_ago_ctr,
        MAX(open_rate) OVER (PARTITION BY canonical_entity_id) as best_open_rate,
        MIN(open_rate) OVER (PARTITION BY canonical_entity_id) as worst_open_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'email_campaign'
        AND COALESCE(sends, 0) > 0
    ),
    
    current_month AS (
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
    FROM current_month
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


def detect_email_bounce_rate_spike(organization_id: str) -> list:
    """
    Detect: Email campaigns with dangerous bounce rates
    Fast Layer: Daily check for deliverability crises
    """
    logger.info("🔍 Running Email Bounce Rate Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(COALESCE(hard_bounce_rate, 0)) as avg_hard_bounce_rate,
        AVG(COALESCE(soft_bounce_rate, 0)) as avg_soft_bounce_rate,
        SUM(COALESCE(sends, 0)) as total_sends,
        SUM(COALESCE(bounces, 0)) as total_bounces
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_bounce_rate,
      avg_hard_bounce_rate,
      avg_soft_bounce_rate,
      total_sends,
      total_bounces
    FROM recent_campaigns
    WHERE avg_bounce_rate > 5  -- 5%+ is concerning, 10%+ is critical
      AND total_sends > 50
    ORDER BY avg_bounce_rate DESC
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
            priority = "high" if row.avg_bounce_rate > 10 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_deliverability",
                "type": "bounce_rate_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"High Bounce Rate: {row.avg_bounce_rate:.1f}%",
                "description": f"Email campaign bounce rate is {row.avg_bounce_rate:.1f}% (hard: {row.avg_hard_bounce_rate:.1f}%, soft: {row.avg_soft_bounce_rate:.1f}%), indicating deliverability issues",
                "evidence": {
                    "bounce_rate": float(row.avg_bounce_rate),
                    "hard_bounce_rate": float(row.avg_hard_bounce_rate),
                    "soft_bounce_rate": float(row.avg_soft_bounce_rate),
                    "total_sends": int(row.total_sends),
                    "total_bounces": int(row.total_bounces),
                },
                "metrics": {
                    "bounce_rate": float(row.avg_bounce_rate),
                    "hard_bounces": float(row.avg_hard_bounce_rate),
                    "soft_bounces": float(row.avg_soft_bounce_rate),
                },
                "hypothesis": "High bounce rate indicates list quality issues, invalid email addresses, or sender reputation problems",
                "confidence_score": 0.9 if row.avg_bounce_rate > 10 else 0.75,
                "potential_impact_score": min(100, row.avg_bounce_rate * 5),
                "urgency_score": 90 if row.avg_bounce_rate > 10 else 70,
                "recommended_actions": [
                    "Check sender reputation and authentication (SPF, DKIM, DMARC)",
                    "Review list quality and acquisition sources",
                    "Remove invalid email addresses immediately",
                    "Consider re-engagement campaign before removing soft bounces",
                    "Contact ESP support if reputation damaged"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 days",
            })
        
        logger.info(f"✅ Email Bounce Rate Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Bounce Rate Spike detector failed: {e}")
    
    return opportunities


def detect_email_spam_complaint_spike(organization_id: str) -> list:
    """
    Detect: Email campaigns with spam complaints
    Fast Layer: Daily check for reputation damage
    """
    logger.info("🔍 Running Email Spam Complaint Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(COALESCE(spam_complaint_rate, 0)) as avg_spam_rate,
        SUM(COALESCE(complaints, 0)) as total_complaints,
        SUM(COALESCE(sends, 0)) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    ),
    baseline_campaigns AS (
      SELECT 
        canonical_entity_id,
        AVG(COALESCE(spam_complaint_rate, 0)) as baseline_spam_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_spam_rate,
      b.baseline_spam_rate,
      r.total_complaints,
      r.total_sends,
      SAFE_DIVIDE((r.avg_spam_rate - b.baseline_spam_rate), b.baseline_spam_rate) * 100 as spam_rate_increase_pct
    FROM recent_campaigns r
    LEFT JOIN baseline_campaigns b ON r.canonical_entity_id = b.canonical_entity_id
    WHERE (r.avg_spam_rate > 0.05  -- >0.05% is concerning, >0.1% is critical
      OR (b.baseline_spam_rate > 0 AND r.avg_spam_rate > b.baseline_spam_rate * 2))  -- 2x spike
      AND r.total_sends > 50
    ORDER BY r.avg_spam_rate DESC
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
            priority = "high" if row.avg_spam_rate > 0.1 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_deliverability",
                "type": "spam_complaint_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"Spam Complaints: {row.avg_spam_rate:.2f}%",
                "description": f"Email campaign spam complaint rate is {row.avg_spam_rate:.2f}%, risking sender reputation and deliverability",
                "evidence": {
                    "current_spam_rate": float(row.avg_spam_rate),
                    "baseline_spam_rate": float(row.baseline_spam_rate) if row.baseline_spam_rate else None,
                    "spam_rate_increase": float(row.spam_rate_increase_pct) if row.spam_rate_increase_pct else None,
                    "total_complaints": int(row.total_complaints),
                    "total_sends": int(row.total_sends),
                },
                "metrics": {
                    "spam_complaint_rate": float(row.avg_spam_rate),
                },
                "hypothesis": "High spam complaints damage sender reputation and will cause long-term deliverability issues (30-60 days to fix)",
                "confidence_score": 0.95,
                "potential_impact_score": min(100, row.avg_spam_rate * 500),  # Scale up since even 0.2% is serious
                "urgency_score": 95 if row.avg_spam_rate > 0.1 else 80,
                "recommended_actions": [
                    "Review content for spam triggers (excessive caps, misleading subject)",
                    "Segment audience better - stop sending to unengaged contacts",
                    "Check acquisition sources for quality",
                    "Make unsubscribe process easier and more prominent",
                    "Consider temporary pause if rate >0.1%"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "2-5 days",
            })
        
        logger.info(f"✅ Email Spam Complaint Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Spam Complaint Spike detector failed: {e}")
    
    return opportunities


def detect_email_list_health_decline(organization_id: str) -> list:
    """
    Detect: Email list health declining (growth slowing, unsubscribes rising)
    Trend Layer: Weekly check for list health issues
    """
    logger.info("🔍 Running Email List Health Decline detector...")
    
    opportunities = []
    
    # Note: This requires list_size tracking over time
    # For now, we'll check unsubscribe rate trends from campaigns
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(COALESCE(unsubscribe_rate, 0)) as avg_unsubscribe_rate,
        SUM(COALESCE(unsubscribes, 0)) as total_unsubscribes,
        SUM(COALESCE(sends, 0)) as total_sends
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(COALESCE(unsubscribe_rate, 0)) as baseline_unsubscribe_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_unsubscribe_rate,
      h.baseline_unsubscribe_rate,
      r.total_unsubscribes,
      r.total_sends,
      SAFE_DIVIDE((r.avg_unsubscribe_rate - h.baseline_unsubscribe_rate), h.baseline_unsubscribe_rate) * 100 as unsubscribe_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE (r.avg_unsubscribe_rate > 0.5  -- >0.5% unsubscribe rate is concerning
      OR (h.baseline_unsubscribe_rate > 0 AND r.avg_unsubscribe_rate > h.baseline_unsubscribe_rate * 1.5))  -- 50% increase
      AND r.total_sends > 100
    ORDER BY r.avg_unsubscribe_rate DESC
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
            priority = "high" if row.avg_unsubscribe_rate > 1.0 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_list_health",
                "type": "list_health_decline",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"High Unsubscribe Rate: {row.avg_unsubscribe_rate:.2f}%",
                "description": f"Email unsubscribe rate is {row.avg_unsubscribe_rate:.2f}%, indicating list health issues",
                "evidence": {
                    "current_unsubscribe_rate": float(row.avg_unsubscribe_rate),
                    "baseline_unsubscribe_rate": float(row.baseline_unsubscribe_rate) if row.baseline_unsubscribe_rate else None,
                    "unsubscribe_increase": float(row.unsubscribe_increase_pct) if row.unsubscribe_increase_pct else None,
                    "total_unsubscribes": int(row.total_unsubscribes),
                    "total_sends": int(row.total_sends),
                },
                "metrics": {
                    "unsubscribe_rate": float(row.avg_unsubscribe_rate),
                },
                "hypothesis": "High unsubscribe rates indicate content relevance issues, sending frequency problems, or poor list acquisition",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, row.avg_unsubscribe_rate * 50),
                "urgency_score": 80 if row.avg_unsubscribe_rate > 1.0 else 60,
                "recommended_actions": [
                    "Reduce email frequency if sending >5x/week",
                    "Segment audience for more relevant content",
                    "Review acquisition sources for quality",
                    "Test re-engagement campaigns",
                    "Improve content value and relevance"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Email List Health Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email List Health Decline detector failed: {e}")
    
    return opportunities


def detect_email_click_to_open_rate_decline(organization_id: str) -> list:
    """
    Detect: Opens stable but clicks declining (content/CTA issue)
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Email Click-to-Open Rate Decline detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(open_rate) as avg_open_rate,
        AVG(click_through_rate) as avg_ctr,
        AVG(COALESCE(click_to_open_rate, 0)) as avg_ctor,
        SUM(COALESCE(sends, 0)) as total_sends,
        SUM(opens) as total_opens,
        SUM(clicks) as total_clicks
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id
    )
    SELECT 
      canonical_entity_id,
      avg_open_rate,
      avg_ctr,
      avg_ctor,
      total_sends,
      total_opens,
      total_clicks
    FROM recent_performance
    WHERE avg_open_rate > 20  -- Good open rate
      AND avg_ctor < 15  -- But poor click-to-open rate
      AND total_sends > 50
    ORDER BY avg_open_rate DESC, avg_ctor ASC
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
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_engagement",
                "type": "click_to_open_decline",
                "priority": "medium",
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": f"Low Click-to-Open Rate: {row.avg_ctor:.1f}%",
                "description": f"Email has good open rate ({row.avg_open_rate:.1f}%) but poor click-to-open rate ({row.avg_ctor:.1f}%), indicating content or CTA issues",
                "evidence": {
                    "open_rate": float(row.avg_open_rate),
                    "click_through_rate": float(row.avg_ctr),
                    "click_to_open_rate": float(row.avg_ctor),
                    "total_sends": int(row.total_sends),
                    "total_opens": int(row.total_opens),
                    "total_clicks": int(row.total_clicks),
                },
                "metrics": {
                    "open_rate": float(row.avg_open_rate),
                    "click_to_open_rate": float(row.avg_ctor),
                },
                "hypothesis": "Subject line is working (good opens) but email content or CTA isn't compelling enough to drive clicks",
                "confidence_score": 0.8,
                "potential_impact_score": 70,
                "urgency_score": 50,
                "recommended_actions": [
                    "Improve CTA placement - put primary CTA above the fold",
                    "Reduce number of links (too many choices = decision paralysis)",
                    "Clarify value proposition of clicking",
                    "Test different CTA copy and button styles",
                    "Add urgency or scarcity elements"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-3 days",
            })
        
        logger.info(f"✅ Email Click-to-Open Rate Decline detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Click-to-Open Rate Decline detector failed: {e}")
    
    return opportunities


def detect_email_optimal_frequency_deviation(organization_id: str) -> list:
    """
    Detect: Email send frequency too high or too low
    Strategic Layer: Monthly check
    """
    logger.info("🔍 Running Email Optimal Frequency Deviation detector...")
    
    opportunities = []
    
    query = f"""
    WITH weekly_sends AS (
      SELECT 
        canonical_entity_id,
        DATE_TRUNC(date, WEEK) as week,
        SUM(emails_sent) as weekly_sends,
        AVG(open_rate) as avg_open_rate,
        AVG(COALESCE(unsubscribe_rate, 0)) as avg_unsubscribe_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'email_campaign'
      GROUP BY canonical_entity_id, week
    )
    SELECT 
      canonical_entity_id,
      AVG(weekly_sends) as avg_weekly_sends,
      AVG(avg_open_rate) as overall_open_rate,
      AVG(avg_unsubscribe_rate) as overall_unsubscribe_rate,
      COUNT(DISTINCT week) as weeks_tracked
    FROM weekly_sends
    GROUP BY canonical_entity_id
    HAVING AVG(weekly_sends) > 7  -- Sending more than 1/day average
      OR AVG(weekly_sends) < 1  -- Less than 1/week
    ORDER BY avg_weekly_sends DESC
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
            is_too_high = row.avg_weekly_sends > 7
            is_too_low = row.avg_weekly_sends < 1
            
            if is_too_high:
                title = f"Email Frequency Too High: {row.avg_weekly_sends:.1f}/week"
                desc = f"Sending {row.avg_weekly_sends:.1f} emails per week on average may lead to fatigue and higher unsubscribes"
                priority = "high" if row.overall_unsubscribe_rate > 0.5 else "medium"
            else:
                title = f"Email Frequency Too Low: {row.avg_weekly_sends:.1f}/week"
                desc = f"Sending only {row.avg_weekly_sends:.1f} emails per week may be missing engagement opportunities"
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "email_optimization",
                "type": "frequency_deviation",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "email",
                "title": title,
                "description": desc,
                "evidence": {
                    "avg_weekly_sends": float(row.avg_weekly_sends),
                    "open_rate": float(row.overall_open_rate),
                    "unsubscribe_rate": float(row.overall_unsubscribe_rate),
                    "weeks_tracked": int(row.weeks_tracked),
                },
                "metrics": {
                    "weekly_frequency": float(row.avg_weekly_sends),
                    "unsubscribe_rate": float(row.overall_unsubscribe_rate),
                },
                "hypothesis": "Too high frequency causes fatigue; too low frequency misses opportunities" if is_too_high else "Low send frequency may be missing revenue and engagement opportunities",
                "confidence_score": 0.7,
                "potential_impact_score": 60 if is_too_high else 40,
                "urgency_score": 60 if is_too_high else 30,
                "recommended_actions": [
                    "Test reducing frequency to 3-5/week" if is_too_high else "Test increasing to 2-4/week",
                    "Segment by engagement level - send more to engaged, less to at-risk",
                    "Use preference center to let subscribers choose frequency",
                    "Monitor unsubscribe rate impact",
                    "A/B test frequency changes with small segment first"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1 week",
            })
        
        logger.info(f"✅ Email Optimal Frequency Deviation detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Email Optimal Frequency Deviation detector failed: {e}")
    
    return opportunities


__all__ = [
    'detect_email_engagement_drop',
    'detect_email_high_opens_low_clicks',
    'detect_email_trends_multitimeframe',
    'detect_email_bounce_rate_spike',
    'detect_email_spam_complaint_spike',
    'detect_email_list_health_decline',
    'detect_email_click_to_open_rate_decline',
    'detect_email_optimal_frequency_deviation',
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
    'detect_email_bounce_rate_spike': {
        'layer': 'fast',
        'timeframe': '7d',
        'priority': 'high',
        'description': 'Detects dangerous bounce rates indicating deliverability crises'
    },
    'detect_email_spam_complaint_spike': {
        'layer': 'fast',
        'timeframe': '7d vs baseline',
        'priority': 'high',
        'description': 'Detects spam complaints that damage sender reputation'
    },
    'detect_email_list_health_decline': {
        'layer': 'trend',
        'timeframe': '30d vs 90d',
        'priority': 'medium',
        'description': 'Detects list health issues via unsubscribe rate increases'
    },
    'detect_email_click_to_open_rate_decline': {
        'layer': 'trend',
        'timeframe': '30d',
        'priority': 'medium',
        'description': 'Opens stable but clicks declining - content/CTA issue'
    },
    'detect_email_optimal_frequency_deviation': {
        'layer': 'strategic',
        'timeframe': '90d',
        'priority': 'low',
        'description': 'Send frequency too high (>7/week) or too low (<1/week)'
    },
}
