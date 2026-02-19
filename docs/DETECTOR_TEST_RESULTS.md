# Detector Test Results - Systematic Testing
**Date:** 2026-01-28  
**Total Detectors:** 117  
**Method:** Live execution logs analysis  
**Organization ID:** SBjucW1ztDyFYWBz7ZLE

---

## Executive Summary

**Out of 117 detectors:**
- ✅ **WORKING: 9** (8%) - Generating 100 opportunities
- ❌ **FAILING: 43** (37%) - SQL errors, missing data
- ⚠️ **PARTIAL: 6** (5%) - Run but find 0 opportunities
- ⏭️ **UNTESTED: 59** (50%) - System/advertising categories not logged

**Latest Run Results:**
- SEO: 20 opportunities (multiple detectors)
- Content: 6 opportunities (multiple detectors)
- All other categories: 0 opportunities

---

## Working Detectors (9 confirmed)

Based on actual opportunities in database:

| Detector | Type | Opportunities | Status |
|----------|------|---------------|--------|
| `detect_seo_striking_distance` | striking_distance | 55 | ✅ WORKING |
| `detect_cost_inefficiency` | negative_roi | 16 | ✅ WORKING |
| `detect_content_decay` | steady_decay | 12 | ✅ WORKING |
| `detect_high_traffic_low_conversion_pages` | high_traffic_low_cvr | 9 | ✅ WORKING |
| `detect_scale_winners` | high_cvr_low_traffic_volatile | 4 | ✅ WORKING |
| `detect_revenue_attribution` | revenue_attribution | 1 | ✅ WORKING |
| `detect_declining_performers` | traffic_decline | 1 | ✅ WORKING |
| `detect_content_to_lead_attribution` | content_to_lead | 1 | ✅ WORKING |
| `detect_fix_losers` | high_conversion_low_traffic | 1 | ✅ WORKING |

**Additional SEO detectors likely working (generating the 20 SEO opportunities):**
- `detect_backlink_quality_decline` (probably)
- `detect_content_freshness_decay` (probably)
- `detect_internal_link_opportunities` (probably)

---

## Failed Detectors (43+ confirmed)

### SQL Error: "Column name is ambiguous" (23 detectors)

These still have entity_map JOIN issues or ambiguous column references:

**Email (13 detectors):**
- ❌ `detect_ab_test_recommendations`
- ❌ `detect_device_client_performance_gap`
- ❌ `detect_email_bounce_rate_spike`
- ❌ `detect_email_click_to_open_rate_decline`
- ❌ `detect_email_engagement_drop`
- ❌ `detect_email_high_opens_low_clicks`
- ❌ `detect_email_list_health_decline`
- ❌ `detect_email_optimal_frequency_deviation`
- ❌ `detect_email_spam_complaint_spike`
- ❌ `detect_email_volume_gap`
- ❌ `detect_list_segmentation_opportunities`
- ❌ `detect_revenue_per_subscriber_decline`
- ❌ `detect_email_trends_multitimeframe` (syntax error)

**Pages (5 detectors):**
- ❌ `detect_page_engagement_decay`
- ❌ `detect_page_error_rate_spike`
- ❌ `detect_scale_winners` (entity_map issue)
- ❌ `detect_fix_losers` (entity_map issue)
- ❌ `detect_scale_winners_multitimeframe`

**Traffic (5 detectors):**
- ❌ `detect_cross_channel_gaps`
- ❌ `detect_traffic_bot_spam_spike`
- ❌ `detect_traffic_spike_quality_check`
- ❌ `detect_traffic_utm_parameter_gaps`
- ❌ `detect_traffic_referral_opportunities`

**Content (2 detectors):**
- ❌ `detect_content_decay` (ambiguous canonical_entity_id)
- ❌ `detect_content_decay_multitimeframe`

**SEO (3 detectors):**
- ❌ `detect_seo_rank_drops`
- ❌ `detect_keyword_cannibalization`
- ❌ `detect_seo_rank_trends_multitimeframe`

**Revenue (2 detectors):**
- ❌ `detect_revenue_anomaly`
- ❌ `detect_metric_anomalies`

---

### SQL Error: "Unrecognized name" - Missing Data Columns (15 detectors)

