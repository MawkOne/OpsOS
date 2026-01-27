# Detector-to-Metrics Mapping
**Purpose:** Map each detector to the specific metrics it uses  
**Updated:** January 2026

---

## 📊 METRICS CATALOG

### Email Metrics
- `open_rate` - Email open rate (%)
- `click_through_rate` (CTR) - Email click-through rate (%)
- `sends` - Number of emails sent
- `opens` - Number of emails opened
- `clicks` - Number of email clicks
- `bounces` - Hard/soft bounce count
- `spam_complaints` - Spam complaint count
- `unsubscribes` - Unsubscribe count
- `revenue_attributed` - Revenue from email campaigns

### SEO Metrics
- `position` - Average keyword position
- `search_volume` - Keyword search volume
- `impressions` - Search impressions
- `ctr` - Organic click-through rate
- `sessions` - Organic sessions
- `rank_avg` - Average ranking position
- `rank_change` - Position change

### Paid Advertising Metrics
- `cost` - Total ad spend
- `clicks` - Paid clicks
- `impressions` - Ad impressions
- `conversions` - Conversion count
- `revenue` - Revenue from ads
- `cpa` - Cost per acquisition
- `roas` - Return on ad spend
- `cpc` - Cost per click
- `mer` - Marketing efficiency ratio

### Page/Traffic Metrics
- `sessions` - Total sessions
- `users` - Unique users
- `pageviews` - Page views
- `conversion_rate` (CVR) - Conversion rate (%)
- `conversions` - Total conversions
- `bounce_rate` - Bounce rate (%)
- `avg_session_duration` - Average session time
- `engagement_rate` - Engagement rate
- `scroll_depth` - Scroll depth percentage
- `revenue` - Revenue from page/traffic

### Revenue Metrics
- `revenue` - Total revenue
- `transactions` - Transaction count
- `average_order_value` (AOV) - Revenue per transaction
- `refunds` - Refund amount
- `refund_count` - Number of refunds
- `mrr` - Monthly recurring revenue
- `arr` - Annual recurring revenue
- `churn_rate` - Customer churn rate
- `ltv` - Lifetime value

---

## 🔍 DETECTOR METRICS MAPPING

### 📧 EMAIL DETECTORS (email_detectors.py)

#### 1. detect_email_engagement_drop
**Layer:** Trend (weekly)  
**Metrics Used:**
- `open_rate` (AVG over 30d periods)
- `click_through_rate` (AVG over 30d periods)
- `sends` (SUM)

**Calculation:**
```
change = (current_30d_avg - previous_30d_avg) / previous_30d_avg
alert if change < -15% AND sends > 100
```

#### 2. detect_email_high_opens_low_clicks
**Layer:** Fast (daily)  
**Metrics Used:**
- `open_rate` (AVG)
- `click_through_rate` (AVG)
- `sends` (SUM)
- `opens` (SUM)
- `clicks` (SUM)

**Calculation:**
```
alert if open_rate > 20% AND ctr < 2% AND sends > 50
```

#### 3. detect_email_trends_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `open_rate` (monthly aggregates by year_month)
- `click_through_rate` (monthly aggregates)
- `sends` (monthly totals)

**Calculation:**
```
month-over-month trends across 1mo, 3mo, 6mo, 12mo periods
alert on >20% decline vs previous period
```

---

### 🔍 SEO DETECTORS (seo_detectors.py)

#### 4. detect_keyword_cannibalization
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `position` (AVG by keyword-page pair)
- `sessions` (SUM)

**Calculation:**
```
alert if multiple pages target same keyword AND avg_position > 10
```

#### 5. detect_seo_striking_distance
**Layer:** Fast (daily)  
**Metrics Used:**
- `position` (AVG)
- `search_volume` (AVG)
- `impressions` (SUM)
- `ctr` (AVG)

**Calculation:**
```
alert if 4 <= position <= 15 AND search_volume > 100
estimate traffic gain from moving to position 1-3
```

#### 6. detect_seo_rank_drops
**Layer:** Fast (daily)  
**Metrics Used:**
- `position` (AVG over 7d periods)
- `search_volume` (AVG)

**Calculation:**
```
change = recent_7d_position - historical_7d_position
alert if change > 3 (positions worse) AND volume > 100
```

#### 7. detect_seo_rank_trends_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `position` (monthly AVG by year_month)
- `search_volume` (monthly AVG)

