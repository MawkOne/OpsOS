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

-- Google Ads campaign data (EXCLUDING unattributed '(not set)' campaigns)
google_ads_daily AS (
SELECT
date,
SUM(sessions) as gads_sessions,
SUM(users) as gads_users,
SUM(conversions) as gads_conversions,
SUM(revenue) as gads_revenue,
SUM(CASE WHEN JSON_VALUE(source_breakdown, '$.campaign_type') = 'Performance Max' THEN sessions ELSE 0 END) as gads_pmax_sessions,
SUM(CASE WHEN JSON_VALUE(source_breakdown, '$.campaign_type') = 'Performance Max' THEN conversions ELSE 0 END) as gads_pmax_conversions,
SUM(CASE WHEN JSON_VALUE(source_breakdown, '$.campaign_type') = 'Search' THEN sessions ELSE 0 END) as gads_search_sessions,
SUM(CASE WHEN JSON_VALUE(source_breakdown, '$.campaign_type') = 'Search' THEN conversions ELSE 0 END) as gads_search_conversions
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'google_ads_campaign'
AND JSON_VALUE(source_breakdown, '$.campaign_name') != '(not set)'
GROUP BY date
),

-- ActiveCampaign email metrics - CAMPAIGN LIFETIME TOTALS
email_deduped AS (
SELECT
date,
entity_type,
canonical_entity_id,
MAX(sends) as sends,
MAX(opens) as opens,
MAX(clicks) as clicks,
MAX(open_rate) as open_rate,
MAX(click_through_rate) as click_through_rate,
MAX(users) as users
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'SBjucW1ztDyFYWBz7ZLE'
GROUP BY date, entity_type, canonical_entity_id
),

email_daily AS (
SELECT
date,
COUNT(DISTINCT CASE WHEN entity_type = 'email_campaign' THEN canonical_entity_id END) as campaigns_launched,
SUM(CASE WHEN entity_type = 'email_campaign' THEN sends ELSE 0 END) as campaign_lifetime_sends,
SUM(CASE WHEN entity_type = 'email_campaign' THEN opens ELSE 0 END) as campaign_lifetime_opens,
SUM(CASE WHEN entity_type = 'email_campaign' THEN clicks ELSE 0 END) as campaign_lifetime_clicks,
AVG(CASE WHEN entity_type = 'email_campaign' AND open_rate > 0 THEN open_rate ELSE NULL END) as campaign_avg_open_rate,
AVG(CASE WHEN entity_type = 'email_campaign' AND click_through_rate > 0 THEN click_through_rate ELSE NULL END) as campaign_avg_ctr,
MAX(CASE WHEN entity_type = 'contact_summary' THEN users ELSE 0 END) as email_contacts_total,
SUM(CASE WHEN entity_type = 'email_list' THEN users ELSE 0 END) as email_list_subscribers_total
FROM email_deduped
GROUP BY date
),

-- Email DAILY activity (opens/clicks that occurred ON that date) - SUMMED across campaigns
email_activity_daily AS (
SELECT
date,
SUM(opens) as email_daily_opens,
MAX(CAST(JSON_VALUE(source_breakdown, '$.unique_openers') AS INT64)) as email_daily_unique_openers,
SUM(clicks) as email_daily_clicks,
MAX(CAST(JSON_VALUE(source_breakdown, '$.unique_clickers') AS INT64)) as email_daily_unique_clickers
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'email_daily_activity'
GROUP BY date
),

-- Stripe purchase data parsed from JSON (DEDUPLICATED by charge_id)
stripe_parsed AS (
SELECT DISTINCT
  JSON_VALUE(api_response, '$.id') as charge_id,
  DATE(TIMESTAMP_SECONDS(CAST(JSON_VALUE(api_response, '$.created') AS INT64))) as purchase_date,
  JSON_VALUE(api_response, '$.status') as status,
  JSON_VALUE(api_response, '$.customer') as customer_id,
  CAST(JSON_VALUE(api_response, '$.amount') AS FLOAT64)/100 as amount
FROM `opsos-864a1.marketing_ai.raw_stripe`
WHERE data_type = 'charge'
),

