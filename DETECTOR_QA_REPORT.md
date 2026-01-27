# Detector QA Report - Active vs Actually Working

**Generated:** January 27, 2026  
**Organization:** SBjucW1ztDyFYWBz7ZLE  
**Test Date Range:** Last 30 days

---

## 📊 Summary

| Status | Count | Notes |
|--------|-------|-------|
| **Marked "Active" in UI** | 58 detectors | What we claim works |
| **Actually Producing Opportunities** | 18 detectors | What actually works |
| **False Positives** | 40 detectors | Marked active but produce 0 opportunities |

**Accuracy Rate: 31% (18/58)**

---

## ✅ ACTUALLY WORKING (18 detectors)

### SEO (11 detectors - 20 opportunities)
- ✅ Keyword Cannibalization
- ✅ Striking Distance Keywords
- ✅ Rank Drops
- ✅ Rank Trends Multi-Timeframe
- ✅ Backlink Quality Decline
- ✅ Core Web Vitals Failing
- ✅ Internal Link Opportunities
- ✅ Rank Volatility Daily
- ✅ Schema Markup Gaps
- ✅ Technical SEO Health Score
- ✅ Content Freshness Decay

**Data Source:** 117,740 keyword rows in BigQuery ✅

### Content (7 detectors - 6 opportunities)
- ✅ Content Decay
- ✅ Content Decay Multi-Timeframe
- ✅ Dwell Time Decline
- ✅ Engagement Rate Decline
- ✅ Content Format Winners
- ✅ Republishing Opportunities
- ✅ Publishing Volume Gap

**Data Source:** 45,793 page rows with engagement_rate ✅

---

## ❌ FALSE POSITIVES - Marked Active But 0 Opportunities

### Email (13 marked active, 0 working)

**Problem:** Only **2 rows** of email data in BigQuery (1 entity, 1 date)

Detectors returning 0 opportunities:
- ❌ detect_email_engagement_drop
- ❌ detect_email_bounce_rate_spike
- ❌ detect_email_click_to_open_rate_decline
- ❌ detect_email_high_opens_low_clicks
- ❌ detect_email_list_health_decline
- ❌ detect_email_optimal_frequency_deviation
- ❌ detect_email_spam_complaint_spike
- ❌ detect_email_trends_multitimeframe
- ❌ detect_email_volume_gap
- ❌ detect_revenue_per_subscriber_decline
- ❌ detect_device_client_performance_gap
- ❌ detect_ab_test_recommendations
- ❌ detect_list_segmentation_opportunities

**Root Cause:** ActiveCampaign sync not populating daily_entity_metrics properly

### Pages (10 marked active, 0 working)

**Problem:** 45,793 page rows exist but detectors find nothing

Detectors returning 0 opportunities:
- ❌ detect_high_traffic_low_conversion_pages
- ❌ detect_page_engagement_decay
- ❌ detect_scale_winners
- ❌ detect_fix_losers
- ❌ detect_scale_winners_multitimeframe
- ❌ detect_page_form_abandonment_spike
- ❌ detect_page_cart_abandonment_increase
- ❌ detect_page_error_rate_spike
- ❌ detect_page_micro_conversion_drop
- ❌ detect_page_exit_rate_increase

**Root Cause:** Likely missing key columns (conversions, bounce_rate, form_submissions, etc.) or thresholds too high

### Revenue (8 marked active, 0 working)

**Problem:** Only 1,550 rows with revenue > 0

Detectors returning 0 opportunities:
- ❌ detect_revenue_anomaly
- ❌ detect_metric_anomalies
- ❌ detect_revenue_trends_multitimeframe
- ❌ detect_revenue_aov_decline
- ❌ detect_revenue_new_customer_decline
- ❌ detect_revenue_discount_cannibalization
- ❌ detect_revenue_seasonality_deviation
- ❌ detect_revenue_payment_failure_spike

**Root Cause:** Minimal revenue data; Stripe sync may not be populating properly

### Traffic (7 marked active, 0 working)

**Problem:** Traffic source data exists but detectors find nothing

Detectors returning 0 opportunities:
- ❌ detect_cross_channel_gaps
- ❌ detect_declining_performers
- ❌ detect_declining_performers_multitimeframe
- ❌ detect_traffic_bot_spam_spike
- ❌ detect_traffic_spike_quality_check
- ❌ detect_traffic_utm_parameter_gaps
- ❌ detect_traffic_referral_opportunities

**Root Cause:** Likely entity_type='traffic_source' missing or thresholds too high

### Advertising (3 marked active, 0 working)

**Problem:** 12,990 campaign rows exist with some revenue

