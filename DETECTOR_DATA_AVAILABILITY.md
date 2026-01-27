# Scout AI Detector Data Availability Analysis

**Goal:** Determine which of the 37 new detectors we can build NOW vs. which need new data sources

---

## 📊 CURRENT DATA INFRASTRUCTURE

### ✅ Data Sources We Have

1. **Google Analytics 4** (via OAuth)
   - Page metrics: sessions, users, pageviews, bounce_rate, engagement_rate, avg_session_duration
   - Traffic sources and channels
   - Conversions and revenue
   - Device/platform breakdown
   - **Search Console integration** (organic keywords, impressions, clicks, position)

2. **Stripe** (via OAuth)
   - Payments and revenue
   - Subscriptions (MRR tracking)
   - Customers
   - Refunds (via Stripe data)

3. **ActiveCampaign** (via API)
   - Email campaigns
   - Sends, opens, clicks
   - Open rates, CTR

4. **DataForSEO** (via API)
   - Keyword rankings
   - Search volume
   - SERP data

5. **QuickBooks** (via OAuth)
   - Expenses
   - Invoices

### ✅ BigQuery Tables We Have

```
- daily_entity_metrics       (page, keyword, campaign, email, product data)
- monthly_entity_metrics      (monthly aggregates with trends)
- monthly_campaign_metrics    (campaign performance over time)
- monthly_revenue_metrics     (revenue trends)
- monthly_funnel_metrics      (conversion funnel data)
- entity_map                  (canonical entity IDs with is_active filter)
- entity_filter_rules         (filtering rules)
- opportunities               (detected opportunities storage)
- metric_registry             (metric definitions)
```

### ✅ Data Fields Available

From `daily_entity_metrics`:
- impressions, clicks, sessions, users, pageviews
- avg_session_duration, bounce_rate, engagement_rate
- conversions, conversion_rate
- revenue, cost, profit
- ctr, cpc, cpa, roas, roi
- position (SEO ranking), search_volume
- sends, opens, open_rate, click_through_rate (email)
- source_breakdown (JSON)

### ❌ Data Sources We DON'T Have

1. **Real-time ad spend** - No hourly/real-time data from Google Ads
2. **Google Ads detailed metrics** - Quality Score, impression share, auction insights
3. **Form analytics** - Form field tracking, abandonment points
4. **Cart abandonment** - No e-commerce event tracking set up
5. **Error monitoring** - No JavaScript error tracking
6. **Page speed metrics** - No PageSpeed Insights API integration
7. **Competitor data** - No competitive intelligence tools
8. **Email deliverability** - No bounce rate, spam complaints from ActiveCampaign
9. **Social media** - No social platform integrations
10. **Backlinks** - No backlink monitoring tools

---

## 🚀 PHASE 1: FAST DETECTION (14 Detectors)

### ✅ CAN BUILD NOW (9 detectors)

#### 24. detect_email_deliverability_crash
**Status:** ⚠️ **PARTIAL** - Have open_rate decline, but missing:
- ❌ Hard/soft bounce rates (not in ActiveCampaign data)
- ❌ Spam complaint rates (not in ActiveCampaign data)
- ✅ Can detect deliverability via open rate crashes as proxy
**Recommendation:** Build with open_rate proxy NOW, enhance later with email platform webhooks

#### 25. detect_email_volume_gap
**Status:** ✅ **YES** - Have all data:
- ✅ Monthly send volume from `monthly_entity_metrics`
- ✅ Can calculate sends per subscriber
- ✅ Can detect zero sends in 30+ days
**Build:** NOW

#### 26. detect_seo_rank_volatility_daily
**Status:** ✅ **YES** - Have all data:
- ✅ Daily rankings from DataForSEO in `daily_entity_metrics`
- ✅ Position field tracks daily changes
- ✅ Can detect >3 position drops in 24 hours
**Build:** NOW

#### 27. detect_seo_indexing_issues
**Status:** ⚠️ **PARTIAL** - Have some data:
- ✅ Search Console API available (route exists)
- ❌ Not currently storing indexed page counts in BigQuery
- ❌ Not tracking crawl errors
**Recommendation:** Add Search Console sync to ETL, THEN build detector

#### 28. detect_seo_serp_feature_loss
**Status:** ❌ **NO** - Missing data:
- ❌ Not tracking SERP features (featured snippets, AI overviews, etc.)
- ❌ Would need SERP tracking tool (SEMrush, Ahrefs, or DataForSEO SERP API)
**Recommendation:** Phase 2 after adding SERP feature tracking

