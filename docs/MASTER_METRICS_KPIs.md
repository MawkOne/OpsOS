# Master Metrics & KPIs

## YTJobs Business Profile

| Attribute | Value |
|-----------|-------|
| **Business Type** | Two-Sided Talent Marketplace |
| **Focus** | YouTube creators & video production professionals |
| **Scale** | 500,000+ registered users |
| **Notable Clients** | MrBeast, Mark Rober, Warner Media |

### Revenue Streams
1. Job Listing & Promotion ($50-$2,500/listing)
2. Subscriptions ($8-$499/month)
3. High-Touch Matching Services ($500-$5,000/role)
4. Transaction Fees (2-8%)
5. Data Products ($5K-$15K/year)

---

## Complete Metrics List (165 Unique Metrics)

### Legend
| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical - Track Daily |
| 🟡 | High - Track Weekly |
| 🟢 | Medium - Track Monthly |
| ✅ | Data Available |
| ⚠️ | Partial/Sparse Data |
| ❌ | Data Not Available |

---

## 1. REVENUE METRICS

### 1.1 Core Revenue (Stripe)

| # | Metric | Description | Calculation | Priority | Status | Source |
|---|--------|-------------|-------------|----------|--------|--------|
| 1 | `mrr` | Monthly Recurring Revenue | Sum active subscriptions | 🔴 | ✅ | Stripe |
| 2 | `arr` | Annual Recurring Revenue | MRR × 12 | 🔴 | ✅ | Stripe |
| 3 | `gmv` | Gross Merchandise Value | Total transaction value | 🔴 | ✅ | Stripe |
| 4 | `revenue` | Total Revenue | All revenue sources | 🔴 | ✅ | Stripe/GA4 |
| 5 | `net_revenue` | Net Revenue | Revenue - Refunds | 🟡 | ✅ | Stripe |
| 6 | `new_mrr` | New MRR | First-time subscriptions | 🔴 | ✅ | Stripe |
| 7 | `expansion_mrr` | Expansion MRR | Upgrade revenue | 🔴 | ✅ | Stripe |
| 8 | `contraction_mrr` | Contraction MRR | Downgrade losses | 🔴 | ✅ | Stripe |
| 9 | `churned_mrr` | Churned MRR | Cancelled subscriptions | 🔴 | ✅ | Stripe |
| 10 | `net_new_mrr` | Net New MRR | New + Expansion - Contraction - Churned | 🔴 | ✅ | Stripe |

### 1.2 Revenue Breakdown

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 11 | `subscription_revenue` | Revenue from subscriptions | 🔴 | ✅ | Stripe |
| 12 | `job_listing_revenue` | Revenue from job posts | 🔴 | ❌ | YTJobs DB |
| 13 | `promotion_revenue` | Featured/sponsored revenue | 🟡 | ❌ | YTJobs DB |
| 14 | `transaction_fee_revenue` | Escrow/payment fees | 🟡 | ❌ | Stripe |
| 15 | `services_revenue` | Curated matching revenue | 🟡 | ❌ | YTJobs DB |

### 1.3 Revenue Quality

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 16 | `arpu` | Avg Revenue Per User | 🟡 | ✅ | Stripe |
| 17 | `arppu` | Avg Revenue Per Paying User | 🟡 | ✅ | Stripe |
| 18 | `take_rate` | Platform fee % | 🟡 | ❌ | Calculated |
| 19 | `average_order_value` | Avg transaction value | 🟡 | ❌ | Stripe |
| 20 | `talent_pro_mrr` | Talent Pro subscription MRR | 🟡 | ✅ | Stripe |
| 21 | `company_access_mrr` | Company subscription MRR | 🟡 | ✅ | Stripe |
| 22 | `agency_mrr` | Agency subscription MRR | 🟡 | ✅ | Stripe |
| 23 | `enterprise_arr` | Enterprise contract ARR | 🟡 | ✅ | Stripe |
| 24 | `subscription_mix` | Revenue by plan type % | 🟢 | ✅ | Stripe |

---

## 2. CUSTOMER METRICS

