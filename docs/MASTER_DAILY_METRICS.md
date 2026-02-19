# Master Daily Metrics Reference

*Generated: 2026-02-07*
*BigQuery View: `opsos-864a1.marketing_ai.v_master_daily_metrics`*
*Location: northamerica-northeast1*

---

## Overview

A single consolidated view containing **78 daily metrics** from all data sources, with calculated fields and growth trends.

**Date Range:** January 1, 2025 → Present (updated daily)

---

## Data Sources

| Source | BigQuery Location | Data Type |
|--------|-------------------|-----------|
| **YTJobs MySQL** | `marketing_ai.daily_entity_metrics` (org_id='ytjobs') | Marketplace metrics |
| **Google Analytics 4** | `analytics_301802672.p_ga4_TrafficAcquisition_*` | Traffic & engagement |
| **ActiveCampaign** | `marketing_ai.daily_entity_metrics` (org_id='SBjucW1ztDyFYWBz7ZLE') | Email marketing |
| **Stripe** | `marketing_ai.raw_stripe` (data_type='charge') | Purchases & payments |

---

## Complete Metric Reference (78 Metrics)

### 1. Date Field

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 1 | `date` | DATE | Generated | Calendar date (date spine from 2025-01-01) |

---

### 2. Marketplace: Signups (4 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 2 | `talent_signups` | INT | YTJobs MySQL → `talent_signups.users` | New talent registrations |
| 3 | `company_signups` | INT | YTJobs MySQL → `company_signups.users` | New company registrations |
| 4 | `total_signups` | INT | **Calculated** | `talent_signups + company_signups` |

---

### 3. Marketplace: Jobs & Applications (6 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 5 | `jobs_posted` | INT | YTJobs MySQL → `jobs_posted.sessions` | New job listings created |
| 6 | `applications` | INT | YTJobs MySQL → `applications.sessions` | Job applications submitted |
| 7 | `apps_per_job` | FLOAT | **Calculated** | `applications / jobs_posted` |
| 8 | `hires` | INT | YTJobs MySQL → `hires.conversions` | Confirmed hires |
| 9 | `match_rate_pct` | FLOAT | **Calculated** | `(hires / jobs_posted) * 100` |
| 10 | `app_to_hire_pct` | FLOAT | **Calculated** | `(hires / applications) * 100` |

---

### 4. Marketplace: Revenue (3 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 11 | `revenue` | FLOAT | YTJobs MySQL → `marketplace_revenue.revenue` | Daily marketplace revenue ($) |
| 12 | `revenue_per_talent_signup` | FLOAT | **Calculated** | `revenue / talent_signups` |
| 13 | `revenue_per_hire` | FLOAT | **Calculated** | `revenue / hires` |

---

### 5. Marketplace: Engagement (3 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 14 | `job_views` | INT | YTJobs MySQL → `job_views.pageviews` | Job listing page views |
| 15 | `profile_views` | INT | YTJobs MySQL → `profile_views.pageviews` | Talent profile page views |
| 16 | `reviews` | INT | YTJobs MySQL → `reviews.conversions` | Reviews submitted |

---

### 6. Stripe: Purchases & Conversion (8 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 17 | `purchases` | INT | Stripe → `charge (status=succeeded)` | Daily successful purchases |
| 18 | `purchasing_customers` | INT | Stripe → `COUNT(DISTINCT customer)` | Unique customers purchasing that day |
| 19 | `stripe_revenue` | FLOAT | Stripe → `SUM(amount/100)` | Daily Stripe revenue ($) |
| 20 | `purchases_per_customer_daily` | FLOAT | **Calculated** | `purchases / purchasing_customers` (daily) |
| 21 | `cumulative_purchases` | INT | **Calculated** | Running total of all purchases |
| 22 | `cumulative_company_signups` | INT | **Calculated** | Running total of company signups |
| 23 | `company_purchase_conversion_pct` | FLOAT | **Calculated** | `(cumulative_customers / cumulative_company_signups) * 100` |
| 24 | `avg_purchases_per_company` | FLOAT | **Calculated** | `cumulative_purchases / cumulative_purchasing_customers` |

---