#### 29. detect_ad_budget_burn_realtime
**Status:** ❌ **NO** - Missing real-time data:
- ❌ Only have daily cost data, not hourly
- ❌ No real-time Google Ads API integration
- ❌ Can't detect "spending 2x target per hour"
**Recommendation:** Phase 3 after adding Google Ads API polling

#### 30. detect_ad_creative_fatigue
**Status:** ✅ **YES** - Have all data:
- ✅ CTR trends over time from `daily_entity_metrics`
- ✅ Impressions for frequency calculation
- ✅ Can compare first 7 days to last 7 days
**Build:** NOW

#### 31. detect_ad_audience_saturation
**Status:** ⚠️ **PARTIAL** - Have some data:
- ✅ CTR and CPM trends available
- ❌ No frequency data (impressions per user)
- ❌ No reach percentage
**Recommendation:** Build with CTR+CPM proxy NOW, enhance later with frequency data

#### 32. detect_ad_quality_score_drops
**Status:** ❌ **NO** - Missing data:
- ❌ Not tracking Quality Score from Google Ads
- ❌ Would need Google Ads API integration
**Recommendation:** Phase 2 after adding Google Ads API

#### 33. detect_form_abandonment_spike
**Status:** ❌ **NO** - Missing data:
- ❌ No form start/submit events tracked in GA4
- ❌ No cart add/checkout events tracked
**Recommendation:** Phase 2 after setting up GA4 form/cart tracking

#### 34. detect_mobile_desktop_cvr_gap
**Status:** ✅ **YES** - Have all data:
- ✅ GA4 provides device breakdown
- ✅ Can query conversion_rate by device
- ✅ Can compare mobile vs. desktop CVR
**Build:** NOW

#### 35. detect_page_error_spike
**Status:** ❌ **NO** - Missing data:
- ❌ No error tracking integration (Sentry, Bugsnag, etc.)
- ❌ No JavaScript error events in GA4
**Recommendation:** Phase 2 after adding error tracking

#### 36. detect_traffic_source_disappearance
**Status:** ✅ **YES** - Have all data:
- ✅ `source_breakdown` JSON field in daily_entity_metrics
- ✅ Can track traffic by source/medium daily
- ✅ Can detect >50% drops in 1 day
**Build:** NOW

#### 37. detect_channel_dependency_risk
**Status:** ✅ **YES** - Have all data:
- ✅ Traffic by channel from GA4
- ✅ Revenue by channel from source_breakdown
- ✅ Can calculate % from single channel
**Build:** NOW

### Phase 1 Summary:
- ✅ **Can Build NOW:** 7 detectors (25, 26, 30, 34, 36, 37, + partial 24, 31)
- ⚠️ **Partial (build with proxy):** 2 detectors (24, 31)
- ❌ **Need New Data:** 5 detectors (27, 28, 29, 32, 33, 35)

---

## 🎯 PHASE 2: GAP DETECTION (14 Detectors)

### ✅ CAN BUILD NOW (11 detectors)

#### 38. detect_email_list_health_issues
**Status:** ⚠️ **PARTIAL**:
- ✅ Can track email volume trends
- ❌ No subscriber count from ActiveCampaign
- ❌ No unsubscribe rate data
**Recommendation:** Build volume/engagement version NOW, enhance later

#### 39. detect_email_revenue_attribution_gap
**Status:** ✅ **YES**:
- ✅ Have email click data
- ✅ Have revenue data
- ✅ Can check if email touchpoints have revenue attribution
**Build:** NOW

#### 40. detect_seo_serp_feature_opportunities
**Status:** ❌ **NO**:
- ❌ Not tracking SERP features
**Recommendation:** Phase 3 after SERP feature tracking

#### 41. detect_seo_technical_health_score
**Status:** ⚠️ **PARTIAL**:
- ✅ Have Search Console data (mobile usability, HTTPS)
- ❌ No PageSpeed Insights API
- ❌ No structured data tracking
**Recommendation:** Build with Search Console data NOW, enhance later

#### 42. detect_ad_retargeting_gap
**Status:** ✅ **YES**:
- ✅ Can identify campaigns by name/type
- ✅ Can calculate retargeting spend % of total
- ✅ Can detect if retargeting campaigns exist
**Build:** NOW

#### 43. detect_ad_device_geo_optimization_gaps
**Status:** ✅ **YES**:
- ✅ GA4 provides device breakdown
- ✅ GA4 provides geographic data
- ✅ Can compare CPA/ROAS by device and geo
**Build:** NOW

