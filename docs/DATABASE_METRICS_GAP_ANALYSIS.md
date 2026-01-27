# Database Metrics Gap Analysis
**Purpose:** Compare existing BigQuery schema vs. metrics needed for all detectors  
**Database:** `opsos-864a1.marketing_ai.daily_entity_metrics`  
**Updated:** January 2026

---

## ✅ METRICS THAT EXIST (25 metrics in database)

### Traffic Metrics ✓
- `impressions` ✓
- `clicks` ✓
- `sessions` ✓
- `users` ✓
- `pageviews` ✓

### Engagement Metrics ✓
- `avg_session_duration` ✓
- `bounce_rate` ✓
- `engagement_rate` ✓
- `conversions` ✓
- `conversion_rate` ✓

### Revenue Metrics ✓
- `revenue` ✓
- `cost` ✓
- `profit` ✓

### Calculated Performance Metrics ✓
- `ctr` ✓ (clicks / impressions)
- `cpc` ✓ (cost / clicks)
- `cpa` ✓ (cost / conversions)
- `roas` ✓ (revenue / cost)
- `roi` ✓ ((revenue - cost) / cost)

### SEO Metrics ✓
- `position` ✓
- `search_volume` ✓

### Email Metrics ✓
- `sends` ✓
- `opens` ✓
- `open_rate` ✓
- `click_through_rate` ✓

### Metadata ✓
- `organization_id` ✓
- `date` ✓
- `canonical_entity_id` ✓
- `entity_type` ✓
- `source_breakdown` ✓ (JSON)

---

## ❌ METRICS THAT DON'T EXIST (60+ missing for full coverage)

### Email Metrics Missing (7):
- ❌ `bounces` (hard bounces)
- ❌ `soft_bounces` 
- ❌ `spam_complaints`
- ❌ `unsubscribes`
- ❌ `forwards` / `shares`
- ❌ `list_size` (total subscribers)
- ❌ `unique_clicks` (vs total clicks)

**Impact:** Cannot build:
- `detect_email_bounce_rate_spike`
- `detect_email_spam_complaint_spike`
- `detect_email_list_health_decline`
- `detect_email_deliverability_crash`

---

### SEO Metrics Missing (8):
- ❌ `indexed_pages` (indexing status)
- ❌ `crawl_errors`
- ❌ `core_web_vitals_lcp` (Largest Contentful Paint)
- ❌ `core_web_vitals_fid` (First Input Delay)
- ❌ `core_web_vitals_cls` (Cumulative Layout Shift)
- ❌ `backlink_count`
- ❌ `backlink_domain_rating`
- ❌ `serp_features` (featured snippets, AI overviews, etc.)

**Impact:** Cannot build:
- `detect_seo_indexing_issues`
- `detect_seo_page_speed_conversion_impact`
- `detect_seo_backlink_loss_spike`
- `detect_seo_serp_feature_opportunity`
- `detect_seo_ai_overview_displacement`

---

### Paid Advertising Metrics Missing (10):
- ❌ `quality_score`
- ❌ `ad_approval_status`
- ❌ `impression_share`
- ❌ `impression_share_lost_budget`
- ❌ `impression_share_lost_rank`
- ❌ `search_impression_share`
- ❌ `landing_page_experience_score`
- ❌ `expected_ctr`
- ❌ `ad_relevance`
- ❌ `bid_strategy_type`

**Impact:** Cannot build:
- `detect_ad_quality_score_decline`
- `detect_ad_policy_disapprovals`
- `detect_ad_impression_share_loss`
- `detect_ad_landing_page_experience_score`
- `detect_ad_bid_strategy_underperformance`

---

### Page/Conversion Metrics Missing (12):
- ❌ `form_starts`
- ❌ `form_submits`
- ❌ `add_to_cart`
- ❌ `begin_checkout`
- ❌ `purchase_count` (vs just revenue)
- ❌ `exit_rate`
- ❌ `scroll_depth_50`
- ❌ `scroll_depth_75`
- ❌ `scroll_depth_100`
- ❌ `error_count` (JS errors, 404s, 500s)
- ❌ `page_load_time`
- ❌ `time_to_interactive`

**Impact:** Cannot build:
- `detect_form_abandonment_spike`
- `detect_cart_abandonment_increase`
- `detect_page_error_rate_spike`
- `detect_page_load_speed_conversion_impact`
- `detect_micro_conversion_drop`
- `detect_exit_rate_increase_high_value_pages`

---

### Content Metrics Missing (6):
- ❌ `publish_date`
- ❌ `last_updated_date`
- ❌ `internal_links_in`
- ❌ `internal_links_out`
- ❌ `social_shares`
- ❌ `comments_count`

**Impact:** Cannot build:
- `detect_content_freshness_decay`
- `detect_content_internal_link_weakness`
- `detect_content_update_opportunity`
- `detect_content_social_share_potential`