### 2.1 Customer Counts

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 25 | `total_customers` | All registered users | 🔴 | ❌ | YTJobs DB |
| 26 | `total_talent` | Talent profiles | 🔴 | ❌ | YTJobs DB |
| 27 | `total_companies` | Company accounts | 🔴 | ❌ | YTJobs DB |
| 28 | `total_agencies` | Agency accounts | 🟡 | ❌ | YTJobs DB |
| 29 | `active_talent` | Active talent (30d) | 🔴 | ❌ | YTJobs DB |
| 30 | `active_companies` | Active companies (30d) | 🔴 | ❌ | YTJobs DB |
| 31 | `paying_customers` | Customers with subscription | 🔴 | ✅ | Stripe |
| 32 | `customers` | Stripe customer count | 🔴 | ✅ | Stripe |

### 2.2 Acquisition

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 33 | `new_talent_signups` | New talent/day | 🔴 | ✅ | GA4 (talent-signup event) |
| 34 | `new_company_signups` | New companies/day | 🔴 | ❌ | YTJobs DB |
| 35 | `signup_conversion_rate` | Visitors to signups | 🔴 | ✅ | GA4 |
| 36 | `talent_signup_rate` | Talent page to signup | 🟡 | ✅ | GA4 |
| 37 | `company_signup_rate` | Company page to signup | 🟡 | ❌ | GA4 |
| 38 | `cac_talent` | Cost to acquire talent | 🟡 | ❌ | Google Ads |
| 39 | `cac_company` | Cost to acquire company | 🟡 | ❌ | Google Ads |
| 40 | `cac_blended` | Blended CAC | 🔴 | ❌ | Google Ads |

### 2.3 Retention & Churn

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 41 | `logo_churn_rate` | Customer churn % | 🔴 | ✅ | Stripe |
| 42 | `revenue_churn_rate` | Revenue churn % | 🔴 | ✅ | Stripe |
| 43 | `net_revenue_retention` | NRR (goal: >100%) | 🔴 | ✅ | Stripe |
| 44 | `gross_revenue_retention` | GRR (goal: >90%) | 🔴 | ✅ | Stripe |
| 45 | `talent_retention_30d` | Talent 30d retention | 🟡 | ❌ | YTJobs DB |
| 46 | `talent_retention_90d` | Talent 90d retention | 🟡 | ❌ | YTJobs DB |
| 47 | `company_retention_30d` | Company 30d retention | 🟡 | ❌ | YTJobs DB |
| 48 | `subscription_retention` | Subscription renewal % | 🔴 | ✅ | Stripe |

### 2.4 Lifetime Value

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 49 | `ltv_talent` | Talent lifetime value | 🔴 | ⚠️ | Stripe + YTJobs DB |
| 50 | `ltv_company` | Company lifetime value | 🔴 | ⚠️ | Stripe + YTJobs DB |
| 51 | `ltv_cac_ratio` | LTV/CAC (goal: >3) | 🔴 | ❌ | Calculated |
| 52 | `payback_period` | Months to recover CAC | 🟡 | ❌ | Calculated |

---

## 3. MARKETPLACE METRICS

### 3.1 Supply & Demand Balance

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 53 | `talent_to_job_ratio` | Talent per open job | 🔴 | ❌ | YTJobs DB |
| 54 | `jobs_per_company` | Jobs per company | 🟡 | ❌ | YTJobs DB |
| 55 | `applications_per_job` | Apps per listing | 🔴 | ❌ | YTJobs DB |
| 56 | `applications_per_talent` | Apps per talent | 🟡 | ❌ | YTJobs DB |
| 57 | `supply_utilization` | % talent with apps | 🟡 | ❌ | YTJobs DB |

### 3.2 Liquidity & Matching

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 58 | `match_rate` | Hires / Jobs posted | 🔴 | ❌ | YTJobs DB |
| 59 | `time_to_fill` | Days to hire | 🔴 | ❌ | YTJobs DB |
| 60 | `time_to_first_application` | Days to first app | 🟡 | ❌ | YTJobs DB |
| 61 | `interview_rate` | Apps to interviews | 🟡 | ❌ | YTJobs DB |
| 62 | `offer_rate` | Interviews to offers | 🟡 | ❌ | YTJobs DB |
| 63 | `acceptance_rate` | Offers accepted | 🟡 | ❌ | YTJobs DB |
| 64 | `quality_of_hire` | Post-hire satisfaction | 🟡 | ❌ | Survey |