#### 44. detect_ad_competitor_activity_surge
**Status:** ❌ **NO**:
- ❌ No auction insights data
- ❌ Would need Google Ads API
**Recommendation:** Phase 3 after Google Ads API

#### 45. detect_page_speed_impact_on_cvr
**Status:** ❌ **NO**:
- ❌ No page speed metrics stored
- ❌ Would need PageSpeed Insights API
**Recommendation:** Phase 3 after adding page speed tracking

#### 46. detect_ab_test_opportunities
**Status:** ✅ **YES**:
- ✅ Have traffic and CVR data per page
- ✅ Can identify high-traffic, moderate-CVR pages
- ✅ Can detect pages unchanged for 90+ days (via last_modified if tracked)
**Build:** NOW

#### 47. detect_multitouch_conversion_path_issues
**Status:** ⚠️ **PARTIAL**:
- ✅ GA4 has path exploration data
- ❌ Not currently syncing conversion paths to BigQuery
**Recommendation:** Phase 3 after adding path tracking

#### 48. detect_content_publishing_volume_gap
**Status:** ✅ **YES**:
- ✅ Can track new pages added per month from entity_map
- ✅ Can count content entities by date_added
- ✅ Can detect zero new content in 30 days
**Build:** NOW

#### 49. detect_content_to_lead_attribution
**Status:** ✅ **YES**:
- ✅ Have content pageviews
- ✅ Have conversion data
- ✅ Can track conversion rate for content pages
**Build:** NOW

#### 50. detect_content_topic_format_winners
**Status:** ⚠️ **PARTIAL**:
- ✅ Have engagement metrics per page
- ❌ No topic/format categorization in data
**Recommendation:** Build if pages have consistent URL patterns, or add categorization

#### 51. detect_content_freshness_decay
**Status:** ✅ **YES**:
- ✅ Can track traffic trends per page over time
- ✅ Can identify content not updated in 12+ months (if last_modified tracked)
- ✅ Can detect declining traffic on aged content
**Build:** NOW

#### 52. detect_traffic_quality_by_source
**Status:** ✅ **YES**:
- ✅ Have bounce_rate per source
- ✅ Have avg_session_duration per source
- ✅ Have conversion_rate per source
**Build:** NOW

#### 53. detect_cac_by_channel
**Status:** ✅ **YES**:
- ✅ Have cost by channel
- ✅ Have conversions by channel
- ✅ Can calculate CAC = cost / conversions
**Build:** NOW

#### 54. detect_revenue_by_channel_attribution
**Status:** ✅ **YES**:
- ✅ Have revenue data
- ✅ Have source_breakdown for channel attribution
- ✅ Can compare last-click vs. multi-touch (if paths tracked)
**Build:** NOW

#### 55. detect_mrr_arr_tracking
**Status:** ✅ **YES**:
- ✅ Have Stripe subscription data
- ✅ Can calculate MRR from active subscriptions
- ✅ Can track churn from subscription cancellations
**Build:** NOW

#### 56. detect_transaction_refund_anomalies
**Status:** ✅ **YES**:
- ✅ Have Stripe payment data
- ✅ Stripe provides refund data
- ✅ Can detect transaction volume drops
- ✅ Can detect refund rate spikes
**Build:** NOW

### Phase 2 Summary:
- ✅ **Can Build NOW:** 11 detectors (39, 42, 43, 46, 48, 49, 51, 52, 53, 54, 55, 56)
- ⚠️ **Partial:** 3 detectors (38, 41, 47, 50)
- ❌ **Need New Data:** 3 detectors (40, 44, 45)

---

## 🔮 PHASE 3: PREDICTIVE LAYER (9 Detectors)

### ✅ CAN BUILD NOW (9 detectors)

#### 57. detect_revenue_forecast_deviation
**Status:** ✅ **YES**:
- ✅ Have historical revenue data
- ✅ Can use Prophet or simple forecasting
- ✅ Can compare actual to forecast
**Build:** NOW (with simple forecasting), enhance later with Prophet

#### 58. detect_churn_prediction_early_warning
**Status:** ⚠️ **PARTIAL**:
- ✅ Have subscription data
- ❌ No product usage data (logins, feature usage)
- ❌ No support ticket data
**Recommendation:** Build with subscription metrics NOW (payment failures, downgrades), enhance later

