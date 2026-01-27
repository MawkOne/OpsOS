"""
Scout AI Expansion - Week 1-2: Remaining Quick Win Detectors
Completing the first 8 detectors
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


def detect_ad_retargeting_gap(organization_id: str) -> list:
    """
    #42: Ad Retargeting Gap
    Alert if retargeting spend <10% of total or no retargeting campaigns
    """
    logger.info("🔍 Running Ad Retargeting Gap detector...")
    
    opportunities = []
    
    query = f"""
    WITH campaign_spend AS (
      SELECT 
        canonical_entity_id,
        SUM(cost) as total_cost,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(revenue), SUM(cost)) as roas,
        -- Identify retargeting campaigns by name patterns
        CASE 
          WHEN LOWER(canonical_entity_id) LIKE '%retarget%' THEN 'retargeting'
          WHEN LOWER(canonical_entity_id) LIKE '%remarketing%' THEN 'retargeting'
          WHEN LOWER(canonical_entity_id) LIKE '%rmt%' THEN 'retargeting'
          ELSE 'prospecting'
        END as campaign_type
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'campaign'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND cost > 0
      GROUP BY canonical_entity_id
    ),
    spend_breakdown AS (
      SELECT 
        campaign_type,
        SUM(total_cost) as type_cost,
        SUM(total_conversions) as type_conversions,
        COUNT(*) as campaign_count
      FROM campaign_spend
      GROUP BY campaign_type
    ),
    totals AS (
      SELECT 
        SUM(type_cost) as all_cost
      FROM spend_breakdown
    )
    SELECT 
      s.*,
      t.all_cost,
      SAFE_DIVIDE(s.type_cost, t.all_cost) * 100 as spend_pct
    FROM spend_breakdown s
    CROSS JOIN totals t
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        retargeting_spend = 0
        total_spend = 0
        has_retargeting = False
        
        for row in results:
            if row['campaign_type'] == 'retargeting':
                has_retargeting = True
                retargeting_spend = row['type_cost']
            total_spend += row['type_cost']
        
        if total_spend == 0:
            return opportunities  # No paid campaigns
        
        retargeting_pct = (retargeting_spend / total_spend) * 100 if total_spend > 0 else 0
        
        # Alert if retargeting is missing or too low
        if not has_retargeting:
            priority = 'high'
            urgency = 85
            title = "🎯 No Retargeting Campaigns Detected"
            description = f"You're spending ${total_spend:.2f}/month on ads but have NO retargeting campaigns. Retargeting typically has 2-3x better ROI than prospecting. This is a major missed opportunity."
        elif retargeting_pct < 10:
            priority = 'high'
            urgency = 75
            title = f"🎯 Retargeting Severely Underfunded: {retargeting_pct:.1f}% of budget"
            description = f"Retargeting is only {retargeting_pct:.1f}% of ad spend (${retargeting_spend:.2f} of ${total_spend:.2f}). Industry benchmark is 20-30%. Retargeting has 2-3x better ROAS."
        elif retargeting_pct < 20:
            priority = 'medium'
            urgency = 65
            title = f"🎯 Retargeting Underfunded: {retargeting_pct:.1f}% of budget"
            description = f"Retargeting is {retargeting_pct:.1f}% of ad spend. Benchmark is 20-30%. Increasing retargeting budget could improve overall ROAS significantly."
        else:
            return opportunities  # Retargeting budget is healthy
        
        opportunities.append({
            'id': str(uuid.uuid4()),
            'organization_id': organization_id,
            'detected_at': datetime.utcnow().isoformat(),
            'category': 'advertising_gap',
            'type': 'retargeting_gap',
            'priority': priority,
            'status': 'new',
            'entity_id': None,
            'entity_type': 'campaign',
            'title': title,
            'description': description,
            'evidence': {
                'total_ad_spend_30d': total_spend,
                'retargeting_spend_30d': retargeting_spend,
                'retargeting_percentage': retargeting_pct,
                'has_retargeting_campaigns': has_retargeting,
                'benchmark_pct': '20-30%'
            },
            'metrics': {
                'retargeting_pct': retargeting_pct,
                'gap_to_benchmark': 20 - retargeting_pct
            },
            'hypothesis': "Retargeting (showing ads to people who've visited your site) has 2-3x better ROAS than cold prospecting. Most successful advertisers allocate 20-30% of budget to retargeting.",
            'confidence_score': 0.88,
            'potential_impact_score': min(100, (20 - retargeting_pct) * 4),
            'urgency_score': urgency,
            'recommended_actions': [
                'Set up website retargeting pixel (Google Ads, Facebook Pixel)',
                'Create retargeting audiences (all visitors, specific pages, cart abandoners)',
                'Build retargeting campaigns with special offers for return visitors',
                'Start with 15-20% of ad budget for retargeting',
                'Test different retargeting windows (7-day, 30-day, 90-day)',
                'Create sequential retargeting (different ads based on time since visit)',
                'Exclude converters from retargeting to avoid waste',
                'Target: 20-30% of ad spend to retargeting within 60 days'
            ],
            'estimated_effort': 'medium',
            'estimated_timeline': '1-2 weeks',
            'historical_performance': {},
            'comparison_data': {
                'benchmark': '20-30% of ad spend',
                'expected_roas_improvement': '2-3x vs. prospecting'
            },
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        })
        
        logger.info(f"✅ Found {len(opportunities)} retargeting gap opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in ad_retargeting_gap detector: {e}")
    
    return opportunities