### 7. Traffic: Totals (7 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 25 | `sessions` | INT | GA4 → `SUM(sessions)` | Total website sessions |
| 26 | `engaged_sessions` | INT | GA4 → `SUM(engagedSessions)` | Sessions with engagement (>10s, key event, or 2+ pages) |
| 27 | `engagement_rate_pct` | FLOAT | **Calculated** | `(engaged_sessions / sessions) * 100` |
| 28 | `total_events` | INT | GA4 → `SUM(eventCount)` | Total tracked events |
| 29 | `events_per_session` | FLOAT | GA4 → `AVG(eventsPerSession)` | Average events per session |
| 30 | `key_events` | FLOAT | GA4 → `SUM(keyEvents)` | Conversion/key events |
| 31 | `ga4_revenue` | FLOAT | GA4 → `SUM(totalRevenue)` | GA4-tracked revenue |

---

### 8. Traffic: By Channel (9 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 32 | `organic_sessions` | INT | GA4 → `sessions WHERE channel='Organic Search'` | Organic search traffic |
| 33 | `paid_search_sessions` | INT | GA4 → `sessions WHERE channel='Paid Search'` | Google Ads Search traffic |
| 34 | `paid_pmax_sessions` | INT | GA4 → `sessions WHERE channel='Cross-network'` | Google Ads Performance Max traffic |
| 35 | `total_paid_sessions` | INT | **Calculated** | `paid_search_sessions + paid_pmax_sessions` |
| 36 | `direct_sessions` | INT | GA4 → `sessions WHERE channel='Direct'` | Direct traffic |
| 37 | `referral_sessions` | INT | GA4 → `sessions WHERE channel='Referral'` | Referral traffic |
| 38 | `social_sessions` | INT | GA4 → `sessions WHERE channel='Organic Social'` | Social media traffic |
| 39 | `email_traffic_sessions` | INT | GA4 → `sessions WHERE channel='Email'` | Email campaign traffic |
| 40 | `video_sessions` | INT | GA4 → `sessions WHERE channel='Organic Video'` | Video (YouTube) traffic |

---

### 9. Traffic: Channel Engagement (5 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 41 | `organic_engaged_sessions` | INT | GA4 → `engagedSessions WHERE channel='Organic Search'` | Engaged organic sessions |
| 42 | `paid_search_engaged_sessions` | INT | GA4 → `engagedSessions WHERE channel='Paid Search'` | Engaged paid search sessions |
| 43 | `paid_pmax_engaged_sessions` | INT | GA4 → `engagedSessions WHERE channel='Cross-network'` | Engaged PMax sessions |
| 44 | `organic_engagement_rate` | FLOAT | **Calculated** | `(organic_engaged / organic_sessions) * 100` |
| 45 | `paid_engagement_rate` | FLOAT | **Calculated** | `(paid_engaged / total_paid_sessions) * 100` |

---

### 10. Traffic: Channel Mix (4 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 46 | `organic_pct` | FLOAT | **Calculated** | `(organic_sessions / sessions) * 100` |
| 47 | `paid_pct` | FLOAT | **Calculated** | `(total_paid_sessions / sessions) * 100` |
| 48 | `direct_pct` | FLOAT | **Calculated** | `(direct_sessions / sessions) * 100` |
| 49 | `referral_pct` | FLOAT | **Calculated** | `(referral_sessions / sessions) * 100` |

---

### 11. Conversion Rates (4 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 50 | `talent_signup_rate_pct` | FLOAT | **Calculated** | `(talent_signups / sessions) * 100` |
| 51 | `company_signup_rate_pct` | FLOAT | **Calculated** | `(company_signups / sessions) * 100` |
| 52 | `overall_signup_rate_pct` | FLOAT | **Calculated** | `(total_signups / sessions) * 100` |
| 53 | `revenue_per_session` | FLOAT | **Calculated** | `revenue / sessions` |

---

### 12. Email Marketing (8 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 54 | `email_sends` | INT | ActiveCampaign → `email_campaign.sends` | Emails sent |
| 55 | `email_opens` | INT | ActiveCampaign → `email_campaign.opens` | Unique email opens |
| 56 | `email_clicks` | INT | ActiveCampaign → `email_campaign.clicks` | Email link clicks |
| 57 | `email_open_rate_pct` | FLOAT | ActiveCampaign → `AVG(open_rate)` | Average open rate |
| 58 | `email_ctr_pct` | FLOAT | ActiveCampaign → `AVG(click_through_rate)` | Average click-through rate |
| 59 | `email_click_to_open_pct` | FLOAT | **Calculated** | `(clicks / opens) * 100` |
| 60 | `email_contacts` | INT | ActiveCampaign → `contact_summary.users` | Total contacts in AC |
| 61 | `email_list_subscribers` | INT | ActiveCampaign → `SUM(email_list.users)` | Total list subscribers |