#### 59. detect_multitouch_attribution_model
**Status:** ⚠️ **PARTIAL**:
- ✅ Have conversion data
- ❌ Not syncing full conversion paths from GA4
**Recommendation:** Phase 3 after adding path tracking

#### 60. detect_ab_test_recommendations
**Status:** ✅ **YES**:
- ✅ Have performance data for all pages
- ✅ Can identify optimization opportunities algorithmically
- ✅ Can suggest tests based on data patterns
**Build:** NOW

#### 61. detect_seasonality_adjusted_alerts
**Status:** ✅ **YES**:
- ✅ Have 91 days of historical data
- ✅ Can calculate day-of-week baselines
- ✅ Can detect deviations from seasonal patterns
**Build:** NOW (enhance later with more history)

#### 62. detect_automated_optimization_suggestions
**Status:** ✅ **YES**:
- ✅ Have all performance metrics
- ✅ Can generate rule-based recommendations
- ✅ Can identify low-hanging fruit
**Build:** NOW

#### 63. detect_cohort_performance_trends
**Status:** ⚠️ **PARTIAL**:
- ✅ Have customer acquisition dates from Stripe
- ✅ Have revenue by customer
- ❌ No cohort LTV calculation set up yet
**Recommendation:** Build cohort analysis NOW, would be valuable

#### 64. detect_unit_economics_dashboard
**Status:** ✅ **YES**:
- ✅ Have CAC data (cost / conversions)
- ✅ Have LTV data (revenue per customer over time)
- ✅ Have gross margin data (revenue - cost)
**Build:** NOW

#### 65. detect_growth_velocity_trends
**Status:** ✅ **YES**:
- ✅ Have revenue, users, MRR over time
- ✅ Can calculate growth rates
- ✅ Can detect acceleration/deceleration
**Build:** NOW

### Phase 3 Summary:
- ✅ **Can Build NOW:** 6 detectors (57, 60, 61, 62, 64, 65)
- ⚠️ **Partial:** 3 detectors (58, 59, 63)
- ❌ **Need New Data:** 0 detectors

---

## 📊 FINAL DATA AVAILABILITY SUMMARY

### By Build Status

| Status | Count | Detectors |
|--------|-------|-----------|
| ✅ **Build NOW** | 24 | Full data available |
| ⚠️ **Build with Proxy** | 8 | Partial data, can build simplified version |
| ❌ **Need New Data** | 5 | Missing critical data sources |

### Total: 32 of 37 detectors can be built NOW (86%)

---

## 🚨 MISSING DATA SOURCES (Blocking 5 Detectors)

### 1. **Real-Time Google Ads Data**
**Blocks:** 
- #29 detect_ad_budget_burn_realtime
- #32 detect_ad_quality_score_drops
- #44 detect_ad_competitor_activity_surge

**Solution:** Integrate Google Ads API with hourly polling
**Priority:** 🔴 HIGH - Prevents expensive budget burns

### 2. **SERP Feature Tracking**
**Blocks:**
- #28 detect_seo_serp_feature_loss
- #40 detect_seo_serp_feature_opportunities

**Solution:** Add DataForSEO SERP API or SEMrush integration
**Priority:** 🟡 MEDIUM - Nice to have, not critical

### 3. **Form/Cart Tracking**
**Blocks:**
- #33 detect_form_abandonment_spike

**Solution:** Set up GA4 custom events for form/cart interactions
**Priority:** 🔴 HIGH - High-impact optimization opportunity

### 4. **Error Monitoring**
**Blocks:**
- #35 detect_page_error_spike

**Solution:** Integrate Sentry or set up GA4 exception tracking
**Priority:** 🟡 MEDIUM - Important for user experience

### 5. **Page Speed Metrics**
**Blocks:**
- #45 detect_page_speed_impact_on_cvr

**Solution:** Integrate PageSpeed Insights API
**Priority:** 🟡 MEDIUM - Known SEO/CVR factor but can live without

---

## 🎯 RECOMMENDED BUILD PLAN

### WEEK 1-2: Quick Wins (8 detectors) ✅ ALL DATA AVAILABLE
1. ✅ #25 detect_email_volume_gap
2. ✅ #26 detect_seo_rank_volatility_daily
3. ✅ #34 detect_mobile_desktop_cvr_gap
4. ✅ #36 detect_traffic_source_disappearance
5. ✅ #37 detect_channel_dependency_risk
6. ✅ #42 detect_ad_retargeting_gap
7. ✅ #52 detect_traffic_quality_by_source
8. ✅ #53 detect_cac_by_channel

