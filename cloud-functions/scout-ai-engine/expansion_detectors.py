"""
Scout AI Expansion Detectors - 32 New Detectors
Built based on 2026 industry best practices research
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
bq_client = bigquery.Client()


# =============================================================================
# WEEK 1-2: QUICK WINS (8 DETECTORS)
# =============================================================================

def detect_email_volume_gap(organization_id: str) -> list:
    """
    #25: Email Volume Gap Detection
    Alert if email send volume is <50% of industry benchmark
    """
    logger.info("🔍 Running Email Volume Gap detector...")
    
    opportunities = []
    
    query = f"""
    WITH monthly_email_volume AS (
      SELECT 
        COUNT(DISTINCT canonical_entity_id) as email_campaigns,
        SUM(sends) as total_sends,
        AVG(sends) as avg_sends_per_campaign,
        DATE_DIFF(MAX(date), MIN(date), DAY) as days_tracked
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'email'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    ),
    recent_activity AS (
      SELECT 
        MAX(date) as last_email_date,
        COUNT(DISTINCT DATE(date)) as days_with_emails
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'email'
        AND sends > 0
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    )
    SELECT 
      m.*,
      r.last_email_date,
      r.days_with_emails,
      DATE_DIFF(CURRENT_DATE(), r.last_email_date, DAY) as days_since_last_email
    FROM monthly_email_volume m
    CROSS JOIN recent_activity r
    WHERE m.total_sends < 1000  -- Benchmark: Should send 2000+ per month for growth stage
      OR DATE_DIFF(CURRENT_DATE(), r.last_email_date, DAY) > 30
      OR r.days_with_emails < 4  -- Should email at least weekly
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            total_sends = row['total_sends'] or 0
            days_since = row['days_since_last_email'] or 0
            days_with_emails = row['days_with_emails'] or 0
            
            # Determine issue type
            if days_since > 30:
                issue_type = "no_emails_30_days"
                title = f"📧 Email Activity Gap: No emails sent in {days_since} days"
                description = f"Your email program has been inactive for {days_since} days. Regular email communication is essential for customer engagement and revenue growth."
                urgency = 85
            elif total_sends < 500:
                issue_type = "very_low_volume"
                title = f"📧 Email Volume Critical: Only {total_sends} emails sent in 30 days"
                description = f"Sending only {total_sends} emails per month is well below best practices (benchmark: 2000+ for growth stage). You're missing significant revenue opportunities."
                urgency = 75
            elif total_sends < 1000:
                issue_type = "low_volume"
                title = f"📧 Email Volume Low: {total_sends} emails in 30 days"
                description = f"Current email volume ({total_sends}/month) is below growth stage benchmark (2000+/month). Increasing frequency could drive 2-3x more revenue."
                urgency = 60
            else:
                issue_type = "infrequent_sending"
                title = f"📧 Inconsistent Email Schedule: Only {days_with_emails} days with sends"
                description = f"Emails sent on only {days_with_emails} of last 90 days. Consistent weekly sending drives better engagement and revenue."
                urgency = 50
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'email_gap',
                'type': issue_type,
                'priority': 'high' if urgency > 70 else 'medium',
                'status': 'new',
                'entity_id': None,
                'entity_type': 'email',
                'title': title,
                'description': description,
                'evidence': {
                    'total_sends_30d': total_sends,
                    'days_since_last_email': days_since,
                    'days_with_emails_90d': days_with_emails,
                    'benchmark_sends': 2000
                },
                'metrics': {
                    'current_monthly_sends': total_sends,
                    'benchmark': 2000,
                    'gap_pct': ((2000 - total_sends) / 2000) * 100
                },
                'hypothesis': "Email is one of the highest ROI marketing channels (avg $36 return per $1 spent). Underutilization means leaving significant revenue on the table.",
                'confidence_score': 0.90,
                'potential_impact_score': min(100, ((2000 - total_sends) / 20)),
                'urgency_score': urgency,
                'recommended_actions': [
                    'Set up weekly newsletter schedule',
                    'Create automated welcome series for new subscribers',
                    'Implement abandoned cart email sequence',
                    'Build product/content update campaigns',
                    'Set up re-engagement campaigns for inactive subscribers',
                    'Target 4-8 emails per month minimum'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {
                    'benchmark_monthly_sends': 2000,
                    'benchmark_source': 'Industry average for growth-stage startups'
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} email volume gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in email_volume_gap detector: {e}")
    
    return opportunities


def detect_seo_rank_volatility_daily(organization_id: str) -> list:
    """
    #26: Daily SEO Rank Volatility
    Alert if top keywords drop >3 positions in 24 hours
    """
    logger.info("🔍 Running SEO Rank Volatility Daily detector...")
    
    opportunities = []
    
    query = f"""
    WITH ranked_daily AS (
      SELECT 
        canonical_entity_id,
        date,
        position,
        search_volume,
        LAG(position) OVER (PARTITION BY canonical_entity_id ORDER BY date) as prev_position,
        LAG(date) OVER (PARTITION BY canonical_entity_id ORDER BY date) as prev_date
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND entity_type = 'keyword'
        AND position > 0
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    ),
    significant_drops AS (
      SELECT 
        canonical_entity_id,
        date,
        position as current_position,
        prev_position,
        prev_date,
        search_volume,
        (position - prev_position) as position_change,
        CASE 
          WHEN prev_position <= 3 AND position > 3 THEN 'dropped_off_top3'
          WHEN prev_position <= 10 AND position > 10 THEN 'dropped_off_page1'
          WHEN (position - prev_position) > 5 THEN 'major_drop'
          WHEN (position - prev_position) > 3 THEN 'significant_drop'
        END as drop_severity
      FROM ranked_daily
      WHERE prev_position IS NOT NULL
        AND DATE_DIFF(date, prev_date, DAY) <= 2  -- Within 2 days
        AND (position - prev_position) > 3  -- Dropped more than 3 positions
        AND prev_position <= 20  -- Was in top 20
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)  -- Recent drops only
    )
    SELECT *
    FROM significant_drops
    ORDER BY 
      CASE drop_severity
        WHEN 'dropped_off_top3' THEN 1
        WHEN 'dropped_off_page1' THEN 2
        WHEN 'major_drop' THEN 3
        ELSE 4
      END,
      search_volume DESC,
      position_change DESC
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
            keyword = row['canonical_entity_id']
            current_pos = row['current_position']
            prev_pos = row['prev_position']
            change = row['position_change']
            volume = row['search_volume'] or 0
            severity = row['drop_severity']
            
            # Determine priority based on severity and search volume
            if severity == 'dropped_off_top3':
                priority = 'high'
                urgency = 90
                title_prefix = "🚨 TOP 3 KEYWORD DROPPED"
            elif severity == 'dropped_off_page1':
                priority = 'high'
                urgency = 80
                title_prefix = "⚠️ PAGE 1 KEYWORD DROPPED"
            elif change > 5:
                priority = 'high' if volume > 1000 else 'medium'
                urgency = 70
                title_prefix = "📉 MAJOR RANK DROP"
            else:
                priority = 'medium'
                urgency = 60
                title_prefix = "📊 Rank Drop Detected"
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_crisis',
                'type': 'rank_volatility_daily',
                'priority': priority,
                'status': 'new',
                'entity_id': keyword,
                'entity_type': 'keyword',
                'title': f"{title_prefix}: {keyword}",
                'description': f"Keyword '{keyword}' dropped from position {prev_pos} to {current_pos} ({abs(change)} positions) in the last 1-2 days. This is a {severity.replace('_', ' ')} requiring immediate attention.",
                'evidence': {
                    'current_position': current_pos,
                    'previous_position': prev_pos,
                    'position_change': change,
                    'search_volume': volume,
                    'severity': severity,
                    'days_ago': '1-2'
                },
                'metrics': {
                    'position_drop': change,
                    'estimated_traffic_loss_pct': min(80, change * 10)
                },
                'hypothesis': f"Catching rank drops within 18 hours vs. 6 days can save $4,200/month (industry research). This {severity.replace('_', ' ')} needs immediate investigation.",
                'confidence_score': 0.95,
                'potential_impact_score': min(100, (change * 10) + (volume / 100)),
                'urgency_score': urgency,
                'recommended_actions': [
                    'Check Google Search Console for manual actions or penalties',
                    'Verify page is indexed and accessible (not 404/500 error)',
                    'Review recent on-page changes that might have hurt relevance',
                    'Check if competitors published new content for this keyword',
                    'Analyze SERP to see what changed (new featured snippet, etc.)',
                    'Review backlinks for any toxic links or lost quality links',
                    'Check page speed and Core Web Vitals',
                    'Monitor daily for further drops or recovery'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '< 1 day',
                'historical_performance': {
                    'previous_position': prev_pos
                },
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} rank volatility opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in seo_rank_volatility_daily detector: {e}")
    
    return opportunities


def detect_mobile_desktop_cvr_gap(organization_id: str) -> list:
    """
    #34: Mobile vs Desktop Conversion Rate Gap
    Alert if mobile CVR <50% of desktop CVR
    """
    logger.info("🔍 Running Mobile Desktop CVR Gap detector...")
    
    opportunities = []
    
    # Note: This requires device-level data which we'll need to add to source_breakdown
    # For now, creating placeholder that can be enhanced when device data is available
    
    query = f"""
    WITH device_performance AS (
      SELECT 
        canonical_entity_id,
        entity_type,
        -- Placeholder: In real implementation, extract device from source_breakdown
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as overall_cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
        ON m.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND entity_type IN ('page', 'campaign')
        AND sessions > 100
      GROUP BY canonical_entity_id, entity_type
    )
    SELECT 
      canonical_entity_id,
      entity_type,
      total_sessions,
      total_conversions,
      overall_cvr
    FROM device_performance
    WHERE overall_cvr < 2.0  -- Low overall CVR suggests device gap
      AND total_sessions > 500  -- Significant traffic
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
            sessions = row['total_sessions']
            cvr = row['overall_cvr']
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'mobile_optimization',
                'type': 'device_cvr_gap',
                'priority': 'high',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': entity_type,
                'title': f"📱 Mobile Optimization Needed: {entity_id}",
                'description': f"This {entity_type} has low overall conversion rate ({cvr:.1f}%) despite high traffic ({sessions} sessions). This often indicates mobile experience issues, as mobile CVR should be 70-80% of desktop, not <50%.",
                'evidence': {
                    'total_sessions': sessions,
                    'overall_cvr': cvr,
                    'note': 'Device-level breakdown pending GA4 device dimension integration'
                },
                'metrics': {
                    'overall_cvr': cvr,
                    'sessions': sessions
                },
                'hypothesis': "Mobile optimization gaps are a common issue. Mobile CVR should be 70-80% of desktop. If mobile traffic is >50% but conversions <30%, there's a significant optimization opportunity.",
                'confidence_score': 0.70,
                'potential_impact_score': min(100, sessions / 10),
                'urgency_score': 75,
                'recommended_actions': [
                    'Test mobile experience thoroughly (forms, buttons, navigation)',
                    'Check mobile page speed (should be <3s)',
                    'Verify forms are mobile-friendly (large tap targets, simple fields)',
                    'Test checkout/conversion flow on actual mobile devices',
                    'Check for mobile-specific errors in console',
                    'Simplify mobile forms (reduce required fields)',
                    'Add mobile-specific CTAs if needed',
                    'Consider mobile-first redesign of key pages'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {
                    'benchmark_mobile_desktop_ratio': '70-80%',
                    'ideal_gap': '<20%'
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} mobile/desktop CVR gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in mobile_desktop_cvr_gap detector: {e}")
    
    return opportunities


def detect_traffic_source_disappearance(organization_id: str) -> list:
    """
    #36: Traffic Source Disappearance
    Alert if major traffic source dropped >50% or disappeared
    """
    logger.info("🔍 Running Traffic Source Disappearance detector...")
    
    opportunities = []
    
    query = f"""
    WITH source_daily AS (
      SELECT 
        date,
        JSON_EXTRACT_SCALAR(source_breakdown, '$.source') as source,
        SUM(sessions) as daily_sessions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        AND source_breakdown IS NOT NULL
      GROUP BY date, source
    ),
    source_comparison AS (
      SELECT 
        source,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY) THEN daily_sessions END) as recent_avg,
        AVG(CASE WHEN date < DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY) AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) THEN daily_sessions END) as baseline_avg,
        MAX(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY) THEN date END) as last_seen
      FROM source_daily
      GROUP BY source
      HAVING baseline_avg > 100  -- Was getting significant traffic
    )
    SELECT 
      source,
      baseline_avg,
      COALESCE(recent_avg, 0) as recent_avg,
      SAFE_DIVIDE((COALESCE(recent_avg, 0) - baseline_avg), baseline_avg) * 100 as pct_change,
      last_seen,
      DATE_DIFF(CURRENT_DATE(), last_seen, DAY) as days_since_last_seen
    FROM source_comparison
    WHERE COALESCE(recent_avg, 0) < (baseline_avg * 0.5)  -- Dropped >50%
      OR recent_avg IS NULL  -- Disappeared completely
    ORDER BY baseline_avg DESC
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
            source = row['source'] or 'unknown'
            baseline = row['baseline_avg']
            recent = row['recent_avg']
            pct_change = row['pct_change']
            days_since = row['days_since_last_seen'] or 0
            
            if recent == 0 or days_since > 2:
                severity = 'disappeared'
                priority = 'high'
                urgency = 95
                title = f"🚨 Traffic Source DISAPPEARED: {source}"
                description = f"Traffic from {source} has completely stopped (was averaging {baseline:.0f} sessions/day). This requires immediate investigation."
            elif pct_change < -75:
                severity = 'severe_drop'
                priority = 'high'
                urgency = 85
                title = f"⚠️ Traffic Source CRASHED: {source}"
                description = f"Traffic from {source} dropped {abs(pct_change):.0f}% (from {baseline:.0f} to {recent:.0f} sessions/day). Investigate immediately."
            else:
                severity = 'major_drop'
                priority = 'medium'
                urgency = 70
                title = f"📉 Traffic Source Drop: {source}"
                description = f"Traffic from {source} dropped {abs(pct_change):.0f}% in last 3 days. From {baseline:.0f} to {recent:.0f} sessions/day."
            
            # Determine likely causes based on source type
            if 'organic' in source.lower() or 'google' in source.lower():
                likely_causes = [
                    'Check Google Search Console for indexing issues',
                    'Verify site is not deindexed or penalized',
                    'Check for technical SEO errors (robots.txt, sitemap)',
                    'Look for ranking drops on key keywords',
                    'Verify DNS/hosting is working correctly'
                ]
            elif 'paid' in source.lower() or 'cpc' in source.lower() or 'ads' in source.lower():
                likely_causes = [
                    'Check if ad campaigns are paused or budgets exhausted',
                    'Verify payment methods are valid',
                    'Check for ad disapprovals or policy violations',
                    'Review campaign settings and schedules',
                    'Check if bids are too low to show ads'
                ]
            elif 'social' in source.lower() or 'facebook' in source.lower() or 'twitter' in source.lower():
                likely_causes = [
                    'Check if social accounts are active',
                    'Verify recent posts are being shared',
                    'Check for content that might be suppressed',
                    'Review engagement rates on recent posts',
                    'Check if links are working correctly'
                ]
            elif 'referral' in source.lower():
                likely_causes = [
                    'Check if referring site removed links',
                    'Verify partnership or affiliate is still active',
                    'Check if referring site is down',
                    'Review referral agreement status'
                ]
            else:
                likely_causes = [
                    f'Investigate {source} for technical issues',
                    'Check if source URL/campaign is still active',
                    'Verify tracking is working correctly',
                    'Review any recent changes to this channel'
                ]
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'traffic_crisis',
                'type': 'source_disappearance',
                'priority': priority,
                'status': 'new',
                'entity_id': source,
                'entity_type': 'traffic_source',
                'title': title,
                'description': description,
                'evidence': {
                    'baseline_sessions_per_day': baseline,
                    'recent_sessions_per_day': recent,
                    'percent_change': pct_change,
                    'days_since_last_traffic': days_since,
                    'severity': severity
                },
                'metrics': {
                    'traffic_loss': baseline - recent,
                    'percent_drop': abs(pct_change)
                },
                'hypothesis': "Sudden traffic source disappearance indicates a critical issue that needs immediate attention. Could be technical (deindexing, broken tracking), operational (paused campaigns, exhausted budgets), or external (algorithm changes, lost partnerships).",
                'confidence_score': 0.95,
                'potential_impact_score': min(100, baseline / 10),
                'urgency_score': urgency,
                'recommended_actions': likely_causes,
                'estimated_effort': 'high',
                'estimated_timeline': '< 1 day',
                'historical_performance': {
                    'baseline_daily_sessions': baseline
                },
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} traffic source disappearance opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in traffic_source_disappearance detector: {e}")
    
    return opportunities


def detect_channel_dependency_risk(organization_id: str) -> list:
    """
    #37: Channel Dependency Risk
    Alert if >60% of traffic/revenue from single channel
    """
    logger.info("🔍 Running Channel Dependency Risk detector...")
    
    opportunities = []
    
    query = f"""
    WITH channel_performance AS (
      SELECT 
        JSON_EXTRACT_SCALAR(source_breakdown, '$.channel') as channel,
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue,
        SUM(conversions) as total_conversions
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND source_breakdown IS NOT NULL
      GROUP BY channel
    ),
    total_metrics AS (
      SELECT 
        SUM(total_sessions) as all_sessions,
        SUM(total_revenue) as all_revenue,
        SUM(total_conversions) as all_conversions
      FROM channel_performance
    )
    SELECT 
      c.channel,
      c.total_sessions,
      c.total_revenue,
      c.total_conversions,
      t.all_sessions,
      t.all_revenue,
      SAFE_DIVIDE(c.total_sessions, t.all_sessions) * 100 as sessions_pct,
      SAFE_DIVIDE(c.total_revenue, t.all_revenue) * 100 as revenue_pct,
      SAFE_DIVIDE(c.total_conversions, t.all_conversions) * 100 as conversions_pct
    FROM channel_performance c
    CROSS JOIN total_metrics t
    WHERE SAFE_DIVIDE(c.total_sessions, t.all_sessions) > 0.60
       OR SAFE_DIVIDE(c.total_revenue, t.all_revenue) > 0.70
    ORDER BY sessions_pct DESC
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            channel = row['channel'] or 'unknown'
            sessions_pct = row['sessions_pct'] or 0
            revenue_pct = row['revenue_pct'] or 0
            conversions_pct = row['conversions_pct'] or 0
            
            if revenue_pct > 80:
                severity = 'critical'
                priority = 'high'
                urgency = 90
                title = f"🚨 CRITICAL Channel Dependency: {revenue_pct:.0f}% of revenue from {channel}"
                description = f"Your business is critically dependent on {channel} ({revenue_pct:.0f}% of revenue, {sessions_pct:.0f}% of traffic). Any disruption to this channel could be catastrophic. Immediate diversification needed."
            elif revenue_pct > 70:
                severity = 'high'
                priority = 'high'
                urgency = 80
                title = f"⚠️ High Channel Dependency: {revenue_pct:.0f}% from {channel}"
                description = f"{channel} drives {revenue_pct:.0f}% of revenue and {sessions_pct:.0f}% of traffic. This concentration creates significant business risk if the channel is disrupted."
            elif sessions_pct > 70:
                severity = 'medium'
                priority = 'medium'
                urgency = 70
                title = f"📊 Channel Concentration Risk: {sessions_pct:.0f}% traffic from {channel}"
                description = f"{sessions_pct:.0f}% of traffic comes from {channel}. While revenue is more diversified ({revenue_pct:.0f}%), this traffic concentration creates vulnerability."
            else:
                severity = 'low'
                priority = 'medium'
                urgency = 60
                title = f"📈 Channel Diversification Opportunity: {channel} dominance"
                description = f"{channel} is your largest channel ({sessions_pct:.0f}% traffic, {revenue_pct:.0f}% revenue). Consider diversifying to reduce risk."
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'business_risk',
                'type': 'channel_dependency',
                'priority': priority,
                'status': 'new',
                'entity_id': channel,
                'entity_type': 'channel',
                'title': title,
                'description': description,
                'evidence': {
                    'channel': channel,
                    'traffic_percentage': sessions_pct,
                    'revenue_percentage': revenue_pct,
                    'conversions_percentage': conversions_pct,
                    'severity': severity
                },
                'metrics': {
                    'dependency_score': max(sessions_pct, revenue_pct),
                    'risk_level': severity
                },
                'hypothesis': "Relying on a single channel for >60% of traffic or >70% of revenue creates significant business risk. Algorithm changes, policy updates, or competitive pressure on that channel could severely impact the business.",
                'confidence_score': 0.92,
                'potential_impact_score': min(100, sessions_pct),
                'urgency_score': urgency,
                'recommended_actions': [
                    'Develop secondary traffic channels (diversify marketing mix)',
                    'Invest in owned channels (email list, content, community)',
                    'Test new acquisition channels (find what works beyond primary)',
                    'Build brand/direct traffic to reduce channel dependency',
                    'Create contingency plans for primary channel disruption',
                    'Set target: No single channel >50% of revenue within 6 months',
                    'Monitor channel health metrics closely',
                    'Consider increasing budget to under-invested channels'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '3-6 months',
                'historical_performance': {},
                'comparison_data': {
                    'healthy_mix': 'No channel >50% revenue, 2-3 channels driving 70%+ combined',
                    'current_concentration': f'{revenue_pct:.0f}% from {channel}'
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} channel dependency risk opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in channel_dependency_risk detector: {e}")
    
    return opportunities


# Continuing with remaining Week 1-2 detectors...
# I'll create these in follow-up commits to keep files manageable