stripe_daily AS (
SELECT
  purchase_date as date,
  COUNT(DISTINCT charge_id) as total_charges,
  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as purchases,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
  COUNT(DISTINCT CASE WHEN status = 'succeeded' THEN customer_id END) as purchasing_customers,
  SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as stripe_revenue
FROM stripe_parsed
GROUP BY purchase_date
),

-- Stripe subscription summary - get LATEST values and forward-fill
stripe_subscriptions_latest AS (
SELECT
revenue as mrr,
CAST(JSON_VALUE(source_breakdown, '$.arr') AS FLOAT64) as arr,
CAST(JSON_VALUE(source_breakdown, '$.active_subscriptions') AS INT64) as active_subscriptions,
CAST(JSON_VALUE(source_breakdown, '$.churned_subscriptions') AS INT64) as churned_subscriptions,
CAST(JSON_VALUE(source_breakdown, '$.churn_rate') AS FLOAT64) as churn_rate_pct
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'subscription_summary'
ORDER BY date DESC
LIMIT 1
),

-- Cumulative Stripe metrics
stripe_cumulative AS (
SELECT
date,
purchases,
failed_transactions,
purchasing_customers,
stripe_revenue,
SUM(purchases) OVER (ORDER BY date) as cumulative_purchases,
SUM(purchasing_customers) OVER (ORDER BY date) as cumulative_purchasing_customers_approx
FROM stripe_daily
),

-- Cumulative company signups
company_cumulative AS (
SELECT
date,
SUM(users) OVER (ORDER BY date) as cumulative_company_signups
FROM (
SELECT date, MAX(users) as users
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs' AND entity_type = 'company_signups'
GROUP BY date
)
),

-- Date spine
date_spine AS (
SELECT date
FROM UNNEST(GENERATE_DATE_ARRAY('2025-01-01', CURRENT_DATE())) as date
)

SELECT
d.date,

-- ========== MARKETPLACE: SIGNUPS ==========
COALESCE(y.talent_signups, 0) as talent_signups,
COALESCE(y.company_signups, 0) as company_signups,
COALESCE(y.talent_signups, 0) + COALESCE(y.company_signups, 0) as total_signups,

-- ========== MARKETPLACE: JOBS ==========
COALESCE(y.jobs_posted, 0) as jobs_posted,
COALESCE(y.applications, 0) as applications,
SAFE_DIVIDE(y.applications, y.jobs_posted) as apps_per_job,
COALESCE(y.hires, 0) as hires,
SAFE_DIVIDE(y.hires, y.jobs_posted) * 100 as match_rate_pct,
SAFE_DIVIDE(y.hires, y.applications) * 100 as app_to_hire_pct,

-- ========== MARKETPLACE: REVENUE ==========
COALESCE(y.revenue, 0) as revenue,
SAFE_DIVIDE(y.revenue, y.talent_signups) as revenue_per_talent_signup,
SAFE_DIVIDE(y.revenue, y.hires) as revenue_per_hire,

-- ========== ENGAGEMENT ==========
COALESCE(y.job_views, 0) as job_views,
COALESCE(y.profile_views, 0) as profile_views,
COALESCE(y.reviews, 0) as reviews,

-- ========== STRIPE REVENUE ==========
COALESCE(s.purchases, 0) as purchases,
COALESCE(s.failed_transactions, 0) as failed_transactions,
COALESCE(s.purchasing_customers, 0) as purchasing_customers,
COALESCE(s.stripe_revenue, 0) as stripe_revenue,
SAFE_DIVIDE(s.purchases, s.purchasing_customers) as purchases_per_customer_daily,
COALESCE(s.cumulative_purchases, 0) as cumulative_purchases,
COALESCE(cc.cumulative_company_signups, 0) as cumulative_company_signups,
SAFE_DIVIDE(s.cumulative_purchasing_customers_approx, cc.cumulative_company_signups) * 100 as company_purchase_conversion_pct,
SAFE_DIVIDE(s.cumulative_purchases, s.cumulative_purchasing_customers_approx) as avg_purchases_per_company,