def detect_traffic_quality_by_source(organization_id: str) -> list:
    """
    #52: Traffic Quality by Source
    Alert if traffic sources have >70% bounce rate or low conversion rates
    """
    logger.info("🔍 Running Traffic Quality by Source detector...")
    
    opportunities = []
    
    query = f"""
    WITH source_metrics AS (
      SELECT 
        JSON_EXTRACT_SCALAR(source_breakdown, '$.source') as source,
        SUM(sessions) as total_sessions,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as conversion_rate,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(avg_session_duration) as avg_duration,
        SUM(cost) as total_cost,
        SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cpa
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND source_breakdown IS NOT NULL
      GROUP BY source
      HAVING total_sessions > 100  -- Significant traffic
    )
    SELECT *
    FROM source_metrics
    WHERE (avg_bounce_rate > 70  -- High bounce rate
       OR avg_duration < 30  -- Very short sessions
       OR (total_cost > 100 AND conversion_rate < 0.5))  -- Paid with terrible CVR
    ORDER BY 
      CASE WHEN total_cost > 0 THEN 1 ELSE 2 END,  -- Paid sources first
      total_sessions DESC
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
            sessions = row['total_sessions']
            bounce_rate = row['avg_bounce_rate'] or 0
            duration = row['avg_duration'] or 0
            cvr = row['conversion_rate'] or 0
            cost = row['total_cost'] or 0
            cpa = row['cpa'] or 0
            
            # Determine quality issue
            issues = []
            if bounce_rate > 80:
                issues.append(f"very high bounce rate ({bounce_rate:.0f}%)")
            elif bounce_rate > 70:
                issues.append(f"high bounce rate ({bounce_rate:.0f}%)")
            
            if duration < 20:
                issues.append(f"very short sessions ({duration:.0f}s)")
            elif duration < 30:
                issues.append(f"short sessions ({duration:.0f}s)")
            
            if cost > 0 and cvr < 0.5:
                issues.append(f"terrible conversion rate ({cvr:.1f}%)")
            elif cost > 0 and cvr < 1.0:
                issues.append(f"low conversion rate ({cvr:.1f}%)")
            
            if cost > 0:
                priority = 'high'  # Paying for bad traffic
                urgency = 85
                title = f"💸 LOW QUALITY PAID TRAFFIC: {source}"
                description = f"Source '{source}' is costing ${cost:.2f}/month but has {', '.join(issues)}. You're paying for traffic that doesn't convert."
            else:
                priority = 'medium'
                urgency = 60
                title = f"📊 Low Quality Traffic: {source}"
                description = f"Source '{source}' has {', '.join(issues)}. While it's free, this traffic isn't engaging or converting."
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'traffic_quality',
                'type': 'low_quality_source',
                'priority': priority,
                'status': 'new',
                'entity_id': source,
                'entity_type': 'traffic_source',
                'title': title,
                'description': description,
                'evidence': {
                    'source': source,
                    'sessions_30d': sessions,
                    'bounce_rate': bounce_rate,
                    'avg_session_duration_seconds': duration,
                    'conversion_rate': cvr,
                    'cost_30d': cost,
                    'cpa': cpa,
                    'quality_issues': issues
                },
                'metrics': {
                    'bounce_rate': bounce_rate,
                    'session_duration': duration,
                    'conversion_rate': cvr
                },
                'hypothesis': f"{'Paid' if cost > 0 else 'Organic'} traffic with >70% bounce rate and <30s duration is low-quality. If paid, this is wasted money. If organic, it indicates targeting or content relevance issues.",
                'confidence_score': 0.85,
                'potential_impact_score': min(100, (cost / 10) if cost > 0 else (sessions / 50)),
                'urgency_score': urgency,
                'recommended_actions': [
                    'If paid: Pause this source/campaign immediately to stop waste',
                    'Analyze landing pages this traffic hits (are they relevant?)',
                    'Check targeting settings (geography, demographics, interests)',
                    'Review ad creative/messaging (does it match landing page?)',
                    'Investigate for bot/spam traffic (impossible geographies, suspicious patterns)',
                    'If organic: Check what keywords/content drives this traffic',
                    'Set up negative keywords (paid) or improve content relevance (organic)',
                    'Monitor after changes to verify improvement'
                ],
                'estimated_effort': 'low',
                'estimated_timeline': '< 1 day',
                'historical_performance': {},
                'comparison_data': {
                    'healthy_bounce_rate': '<60%',
                    'healthy_duration': '>60s',
                    'healthy_cvr': '>2%'
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} traffic quality opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in traffic_quality_by_source detector: {e}")
    
    return opportunities


def detect_cac_by_channel(organization_id: str) -> list:
    """
    #53: Customer Acquisition Cost by Channel
    Alert if CAC varies >5x by channel with no budget reallocation
    """
    logger.info("🔍 Running CAC by Channel detector...")
    
    opportunities = []
    
    query = f"""
    WITH channel_performance AS (
      SELECT 
        JSON_EXTRACT_SCALAR(source_breakdown, '$.channel') as channel,
        SUM(cost) as total_cost,
        SUM(conversions) as total_conversions,
        SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cac,
        SUM(revenue) as total_revenue,
        SAFE_DIVIDE(SUM(revenue), SUM(cost)) as roas
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND source_breakdown IS NOT NULL
        AND cost > 0
      GROUP BY channel
      HAVING total_conversions > 5  -- Minimum conversions for valid CAC
    ),
    cac_analysis AS (
      SELECT 
        *,
        MIN(cac) OVER() as lowest_cac,
        MAX(cac) OVER() as highest_cac,
        AVG(cac) OVER() as avg_cac
      FROM channel_performance
    )
    SELECT *
    FROM cac_analysis
    WHERE highest_cac / NULLIF(lowest_cac, 0) > 5  -- 5x+ variance
       OR (cac > avg_cac * 2 AND total_cost > 500)  -- Expensive channel with significant spend
    ORDER BY cac DESC
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        channels_data = list(results)
        
        if not channels_data:
            return opportunities
        
        # Get lowest CAC for comparison
        lowest_cac = min([row['lowest_cac'] for row in channels_data])
        highest_cac = max([row['highest_cac'] for row in channels_data])
        variance_ratio = highest_cac / lowest_cac if lowest_cac > 0 else 0
        
        # Create opportunity for high-variance situation
        if variance_ratio > 5:
            expensive_channels = [row for row in channels_data if row['cac'] > row['avg_cac']]
            efficient_channels = [row for row in channels_data if row['cac'] <= row['avg_cac']]
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'advertising_optimization',
                'type': 'cac_variance',
                'priority': 'high',
                'status': 'new',
                'entity_id': None,
                'entity_type': 'channel',
                'title': f"💰 CAC Variance Alert: {variance_ratio:.1f}x difference between channels",
                'description': f"Customer acquisition cost varies {variance_ratio:.1f}x across channels (${lowest_cac:.2f} to ${highest_cac:.2f}). This suggests budget reallocation could significantly improve overall efficiency.",
                'evidence': {
                    'lowest_cac': lowest_cac,
                    'highest_cac': highest_cac,
                    'variance_ratio': variance_ratio,
                    'expensive_channels': [{'channel': ch['channel'], 'cac': ch['cac'], 'spend': ch['total_cost']} for ch in expensive_channels],
                    'efficient_channels': [{'channel': ch['channel'], 'cac': ch['cac'], 'spend': ch['total_cost']} for ch in efficient_channels]
                },
                'metrics': {
                    'cac_variance': variance_ratio,
                    'potential_savings': sum([ch['total_cost'] for ch in expensive_channels]) * 0.3  # Conservative estimate
                },
                'hypothesis': "When CAC varies >5x by channel, reallocating budget from expensive to efficient channels can dramatically improve overall CAC while maintaining or increasing conversion volume.",
                'confidence_score': 0.90,
                'potential_impact_score': min(100, variance_ratio * 10),
                'urgency_score': 80,
                'recommended_actions': [
                    f"Reduce spend on highest-CAC channels: {', '.join([ch['channel'] for ch in expensive_channels])}",
                    f"Increase spend on lowest-CAC channels: {', '.join([ch['channel'] for ch in efficient_channels])}",
                    'Investigate why efficient channels have lower CAC (better targeting? higher intent?)',
                    'Test scaling efficient channels 2-3x to find their ceiling',
                    'Improve expensive channels (better targeting, creative, landing pages)',
                    'Set target: Bring all channel CACs within 2x of each other',
                    'Calculate blended CAC monthly and optimize mix',
                    'Consider pausing channels with CAC >4x the lowest'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-2 weeks',
                'historical_performance': {},
                'comparison_data': {
                    'healthy_variance': '<3x',
                    'current_variance': f'{variance_ratio:.1f}x'
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} CAC variance opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in cac_by_channel detector: {e}")
    
    return opportunities
