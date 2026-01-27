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


def detect_page_form_abandonment_spike(organization_id: str) -> list:
    """
    Detect: Form abandonment rate spiking
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Form Abandonment Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(form_abandonment_rate) as avg_abandonment_rate,
        SUM(form_starts) as total_form_starts,
        SUM(form_submits) as total_form_submits
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
        AND form_starts > 0
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(form_abandonment_rate) as baseline_abandonment_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'page'
        AND form_starts > 0
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_abandonment_rate,
      h.baseline_abandonment_rate,
      r.total_form_starts,
      r.total_form_submits,
      SAFE_DIVIDE((r.avg_abandonment_rate - h.baseline_abandonment_rate), h.baseline_abandonment_rate) * 100 as abandonment_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.avg_abandonment_rate > 50  -- >50% abandonment is concerning
      OR (h.baseline_abandonment_rate > 0 AND r.avg_abandonment_rate > h.baseline_abandonment_rate * 1.2)  -- 20%+ increase
      AND r.total_form_starts > 20
    ORDER BY r.avg_abandonment_rate DESC
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
            priority = "high" if row.avg_abandonment_rate > 70 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "conversion_optimization",
                "type": "form_abandonment_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Form Abandonment Spike: {row.avg_abandonment_rate:.1f}%",
                "description": f"Form abandonment at {row.avg_abandonment_rate:.1f}% (baseline: {row.baseline_abandonment_rate:.1f}%)",
                "evidence": {
                    "current_abandonment_rate": float(row.avg_abandonment_rate),
                    "baseline_abandonment_rate": float(row.baseline_abandonment_rate) if row.baseline_abandonment_rate else None,
                    "abandonment_increase_pct": float(row.abandonment_increase_pct) if row.abandonment_increase_pct else None,
                    "total_form_starts": int(row.total_form_starts),
                    "total_form_submits": int(row.total_form_submits),
                },
                "metrics": {
                    "form_abandonment_rate": float(row.avg_abandonment_rate),
                },
                "hypothesis": "Form friction, too many fields, technical errors, or trust issues causing abandonment",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, row.avg_abandonment_rate * 0.8),
                "urgency_score": 85 if row.avg_abandonment_rate > 70 else 65,
                "recommended_actions": [
                    "Reduce form fields - remove non-essential questions",
                    "Add progress indicators for multi-step forms",
                    "Check for technical errors (JavaScript console)",
                    "Add trust signals near submit button",
                    "Test autofill and validation",
                    "Consider breaking into smaller steps",
                    f"Potential conversions: {int(row.total_form_starts * (row.avg_abandonment_rate / 100))} form starts lost"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "3-5 days",
            })
        
        logger.info(f"✅ Form Abandonment Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Form Abandonment Spike detector failed: {e}")
    
    return opportunities


def detect_page_cart_abandonment_increase(organization_id: str) -> list:
    """
    Detect: Cart abandonment rate increasing
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Cart Abandonment Increase detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(cart_abandonment_rate) as avg_cart_abandonment,
        SUM(add_to_cart) as total_add_to_cart,
        SUM(begin_checkout) as total_begin_checkout,
        SUM(purchase_count) as total_purchases
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND add_to_cart > 0
    ),
    historical_performance AS (
      SELECT 
        AVG(cart_abandonment_rate) as baseline_cart_abandonment
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND add_to_cart > 0
    )
    SELECT 
      r.avg_cart_abandonment as current_cart_abandonment,
      h.baseline_cart_abandonment,
      r.total_add_to_cart,
      r.total_begin_checkout,
      r.total_purchases,
      SAFE_DIVIDE((r.avg_cart_abandonment - h.baseline_cart_abandonment), h.baseline_cart_abandonment) * 100 as cart_abandonment_increase_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE r.avg_cart_abandonment > 60  -- >60% is concerning
      OR (h.baseline_cart_abandonment > 0 AND r.avg_cart_abandonment > h.baseline_cart_abandonment * 1.15)  -- 15%+ increase
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
            priority = "high" if row.current_cart_abandonment > 75 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "conversion_optimization",
                "type": "cart_abandonment_increase",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "ecommerce",
                "title": f"Cart Abandonment Increasing: {row.current_cart_abandonment:.1f}%",
                "description": f"Cart abandonment at {row.current_cart_abandonment:.1f}%, up from {row.baseline_cart_abandonment:.1f}%",
                "evidence": {
                    "current_cart_abandonment": float(row.current_cart_abandonment),
                    "baseline_cart_abandonment": float(row.baseline_cart_abandonment),
                    "cart_abandonment_increase_pct": float(row.cart_abandonment_increase_pct),
                    "total_add_to_cart": int(row.total_add_to_cart),
                    "total_begin_checkout": int(row.total_begin_checkout),
                    "total_purchases": int(row.total_purchases),
                },
                "metrics": {
                    "cart_abandonment_rate": float(row.current_cart_abandonment),
                },
                "hypothesis": "Shipping costs, checkout friction, payment issues, or lack of trust causing cart abandonment",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, row.current_cart_abandonment * 0.8),
                "urgency_score": 85 if row.current_cart_abandonment > 75 else 65,
                "recommended_actions": [
                    "Review shipping costs - too high or surprise fees?",
                    "Simplify checkout process - reduce steps",
                    "Add more payment options",
                    "Display trust badges and security info",
                    "Test guest checkout option",
                    "Send cart abandonment emails",
                    f"Revenue recovery potential: {int(row.total_add_to_cart - row.total_purchases)} abandoned carts"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Cart Abandonment Increase detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Cart Abandonment Increase detector failed: {e}")
    
    return opportunities


def detect_page_error_rate_spike(organization_id: str) -> list:
    """
    Detect: Page error rate spiking (JS errors, 404s, etc.)
    Fast Layer: Daily check
    """
    logger.info("🔍 Running Page Error Rate Spike detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(error_count) as total_errors,
        SUM(sessions) as total_sessions,
        SAFE_DIVIDE(SUM(error_count), SUM(sessions)) * 100 as error_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        SAFE_DIVIDE(SUM(error_count), SUM(sessions)) * 100 as baseline_error_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.error_rate as current_error_rate,
      h.baseline_error_rate,
      r.total_errors,
      r.total_sessions,
      SAFE_DIVIDE((r.error_rate - h.baseline_error_rate), h.baseline_error_rate) * 100 as error_rate_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE r.error_rate > 5  -- >5% error rate is concerning
      OR (h.baseline_error_rate > 0 AND r.error_rate > h.baseline_error_rate * 2)  -- 2x increase
      AND r.total_sessions > 50
    ORDER BY r.error_rate DESC
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
            priority = "high" if row.current_error_rate > 10 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "technical_health",
                "type": "page_error_spike",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Page Error Rate Spiking: {row.current_error_rate:.1f}%",
                "description": f"Page errors at {row.current_error_rate:.1f}% of sessions (baseline: {row.baseline_error_rate:.1f}%)",
                "evidence": {
                    "current_error_rate": float(row.current_error_rate),
                    "baseline_error_rate": float(row.baseline_error_rate) if row.baseline_error_rate else None,
                    "error_rate_increase_pct": float(row.error_rate_increase_pct) if row.error_rate_increase_pct else None,
                    "total_errors": int(row.total_errors),
                    "total_sessions": int(row.total_sessions),
                },
                "metrics": {
                    "error_rate": float(row.current_error_rate),
                },
                "hypothesis": "JavaScript errors, broken API calls, or deployment issues affecting user experience",
                "confidence_score": 0.95,
                "potential_impact_score": min(100, row.current_error_rate * 5),
                "urgency_score": 95 if row.current_error_rate > 10 else 75,
                "recommended_actions": [
                    "Check browser console for JavaScript errors",
                    "Review recent deployments - rollback if needed",
                    "Test page functionality across browsers/devices",
                    "Check API endpoints for failures",
                    "Monitor error tracking (Sentry, Bugsnag, etc.)",
                    "Test with ad blockers disabled",
                    f"{int(row.total_errors)} errors affecting user experience"
                ],
                "estimated_effort": "high",
                "estimated_timeline": "1-3 days",
            })
        
        logger.info(f"✅ Page Error Rate Spike detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Page Error Rate Spike detector failed: {e}")
    
    return opportunities


