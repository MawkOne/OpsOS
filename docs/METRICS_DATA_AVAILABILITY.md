# Metrics Data Availability Analysis

*Generated: 2026-02-07*
*Based on BigQuery data audit after region migration*

---

## Executive Summary

| Category | Can Calculate Now | Previously | Change |
|----------|------------------|------------|--------|
| **Revenue** | 8 / 24 | 17 | -9 (Stripe raw needs parsing) |
| **Customer/Acquisition** | 12 / 28 | 10 | +2 |
| **Marketplace** | 12 / 27 | 1 | **+11** |
| **Website/GA4** | 25 / 38 | 22 | +3 |
| **Email** | 0 / 10 | 8 | -8 (AC data empty) |
| **SEO** | 9 / 20 | 9 | 0 |
| **Paid Ads** | 0 / 7 | 0 | 0 |
| **TOTAL** | **66 / 165** | 67 | ~same |

**Key Win:** Marketplace metrics jumped from 1 → 12 calculable metrics thanks to YTJobs MySQL sync.

---

## Data Sources in BigQuery

| Dataset | Location | Tables | Status |
|---------|----------|--------|--------|
| `marketing_ai` | northamerica-northeast1 | 14 tables, 7 views | ✅ Active |
| `analytics_301802672` | northamerica-northeast1 | GA4 data | ✅ Active |

### Available Entity Types (daily_entity_metrics)

| Entity Type | Days of Data | Date Range | Key Metric |
|-------------|--------------|------------|------------|
| `talent_signups` | 411 | Jan 2025 - Feb 2026 | 164,296 users |
| `company_signups` | 411 | Jan 2025 - Feb 2026 | 44,617 users |
| `applications` | 411 | Jan 2025 - Feb 2026 | 538,522 apps |
| `jobs_posted` | 411 | Jan 2025 - Feb 2026 | 14,965 jobs |
| `marketplace_revenue` | 411 | Jan 2025 - Feb 2026 | $1.35M |
| `hires` | 183 | Jan 2025 - Feb 2026 | 524 hires |
| `reviews` | 411 | Jan 2025 - Feb 2026 | 42,829 reviews |
| `job_views` | 117 | Oct 2025 - Feb 2026 | pageviews |
| `profile_views` | 234 | Jun 2025 - Feb 2026 | pageviews |

---

## Metric-by-Metric Status

### 1. REVENUE METRICS (8/24 calculable)

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 1 | `mrr` | ❌ | Need to parse Stripe subscriptions |
| 2 | `arr` | ❌ | Derived from MRR |
| 3 | `gmv` | ⚠️ | Have marketplace_revenue, not full GMV |
| 4 | **`revenue`** | ✅ | **$1.35M total, monthly available** |
| 5 | `net_revenue` | ❌ | Need refund data |
| 6-10 | MRR breakdown | ❌ | Need Stripe subscription parsing |
| 11 | `subscription_revenue` | ❌ | Need Stripe parsing |
| 12 | **`job_listing_revenue`** | ⚠️ | Included in marketplace_revenue |
| 16 | **`arpu`** | ✅ | revenue / signups calculable |
| 17 | `arppu` | ❌ | Need paying user count |

**Sample Data:**
```
| Month   | Revenue  | MoM %  |
|---------|----------|--------|
| 2026-01 | $144,409 | +26.2% |
| 2025-12 | $114,436 | -0.4%  |
| 2025-11 | $114,937 | +13.9% |
```

---

### 2. CUSTOMER/ACQUISITION METRICS (12/28 calculable)

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 25-30 | Total counts | ❌ | Need full user table sync |
| 31-32 | Paying customers | ❌ | Need Stripe parsing |
| 33 | **`new_talent_signups`** | ✅ | **Daily data available** |
| 34 | **`new_company_signups`** | ✅ | **Daily data available** |
| 35 | **`signup_conversion_rate`** | ✅ | **GA4 sessions → signups** |
| 36 | **`talent_signup_rate`** | ✅ | **2.8-6.7% monthly** |
| 37 | **`company_signup_rate`** | ✅ | **0.7-2.2% monthly** |
| 38-40 | CAC metrics | ❌ | Need Google Ads |
| 41-48 | Retention/Churn | ❌ | Need time-series user data |