---

### 13. Growth: Day-over-Day (6 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 62 | `talent_signups_dod` | INT | **Calculated** | `talent_signups - LAG(talent_signups, 1)` |
| 63 | `company_signups_dod` | INT | **Calculated** | `company_signups - LAG(company_signups, 1)` |
| 64 | `applications_dod` | INT | **Calculated** | `applications - LAG(applications, 1)` |
| 65 | `revenue_dod` | FLOAT | **Calculated** | `revenue - LAG(revenue, 1)` |
| 66 | `sessions_dod` | INT | **Calculated** | `sessions - LAG(sessions, 1)` |
| 67 | `purchases_dod` | INT | **Calculated** | `purchases - LAG(purchases, 1)` |

---

### 14. Growth: 7-Day Rolling Averages (7 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 68 | `talent_signups_7d_avg` | FLOAT | **Calculated** | `AVG(talent_signups) OVER (ROWS 6 PRECEDING)` |
| 69 | `company_signups_7d_avg` | FLOAT | **Calculated** | `AVG(company_signups) OVER (ROWS 6 PRECEDING)` |
| 70 | `applications_7d_avg` | FLOAT | **Calculated** | `AVG(applications) OVER (ROWS 6 PRECEDING)` |
| 71 | `revenue_7d_avg` | FLOAT | **Calculated** | `AVG(revenue) OVER (ROWS 6 PRECEDING)` |
| 72 | `sessions_7d_avg` | FLOAT | **Calculated** | `AVG(sessions) OVER (ROWS 6 PRECEDING)` |
| 73 | `purchases_7d_avg` | FLOAT | **Calculated** | `AVG(purchases) OVER (ROWS 6 PRECEDING)` |
| 74 | `stripe_revenue_7d_avg` | FLOAT | **Calculated** | `AVG(stripe_revenue) OVER (ROWS 6 PRECEDING)` |

---

### 15. Growth: Week-over-Week (4 metrics)

| # | Metric | Type | Source | Description |
|---|--------|------|--------|-------------|
| 75 | `talent_signups_wow_pct` | FLOAT | **Calculated** | `((current - 7_days_ago) / 7_days_ago) * 100` |
| 76 | `revenue_wow_pct` | FLOAT | **Calculated** | `((current - 7_days_ago) / 7_days_ago) * 100` |
| 77 | `sessions_wow_pct` | FLOAT | **Calculated** | `((current - 7_days_ago) / 7_days_ago) * 100` |
| 78 | `purchases_wow_pct` | FLOAT | **Calculated** | `((current - 7_days_ago) / 7_days_ago) * 100` |

---

## Summary by Source

| Source | Raw Metrics | Calculated Metrics | Total |
|--------|-------------|-------------------|-------|
| **YTJobs MySQL** | 13 | 0 | 13 |
| **Google Analytics 4** | 16 | 0 | 16 |
| **Stripe** | 3 | 5 | 8 |
| **ActiveCampaign** | 6 | 0 | 6 |
| **Calculated** | 0 | 34 | 34 |
| **Date Spine** | 1 | 0 | 1 |
| **TOTAL** | **39** | **39** | **78** |

---

## Query Examples

### Get All Metrics for a Date Range
```sql
SELECT *
FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
WHERE date BETWEEN '2025-01-01' AND '2026-02-07'
ORDER BY date DESC
```

### Get Specific Category (Marketplace Only)
```sql
SELECT 
  date,
  talent_signups, company_signups, total_signups,
  jobs_posted, applications, apps_per_job,
  hires, match_rate_pct,
  revenue, revenue_per_talent_signup
FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
WHERE date >= '2025-01-01'
ORDER BY date DESC
```