**Revenue (9 detectors):**
- ❌ `detect_revenue_aov_decline` (average_order_value)
- ❌ `detect_revenue_new_customer_decline` (first_time_customers)
- ❌ `detect_revenue_payment_failure_spike` (payment_failure_rate)
- ❌ `detect_revenue_discount_cannibalization` (refund_rate)
- ❌ `detect_mrr_arr_tracking` (mrr column)
- ❌ `detect_unit_economics_dashboard` (ltv column)
- ❌ `detect_transaction_refund_anomalies` (transactions column)
- ❌ `detect_revenue_seasonality_deviation` (date operator issue)
- ❌ `detect_revenue_trends_multitimeframe` (syntax error)

**Pages (4 detectors):**
- ❌ `detect_page_cart_abandonment_increase` (cart_abandonment_rate)
- ❌ `detect_page_exit_rate_increase` (exit_rate)
- ❌ `detect_page_form_abandonment_spike` (form_starts)
- ❌ `detect_page_micro_conversion_drop` (scroll_depth_avg)

**Traffic (2 detectors):**
- ❌ `detect_declining_performers` (broken alias)
- ❌ `detect_declining_performers_multitimeframe` (syntax error)

---

### SQL Syntax Errors (5 detectors)

- ❌ `detect_paid_campaigns_multitimeframe` (CURRENT keyword)
- ❌ `detect_seo_rank_trends_multitimeframe` (CURRENT keyword)
- ❌ `detect_email_trends_multitimeframe` (CURRENT keyword)
- ❌ `detect_declining_performers_multitimeframe` (CURRENT keyword)
- ❌ `detect_revenue_trends_multitimeframe` (CURRENT keyword)

---

## Partial Success - No Opportunities (6 detectors)

These run without errors but find 0 opportunities (may need more data):

**Advertising:**
- ⚠️ Most advertising detectors (data exists but thresholds not met)

**Content:**
- ⚠️ `detect_dwell_time_decline` (runs but finds nothing)
- ⚠️ `detect_engagement_rate_decline` (runs but finds nothing)
- ⚠️ `detect_content_format_winners` (runs but finds nothing)
- ⚠️ `detect_republishing_opportunities` (runs but finds nothing)
- ⚠️ `detect_publishing_volume_gap` (runs but finds nothing)

---

## Untested (59 detectors)

**System Category (15 detectors) - Not executed:**
- System detectors aren't in the `saas` product config
- Would need to enable and test separately

**Advertising Category (~10 detectors) - Not logged:**
- Many exist but didn't appear in error logs
- Need individual testing

**Pages/Revenue/Traffic - Remaining (~34 detectors):**
- Not mentioned in logs
- Likely have similar SQL issues

---

## Root Causes Analysis

### 1. Entity Map Join Issues (23 detectors)
**Problem:** Queries still reference entity_map with ambiguous columns  
**Fix:** Remove entity_map joins, query daily_entity_metrics directly  
**Effort:** High - 23 files to fix

### 2. Missing Data Columns (15 detectors)
**Problem:** Queries reference columns that don't exist in BigQuery  
**Fix:** Either add columns to schema OR disable detectors  
**Effort:** Medium - Need schema updates

### 3. Multitimeframe SQL Syntax (5 detectors)
**Problem:** Bad SQL using `CURRENT` keyword incorrectly  
**Fix:** Rewrite queries with proper date logic  
**Effort:** Medium - 5 files to fix

### 4. Insufficient Data (6+ detectors)
**Problem:** Detectors run but thresholds not met  
**Fix:** Adjust thresholds OR wait for more data  
**Effort:** Low - Config changes

---

## Recommendations

### Priority 1: Fix SQL Errors (43 detectors)
1. Batch fix all entity_map ambiguous column issues
2. Fix multitimeframe CURRENT keyword syntax
3. Either add missing columns OR disable those detectors

**Impact:** Could unlock 30-40 more working detectors

### Priority 2: Lower Thresholds (6 detectors)
1. Adjust detection thresholds for content detectors
2. Review advertising detector logic

**Impact:** Could find 10-20 more opportunities

### Priority 3: Enable System Detectors (15 detectors)
1. Add 'system' to product configs
2. Test system health detectors

**Impact:** Meta-insights about detector health

---

## Next Steps

**Option A: Quick Fix (2-3 hours)**
- Fix the 23 ambiguous column detectors
- Fix the 5 multitimeframe syntax errors
- Expected result: 25-30 working detectors

**Option B: Complete Fix (1-2 days)**
- Fix all SQL errors
- Add missing columns to schema
- Adjust thresholds
- Expected result: 60-80 working detectors

**Option C: Minimal Effort**
- Accept 9 working detectors
- Focus on making those 9 bulletproof
- Expected result: Stay at 9 detectors, improve quality