---

### Revenue Metrics Missing (11):
- ❌ `mrr` (Monthly Recurring Revenue)
- ❌ `arr` (Annual Recurring Revenue)
- ❌ `churn_count`
- ❌ `churn_rate`
- ❌ `new_mrr` (from new customers)
- ❌ `expansion_mrr` (from upgrades)
- ❌ `contraction_mrr` (from downgrades)
- ❌ `reactivation_mrr`
- ❌ `refunds`
- ❌ `refund_count`
- ❌ `payment_failures`
- ❌ `average_order_value` (stored, not just calculated)
- ❌ `transactions`
- ❌ `first_time_customers`
- ❌ `returning_customers`

**Impact:** Cannot build:
- `detect_mrr_churn_spike`
- `detect_payment_failure_rate_increase`
- `detect_average_order_value_decline`
- `detect_new_customer_revenue_decline`
- `detect_expansion_revenue_opportunity`
- `detect_transaction_refund_anomalies`

---

### Cross-Cutting/System Metrics Missing (8):
- ❌ `data_freshness_timestamp` (when data was last updated)
- ❌ `data_completeness_score` (% of expected records)
- ❌ `null_rate` (% of null values in critical fields)
- ❌ `mapping_success_rate` (% successfully mapped to canonical_entity_id)
- ❌ `sync_status` (success/failure by source)
- ❌ `record_count` (for anomaly detection)
- ❌ `expected_record_count` (baseline for validation)
- ❌ `data_quality_score`

**Impact:** Cannot build:
- `detect_data_freshness_issues`
- `detect_entity_mapping_quality_decline`
- `detect_metric_calculation_errors`
- `detect_data_source_disconnection`

---

## 🆕 DIMENSIONS MISSING (not in daily_entity_metrics)

### Granularity Needed:
- ❌ **Hour of day** (for real-time budget burn detection)
- ❌ **Device type** (mobile vs desktop vs tablet)
- ❌ **Browser** (Chrome, Safari, Firefox, etc.)
- ❌ **Geographic location** (country, region, city)
- ❌ **Campaign subtype** (brand, non-brand, retargeting, prospecting)
- ❌ **Landing page** (which page did traffic land on)
- ❌ **Traffic source** (organic, paid, email, referral, direct)
- ❌ **UTM parameters** (campaign, source, medium, term, content)
- ❌ **Content type** (blog, guide, video, product page)
- ❌ **Customer segment** (new, returning, VIP, etc.)
- ❌ **Cohort** (signup month/quarter)

**Current state:** Only aggregates by `date` + `canonical_entity_id`  
**Problem:** Can't detect device-specific, geographic, or hourly issues

---

## 📊 GRANULARITY ISSUES

### Current Table Structure:
```sql
daily_entity_metrics (
  date,                -- Daily only (no hourly)
  canonical_entity_id, -- Single entity
  entity_type,         -- page/campaign/keyword/email/product
  [metrics...]
)
```

### Missing Granularities:

#### 1. Hourly Metrics (for real-time detection)
**Need:** `hourly_entity_metrics` table
**For detectors:**
- `detect_ad_budget_burn_realtime` (needs hourly spend)
- `detect_conversion_crash_realtime` (needs hourly CVR)
- `detect_traffic_spike_quality_check` (needs hourly sessions)

#### 2. Device/Browser Breakdown
**Need:** `device` dimension in metrics table
**For detectors:**
- `detect_mobile_desktop_cvr_gap`
- `detect_browser_device_compatibility_issues`
- `detect_seo_mobile_desktop_rank_divergence`

#### 3. Geographic Breakdown
**Need:** `location` dimension in metrics table
**For detectors:**
- `detect_seo_geographic_rank_variance`
- `detect_ad_device_geo_optimization_gaps`

#### 4. Multi-Touch Attribution
**Need:** NEW TABLE `conversion_paths`
**For detectors:**
- `detect_multitouch_conversion_path_issues`
- `detect_channel_assist_value`
- `detect_utm_parameter_tracking_gaps`

#### 5. Search Terms (Query-Level)
**Need:** NEW TABLE `search_terms_metrics` (separate from campaign)
**For detectors:**
- `detect_ad_search_term_waste`

#### 6. Customer-Level Metrics
**Need:** NEW TABLE `customer_metrics` (not entity_metrics)
**For detectors:**
- `detect_cohort_performance_divergence`
- `detect_ltv_cac_ratio_decline`
- `detect_revenue_concentration_risk`

---

## 🔧 MISSING TABLES (entirely new tables needed)

### 1. `hourly_entity_metrics`
**Purpose:** Real-time Fast layer detection  
**Partitioning:** PARTITION BY TIMESTAMP_TRUNC(timestamp, HOUR)  
**Needed for:** 15+ real-time detectors