**Calculation:**
```
month-over-month position tracking
alert if position worsens >3 spots vs 1/3/6 months ago
```

---

### 💰 ADVERTISING DETECTORS (advertising_detectors.py)

#### 8. detect_cost_inefficiency
**Layer:** Fast (daily)  
**Metrics Used:**
- `cost` (SUM)
- `conversions` (SUM)
- `revenue` (SUM)
- `cpa` (calculated)
- `roas` (calculated)

**Calculation:**
```
cpa = cost / conversions
roas = revenue / cost
alert if cpa > 2x baseline OR roas < 0.5x baseline
```

#### 9. detect_paid_waste
**Layer:** Fast (daily)  
**Metrics Used:**
- `cost` (SUM)
- `clicks` (SUM)
- `conversions` (SUM)

**Calculation:**
```
alert if cost > $50 AND conversions = 0 AND clicks > 20
```

#### 10. detect_paid_campaigns_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `cost` (monthly SUM)
- `revenue` (monthly SUM)
- `conversions` (monthly SUM)
- `roas` (calculated monthly)

**Calculation:**
```
month-over-month ROAS tracking
alert if ROAS declines >20% vs 1/3/6 months ago
```

---

### 📄 PAGES DETECTORS (pages_detectors.py)

#### 11. detect_high_traffic_low_conversion_pages
**Layer:** Fast (daily)  
**Metrics Used:**
- `sessions` (SUM)
- `conversions` (SUM)
- `conversion_rate` (calculated)

**Calculation:**
```
cvr = conversions / sessions
alert if sessions > 500 AND cvr < 2%
```

#### 12. detect_page_engagement_decay
**Layer:** Trend (weekly)  
**Metrics Used:**
- `avg_session_duration` (AVG over 30d periods)
- `bounce_rate` (AVG over 30d periods)
- `sessions` (SUM)

**Calculation:**
```
alert if duration drops >20% OR bounce_rate increases >15%
between current 30d vs previous 30d
```

#### 13. detect_scale_winners
**Layer:** Fast (daily)  
**Metrics Used:**
- `sessions` (SUM over 7d)
- `conversions` (SUM over 7d)
- `conversion_rate` (calculated)

**Calculation:**
```
cvr = conversions / sessions
alert if cvr > 5% AND sessions < 100 (underutilized)
```

#### 14. detect_fix_losers
**Layer:** Fast (daily)  
**Metrics Used:**
- `sessions` (SUM over 7d)
- `conversions` (SUM over 7d)
- `conversion_rate` (calculated)

**Calculation:**
```
cvr = conversions / sessions
alert if sessions > 500 AND cvr < 2% (high traffic, poor conversion)
```

#### 15. detect_scale_winners_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `conversion_rate` (monthly AVG by year_month)
- `sessions` (monthly SUM)

**Calculation:**
```
alert if CVR consistently high (>5%) but sessions < threshold
```

---

### ✍️ CONTENT DETECTORS (content_detectors.py)

#### 16. detect_content_decay
**Layer:** Trend (weekly)  
**Metrics Used:**
- `sessions` (SUM over 30d periods)
- `pageviews` (SUM over 30d periods)

**Calculation:**
```
change = (current_30d - previous_30d) / previous_30d
alert if change < -30% (traffic loss)
```

#### 17. detect_content_decay_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `sessions` (monthly SUM by year_month)
- `pageviews` (monthly SUM)

**Calculation:**
```
month-over-month session tracking
alert if sessions decline >30% vs 1/3/6 months ago
```

---

### 🚦 TRAFFIC DETECTORS (traffic_detectors.py)

#### 18. detect_cross_channel_gaps
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `sessions` (SUM by source/medium)
- `conversions` (SUM by source/medium)
- `channel_count` (COUNT DISTINCT)

**Calculation:**
```
alert if entity only has traffic from 1 channel AND volume > threshold
suggests missing channel diversification
```

#### 19. detect_declining_performers
**Layer:** Fast (daily)  
**Metrics Used:**
- `sessions` (SUM over 7d)
- `conversions` (SUM over 7d)
- `conversion_rate` (calculated)

**Calculation:**
```
alert if recent_7d sessions < 0.7 × baseline_28d sessions
OR recent CVR < 0.7 × baseline CVR
```

#### 20. detect_declining_performers_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `sessions` (monthly SUM by year_month)
- `conversions` (monthly SUM)
- `conversion_rate` (calculated monthly)