-- ========== STRIPE SUBSCRIPTIONS (latest snapshot, forward-filled) ==========
COALESCE(sub.mrr, 0) as mrr,
COALESCE(sub.arr, 0) as arr,
COALESCE(sub.active_subscriptions, 0) as active_subscriptions,
COALESCE(sub.churned_subscriptions, 0) as churned_subscriptions,
sub.churn_rate_pct,

-- ========== TRAFFIC TOTALS ==========
COALESCE(g.sessions, 0) as sessions,
COALESCE(g.engaged_sessions, 0) as engaged_sessions,
SAFE_DIVIDE(g.engaged_sessions, g.sessions) * 100 as engagement_rate_pct,
COALESCE(g.total_events, 0) as total_events,
g.events_per_session,
COALESCE(g.key_events, 0) as key_events,
COALESCE(g.ga4_revenue, 0) as ga4_revenue,
  COALESCE(gu.new_users, 0) as new_users,

-- ========== TRAFFIC BY CHANNEL ==========
COALESCE(g.organic_sessions, 0) as organic_sessions,
COALESCE(g.paid_search_sessions, 0) as paid_search_sessions,
COALESCE(g.paid_pmax_sessions, 0) as paid_pmax_sessions,
COALESCE(g.paid_search_sessions, 0) + COALESCE(g.paid_pmax_sessions, 0) as total_paid_sessions,
COALESCE(g.direct_sessions, 0) as direct_sessions,
COALESCE(g.referral_sessions, 0) as referral_sessions,
COALESCE(g.social_sessions, 0) as social_sessions,
COALESCE(g.email_traffic_sessions, 0) as email_traffic_sessions,
COALESCE(g.video_sessions, 0) as video_sessions,

-- ========== CHANNEL ENGAGEMENT ==========
COALESCE(g.organic_engaged_sessions, 0) as organic_engaged_sessions,
COALESCE(g.paid_search_engaged_sessions, 0) as paid_search_engaged_sessions,
COALESCE(g.paid_pmax_engaged_sessions, 0) as paid_pmax_engaged_sessions,
SAFE_DIVIDE(g.organic_engaged_sessions, g.organic_sessions) * 100 as organic_engagement_rate,
SAFE_DIVIDE(g.paid_search_engaged_sessions + g.paid_pmax_engaged_sessions, g.paid_search_sessions + g.paid_pmax_sessions) * 100 as paid_engagement_rate,

-- ========== CHANNEL MIX ==========
SAFE_DIVIDE(g.organic_sessions, g.sessions) * 100 as organic_pct,
SAFE_DIVIDE(g.paid_search_sessions + g.paid_pmax_sessions, g.sessions) * 100 as paid_pct,
SAFE_DIVIDE(g.direct_sessions, g.sessions) * 100 as direct_pct,
SAFE_DIVIDE(g.referral_sessions, g.sessions) * 100 as referral_pct,

-- ========== GOOGLE ADS (attributed campaigns only) ==========
COALESCE(gads.gads_sessions, 0) as gads_sessions,
COALESCE(gads.gads_users, 0) as gads_users,
COALESCE(gads.gads_conversions, 0) as gads_conversions,
COALESCE(gads.gads_revenue, 0) as gads_revenue,
COALESCE(gads.gads_pmax_sessions, 0) as gads_pmax_sessions,
COALESCE(gads.gads_pmax_conversions, 0) as gads_pmax_conversions,
COALESCE(gads.gads_search_sessions, 0) as gads_search_sessions,
COALESCE(gads.gads_search_conversions, 0) as gads_search_conversions,

-- ========== CONVERSION RATES ==========
SAFE_DIVIDE(y.talent_signups, gu.new_users - y.company_signups) * 100 as talent_signup_rate_pct,
SAFE_DIVIDE(y.company_signups, gu.new_users - y.talent_signups) * 100 as company_signup_rate_pct,
SAFE_DIVIDE(y.talent_signups + y.company_signups, gu.new_users) * 100 as overall_signup_rate_pct,
SAFE_DIVIDE(y.revenue, g.sessions) as revenue_per_session,

