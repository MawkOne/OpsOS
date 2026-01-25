"""
Additional Scout AI Detectors
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


def detect_cross_channel_gaps(organization_id: str) -> list:
    """
    Detect: Pages performing well organically but not supported by paid
    or vice versa
    """
    logger.info("🔍 Running Cross-Channel Gaps detector...")
    
    opportunities = []
    
    query = f"""
    WITH ga_metrics AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as organic_sessions,
        AVG(conversion_rate) as avg_conversion_rate,
        SUM(revenue) as total_revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
        AND JSON_EXTRACT_SCALAR(source_breakdown, '$.ga4') IS NOT NULL
      GROUP BY canonical_entity_id
      HAVING organic_sessions > 100
    ),
    ads_spend AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_ad_spend
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
        AND cost > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      g.*,
      COALESCE(a.total_ad_spend, 0) as ad_spend
    FROM ga_metrics g
    LEFT JOIN ads_spend a ON g.canonical_entity_id = a.canonical_entity_id
    WHERE (a.total_ad_spend IS NULL OR a.total_ad_spend < 10)  -- Little to no ad spend
      AND g.avg_conversion_rate > 2.0  -- Good conversion rate
    ORDER BY g.total_revenue DESC
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
            sessions = row['organic_sessions']
            conv_rate = row['avg_conversion_rate']
            revenue = row['total_revenue']
            ad_spend = row['ad_spend']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cross_channel',
                'type': 'organic_winner_no_paid_support',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🎯 Cross-Channel Gap: {entity_id}",
                'description': f"This page gets {sessions} organic sessions with {conv_rate:.1f}% conversion but only ${ad_spend:.2f} in ad spend. Supporting with paid could amplify success.",
                'evidence': json.dumps({
                    'organic_sessions': sessions,
                    'conversion_rate': conv_rate,
                    'revenue': revenue,
                    'ad_spend': ad_spend
                }),
                'metrics': json.dumps({
                    'current_sessions': sessions,
                    'current_conversion_rate': conv_rate,
                    'current_ad_spend': ad_spend
                }),
                'hypothesis': f"This page proves it converts organically. Adding targeted paid traffic could scale revenue without the risk of testing an unproven page.",
                'confidence_score': 0.80,
                'potential_impact_score': min(100, (revenue / 100)),
                'urgency_score': 60,
                'recommended_actions': [
                    'Create Google Ads campaign targeting this page',
                    'Use high-converting organic keywords in paid campaigns',
                    'Start with small budget to test incrementality',
                    'Monitor if paid traffic converts at similar rate to organic',
                    'Scale budget based on performance'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': json.dumps({}),
                'comparison_data': json.dumps({}),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} cross-channel gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cross_channel_gaps detector: {e}")
    
    return opportunities


