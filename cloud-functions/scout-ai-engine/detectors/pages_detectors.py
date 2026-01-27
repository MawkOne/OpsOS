"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
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


def detect_high_traffic_low_conversion_pages(organization_id: str) -> list:
    """
    PHASE 2A #3: High Traffic, Low Conversion Pages
    Detect: Pages getting significant traffic but converting poorly
    """
    logger.info("🔍 Running High Traffic Low CVR Pages detector...")
    
    opportunities = []
    
    query = f"""
    WITH page_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_cvr,
        SUM(conversions) as total_conversions,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(avg_session_duration) as avg_duration
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
      HAVING total_sessions > 100  -- Meaningful traffic
    ),
    peer_avg AS (
      SELECT 
        AVG(avg_cvr) as site_avg_cvr
      FROM page_performance
    )
    SELECT 
      p.*,
      pa.site_avg_cvr,
      PERCENT_RANK() OVER (ORDER BY total_sessions) as traffic_percentile,
      PERCENT_RANK() OVER (ORDER BY avg_cvr) as cvr_percentile
    FROM page_performance p
    CROSS JOIN peer_avg pa
    WHERE traffic_percentile > 0.70  -- Top 30% traffic
      AND avg_cvr < pa.site_avg_cvr * 0.80  -- 20% below site average
    ORDER BY total_sessions DESC
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
            sessions = row['total_sessions']
            cvr = row['avg_cvr']
            site_avg = row['site_avg_cvr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'page_optimization',
                'type': 'high_traffic_low_cvr',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"🎯 High-Traffic, Low-CVR Page: {entity_id}",
                'description': f"This page gets {sessions:,.0f} sessions (top 30%) but converts at {cvr:.2f}% vs site avg {site_avg:.2f}%. Huge optimization opportunity.",
                'evidence': {
                    'total_sessions': sessions,
                    'conversion_rate': cvr,
                    'site_avg_cvr': site_avg,
                    'cvr_vs_avg': ((cvr / site_avg) - 1) * 100,
                    'traffic_percentile': row['traffic_percentile'],
                    'bounce_rate': row['avg_bounce_rate']
                },
                'metrics': {
                    'current_sessions': sessions,
                    'current_cvr': cvr,
                    'target_cvr': site_avg
                },
                'hypothesis': f"If this page converted at site average, it would generate {sessions * (site_avg / 100):.0f} conversions vs current {row['total_conversions']}. Massive leverage opportunity.",
                'confidence_score': 0.88,
                'potential_impact_score': min(100, ((site_avg - cvr) / cvr) * sessions / 10),
                'urgency_score': 75,
                'recommended_actions': [
                    'A/B test new headline and value proposition',
                    'Simplify primary CTA',
                    'Add social proof and trust signals',
                    'Reduce form fields if applicable',
                    'Improve page load speed',
                    'Test different page layouts',
                    'Add exit-intent popup for high-bounce visitors'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '2-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} high-traffic low-CVR page opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in high_traffic_low_conversion_pages detector: {e}")
    
    return opportunities


def detect_page_engagement_decay(organization_id: str) -> list:
    """
    PHASE 2A #4: Page Engagement Decay
    Detect: Pages with declining engagement metrics (early warning before CVR drops)
    """
    logger.info("🔍 Running Page Engagement Decay detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_engagement AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_session_duration) as avg_duration,
        AVG(bounce_rate) as avg_bounce,
        AVG(engagement_rate) as avg_engagement,
        SUM(sessions) as total_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_engagement AS (
      SELECT 
        canonical_entity_id,
        AVG(avg_session_duration) as avg_duration,
        AVG(bounce_rate) as avg_bounce,
        AVG(engagement_rate) as avg_engagement
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_duration as recent_duration,
      h.avg_duration as historical_duration,
      r.avg_bounce as recent_bounce,
      h.avg_bounce as historical_bounce,
      r.total_sessions,
      SAFE_DIVIDE((r.avg_duration - h.avg_duration), h.avg_duration) * 100 as duration_change_pct,
      SAFE_DIVIDE((r.avg_bounce - h.avg_bounce), h.avg_bounce) * 100 as bounce_change_pct
    FROM recent_engagement r
    INNER JOIN historical_engagement h 
      ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.total_sessions > 50  -- Meaningful traffic
      AND (
        SAFE_DIVIDE((r.avg_duration - h.avg_duration), h.avg_duration) < -0.20  -- 20%+ drop in duration
        OR SAFE_DIVIDE((r.avg_bounce - h.avg_bounce), h.avg_bounce) > 0.15  -- 15%+ increase in bounce
      )
    ORDER BY ABS(duration_change_pct) DESC
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
            duration_change = row['duration_change_pct'] or 0
            bounce_change = row['bounce_change_pct'] or 0
            
            primary_issue = 'duration' if abs(duration_change) > abs(bounce_change) else 'bounce_rate'
            primary_change = duration_change if primary_issue == 'duration' else bounce_change
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'page_optimization',
                'type': 'engagement_decay',
                'priority': 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'page',
                'title': f"⚠️ Engagement Decay: {entity_id}",
                'description': f"{'Session duration dropped' if primary_issue == 'duration' else 'Bounce rate increased'} {abs(primary_change):.1f}% vs historical baseline. Early warning signal.",
                'evidence': {
                    'recent_duration': row['recent_duration'],
                    'historical_duration': row['historical_duration'],
                    'duration_change_pct': duration_change,
                    'recent_bounce': row['recent_bounce'],
                    'historical_bounce': row['historical_bounce'],
                    'bounce_change_pct': bounce_change
                },
                'metrics': {
                    'current_duration': row['recent_duration'],
                    'current_bounce': row['recent_bounce'],
                    'change_pct': primary_change
                },
                'hypothesis': f"Declining engagement metrics often precede conversion rate drops. Catching this early allows intervention before revenue is impacted.",
                'confidence_score': 0.72,
                'potential_impact_score': min(100, abs(primary_change) * 2),
                'urgency_score': 65,
                'recommended_actions': [
                    'Review recent page changes or updates',
                    'Check page load speed and performance',
                    'Analyze user behavior with heatmaps',
                    'Test different content above the fold',
                    'Improve internal linking to keep users engaged',
                    'Add more compelling CTAs earlier on page',
                    'Check mobile vs desktop experience'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} page engagement decay opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in page_engagement_decay detector: {e}")
    
    return opportunities


def detect_scale_winners_multitimeframe(organization_id: str) -> list:
    """
    Enhanced Scale Winners with Monthly Momentum
    Detects: High CVR entities with low traffic, prioritizing those with improving CVR trends
    """
    logger.info("🔍 Running Scale Winners (Multi-Timeframe) detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_performance AS (
      SELECT 
        m.canonical_entity_id,
        m.entity_type,
        m.year_month,
        m.conversion_rate,
        m.sessions,
        m.revenue,
        LAG(m.conversion_rate, 1) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_1_ago_cvr,
        LAG(m.conversion_rate, 2) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_2_ago_cvr,
        LAG(m.sessions, 1) OVER (PARTITION BY m.canonical_entity_id, m.entity_type ORDER BY m.year_month) as month_1_ago_sessions,
        MAX(m.conversion_rate) OVER (PARTITION BY m.canonical_entity_id, m.entity_type) as best_cvr_ever,
        STDDEV(m.conversion_rate) OVER (PARTITION BY m.canonical_entity_id, m.entity_type) / AVG(m.conversion_rate) OVER (PARTITION BY m.canonical_entity_id, m.entity_type) as cvr_volatility
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE m.organization_id = @org_id
        AND m.entity_type IN ('page', 'campaign')
        AND m.sessions > 10
    ),
    
    current_month AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        conversion_rate as current_cvr,
        sessions as current_sessions,
        revenue as current_revenue,
        month_1_ago_cvr,
        month_2_ago_cvr,
        month_1_ago_sessions,
        best_cvr_ever,
        cvr_volatility,
        
        -- CVR momentum
        CASE 
          WHEN conversion_rate > month_1_ago_cvr AND month_1_ago_cvr > month_2_ago_cvr THEN 'Improving'
          WHEN conversion_rate < month_1_ago_cvr AND month_1_ago_cvr < month_2_ago_cvr THEN 'Declining'
          WHEN cvr_volatility < 0.15 THEN 'Stable'
          ELSE 'Volatile'
        END as cvr_momentum,
        
        SAFE_DIVIDE(conversion_rate - month_1_ago_cvr, month_1_ago_cvr) * 100 as mom_cvr_change
        
      FROM monthly_performance
      WHERE year_month = (SELECT MAX(year_month) FROM monthly_performance)
        AND conversion_rate > 2.0  -- Minimum CVR threshold
    ),
    
    peer_benchmarks AS (
      SELECT 
        entity_type,
        APPROX_QUANTILES(current_cvr, 100)[OFFSET(70)] as cvr_p70,
        APPROX_QUANTILES(current_sessions, 100)[OFFSET(30)] as sessions_p30
      FROM current_month
      GROUP BY entity_type
    )
    
    SELECT 
      c.*,
      p.cvr_p70,
      p.sessions_p30
    FROM current_month c
    JOIN peer_benchmarks p ON c.entity_type = p.entity_type
    WHERE c.current_cvr > p.cvr_p70  -- Top 30% CVR
      AND c.current_sessions < p.sessions_p30  -- Bottom 30% traffic
    ORDER BY 
      CASE 
        WHEN cvr_momentum = 'Improving' THEN 1
        WHEN cvr_momentum = 'Stable' THEN 2
        ELSE 3
      END,
      current_cvr DESC
    LIMIT 20
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
            cvr = row['current_cvr']
            sessions = row['current_sessions']
            momentum = row['cvr_momentum']
            mom_cvr = row['mom_cvr_change'] or 0
            volatility = row['cvr_volatility'] or 0
            
            # Priority based on momentum
            if momentum == 'Improving':
                priority = 'high'
                confidence = 0.92
            elif momentum == 'Stable':
                priority = 'high'
                confidence = 0.88
            else:
                priority = 'medium'
                confidence = 0.75
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'scale_winner',
                'type': f'high_cvr_low_traffic_{momentum.lower()}',
                'priority': priority,
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🚀 Scale Winner ({momentum} CVR): {entity_id}",
                'description': f"CVR {cvr:.1f}% (top 30%) with only {sessions:,.0f} sessions. {momentum} trend ({mom_cvr:+.1f}% MoM). {'Low volatility' if volatility < 0.15 else 'Some volatility'} = {'High' if momentum == 'Improving' else 'Good'} confidence scale opportunity.",
                'evidence': {
                    'current_cvr': cvr,
                    'current_sessions': sessions,
                    'cvr_momentum': momentum,
                    'mom_cvr_change': mom_cvr,
                    'cvr_volatility': volatility,
                    'best_cvr_ever': row['best_cvr_ever'],
                    'month_1_ago_cvr': row['month_1_ago_cvr'],
                    'month_2_ago_cvr': row['month_2_ago_cvr']
                },
                'metrics': {
                    'current_conversion_rate': cvr,
                    'current_sessions': sessions,
                    'momentum': momentum
                },
                'hypothesis': f"{'Improving CVR over multiple months + proven conversion ability = HIGH confidence scale opportunity. CVR trend shows this is getting BETTER, not a fluke.' if momentum == 'Improving' else 'Stable CVR over time = Predictable, reliable performance. Low risk to scale.' if momentum == 'Stable' else 'High CVR but volatile. Test with caution before scaling aggressively.'}",
                'confidence_score': confidence,
                'potential_impact_score': min(100, cvr * 8),
                'urgency_score': 75 if momentum == 'Improving' else 65,
                'recommended_actions': [
                    f"MOMENTUM: CVR {momentum.lower()} monthly - {'capitalize on this positive trend!' if momentum == 'Improving' else 'proven stable performer' if momentum == 'Stable' else 'investigate volatility before scaling'}",
                    'Increase paid ad budget targeting this page/campaign',
                    'Create content linking to this high-converting asset',
                    'Feature prominently in email campaigns',
                    'Improve SEO for related keywords',
                    'Add CTAs from high-traffic pages',
                    'Monitor CVR as traffic scales to ensure it holds'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {
                    'best_cvr_ever': row['best_cvr_ever'],
                    'cvr_volatility': volatility
                },
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} scale winner (multi-timeframe) opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in scale_winners_multitimeframe detector: {e}")
    
    return opportunities



def detect_scale_winners(organization_id: str) -> list:
    """
    Detect: Entities performing well but not getting enough resources
    Example: Page with high conversion rate but low traffic
    """
    logger.info("🔍 Running Scale Winners detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(roas) as avg_roas,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('page', 'campaign')
      GROUP BY canonical_entity_id, entity_type
      HAVING total_sessions > 10  -- Minimum threshold
    ),
    ranked AS (
      SELECT 
        *,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY avg_conversion_rate) as conversion_percentile,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY total_sessions) as traffic_percentile
      FROM recent_metrics
    )
    SELECT *
    FROM ranked
    WHERE conversion_percentile > 0.7  -- Top 30% performers
      AND traffic_percentile < 0.3     -- Bottom 30% traffic
      AND avg_conversion_rate > 2.0    -- Minimum conversion rate
    ORDER BY avg_conversion_rate DESC
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
            conv_rate = row['avg_conversion_rate']
            sessions = row['total_sessions']
            revenue = row['total_revenue']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'scale_winner',
                'type': 'high_conversion_low_traffic',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🚀 Scale Winner: {entity_id}",
                'description': f"This {entity_type} has {conv_rate:.1f}% conversion rate (top 30%) but only {sessions} sessions (bottom 30%). Increasing traffic could significantly boost revenue.",
                'evidence': {
                    'conversion_rate': conv_rate,
                    'sessions': sessions,
                    'revenue': revenue,
                    'conversion_percentile': row['conversion_percentile'],
                    'traffic_percentile': row['traffic_percentile']
                },
                'metrics': {
                    'current_conversion_rate': conv_rate,
                    'current_sessions': sessions,
                    'current_revenue': revenue
                },
                'hypothesis': f"This {entity_type} converts well but gets little traffic. Directing more qualified traffic here could multiply revenue with minimal additional effort.",
                'confidence_score': 0.85,
                'potential_impact_score': min(100, (conv_rate * 10)),
                'urgency_score': 70,
                'recommended_actions': [
                    'Increase paid ad budget for this target',
                    'Create more content linking to this page',
                    'Improve SEO for related keywords',
                    'Feature this in email campaigns',
                    'Add prominent CTAs from high-traffic pages'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} scale winner opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in scale_winners detector: {e}")
    
    return opportunities


def detect_fix_losers(organization_id: str) -> list:
    """
    Detect: Entities getting traffic but performing poorly
    Example: High-traffic page with terrible conversion rate
    """
    logger.info("🔍 Running Fix Losers detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_metrics AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(bounce_rate) as avg_bounce_rate,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(cost) as total_cost
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('page', 'campaign')
      GROUP BY canonical_entity_id, entity_type
      HAVING total_sessions > 50  -- Significant traffic
    ),
    ranked AS (
      SELECT 
        *,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY avg_conversion_rate) as conversion_percentile,
        PERCENT_RANK() OVER (PARTITION BY entity_type ORDER BY total_sessions) as traffic_percentile
      FROM recent_metrics
    )
    SELECT *
    FROM ranked
    WHERE traffic_percentile > 0.5    -- Top 50% traffic
      AND conversion_percentile < 0.3  -- Bottom 30% conversion
    ORDER BY total_sessions DESC
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
            conv_rate = row['avg_conversion_rate']
            bounce_rate = row['avg_bounce_rate']
            sessions = row['total_sessions']
            cost = row['total_cost']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'fix_loser',
                'type': 'high_traffic_low_conversion',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"🔧 Fix Opportunity: {entity_id}",
                'description': f"This {entity_type} gets {sessions} sessions but only {conv_rate:.1f}% conversion rate. Small improvements here could have huge impact.",
                'evidence': {
                    'conversion_rate': conv_rate,
                    'bounce_rate': bounce_rate,
                    'sessions': sessions,
                    'cost': cost,
                    'traffic_percentile': row['traffic_percentile']
                },
                'metrics': {
                    'current_conversion_rate': conv_rate,
                    'current_bounce_rate': bounce_rate,
                    'current_sessions': sessions
                },
                'hypothesis': f"With {sessions} sessions, even a 1% improvement in conversion could generate significant additional revenue. High bounce rate ({bounce_rate:.1f}%) suggests UX or messaging issues.",
                'confidence_score': 0.90,
                'potential_impact_score': min(100, (sessions / 10)),
                'urgency_score': 80,
                'recommended_actions': [
                    'A/B test different headlines and CTAs',
                    'Improve page load speed',
                    'Clarify value proposition',
                    'Add trust signals (testimonials, reviews)',
                    'Simplify the conversion process',
                    'Check mobile experience'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} fix loser opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in fix_losers detector: {e}")
    
    return opportunities


__all__ = ['detect_high_traffic_low_conversion_pages', 'detect_page_engagement_decay', 'detect_scale_winners_multitimeframe', 'detect_scale_winners', 'detect_fix_losers']
