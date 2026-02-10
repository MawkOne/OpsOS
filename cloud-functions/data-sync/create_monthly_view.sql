-- v_master_monthly_metrics: same logic as weekly but by calendar month.
-- Best practice: aggregate by calendar month (actual days 28-31), not fixed 30/31.
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.v_master_monthly_metrics` AS
WITH daily_data AS (
  SELECT
    *,
    EXTRACT(YEAR FROM date) as year,
    EXTRACT(MONTH FROM date) as month
  FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
),

monthly_aggregated AS (
  SELECT
    -- Month identifier (YYYY-MM); calendar month boundaries (actual days 28-31)
    FORMAT_DATE('%Y-%m', DATE(year, month, 1)) as month_num,
    year,
    month,
    DATE(year, month, 1) as month_start,
    LAST_DAY(DATE(year, month, 1), MONTH) as month_end,
    DATE_DIFF(LAST_DAY(DATE(year, month, 1), MONTH), DATE(year, month, 1), DAY) + 1 as days_in_month,
    COUNT(*) as days_with_data,

    -- ========== MARKETPLACE: SIGNUPS ==========
    SUM(talent_signups) as talent_signups,
    SUM(company_signups) as company_signups,
    SUM(total_signups) as total_signups,
    AVG(talent_signups) as talent_signups_daily_avg,
    AVG(company_signups) as company_signups_daily_avg,

    -- ========== MARKETPLACE: JOBS ==========
    SUM(jobs_posted) as jobs_posted,
    SUM(applications) as applications,
    SAFE_DIVIDE(SUM(applications), SUM(jobs_posted)) as apps_per_job,
    SUM(hires) as hires,
    SAFE_DIVIDE(SUM(hires), SUM(jobs_posted)) * 100 as match_rate_pct,
    SAFE_DIVIDE(SUM(hires), SUM(applications)) * 100 as app_to_hire_pct,

    -- ========== MARKETPLACE: REVENUE ==========
    SUM(revenue) as revenue,
    AVG(revenue) as revenue_daily_avg,
    SAFE_DIVIDE(SUM(revenue), SUM(talent_signups)) as revenue_per_talent_signup,
    SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(hires), 0)) as revenue_per_hire,

    -- ========== ENGAGEMENT ==========
    SUM(job_views) as job_views,
    SUM(profile_views) as profile_views,
    SUM(reviews) as reviews,

    -- ========== STRIPE REVENUE ==========
    SUM(purchases) as purchases,
    SUM(failed_transactions) as failed_transactions,
    SUM(purchasing_customers) as purchasing_customers,
    SUM(stripe_revenue) as stripe_revenue,
    AVG(stripe_revenue) as stripe_revenue_daily_avg,
    SAFE_DIVIDE(SUM(purchases), SUM(purchasing_customers)) as purchases_per_customer,
    MAX(cumulative_purchases) as cumulative_purchases,
    MAX(cumulative_company_signups) as cumulative_company_signups,

    -- ========== STRIPE SUBSCRIPTIONS (latest in month) ==========
    MAX(mrr) as mrr,
    MAX(arr) as arr,
    MAX(active_subscriptions) as active_subscriptions,
    MAX(churned_subscriptions) as churned_subscriptions,
    MAX(churn_rate_pct) as churn_rate_pct,

    -- ========== TRAFFIC TOTALS ==========
    SUM(sessions) as sessions,
    SUM(engaged_sessions) as engaged_sessions,
    SAFE_DIVIDE(SUM(engaged_sessions), SUM(sessions)) * 100 as engagement_rate_pct,
    SUM(total_events) as total_events,
    AVG(events_per_session) as events_per_session,
    SUM(key_events) as key_events,
    SUM(ga4_revenue) as ga4_revenue,

    -- ========== TRAFFIC BY CHANNEL ==========
    SUM(organic_sessions) as organic_sessions,
    SUM(paid_search_sessions) as paid_search_sessions,
    SUM(paid_pmax_sessions) as paid_pmax_sessions,
    SUM(total_paid_sessions) as total_paid_sessions,
    SUM(direct_sessions) as direct_sessions,
    SUM(referral_sessions) as referral_sessions,
    SUM(social_sessions) as social_sessions,
    SUM(email_traffic_sessions) as email_traffic_sessions,
    SUM(video_sessions) as video_sessions,

    -- ========== CHANNEL ENGAGEMENT ==========
    SUM(organic_engaged_sessions) as organic_engaged_sessions,
    SUM(paid_search_engaged_sessions) as paid_search_engaged_sessions,
    SUM(paid_pmax_engaged_sessions) as paid_pmax_engaged_sessions,
    SAFE_DIVIDE(SUM(organic_engaged_sessions), SUM(organic_sessions)) * 100 as organic_engagement_rate,
    SAFE_DIVIDE(SUM(paid_search_engaged_sessions) + SUM(paid_pmax_engaged_sessions),
                SUM(paid_search_sessions) + SUM(paid_pmax_sessions)) * 100 as paid_engagement_rate,

    -- ========== CHANNEL MIX ==========
    SAFE_DIVIDE(SUM(organic_sessions), SUM(sessions)) * 100 as organic_pct,
    SAFE_DIVIDE(SUM(total_paid_sessions), SUM(sessions)) * 100 as paid_pct,
    SAFE_DIVIDE(SUM(direct_sessions), SUM(sessions)) * 100 as direct_pct,
    SAFE_DIVIDE(SUM(referral_sessions), SUM(sessions)) * 100 as referral_pct,

    -- ========== GOOGLE ADS ==========
    SUM(gads_sessions) as gads_sessions,
    SUM(gads_users) as gads_users,
    SUM(gads_conversions) as gads_conversions,
    SUM(gads_revenue) as gads_revenue,
    SUM(gads_pmax_sessions) as gads_pmax_sessions,
    SUM(gads_pmax_conversions) as gads_pmax_conversions,
    SUM(gads_search_sessions) as gads_search_sessions,
    SUM(gads_search_conversions) as gads_search_conversions,

    -- ========== CONVERSION RATES ==========
    SAFE_DIVIDE(SUM(talent_signups), SUM(sessions)) * 100 as talent_signup_rate_pct,
    SAFE_DIVIDE(SUM(company_signups), SUM(sessions)) * 100 as company_signup_rate_pct,
    SAFE_DIVIDE(SUM(total_signups), SUM(sessions)) * 100 as overall_signup_rate_pct,
    SAFE_DIVIDE(SUM(revenue), SUM(sessions)) as revenue_per_session,

    -- ========== EMAIL CAMPAIGNS ==========
    SUM(campaigns_launched) as campaigns_launched,
    MAX(campaign_lifetime_sends) as campaign_lifetime_sends,
    MAX(campaign_lifetime_opens) as campaign_lifetime_opens,
    MAX(campaign_lifetime_clicks) as campaign_lifetime_clicks,
    AVG(campaign_avg_open_rate) as campaign_avg_open_rate,
    AVG(campaign_avg_ctr) as campaign_avg_ctr,

    -- ========== EMAIL DAILY ACTIVITY (monthly totals) ==========
    SUM(email_daily_opens) as email_monthly_opens,
    SUM(email_daily_clicks) as email_monthly_clicks,
    AVG(email_daily_opens) as email_opens_daily_avg,
    MAX(email_daily_unique_openers) as email_peak_unique_openers

  FROM daily_data
  GROUP BY year, month
)

SELECT
  m.*,

  -- ========== GROWTH: MoM (Month over Month) ==========
  m.talent_signups - LAG(m.talent_signups) OVER (ORDER BY m.year, m.month) as talent_signups_mom,
  SAFE_DIVIDE(m.talent_signups - LAG(m.talent_signups) OVER (ORDER BY m.year, m.month),
              LAG(m.talent_signups) OVER (ORDER BY m.year, m.month)) * 100 as talent_signups_mom_pct,

  m.company_signups - LAG(m.company_signups) OVER (ORDER BY m.year, m.month) as company_signups_mom,
  SAFE_DIVIDE(m.company_signups - LAG(m.company_signups) OVER (ORDER BY m.year, m.month),
              LAG(m.company_signups) OVER (ORDER BY m.year, m.month)) * 100 as company_signups_mom_pct,

  m.sessions - LAG(m.sessions) OVER (ORDER BY m.year, m.month) as sessions_mom,
  SAFE_DIVIDE(m.sessions - LAG(m.sessions) OVER (ORDER BY m.year, m.month),
              LAG(m.sessions) OVER (ORDER BY m.year, m.month)) * 100 as sessions_mom_pct,

  m.stripe_revenue - LAG(m.stripe_revenue) OVER (ORDER BY m.year, m.month) as stripe_revenue_mom,
  SAFE_DIVIDE(m.stripe_revenue - LAG(m.stripe_revenue) OVER (ORDER BY m.year, m.month),
              LAG(m.stripe_revenue) OVER (ORDER BY m.year, m.month)) * 100 as stripe_revenue_mom_pct,

  m.purchases - LAG(m.purchases) OVER (ORDER BY m.year, m.month) as purchases_mom,
  SAFE_DIVIDE(m.purchases - LAG(m.purchases) OVER (ORDER BY m.year, m.month),
              LAG(m.purchases) OVER (ORDER BY m.year, m.month)) * 100 as purchases_mom_pct,

  m.applications - LAG(m.applications) OVER (ORDER BY m.year, m.month) as applications_mom,
  SAFE_DIVIDE(m.applications - LAG(m.applications) OVER (ORDER BY m.year, m.month),
              LAG(m.applications) OVER (ORDER BY m.year, m.month)) * 100 as applications_mom_pct,

  -- ========== 3-MONTH ROLLING AVERAGES ==========
  AVG(m.talent_signups) OVER (ORDER BY m.year, m.month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as talent_signups_3m_avg,
  AVG(m.company_signups) OVER (ORDER BY m.year, m.month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as company_signups_3m_avg,
  AVG(m.sessions) OVER (ORDER BY m.year, m.month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as sessions_3m_avg,
  AVG(m.stripe_revenue) OVER (ORDER BY m.year, m.month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as stripe_revenue_3m_avg,
  AVG(m.purchases) OVER (ORDER BY m.year, m.month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as purchases_3m_avg

FROM monthly_aggregated m
ORDER BY m.year DESC, m.month DESC;