def detect_page_micro_conversion_drop(organization_id: str) -> list:
    """
    Detect: Micro-conversions (scroll, video, clicks) declining
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Micro-Conversion Drop detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(scroll_depth_avg) as avg_scroll_depth,
        SUM(scroll_depth_75) as total_scroll_75,
        SUM(sessions) as total_sessions,
        SAFE_DIVIDE(SUM(scroll_depth_75), SUM(sessions)) * 100 as scroll_75_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(scroll_depth_avg) as baseline_scroll_depth,
        SAFE_DIVIDE(SUM(scroll_depth_75), SUM(sessions)) * 100 as baseline_scroll_75_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_scroll_depth,
      h.baseline_scroll_depth,
      r.scroll_75_rate,
      h.baseline_scroll_75_rate,
      r.total_sessions,
      SAFE_DIVIDE((r.avg_scroll_depth - h.baseline_scroll_depth), h.baseline_scroll_depth) * 100 as scroll_depth_change_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.baseline_scroll_depth > 0
      AND r.avg_scroll_depth < h.baseline_scroll_depth * 0.85  -- 15%+ drop
      AND r.total_sessions > 100
    ORDER BY scroll_depth_change_pct ASC
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
            priority = "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "engagement_optimization",
                "type": "micro_conversion_drop",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Scroll Depth Declining: {row.scroll_depth_change_pct:+.1f}%",
                "description": f"Average scroll depth down to {row.avg_scroll_depth:.1f}% (from {row.baseline_scroll_depth:.1f}%)",
                "evidence": {
                    "current_scroll_depth": float(row.avg_scroll_depth),
                    "baseline_scroll_depth": float(row.baseline_scroll_depth),
                    "scroll_depth_change_pct": float(row.scroll_depth_change_pct),
                    "scroll_75_rate": float(row.scroll_75_rate),
                    "baseline_scroll_75_rate": float(row.baseline_scroll_75_rate) if row.baseline_scroll_75_rate else None,
                    "total_sessions": int(row.total_sessions),
                },
                "metrics": {
                    "scroll_depth": float(row.avg_scroll_depth),
                },
                "hypothesis": "Content quality declining, page too long, or engagement hooks missing",
                "confidence_score": 0.75,
                "potential_impact_score": min(100, abs(row.scroll_depth_change_pct)),
                "urgency_score": 60,
                "recommended_actions": [
                    "Review content quality - is it engaging?",
                    "Add engagement elements (videos, images, interactive)",
                    "Check page load speed - slow pages lose readers",
                    "Move important content higher up",
                    "Test different content formats",
                    "Add internal links to keep users engaged",
                    f"{int(row.total_sessions * (1 - row.avg_scroll_depth / 100))} sessions not seeing full content"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Micro-Conversion Drop detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Micro-Conversion Drop detector failed: {e}")
    
    return opportunities


def detect_page_exit_rate_increase(organization_id: str) -> list:
    """
    Detect: Exit rate increasing on important pages
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Exit Rate Increase detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(exit_rate) as avg_exit_rate,
        SUM(sessions) as total_sessions,
        AVG(conversion_rate) as avg_conversion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND date < CURRENT_DATE()
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    ),
    historical_performance AS (
      SELECT 
        canonical_entity_id,
        AVG(exit_rate) as baseline_exit_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_exit_rate,
      h.baseline_exit_rate,
      r.total_sessions,
      r.avg_conversion_rate,
      SAFE_DIVIDE((r.avg_exit_rate - h.baseline_exit_rate), h.baseline_exit_rate) * 100 as exit_rate_increase_pct
    FROM recent_performance r
    LEFT JOIN historical_performance h ON r.canonical_entity_id = h.canonical_entity_id
    WHERE h.baseline_exit_rate > 0
      AND r.avg_exit_rate > h.baseline_exit_rate * 1.2  -- 20%+ increase
      AND r.total_sessions > 100
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
            priority = "high" if row.exit_rate_increase_pct > 50 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "engagement_optimization",
                "type": "exit_rate_increase",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Exit Rate Increasing: {row.avg_exit_rate:.1f}% (+{row.exit_rate_increase_pct:.1f}%)",
                "description": f"Exit rate up to {row.avg_exit_rate:.1f}% from {row.baseline_exit_rate:.1f}%",
                "evidence": {
                    "current_exit_rate": float(row.avg_exit_rate),
                    "baseline_exit_rate": float(row.baseline_exit_rate),
                    "exit_rate_increase_pct": float(row.exit_rate_increase_pct),
                    "total_sessions": int(row.total_sessions),
                    "conversion_rate": float(row.avg_conversion_rate),
                },
                "metrics": {
                    "exit_rate": float(row.avg_exit_rate),
                },
                "hypothesis": "Missing next steps, broken links, or content not meeting user intent",
                "confidence_score": 0.80,
                "potential_impact_score": min(100, row.exit_rate_increase_pct * 0.8),
                "urgency_score": 75 if row.exit_rate_increase_pct > 50 else 60,
                "recommended_actions": [
                    "Add clear next steps and CTAs",
                    "Check for broken internal links",
                    "Add related content links",
                    "Review page intent vs actual content",
                    "Test different CTA placements",
                    "Add exit-intent popups with offers",
                    f"{int(row.total_sessions * (row.avg_exit_rate / 100))} sessions exiting - keep them engaged"
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
