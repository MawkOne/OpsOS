CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.v_master_daily_metrics` AS
WITH
-- YTJobs metrics - DEDUPLICATED by taking MAX per date/entity_type
ytjobs_deduped AS (
SELECT
date,
entity_type,
MAX(users) as users,
MAX(sessions) as sessions,
MAX(conversions) as conversions,
MAX(revenue) as revenue,
MAX(pageviews) as pageviews
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
GROUP BY date, entity_type
),

-- YTJobs metrics pivoted by entity type
ytjobs_daily AS (
SELECT
date,
SUM(CASE WHEN entity_type = 'talent_signups' THEN users ELSE 0 END) as talent_signups,
SUM(CASE WHEN entity_type = 'company_signups' THEN users ELSE 0 END) as company_signups,
SUM(CASE WHEN entity_type = 'jobs_posted' THEN sessions ELSE 0 END) as jobs_posted,
SUM(CASE WHEN entity_type = 'applications' THEN sessions ELSE 0 END) as applications,
SUM(CASE WHEN entity_type = 'hires' THEN conversions ELSE 0 END) as hires,
SUM(CASE WHEN entity_type = 'marketplace_revenue' THEN revenue ELSE 0 END) as revenue,
SUM(CASE WHEN entity_type = 'job_views' THEN pageviews ELSE 0 END) as job_views,
SUM(CASE WHEN entity_type = 'profile_views' THEN pageviews ELSE 0 END) as profile_views,
SUM(CASE WHEN entity_type = 'reviews' THEN conversions ELSE 0 END) as reviews
FROM ytjobs_deduped
GROUP BY date
),

-- GA4 traffic by day with channel breakdown
ga4_daily AS (
SELECT
_PARTITIONDATE as date,
SUM(sessions) as sessions,
SUM(engagedSessions) as engaged_sessions,
SUM(eventCount) as total_events,
AVG(eventsPerSession) as events_per_session,
SUM(keyEvents) as key_events,
SUM(totalRevenue) as ga4_revenue,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Organic Search' THEN sessions ELSE 0 END) as organic_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Paid Search' THEN sessions ELSE 0 END) as paid_search_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Cross-network' THEN sessions ELSE 0 END) as paid_pmax_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Direct' THEN sessions ELSE 0 END) as direct_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Referral' THEN sessions ELSE 0 END) as referral_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Organic Social' THEN sessions ELSE 0 END) as social_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Email' THEN sessions ELSE 0 END) as email_traffic_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Organic Video' THEN sessions ELSE 0 END) as video_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Organic Search' THEN engagedSessions ELSE 0 END) as organic_engaged_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Paid Search' THEN engagedSessions ELSE 0 END) as paid_search_engaged_sessions,
SUM(CASE WHEN sessionDefaultChannelGroup = 'Cross-network' THEN engagedSessions ELSE 0 END) as paid_pmax_engaged_sessions
FROM `opsos-864a1.analytics_301802672.p_ga4_TrafficAcquisition_301802672`
GROUP BY _PARTITIONDATE
),

ga4_users_daily AS (
  SELECT
    _PARTITIONDATE as date,
    SUM(newUsers) as new_users,
    SUM(totalUsers) as total_users
  FROM `opsos-864a1.analytics_301802672.p_ga4_UserAcquisition_301802672`
  GROUP BY _PARTITIONDATE
),

-- Google Ads campaign data - SESSIONS ONLY (for session-level metrics)
google_ads_campaigns AS (
SELECT
date,
SUM(sessions) as gads_sessions,
SUM(users) as gads_users,
SUM(CASE WHEN JSON_VALUE(source_breakdown, '$.campaign_type') = 'Performance Max' THEN sessions ELSE 0 END) as gads_pmax_sessions,
SUM(CASE WHEN JSON_VALUE(source_breakdown, '$.campaign_type') = 'Search' THEN sessions ELSE 0 END) as gads_search_sessions
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'google_ads_campaign'
AND JSON_VALUE(source_breakdown, '$.campaign_name') != '(not set)'
GROUP BY date
),

-- Google Ads account aggregate - CONVERSIONS & REVENUE (from GA4 event-level data)
google_ads_aggregate AS (
SELECT
date,
SUM(conversions) as gads_conversions,
SUM(revenue) as gads_revenue
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'ad_account'
AND canonical_entity_id LIKE 'google_ads_%'
GROUP BY date
),