### 3.3 Job Listing Performance

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 65 | `total_jobs_posted` | Jobs posted | 🔴 | ❌ | YTJobs DB |
| 66 | `active_jobs` | Open jobs | 🔴 | ❌ | YTJobs DB |
| 67 | `job_views` | Views per job | 🟡 | ✅ | GA4 (page entity) |
| 68 | `job_click_rate` | Search to view rate | 🟡 | ❌ | GA4 + YTJobs DB |
| 69 | `apply_rate` | Views to applications | 🔴 | ❌ | YTJobs DB |
| 70 | `featured_job_conversion` | Featured vs standard | 🟡 | ❌ | YTJobs DB |
| 71 | `jobs_filled` | Filled jobs | 🔴 | ❌ | YTJobs DB |
| 72 | `jobs_expired` | Expired unfilled | 🟢 | ❌ | YTJobs DB |
| 73 | `repeat_posting_rate` | Companies posting again | 🟡 | ❌ | YTJobs DB |

### 3.4 Talent Performance

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 74 | `profile_completion_rate` | % complete profiles | 🟡 | ❌ | YTJobs DB |
| 75 | `portfolio_upload_rate` | % with portfolio | 🟡 | ❌ | YTJobs DB |
| 76 | `talent_response_rate` | Response to messages | 🟡 | ❌ | YTJobs DB |
| 77 | `talent_response_time` | Avg response hours | 🟡 | ❌ | YTJobs DB |
| 78 | `talent_placement_rate` | Hired talent % | 🔴 | ❌ | YTJobs DB |
| 79 | `talent_repeat_hire_rate` | Repeat hires % | 🟡 | ❌ | YTJobs DB |

---

## 4. WEBSITE & ENGAGEMENT METRICS (GA4)

### 4.1 Traffic

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 80 | `sessions` | Total sessions | 🔴 | ✅ | GA4 |
| 81 | `users` | Unique visitors | 🔴 | ✅ | GA4 |
| 82 | `pageviews` | Page views | 🟡 | ✅ | GA4 |
| 83 | `dau` | Daily Active Users | 🔴 | ✅ | GA4 |
| 84 | `wau` | Weekly Active Users | 🔴 | ✅ | GA4 |
| 85 | `mau` | Monthly Active Users | 🔴 | ✅ | GA4 |
| 86 | `dau_mau_ratio` | Stickiness (goal: >20%) | 🔴 | ✅ | GA4 |

### 4.2 Traffic Sources

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 87 | `organic_traffic` | Organic sessions | 🔴 | ✅ | GA4 |
| 88 | `paid_traffic` | Paid sessions | 🔴 | ✅ | GA4 |
| 89 | `referral_traffic` | Referral sessions | 🟡 | ✅ | GA4 |
| 90 | `direct_traffic` | Direct sessions | 🟡 | ✅ | GA4 |
| 91 | `social_traffic` | Social sessions | 🟡 | ✅ | GA4 |

### 4.3 Engagement

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 92 | `bounce_rate` | Single page visits | 🟡 | ⚠️ | GA4 |
| 93 | `engagement_rate` | Engaged sessions % | 🟡 | ✅ | GA4 |
| 94 | `avg_session_duration` | Avg session length | 🟡 | ⚠️ | GA4 |
| 95 | `pages_per_session` | Pages per session | 🟡 | ✅ | GA4 |
| 96 | `sessions_per_user` | Sessions per user | 🟡 | ✅ | GA4 |

### 4.4 Conversions

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 97 | `conversions` | Total conversions | 🔴 | ✅ | GA4 |
| 98 | `conversion_rate` | Conversion % | 🔴 | ⚠️ | GA4 |
| 99 | `visit_to_signup` | Visitor to signup % | 🔴 | ✅ | GA4 |
| 100 | `signup_to_activation` | Signup to activated % | 🔴 | ❌ | GA4 + YTJobs DB |
| 101 | `activation_to_paid` | Activated to paid % | 🔴 | ❌ | GA4 + Stripe |
| 102 | `visitor_to_paid` | End-to-end conversion | 🔴 | ❌ | GA4 + Stripe |

### 4.5 Page Performance

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 103 | `scroll_depth_avg` | Avg scroll depth | 🟡 | ❌ | GA4 Enhanced |
| 104 | `scroll_depth_75` | % reaching 75% | 🟡 | ❌ | GA4 Enhanced |
| 105 | `exit_rate` | Exit rate by page | 🟡 | ❌ | GA4 API |
| 106 | `page_load_time` | Avg load time | 🟡 | ❌ | DataForSEO |