Detectors returning 0 opportunities:
- ❌ detect_cost_inefficiency
- ❌ detect_paid_waste
- ❌ detect_paid_campaigns_multitimeframe

**Root Cause:** Thresholds may be too high or missing ad_spend column

---

## 🔍 Data Availability by Entity Type

| Entity Type | Rows | Entities | Has Sessions | Has Revenue | Has Sends |
|-------------|------|----------|--------------|-------------|-----------|
| keyword | 117,740 | 1,015 | 0 | 0 | 0 |
| page | 45,793 | 1,246 | 45,420 | 0 | 0 |
| campaign | 12,990 | 188 | 4,374 | 1,518 | 0 |
| email | 2 | 1 | 2 | 0 | 2 |
| product | 32 | 3 | 0 | 32 | 0 |

---

## 🚨 Critical Issues

### 1. Email Data Pipeline Broken
- **Symptom:** Only 2 rows of email data
- **Expected:** Hundreds/thousands of email campaign rows
- **Impact:** 13 email detectors useless
- **Fix Needed:** Debug ActiveCampaign → BigQuery sync

### 2. Pages Detectors Silent Failures
- **Symptom:** Tons of page data but 0 opportunities
- **Likely Cause:** Missing columns (conversions, forms, errors) or SQL errors
- **Impact:** 10 page detectors appear broken
- **Fix Needed:** Check SQL queries and required columns

### 3. Traffic Source Entity Missing
- **Symptom:** 7 traffic detectors find nothing
- **Likely Cause:** No entity_type='traffic_source' in data
- **Impact:** 7 traffic detectors useless
- **Fix Needed:** Create traffic_source entities from GA4 data

### 4. Revenue Data Minimal
- **Symptom:** Only 1,550 rows with revenue
- **Likely Cause:** Stripe sync not comprehensive
- **Impact:** 8 revenue detectors struggling
- **Fix Needed:** Enhance Stripe → BigQuery sync

---

## ✅ Recommended Actions

### Immediate (Fix False Positives)

1. **Update UI to mark only 18 detectors as "active"**
   - SEO: 11 active
   - Content: 7 active
   - Everything else: "planned" or "needs_data"

2. **Fix email data sync**
   - Debug ActiveCampaign API sync
   - Verify daily_entity_metrics population
   - Target: Get 100+ email rows

3. **Investigate pages detectors**
   - Run each detector manually with logging
   - Check SQL queries for errors
   - Verify required columns exist

### Short Term (Unlock More Detectors)

4. **Create traffic_source entities**
   - Aggregate GA4 traffic sources
   - Populate entity_type='traffic_source' in BigQuery
   - Target: Unlock 7 traffic detectors

5. **Enhance Stripe sync**
   - Capture more transaction/subscription data
   - Populate revenue columns properly
   - Target: Unlock 8 revenue detectors

6. **Debug advertising detectors**
   - Check campaign data structure
   - Verify ad_spend column exists
   - Target: Unlock 3 ad detectors

### Long Term (Full Coverage)

7. **Build comprehensive ETL**
   - Ensure all data sources flow to BigQuery properly
   - Add missing columns (device_type, funnel events, etc.)
   - Target: Unlock remaining 39 detectors

---

## 📈 Progress Tracking

**Current Reality:**
- Claimed: 59/117 operational (50%)
- Actual: 18/117 operational (15%)
- **Honest Status: 15% working**

**With Immediate Fixes:**
- Fix email sync → +13 detectors (26%)
- Fix pages detectors → +10 detectors (35%)
- Fix traffic detectors → +7 detectors (41%)
- **Target: 48/117 operational (41%)**

**With All Fixes:**
- Add revenue data → +8 detectors (48%)
- Add advertising fixes → +3 detectors (50%)
- Build ETL for device/funnel → +10 detectors (59%)
- **Target: 69/117 operational (59%)**

---

## 🎯 Honesty Standard

**New Definition of "Active":**
1. ✅ Data exists in BigQuery where detector queries
2. ✅ Detector runs without SQL errors
3. ✅ Detector produces at least 1 opportunity in test run
4. ✅ Opportunities make business sense (not false positives)

**Only mark detectors "active" after confirming all 4 criteria.**

---

## 📝 Test Methodology

1. Called `/api/detectors/list` to get "active" count: 58 detectors
2. Ran `scout-ai-engine` with test org
3. Counted actual opportunities by category
4. Queried BigQuery for data availability by entity_type
5. Cross-referenced opportunities vs claimed active status
6. Identified 40 false positives (marked active but produce nothing)

**Conclusion:** Need to be brutally honest about what works vs what's just code.