### 2. `device_entity_metrics`
**Purpose:** Device/browser/geo-specific performance  
**Dimensions:** device_type, browser, country, region  
**Needed for:** 8+ cross-device detectors

### 3. `conversion_paths`
**Purpose:** Multi-touch attribution  
**Fields:** user_id, conversion_id, touchpoint_sequence, timestamps  
**Needed for:** 5+ attribution detectors

### 4. `search_terms_daily`
**Purpose:** Query-level paid search analysis  
**Fields:** search_term, campaign_id, match_type, cost, conversions  
**Needed for:** 3+ search term detectors

### 5. `customer_cohorts`
**Purpose:** Customer-level revenue analysis  
**Fields:** customer_id, cohort_month, mrr, ltv, status  
**Needed for:** 10+ revenue detectors

### 6. `data_quality_logs`
**Purpose:** System health monitoring  
**Fields:** table_name, sync_timestamp, record_count, null_rates  
**Needed for:** 8+ cross-cutting detectors

### 7. `serp_features`
**Purpose:** SERP feature tracking  
**Fields:** keyword_id, feature_type (snippet, AI_overview), owned_by_us  
**Needed for:** 2+ SEO detectors

### 8. `backlinks_daily`
**Purpose:** Backlink monitoring  
**Fields:** target_url, referring_domain, domain_rating, status  
**Needed for:** 1 SEO detector

---

## 📋 SUMMARY

### Current State:
- **Tables:** 1 main metrics table (`daily_entity_metrics`)
- **Metrics in table:** 25 metrics
- **Granularity:** Daily only
- **Dimensions:** Entity ID, Type, Date
- **Covers:** 55 current detectors ✅

### To Build 77 New Detectors:
- **New metrics needed:** ~60 (in existing table)
- **New tables needed:** 8 entirely new tables
- **New dimensions needed:** ~15 (device, geo, UTM, etc.)
- **New granularity:** Hourly metrics for real-time detection

---

## 🎯 PRIORITY: WHAT TO ADD FIRST

### Phase 1: Quick Wins (Add to daily_entity_metrics)
**Effort:** Low (just add columns)  
**Add these 15 metrics:**
1. `bounces` (email)
2. `unsubscribes` (email)
3. `spam_complaints` (email)
4. `refunds` (revenue)
5. `refund_count` (revenue)
6. `transactions` (revenue)
7. `quality_score` (ads)
8. `impression_share` (ads)
9. `form_starts` (pages)
10. `form_submits` (pages)
11. `exit_rate` (pages)
12. `page_load_time` (pages)
13. `scroll_depth_avg` (pages)
14. `error_count` (pages)
15. `internal_links_count` (content)

**Unlocks:** 20+ new detectors immediately

---

### Phase 2: New Tables (Medium effort)
**Effort:** Medium (create new tables, update ETL)  
**Build these 3 tables:**
1. `hourly_entity_metrics` (for real-time detection)
2. `customer_cohorts` (for revenue/churn detectors)
3. `data_quality_logs` (for system health)

**Unlocks:** 30+ new detectors

---

### Phase 3: Advanced Dimensions (Higher effort)
**Effort:** High (reshape data model, complex ETL)  
**Build these 5 tables:**
1. `device_entity_metrics` (device/browser/geo breakdown)
2. `conversion_paths` (multi-touch attribution)
3. `search_terms_daily` (query-level ad data)
4. `serp_features` (SERP feature tracking)
5. `backlinks_daily` (backlink monitoring)

**Unlocks:** Final 27 detectors

---

## 💡 DATA SOURCE GAPS

### Metrics We Can Get (from existing integrations):
✅ **ActiveCampaign:** bounces, unsubscribes, spam_complaints  
✅ **Google Ads:** quality_score, impression_share, search_terms  
✅ **Stripe:** refunds, transactions, MRR, churn  
✅ **GA4:** form events, scroll depth, errors, device/browser  
✅ **DataForSEO:** SERP features, backlinks

### Metrics We CAN'T Get Yet:
❌ **Core Web Vitals:** Need PageSpeed Insights API integration  
❌ **Indexing Status:** Need Google Search Console API  
❌ **Social Shares:** Need social API integrations (Twitter, LinkedIn, etc.)  
❌ **Content Metadata:** Need manual tagging or CMS integration

---

## ⚡ RECOMMENDED NEXT STEPS

1. **Add 15 quick-win metrics** to `daily_entity_metrics` schema
2. **Update ETL pipelines** to populate new metrics from existing sources
3. **Create `hourly_entity_metrics`** table for real-time detection
4. **Create `customer_cohorts`** table for revenue detectors
5. **Add PageSpeed Insights API** integration for Core Web Vitals
6. **Add Google Search Console API** for indexing status
7. **Build device dimension** into metrics tables
8. **Create multi-touch attribution** pipeline

This will unlock **50+ new detectors** and bring coverage from 27% → 70%+ ✅