### 4.6 Feature Adoption

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 107 | `search_usage_rate` | Users using search | 🟡 | ❌ | GA4 Events |
| 108 | `filter_usage_rate` | Users using filters | 🟢 | ❌ | GA4 Events |
| 109 | `save_job_rate` | Users saving jobs | 🟢 | ❌ | GA4 Events |
| 110 | `message_send_rate` | Users messaging | 🟡 | ❌ | YTJobs DB |
| 111 | `profile_view_rate` | Profiles viewed | 🟡 | ✅ | GA4 |

### 4.7 Activation

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 112 | `talent_activation_rate` | Talent completing key action | 🔴 | ❌ | YTJobs DB |
| 113 | `company_activation_rate` | Company posting first job | 🔴 | ❌ | YTJobs DB |
| 114 | `time_to_first_action` | Days to first action | 🟡 | ❌ | YTJobs DB |
| 115 | `time_to_first_application` | Days to first apply | 🟡 | ❌ | YTJobs DB |
| 116 | `time_to_first_job_post` | Days to first post | 🟡 | ❌ | YTJobs DB |
| 117 | `onboarding_completion` | % completing onboarding | 🟡 | ❌ | YTJobs DB |

---

## 5. E-COMMERCE FUNNEL METRICS (GA4)

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 118 | `add_to_cart` | Add to cart events | 🟡 | ❌ | GA4 E-commerce |
| 119 | `checkout_started` | Checkout begins | 🟡 | ❌ | GA4 E-commerce |
| 120 | `purchase_completed` | Purchases | 🔴 | ❌ | GA4 E-commerce |
| 121 | `cart_abandonment_rate` | Cart abandonment % | 🟡 | ❌ | Calculated |
| 122 | `form_starts` | Form start events | 🟡 | ❌ | GA4 Events |
| 123 | `form_submits` | Form submit events | 🟡 | ❌ | GA4 Events |
| 124 | `form_abandonment_rate` | Form abandonment % | 🟡 | ❌ | Calculated |

---

## 6. EMAIL MARKETING METRICS (ActiveCampaign)

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 125 | `sends` | Emails sent | 🟡 | ✅ | ActiveCampaign |
| 126 | `opens` | Emails opened | 🟡 | ✅ | ActiveCampaign |
| 127 | `open_rate` | Open rate | 🟡 | ✅ | ActiveCampaign |
| 128 | `clicks` | Links clicked | 🟡 | ✅ | ActiveCampaign |
| 129 | `click_through_rate` | CTR | 🟡 | ✅ | ActiveCampaign |
| 130 | `email_list_size` | Total subscribers | 🟡 | ✅ | ActiveCampaign |
| 131 | `email_list_growth` | Growth rate | 🟡 | ✅ | ActiveCampaign |
| 132 | `email_bounce_rate` | Bounce rate | 🟡 | ✅ | ActiveCampaign |
| 133 | `email_unsubscribe_rate` | Unsubscribe rate | 🟢 | ❌ | ActiveCampaign |
| 134 | `email_conversion_rate` | Email to action | 🟡 | ❌ | AC + GA4 |

---

## 7. SEO METRICS (DataForSEO)

### 7.1 Keyword Rankings

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 135 | `position` | Keyword rank position | 🟡 | ✅ | DataForSEO |
| 136 | `search_volume` | Monthly search volume | 🟡 | ✅ | DataForSEO |
| 137 | `organic_keywords` | Keywords ranking | 🟡 | ✅ | DataForSEO |
| 138 | `top_10_keywords` | Keywords pos 1-10 | 🟡 | ✅ | DataForSEO |
| 139 | `avg_position` | Avg ranking position | 🟡 | ✅ | DataForSEO |
| 140 | `seo_position_change` | Position change | 🟡 | ❌ | Calculated |
| 141 | `impressions` | Search impressions | 🟡 | ⚠️ | DataForSEO |
| 142 | `ctr` | Organic CTR | 🟡 | ❌ | DataForSEO |

### 7.2 Domain Metrics

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 143 | `domain_rank` | Domain authority | 🟢 | ✅ | DataForSEO |
| 144 | `backlinks_total` | Total backlinks | 🟢 | ✅ | DataForSEO |
| 145 | `referring_domains` | Referring domains | 🟢 | ✅ | DataForSEO |
| 146 | `backlinks_change` | Backlink change | 🟢 | ❌ | Calculated |