def detect_keyword_cannibalization(organization_id: str) -> list:
    """
    Detect: Multiple pages competing for the same keywords
    causing ranking dilution
    """
    logger.info("🔍 Running Keyword Cannibalization detector...")
    
    opportunities = []
    
    query = f"""
    WITH keyword_page_mapping AS (
      SELECT 
        k.canonical_entity_id as keyword_id,
        p.canonical_entity_id as page_id,
        AVG(k.position) as avg_position,
        SUM(k.sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` k
      INNER JOIN `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` p
        ON k.organization_id = p.organization_id
        AND k.date = p.date
      WHERE k.organization_id = @org_id
        AND k.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND k.entity_type = 'keyword'
        AND p.entity_type = 'page'
      GROUP BY keyword_id, page_id
    ),
    cannibalization_cases AS (
      SELECT 
        keyword_id,
        COUNT(DISTINCT page_id) as competing_pages,
        AVG(avg_position) as avg_position,
        SUM(total_sessions) as total_sessions
      FROM keyword_page_mapping
      GROUP BY keyword_id
      HAVING COUNT(DISTINCT page_id) > 1  -- Multiple pages
        AND AVG(avg_position) > 10  -- Not ranking great
    )
    SELECT *
    FROM cannibalization_cases
    ORDER BY competing_pages DESC, avg_position DESC
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
            keyword_id = row['keyword_id']
            competing_pages = row['competing_pages']
            position = row['avg_position']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_issue',
                'type': 'keyword_cannibalization',
                'priority': 'medium',
                'status': 'new',
                'entity_id': keyword_id,
                'entity_type': 'keyword',
                'title': f"⚠️ Keyword Cannibalization: {keyword_id}",
                'description': f"{competing_pages} pages are competing for this keyword (avg position: {position:.1f}). Consolidating could improve rankings.",
                'evidence': json.dumps({
                    'competing_pages': competing_pages,
                    'avg_position': position
                }),
                'metrics': json.dumps({
                    'competing_pages': competing_pages,
                    'current_position': position
                }),
                'hypothesis': f"When multiple pages target the same keyword, search engines struggle to determine which to rank, diluting authority and resulting in poor rankings for all.",
                'confidence_score': 0.75,
                'potential_impact_score': min(100, (competing_pages * 15)),
                'urgency_score': 50,
                'recommended_actions': [
                    'Audit all pages ranking for this keyword',
                    'Consolidate content into one authoritative page',
                    '301 redirect weaker pages to the main page',
                    'Update internal linking to point to canonical page',
                    'Add canonical tags if pages must stay separate',
                    'Monitor rankings after consolidation'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '2-4 weeks',
                'historical_performance': json.dumps({}),
                'comparison_data': json.dumps({}),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} keyword cannibalization opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in keyword_cannibalization detector: {e}")
    
    return opportunities


def detect_cost_inefficiency(organization_id: str) -> list:
    """
    Detect: High-cost entities with poor ROI
    """
    logger.info("🔍 Running Cost Inefficiency detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        SUM(cost) as total_cost,
        SUM(revenue) as total_revenue,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(revenue), SUM(cost)) as roas,
        SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cpa
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND cost > 0
      GROUP BY canonical_entity_id, entity_type
      HAVING total_cost > 100  -- Spending at least $100
    )
    SELECT *
    FROM recent_performance
    WHERE roas < 1.0  -- Losing money
    ORDER BY total_cost DESC
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
            entity_type = row['entity_type']
            cost = row['total_cost']
            revenue = row['total_revenue']
            roas = row['roas'] or 0
            cpa = row['cpa'] or 0
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'cost_inefficiency',
                'type': 'negative_roi',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"💸 Cost Inefficiency: {entity_id}",
                'description': f"This {entity_type} has spent ${cost:.2f} but only generated ${revenue:.2f} (ROAS: {roas:.2f}x). Consider pausing or optimizing.",
                'evidence': json.dumps({
                    'total_cost': cost,
                    'total_revenue': revenue,
                    'roas': roas,
                    'cpa': cpa
                }),
                'metrics': json.dumps({
                    'current_cost': cost,
                    'current_revenue': revenue,
                    'current_roas': roas
                }),
                'hypothesis': f"With ROAS below 1.0x, every dollar spent loses money. Either optimize or reallocate budget to better-performing entities.",
                'confidence_score': 0.92,
                'potential_impact_score': min(100, (cost - revenue) / 10),
                'urgency_score': 85,
                'recommended_actions': [
                    'Pause this campaign immediately to stop losses',
                    'Audit targeting and keywords',
                    'Review landing page conversion rate',
                    'Check if tracking is working correctly',
                    'Compare to better-performing campaigns',
                    'Either fix or reallocate budget'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 week',
                'historical_performance': json.dumps({}),
                'comparison_data': json.dumps({}),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} cost inefficiency opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cost_inefficiency detector: {e}")
    
    return opportunities


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
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
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
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
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
                'evidence': json.dumps({
                    'current_open_rate': current_open,
                    'previous_open_rate': row['previous_open_rate'],
                    'open_rate_change': open_change
                }),
                'metrics': json.dumps({
                    'current_open_rate': current_open,
                    'change_pct': open_change
                }),
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
                'historical_performance': json.dumps({}),
                'comparison_data': json.dumps({}),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email engagement drop opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_engagement_drop detector: {e}")
    
    return opportunities