**Calculation:**
```
month-over-month tracking
alert if sessions OR CVR declines >30% vs 1/3/6 months ago
```

---

### 💵 REVENUE DETECTORS (revenue_detectors.py)

#### 21. detect_revenue_anomaly
**Layer:** Fast (daily)  
**Metrics Used:**
- `revenue` (SUM over 1d vs 7d baseline)

**Calculation:**
```
alert if yesterday_revenue differs >20% from 7d_avg_revenue
```

#### 22. detect_metric_anomalies
**Layer:** Fast (daily)  
**Metrics Used:**
- `revenue` (SUM)
- `sessions` (SUM)
- `conversions` (SUM)
- `conversion_rate` (calculated)

**Calculation:**
```
alert if any key metric (revenue, sessions, CVR) 
differs >20% from 7d baseline
```

#### 23. detect_revenue_trends_multitimeframe
**Layer:** Strategic (monthly)  
**Metrics Used:**
- `revenue` (monthly SUM by year_month)
- `transactions` (monthly SUM)
- `average_order_value` (calculated)

**Calculation:**
```
month-over-month revenue tracking
alert if revenue declines >20% vs 1/3/6 months ago
```

---

## 📊 METRICS FREQUENCY BY DETECTOR LAYER

### Fast Layer (Daily)
Most commonly used metrics:
1. `sessions` (10 detectors)
2. `conversions` (10 detectors)
3. `conversion_rate` (8 detectors)
4. `cost` (4 detectors)
5. `position` (2 detectors)

### Trend Layer (Weekly)
Most commonly used metrics:
1. `sessions` (5 detectors)
2. `open_rate` (2 detectors)
3. `click_through_rate` (2 detectors)
4. `bounce_rate` (1 detector)

### Strategic Layer (Monthly)
Most commonly used metrics:
1. `sessions` (7 detectors)
2. `position` (2 detectors)
3. `revenue` (3 detectors)
4. `conversion_rate` (3 detectors)

---

## 🎯 METRIC DEPENDENCIES

### Core Metrics Required by Multiple Detectors
These metrics are used across 5+ detectors:

1. **sessions** - Used by 22 detectors
2. **conversions** - Used by 20 detectors
3. **conversion_rate** - Used by 14 detectors (derived)
4. **revenue** - Used by 8 detectors
5. **cost** - Used by 6 detectors
6. **position** - Used by 4 detectors
7. **open_rate** - Used by 3 detectors
8. **click_through_rate** - Used by 3 detectors

### Derived Metrics (Calculated, Not Stored)
These are calculated on-the-fly in detector queries:

- `conversion_rate` = conversions / sessions
- `cpa` = cost / conversions
- `roas` = revenue / cost
- `average_order_value` = revenue / transactions
- `percent_change` = (current - previous) / previous

---

## 🔧 METRICS FOR NEW DETECTORS (From DETECTORS_TO_BUILD.md)

### Email (7 new detectors need):
- `bounce_rate` (hard/soft bounces) - **NEW METRIC NEEDED**
- `spam_complaint_rate` - **NEW METRIC NEEDED**
- `list_growth_rate` - **NEW METRIC NEEDED**
- `unsubscribe_rate` - **NEW METRIC NEEDED**
- `revenue_per_subscriber` - **NEW CALCULATION NEEDED**
- `click_to_open_rate` (clicks/opens) - **NEW CALCULATION NEEDED**
- `send_frequency` (sends per subscriber per week) - **NEW CALCULATION NEEDED**

### SEO (8 new detectors need):
- `indexing_status` (indexed/not indexed) - **NEW METRIC NEEDED**
- `crawl_errors` - **NEW METRIC NEEDED**
- `core_web_vitals` (LCP, FID, CLS) - **NEW METRIC NEEDED**
- `backlink_count` - **NEW METRIC NEEDED**
- `backlink_quality` (DR, authority) - **NEW METRIC NEEDED**
- `serp_features` (snippets, AI overviews) - **NEW METRIC NEEDED**
- `mobile_position` vs `desktop_position` - **NEW METRIC NEEDED**
- `geographic_position` by location - **NEW METRIC NEEDED**