### 7.3 Technical SEO

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 147 | `core_web_vitals_lcp` | LCP score | 🟡 | ❌ | DataForSEO PageSpeed |
| 148 | `core_web_vitals_fid` | FID score | 🟢 | ❌ | DataForSEO PageSpeed |
| 149 | `core_web_vitals_cls` | CLS score | 🟢 | ❌ | DataForSEO PageSpeed |
| 150 | `onpage_score` | On-page SEO score | 🟡 | ❌ | DataForSEO On-Page |
| 151 | `broken_links_count` | Broken links | 🟡 | ❌ | DataForSEO On-Page |
| 152 | `has_schema_markup` | Schema present | 🟢 | ❌ | DataForSEO On-Page |
| 153 | `missing_h1_tag` | Missing H1 | 🟢 | ❌ | DataForSEO On-Page |
| 154 | `missing_meta_description` | Missing meta | 🟢 | ❌ | DataForSEO On-Page |

---

## 8. PAID ADVERTISING METRICS (Google Ads)

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 155 | `ad_spend` / `cost` | Total ad spend | 🔴 | ❌ | Google Ads |
| 156 | `ad_impressions` | Ad impressions | 🟡 | ❌ | Google Ads |
| 157 | `ad_clicks` | Ad clicks | 🟡 | ❌ | Google Ads |
| 158 | `ad_ctr` | Ad CTR | 🟡 | ❌ | Google Ads |
| 159 | `ad_cpc` / `cpc` | Cost per click | 🟡 | ❌ | Google Ads |
| 160 | `ad_cpa` / `cpa` | Cost per acquisition | 🔴 | ❌ | Google Ads |
| 161 | `ad_roas` / `roas` | Return on ad spend | 🔴 | ❌ | Google Ads |

---

## 9. PRODUCT HEALTH & SATISFACTION

| # | Metric | Description | Priority | Status | Source |
|---|--------|-------------|----------|--------|--------|
| 162 | `uptime` | Platform availability | 🔴 | ❌ | Monitoring |
| 163 | `error_rate` / `error_count` | Page errors | 🟡 | ❌ | GA4 Events |
| 164 | `nps_talent` | Talent NPS | 🟡 | ❌ | Survey |
| 165 | `nps_company` | Company NPS | 🟡 | ❌ | Survey |

---

## Summary by Category

| Category | Total | ✅ Available | ⚠️ Partial | ❌ Missing |
|----------|-------|--------------|------------|-----------|
| Revenue | 24 | 17 | 0 | 7 |
| Customer | 28 | 10 | 2 | 16 |
| Marketplace | 27 | 1 | 0 | 26 |
| Website/Engagement | 38 | 22 | 4 | 12 |
| E-commerce Funnel | 7 | 0 | 0 | 7 |
| Email Marketing | 10 | 8 | 0 | 2 |
| SEO | 20 | 9 | 1 | 10 |
| Paid Advertising | 7 | 0 | 0 | 7 |
| Product Health | 4 | 0 | 0 | 4 |
| **TOTAL** | **165** | **67 (41%)** | **7 (4%)** | **91 (55%)** |

---

## Summary by Priority

| Priority | Total | ✅ Available | ❌ Missing |
|----------|-------|--------------|-----------|
| 🔴 Critical | 48 | 23 (48%) | 25 (52%) |
| 🟡 High | 89 | 36 (40%) | 53 (60%) |
| 🟢 Medium | 28 | 8 (29%) | 20 (71%) |

---

## Data Source Coverage

| Source | Status | Metrics Enabled | Gap |
|--------|--------|-----------------|-----|
| **Stripe** | ✅ Connected | 24 revenue/subscription metrics | - |
| **GA4** | ✅ Connected | 30 traffic/engagement metrics | E-commerce, scroll, forms not tracked |
| **ActiveCampaign** | ✅ Connected | 10 email metrics | Device breakdown, conversions |
| **DataForSEO** | ✅ Connected | 10 SEO metrics | On-page audit, CWV not synced |
| **Google Ads** | ❌ Not Connected | 0 | 7 advertising metrics |
| **YTJobs MySQL** | ✅ **ACCESS CONFIRMED** | **26 marketplace metrics** | Needs sync setup |
| **YTJobs BigQuery** | ✅ Connected | Talents, Companies (recruiter app) | Different dataset |
| **Product Analytics** | ❌ Not Connected | 0 | Feature adoption, user journeys |