### WEEK 3-4: High-Value Detectors (8 detectors) ✅ ALL DATA AVAILABLE
9. ✅ #30 detect_ad_creative_fatigue
10. ✅ #39 detect_email_revenue_attribution_gap
11. ✅ #43 detect_ad_device_geo_optimization_gaps
12. ✅ #48 detect_content_publishing_volume_gap
13. ✅ #49 detect_content_to_lead_attribution
14. ✅ #51 detect_content_freshness_decay
15. ✅ #55 detect_mrr_arr_tracking
16. ✅ #56 detect_transaction_refund_anomalies

### WEEK 5-6: Strategic Detectors (8 detectors) ✅ ALL DATA AVAILABLE
17. ✅ #46 detect_ab_test_opportunities
18. ✅ #54 detect_revenue_by_channel_attribution
19. ✅ #57 detect_revenue_forecast_deviation
20. ✅ #60 detect_ab_test_recommendations
21. ✅ #61 detect_seasonality_adjusted_alerts
22. ✅ #62 detect_automated_optimization_suggestions
23. ✅ #64 detect_unit_economics_dashboard
24. ✅ #65 detect_growth_velocity_trends

### WEEK 7-8: Partial Data Detectors (8 detectors) ⚠️ BUILD WITH PROXIES
25. ⚠️ #24 detect_email_deliverability_crash (use open_rate proxy)
26. ⚠️ #31 detect_ad_audience_saturation (use CTR+CPM proxy)
27. ⚠️ #38 detect_email_list_health_issues (use volume proxy)
28. ⚠️ #41 detect_seo_technical_health_score (Search Console only)
29. ⚠️ #47 detect_multitouch_conversion_path_issues (if paths available)
30. ⚠️ #50 detect_content_topic_format_winners (if URL patterns exist)
31. ⚠️ #58 detect_churn_prediction_early_warning (subscription metrics only)
32. ⚠️ #63 detect_cohort_performance_trends (basic cohorts)

### LATER: Blocked by Missing Data (5 detectors) ❌ NEED NEW INTEGRATIONS
33. ❌ #28 detect_seo_serp_feature_loss (need SERP tracking)
34. ❌ #29 detect_ad_budget_burn_realtime (need Google Ads API)
35. ❌ #32 detect_ad_quality_score_drops (need Google Ads API)
36. ❌ #33 detect_form_abandonment_spike (need GA4 events)
37. ❌ #35 detect_page_error_spike (need error tracking)
38. ❌ #40 detect_seo_serp_feature_opportunities (need SERP tracking)
39. ❌ #44 detect_ad_competitor_activity_surge (need Google Ads API)
40. ❌ #45 detect_page_speed_impact_on_cvr (need PageSpeed API)

---

## ✅ CONFIRMATION: WE CAN BUILD 32 OF 37 DETECTORS NOW

**Yes, we can build the vast majority!**

- ✅ **24 detectors:** Full data available, build 100% version
- ⚠️ **8 detectors:** Partial data, build 70-80% version with proxies
- ❌ **5 detectors:** Missing critical data, need new integrations

**Recommended:** Build the 24 fully-supported detectors first (6-8 weeks), then tackle the 8 partial detectors, then add new data sources for the final 5.

---

## 🔧 DATA SOURCES TO ADD LATER (For Final 5 Detectors)

1. **Google Ads API Integration** (blocks 3 detectors)
   - Real-time spend data
   - Quality Score tracking
   - Auction insights for competitive data
   - **Effort:** 1-2 weeks
   - **Value:** HIGH - Prevents budget waste

2. **GA4 Form/Cart Event Tracking** (blocks 1 detector)
   - Form start/submit events
   - Cart add/checkout events
   - **Effort:** 1-2 days setup
   - **Value:** HIGH - Major CVR optimization

3. **SERP Feature Tracking** (blocks 2 detectors)
   - DataForSEO SERP API or SEMrush
   - **Effort:** 1 week
   - **Value:** MEDIUM - Nice SEO insights

4. **Error Monitoring Integration** (blocks 1 detector)
   - Sentry or GA4 exceptions
   - **Effort:** 2-3 days
   - **Value:** MEDIUM - UX improvement

5. **PageSpeed Insights API** (blocks 1 detector)
   - Automated page speed scoring
   - **Effort:** 2-3 days
   - **Value:** MEDIUM - Known optimization factor

---

**Bottom Line:** We have 86% of the data we need. Let's build those 32 detectors now and add the remaining data sources later!