-- ========== EMAIL CAMPAIGNS (LIFETIME TOTALS) ==========
COALESCE(e.campaigns_launched, 0) as campaigns_launched,
COALESCE(e.campaign_lifetime_sends, 0) as campaign_lifetime_sends,
COALESCE(e.campaign_lifetime_opens, 0) as campaign_lifetime_opens,
COALESCE(e.campaign_lifetime_clicks, 0) as campaign_lifetime_clicks,
e.campaign_avg_open_rate,
e.campaign_avg_ctr,
SAFE_DIVIDE(e.campaign_lifetime_clicks, e.campaign_lifetime_opens) * 100 as campaign_click_to_open_pct,
COALESCE(e.email_contacts_total, 0) as email_contacts_total,
COALESCE(e.email_list_subscribers_total, 0) as email_list_subscribers_total,

-- ========== EMAIL DAILY ACTIVITY ==========
COALESCE(ea.email_daily_opens, 0) as email_daily_opens,
COALESCE(ea.email_daily_unique_openers, 0) as email_daily_unique_openers,
COALESCE(ea.email_daily_clicks, 0) as email_daily_clicks,
COALESCE(ea.email_daily_unique_clickers, 0) as email_daily_unique_clickers,

-- ========== GROWTH: DOD ==========
y.talent_signups - LAG(y.talent_signups) OVER (ORDER BY d.date) as talent_signups_dod,
y.company_signups - LAG(y.company_signups) OVER (ORDER BY d.date) as company_signups_dod,
y.applications - LAG(y.applications) OVER (ORDER BY d.date) as applications_dod,
y.revenue - LAG(y.revenue) OVER (ORDER BY d.date) as revenue_dod,
g.sessions - LAG(g.sessions) OVER (ORDER BY d.date) as sessions_dod,
s.purchases - LAG(s.purchases) OVER (ORDER BY d.date) as purchases_dod,
s.stripe_revenue - LAG(s.stripe_revenue) OVER (ORDER BY d.date) as stripe_revenue_dod,

-- ========== GROWTH: 7D AVG ==========
AVG(y.talent_signups) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as talent_signups_7d_avg,
AVG(y.company_signups) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as company_signups_7d_avg,
AVG(y.applications) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as applications_7d_avg,
AVG(y.revenue) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as revenue_7d_avg,
AVG(g.sessions) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as sessions_7d_avg,
AVG(s.purchases) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as purchases_7d_avg,
AVG(s.stripe_revenue) OVER (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as stripe_revenue_7d_avg,

-- ========== GROWTH: WOW ==========
SAFE_DIVIDE(y.talent_signups - LAG(y.talent_signups, 7) OVER (ORDER BY d.date), LAG(y.talent_signups, 7) OVER (ORDER BY d.date)) * 100 as talent_signups_wow_pct,
SAFE_DIVIDE(y.revenue - LAG(y.revenue, 7) OVER (ORDER BY d.date), LAG(y.revenue, 7) OVER (ORDER BY d.date)) * 100 as revenue_wow_pct,
SAFE_DIVIDE(g.sessions - LAG(g.sessions, 7) OVER (ORDER BY d.date), LAG(g.sessions, 7) OVER (ORDER BY d.date)) * 100 as sessions_wow_pct,
SAFE_DIVIDE(s.purchases - LAG(s.purchases, 7) OVER (ORDER BY d.date), LAG(s.purchases, 7) OVER (ORDER BY d.date)) * 100 as purchases_wow_pct,
SAFE_DIVIDE(s.stripe_revenue - LAG(s.stripe_revenue, 7) OVER (ORDER BY d.date), LAG(s.stripe_revenue, 7) OVER (ORDER BY d.date)) * 100 as stripe_revenue_wow_pct

FROM date_spine d
LEFT JOIN ytjobs_daily y ON d.date = y.date
LEFT JOIN ga4_daily g ON d.date = g.date
  LEFT JOIN ga4_users_daily gu ON d.date = gu.date
  LEFT JOIN google_ads_daily gads ON d.date = gads.date
LEFT JOIN email_daily e ON d.date = e.date
LEFT JOIN email_activity_daily ea ON d.date = ea.date
LEFT JOIN stripe_cumulative s ON d.date = s.date
CROSS JOIN stripe_subscriptions_latest sub
LEFT JOIN company_cumulative cc ON d.date = cc.date
WHERE d.date >= '2025-01-01'
ORDER BY d.date DESC