**Sample Conversion Rates:**
```
| Month   | Sessions | Talent Signups | Rate  | Company Signups | Rate  |
|---------|----------|----------------|-------|-----------------|-------|
| 2026-01 | 553,161  | 15,471         | 2.80% | 4,158           | 0.75% |
| 2025-12 | 474,664  | 15,005         | 3.16% | 3,443           | 0.73% |
| 2025-11 | 397,957  | 16,931         | 4.25% | 3,521           | 0.89% |
```

---

### 3. MARKETPLACE METRICS (12/27 calculable) ⭐ BIG WIN

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 53 | `talent_to_job_ratio` | ❌ | Need active counts |
| 54 | `jobs_per_company` | ❌ | Need company job counts |
| 55 | **`applications_per_job`** | ✅ | **28-43 apps/job** |
| 56 | `applications_per_talent` | ❌ | Need talent-level data |
| 58 | **`match_rate`** | ✅ | **0.6-3.4% (hires/jobs)** |
| 59-64 | Time to fill, funnel | ❌ | Need timestamp data |
| 65 | **`total_jobs_posted`** | ✅ | **14,965 total** |
| 66 | `active_jobs` | ❌ | Need status field |
| 67 | **`job_views`** | ✅ | **Data available** |
| 71 | **`jobs_filled`** | ✅ | **Via hires entity** |
| 74-79 | Talent performance | ❌ | Need profile data |

**Sample Marketplace Health:**
```
| Month   | Applications | Jobs Posted | Apps/Job | Hires | Match Rate |
|---------|--------------|-------------|----------|-------|------------|
| 2026-01 | 48,038       | 1,402       | 34.3     | 26    | 1.9%       |
| 2025-12 | 35,679       | 1,256       | 28.4     | 16    | 1.3%       |
| 2025-11 | 37,231       | 1,247       | 29.9     | 27    | 2.2%       |
```

---

### 4. WEBSITE/GA4 METRICS (25/38 calculable)

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 80 | **`sessions`** | ✅ | **3.15M total (Jan 2025+)** |
| 81 | **`users`** | ✅ | Available via GA4 |
| 82 | **`pageviews`** | ✅ | Event count available |
| 83-86 | DAU/WAU/MAU | ✅ | Derivable from sessions |
| 87 | **`organic_traffic`** | ✅ | **719K sessions** |
| 88 | **`paid_traffic`** | ✅ | **67K sessions** |
| 89 | **`referral_traffic`** | ✅ | **520K sessions** |
| 90 | **`direct_traffic`** | ✅ | **775K sessions** |
| 91 | **`social_traffic`** | ✅ | **259K sessions** |
| 92 | `bounce_rate` | ⚠️ | GA4 uses engagement rate instead |
| 93 | **`engagement_rate`** | ✅ | **54-82% by channel** |
| 94-96 | Session metrics | ✅ | Available |
| 97 | **`conversions`** | ✅ | Key events available |
| 98 | **`conversion_rate`** | ✅ | **3.5-8.9% signup rate** |
| 99 | **`visit_to_signup`** | ✅ | **Same as above** |
| 100-102 | Funnel stages | ❌ | Need activation events |
| 103-106 | Scroll/Exit | ❌ | Need enhanced measurement |
| 107-117 | Feature adoption | ❌ | Need custom events |