### Get Traffic Breakdown
```sql
SELECT 
  date,
  sessions,
  organic_sessions, organic_pct,
  total_paid_sessions, paid_pct,
  direct_sessions, direct_pct,
  referral_sessions, referral_pct
FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
WHERE date >= '2025-06-01' AND sessions > 0
ORDER BY date DESC
```

### Get Conversion Funnel
```sql
SELECT 
  date,
  sessions,
  talent_signups, talent_signup_rate_pct,
  company_signups, company_signup_rate_pct,
  applications, apps_per_job,
  hires, match_rate_pct,
  revenue, revenue_per_session
FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
WHERE date >= '2025-01-01' AND sessions > 0
ORDER BY date DESC
```

### Get Growth Trends
```sql
SELECT 
  date,
  talent_signups, talent_signups_7d_avg, talent_signups_wow_pct,
  revenue, revenue_7d_avg, revenue_wow_pct,
  sessions, sessions_7d_avg, sessions_wow_pct
FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
WHERE date >= '2025-01-01' AND sessions > 0
ORDER BY date DESC
```

### Get Company Purchase Conversion Funnel
```sql
SELECT 
  date,
  company_signups,
  cumulative_company_signups,
  purchases,
  cumulative_purchases,
  purchasing_customers,
  stripe_revenue,
  ROUND(company_purchase_conversion_pct, 2) as conversion_pct,
  ROUND(avg_purchases_per_company, 2) as avg_purchases_per_company
FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
WHERE purchases > 0
ORDER BY date DESC
```

---

## Source Table Details

### YTJobs MySQL (`daily_entity_metrics` where org_id='ytjobs')

| Entity Type | Column Mapping |
|-------------|----------------|
| `talent_signups` | users → `talent_signups` |
| `company_signups` | users → `company_signups` |
| `applications` | sessions → `applications`, conversions → `application_hires` |
| `jobs_posted` | sessions → `jobs_posted` |
| `hires` | conversions → `hires` |
| `marketplace_revenue` | revenue → `revenue` |
| `job_views` | pageviews → `job_views` |
| `profile_views` | pageviews → `profile_views` |
| `reviews` | conversions → `reviews` |

### Google Analytics 4 (`p_ga4_TrafficAcquisition_301802672`)

| GA4 Column | View Column | Aggregation |
|------------|-------------|-------------|
| `sessions` | `sessions` | SUM by day |
| `engagedSessions` | `engaged_sessions` | SUM by day |
| `eventCount` | `total_events` | SUM by day |
| `eventsPerSession` | `events_per_session` | AVG by day |
| `keyEvents` | `key_events` | SUM by day |
| `totalRevenue` | `ga4_revenue` | SUM by day |
| `sessionDefaultChannelGroup` | Used for channel breakdown | GROUP BY |

### ActiveCampaign (`daily_entity_metrics` where org_id='SBjucW1ztDyFYWBz7ZLE')

| Entity Type | Column Mapping |
|-------------|----------------|
| `email_campaign` | sends → `email_sends`, opens → `email_opens`, clicks → `email_clicks` |
| `email_campaign` | open_rate → `email_open_rate_pct`, click_through_rate → `email_ctr_pct` |
| `contact_summary` | users → `email_contacts` |
| `email_list` | SUM(users) → `email_list_subscribers` |

### Stripe (`raw_stripe` where data_type='charge')

| JSON Field | View Column | Aggregation |
|------------|-------------|-------------|
| `$.status = 'succeeded'` | Filter for successful charges | WHERE clause |
| `$.created` | `date` | TIMESTAMP_SECONDS → DATE |
| `$.amount / 100` | `stripe_revenue` | SUM by day ($) |
| `$.customer` | `purchasing_customers` | COUNT(DISTINCT) by day |
| Count of charges | `purchases` | COUNT by day |

---

## Notes

- **NULL values**: Metrics are COALESCE'd to 0 when source data is missing
- **Division by zero**: All rate calculations use `SAFE_DIVIDE` to return NULL instead of error
- **Date gaps**: Date spine ensures every date from 2025-01-01 is represented, even with no data
- **Refresh**: View pulls live data from source tables on each query
- **Cumulative metrics**: `cumulative_purchasing_customers_approx` is a running sum of daily unique customers, not a true distinct count across all time. This slightly overestimates if customers purchase on multiple days.

---

*Last updated: 2026-02-07*