### Advertising (10 new detectors need):
- `hourly_spend` (real-time) - **NEW GRANULARITY NEEDED**
- `quality_score` - **NEW METRIC NEEDED**
- `approval_status` - **NEW METRIC NEEDED**
- `impression_share` - **NEW METRIC NEEDED**
- `impression_share_lost_budget` - **NEW METRIC NEEDED**
- `impression_share_lost_rank` - **NEW METRIC NEEDED**
- `search_terms` (query-level data) - **NEW GRAIN NEEDED**
- `bid_strategy` - **NEW DIMENSION NEEDED**
- `landing_page_experience` - **NEW METRIC NEEDED**
- `hour_of_day` / `day_of_week` performance - **NEW GRAIN NEEDED**

### Pages (8 new detectors need):
- `form_starts` - **NEW METRIC NEEDED**
- `form_submits` - **NEW METRIC NEEDED**
- `form_abandonment_rate` - **NEW CALCULATION NEEDED**
- `add_to_cart` events - **NEW METRIC NEEDED**
- `checkout_started` events - **NEW METRIC NEEDED**
- `cart_abandonment_rate` - **NEW CALCULATION NEEDED**
- `error_count` (404s, 500s, JS errors) - **NEW METRIC NEEDED**
- `page_load_time` by page - **NEW METRIC NEEDED**
- `exit_rate` - **NEW METRIC NEEDED**
- `browser` / `device` dimensions - **NEW GRAIN NEEDED**

### Content (9 new detectors need):
- `publish_date` - **NEW DIMENSION NEEDED**
- `content_type` (blog, guide, video) - **NEW DIMENSION NEEDED**
- `topic_cluster` - **NEW DIMENSION NEEDED**
- `internal_links_count` - **NEW METRIC NEEDED**
- `scroll_depth` percentiles - **NEW GRANULARITY NEEDED**
- `content_production_cost` - **NEW METRIC NEEDED** (external)
- `social_shares` - **NEW METRIC NEEDED**

### Traffic (9 new detectors need):
- `ltv` (lifetime value) - **NEW METRIC NEEDED**
- `cac_by_channel` - **NEW CALCULATION NEEDED**
- `utm_parameters` (campaign, source, medium, term, content) - **NEW DIMENSIONS NEEDED**
- `bot_indicators` (bounce >80%, duration <10s) - **NEW LOGIC NEEDED**
- `referral_source` granularity - **NEW DIMENSION NEEDED**
- `conversion_path` (multi-touch) - **NEW TABLE/LOGIC NEEDED**
- `channel_assists` - **NEW CALCULATION NEEDED**

### Revenue (11 new detectors need):
- `mrr` - **NEW METRIC NEEDED**
- `arr` - **NEW METRIC NEEDED**
- `churn_rate` - **NEW METRIC NEEDED**
- `payment_failure_rate` - **NEW METRIC NEEDED**
- `new_customer_revenue` vs `expansion_revenue` - **NEW SEGMENTATION NEEDED**
- `upgrade_rate` - **NEW METRIC NEEDED**
- `customer_count_by_segment` - **NEW DIMENSION NEEDED**
- `discount_usage_rate` - **NEW METRIC NEEDED**
- `payment_method` dimension - **NEW DIMENSION NEEDED**
- `cohort_id` (signup month) - **NEW DIMENSION NEEDED**

### Cross-Cutting (15 new detectors need):
- `data_freshness` (table timestamps) - **NEW METRIC NEEDED**
- `null_rate` by field - **NEW METRIC NEEDED**
- `mapping_success_rate` - **NEW METRIC NEEDED**
- `sync_status` by source - **NEW METRIC NEEDED**
- `opportunity_age` - **NEW METRIC NEEDED**
- `opportunity_status` - **NEW DIMENSION NEEDED**
- `dismissal_rate` by detector - **NEW METRIC NEEDED**
- `prediction_accuracy` - **NEW METRIC NEEDED**

---

## 📋 SUMMARY

### Current State (55 detectors built):
- **Metrics in use:** ~25 distinct metrics
- **Most used:** sessions, conversions, conversion_rate, revenue, cost
- **Data sources:** GA4, Google Ads, DataForSEO, Stripe, ActiveCampaign

### To Build (77 new detectors):
- **New metrics needed:** ~60 additional metrics
- **New dimensions needed:** ~15 (UTM params, content_type, browser, etc.)
- **New calculations needed:** ~20 (LTV:CAC, bounce_rate, etc.)
- **New data granularity:** Hourly, real-time, multi-touch paths

---

**Next Steps:**
1. Add missing metrics to `daily_entity_metrics` table
2. Create new dimension tables (utm_parameters, content_metadata, etc.)
3. Implement real-time data pipelines for Fast layer detectors
4. Build metric calculation layer for derived metrics