**Traffic by Channel:**
```
| Channel        | Sessions | Engaged | Engagement Rate |
|----------------|----------|---------|-----------------|
| Direct         | 775,439  | 470,654 | 60.7%           |
| Organic Search | 719,520  | 579,374 | 80.5%           |
| Referral       | 519,855  | 399,439 | 76.8%           |
| Cross-network  | 268,138  | 214,953 | 80.2%           |
| Organic Social | 258,715  | 194,560 | 75.2%           |
| Email          | 258,133  | 201,820 | 78.2%           |
| Paid Search    | 67,130   | 55,076  | 82.0%           |
```

---

### 5. E-COMMERCE FUNNEL (0/7 calculable)

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 118-124 | All funnel metrics | ❌ | Need GA4 e-commerce implementation |

**Action Required:** Implement GA4 e-commerce tracking on website.

---

### 6. EMAIL MARKETING (0/10 calculable)

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 125-134 | All email metrics | ❌ | ActiveCampaign raw_data is empty |

**Action Required:** Fix ActiveCampaign sync.

---

### 7. SEO METRICS (9/20 calculable)

Status unchanged - DataForSEO data available.

---

### 8. PAID ADVERTISING (0/7 calculable)

| # | Metric | Status | Notes |
|---|--------|--------|-------|
| 155-161 | All ad metrics | ❌ | Google Ads not connected |

**Action Required:** Connect Google Ads via BigQuery Data Transfer.

---

## Available BigQuery Views

All views are in `opsos-864a1.marketing_ai`:

| View | Description | Key Metrics |
|------|-------------|-------------|
| `v_ytjobs_daily_metrics` | Last 30 days by entity | DoD, WoW changes, 7d rolling avg |
| `v_ytjobs_weekly_metrics` | Weekly aggregates | WoW change, conversion rate |
| `v_ytjobs_monthly_metrics` | Monthly aggregates | MoM change, revenue growth |
| `v_ytjobs_l12m_metrics` | Last 12 months | Rolling averages, best/worst month |
| `v_ytjobs_alltime_metrics` | All historical data | Cumulative totals, YoY growth |
| `v_ytjobs_conversion_rates` | Monthly with GA4 join | Traffic → Signup rates |
| `v_ytjobs_weekly_conversion_rates` | Weekly with GA4 join | Weekly signup rates |

---

## Priority Actions to Increase Coverage

### 1. Parse Stripe Raw Data → +10 metrics
- MRR, ARR, churn rates, subscription breakdown
- Data exists in `raw_stripe` but needs JSON parsing

### 2. Connect Google Ads → +7 metrics  
- Ad spend, CPC, CPA, ROAS
- Enables CAC and LTV/CAC calculations

### 3. Fix ActiveCampaign Sync → +8 metrics
- Email opens, clicks, CTR
- Currently returning empty data

### 4. Add YTJobs Full User Sync → +15 metrics
- Total users, active users, retention
- Profile completion, response rates

### 5. Enable GA4 E-commerce → +7 metrics
- Add to cart, checkout, purchase events
- Cart abandonment rate

---

## Sample Queries

### Monthly Revenue with Growth
```sql
SELECT * FROM `opsos-864a1.marketing_ai.v_ytjobs_monthly_metrics`
WHERE entity_type = 'marketplace_revenue'
ORDER BY year_month DESC
```

### Conversion Rates with GA4 Traffic
```sql
SELECT * FROM `opsos-864a1.marketing_ai.v_ytjobs_conversion_rates`
ORDER BY year_month DESC
```

### Weekly Marketplace Health
```sql
SELECT 
  year_week,
  MAX(CASE WHEN entity_type = 'applications' THEN sessions END) as apps,
  MAX(CASE WHEN entity_type = 'jobs_posted' THEN sessions END) as jobs,
  MAX(CASE WHEN entity_type = 'applications' THEN conversions END) as hires
FROM `opsos-864a1.marketing_ai.v_ytjobs_weekly_metrics`
GROUP BY year_week
ORDER BY year_week DESC
```

---

*Next update scheduled after: Google Ads connection, Stripe parsing, AC fix*