---

## YTJobs MySQL Database (Live Data)

**Connection:** SSH tunnel via bastion → RDS MySQL read replica  
**Status:** ✅ Successfully connected and verified

### Current Data Volumes

| Table | Records | Description |
|-------|---------|-------------|
| `users` | 498,927 | Talent profiles |
| `companies` | 100,493 | Company accounts |
| `jobs` | 34,893 | Job postings |
| `job_apply` | 1,376,457 | Applications |
| `job_views` | 1,546,803 | Job page views |
| `profile_views` | 7,143,750 | Talent profile views |
| `reviews` | 81,883 | Reviews/ratings |
| `payments` | 21,596 | Payment transactions |
| `subscriptions` | 159 | Active subscriptions |

### Live Marketplace Metrics (Jan 2025 - Feb 2026)

**Revenue Performance:**
| Month | Payments | Revenue |
|-------|----------|---------|
| Jan 2026 | 921 | $141,443 |
| Dec 2025 | 802 | $114,436 |
| Nov 2025 | 786 | $114,937 |
| Oct 2025 | 627 | $100,943 |
| Sep 2025 | 694 | $108,669 |
| Aug 2025 | 675 | $99,629 |

**Daily Metrics (Recent):**
- User signups: ~400-550/day
- Job applications: ~1,100-2,200/day  
- Jobs posted: ~35-60/day
- Payments: ~20-40/day (~$3-5k/day)

**Marketplace Health:**
- Match rate (hires/jobs): **21.1%**
- Avg applications per job: **34.3**
- Monthly hires: **21-100**
- Company signups: **2,700-4,500/month**

**Application Funnel:**
| Status | Count | % |
|--------|-------|---|
| Undecided | 968,274 | 70.4% |
| Low Priority | 320,230 | 23.3% |
| High Priority | 67,888 | 4.9% |
| Accepted | 19,154 | 1.4% |
| Hired | 912 | 0.07% |

**Job Status Distribution:**
| Status | Count |
|--------|-------|
| Draft | 23,945 |
| Expired | 6,951 |
| Deleted | 3,435 |
| Active | 479 |
| Closed | 83 |

---

## Priority Actions

### 🔴 HIGH IMPACT (Enables 20+ Metrics)

**1. ✅ YTJobs MySQL Database - ACCESS CONFIRMED**
- **Status:** SSH tunnel working, data accessible
- **Enables:** 26 marketplace metrics (jobs, applications, hires, talent, companies)
- **Next Step:** Build Cloud Function to sync daily metrics to BigQuery
- **Impact:** Core business metrics now available

**2. Connect Google Ads**
- **Enables:** 7 advertising metrics + CAC calculations
- **Method:** BigQuery Data Transfer Service
- **Impact:** All paid advertising detectors, LTV/CAC ratio

### 🟡 MEDIUM IMPACT (Enables 5-15 Metrics)

**3. Enable GA4 E-commerce Tracking**
- **Enables:** 7 funnel metrics (add_to_cart, checkout, purchase)
- **Method:** Implement GA4 e-commerce events on website

**4. Sync DataForSEO On-Page API**
- **Enables:** 8 technical SEO metrics (CWV, broken links, schema)
- **Method:** Extend dataforseo-bigquery-sync

**5. Enable GA4 Enhanced Measurement**
- **Enables:** 4 scroll/engagement metrics
- **Method:** Enable in GA4 Admin

---

## Benchmark Targets

| Metric | Current | Target | Industry |
|--------|---------|--------|----------|
| MRR | $XXk | $50k | - |
| MRR Growth | X% | >10% MoM | 5-15% |
| Net Revenue Retention | X% | >100% | 90-120% |
| Logo Churn | X% | <5% monthly | 3-8% |
| LTV/CAC Ratio | N/A | >3.0 | 3.0+ |
| DAU/MAU Ratio | X% | >20% | 10-25% |
| Match Rate | N/A | >30% | 15-40% |
| Time to Fill | N/A | <30 days | 30-45 days |
| Apply Rate | N/A | >5% | 3-8% |
| Activation Rate | N/A | >40% | 25-50% |
| NPS | N/A | >50 | 30-70 |

---

*Generated: 2026-02-07*
*Total Unique Metrics: 165*
