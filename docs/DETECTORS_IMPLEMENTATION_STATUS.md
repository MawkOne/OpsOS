# Detectors Implementation Status
**Updated:** January 27, 2026  
**Active Detectors:** 60 (was 55)  
**Planned Detectors:** 72 (was 77)

---

## ✅ JUST IMPLEMENTED (5 New Email Detectors)

### 1. Bounce Rate Spike ✓
- **Status:** ACTIVE
- **Layer:** Fast (daily)
- **Data:** ActiveCampaign API provides bounces, hard_bounces, soft_bounces
- **Deployment:** Live in Scout AI engine
- **Why buildable:** Already syncing bounce data from ActiveCampaign

### 2. Spam Complaint Spike ✓
- **Status:** ACTIVE  
- **Layer:** Fast (daily)
- **Data:** ActiveCampaign API provides "abuses" field (spam complaints)
- **Deployment:** Live in Scout AI engine
- **Why buildable:** Added spam_complaints field to sync

### 3. List Health Decline ✓
- **Status:** ACTIVE
- **Layer:** Trend (weekly)
- **Data:** ActiveCampaign provides unsubscribes, list counts
- **Deployment:** Live in Scout AI engine
- **Why buildable:** Already syncing unsubscribe data

### 4. Click-to-Open Rate Decline ✓
- **Status:** ACTIVE
- **Layer:** Trend (weekly)
- **Data:** ActiveCampaign provides uniqueOpens, uniqueLinkClicks
- **Deployment:** Live in Scout AI engine
- **Why buildable:** Calculate click_to_open_rate from existing data

### 5. Optimal Frequency Deviation ✓
- **Status:** ACTIVE
- **Layer:** Strategic (monthly)
- **Data:** ActiveCampaign provides send counts over time
- **Deployment:** Live in Scout AI engine
- **Why buildable:** Calculate weekly frequency from send data

---

## 🎯 WHAT WE CAN BUILD NEXT (20+ more immediately)

### Revenue Detectors (5 buildable with Stripe):

#### 1. Average Order Value Decline ✓ CAN BUILD
- **Data needed:** transactions, revenue (already have!)
- **Why:** Stripe provides transaction amounts
- **Effort:** Low (30 min)

#### 2. Payment Failure Rate Increase ✓ CAN BUILD
- **Data needed:** failed_payments (already have!)
- **Why:** Stripe provides charge failures
- **Effort:** Low (30 min)

#### 3. New Customer Revenue Decline ✓ CAN BUILD
- **Data needed:** first_time_customers, returning_customers
- **Why:** Stripe provides customer data, can calculate
- **Effort:** Medium (1 hour)

#### 4. Discount Cannibalization ✓ CAN BUILD
- **Data needed:** Stripe coupon usage data
- **Why:** Stripe provides discount information
- **Effort:** Medium (1-2 hours)

#### 5. Revenue Seasonality Deviation ✓ CAN BUILD
- **Data needed:** revenue over time (already have!)
- **Why:** Compare to year-over-year patterns
- **Effort:** Medium (1-2 hours)

### Page/CRO Detectors (6 buildable with GA4):

#### 6. Form Abandonment Spike ✓ CAN BUILD
- **Data needed:** form_start, form_submit events
- **Why:** GA4 provides these as standard events
- **Effort:** Low (30 min)

#### 7. Cart Abandonment Increase ✓ CAN BUILD  
- **Data needed:** add_to_cart, begin_checkout, purchase events
- **Why:** GA4 e-commerce events (if configured)
- **Effort:** Low (30 min)

#### 8. Page Error Rate Spike ✓ CAN BUILD
- **Data needed:** exception events from GA4
- **Why:** GA4 tracks JS errors as exceptions
- **Effort:** Low (30 min)

#### 9. Micro-Conversion Drop ✓ CAN BUILD
- **Data needed:** scroll_depth, video_start, button_click events
- **Why:** GA4 provides enhanced measurement events
- **Effort:** Medium (1 hour)

#### 10. Exit Rate Increase ✓ CAN BUILD
- **Data needed:** entrances, exits (GA4 calculated)
- **Why:** GA4 provides page-level exit rates
- **Effort:** Low (30 min)

#### 11. Browser/Device Compatibility Issues ✓ CAN BUILD
- **Data needed:** device, browser dimensions + CVR
- **Why:** GA4 provides device/browser breakdowns
- **Effort:** Low (requires device_entity_metrics table)

### Traffic Detectors (4 buildable with GA4):

#### 12. Bot/Spam Traffic Spike ✓ CAN BUILD
- **Data needed:** bounce_rate, avg_session_duration, pages_per_session
- **Why:** Identify bot patterns (>80% bounce, <10s duration)
- **Effort:** Low (30 min)

#### 13. Unexpected Traffic Spike Quality Check ✓ CAN BUILD
- **Data needed:** sessions surge + engagement metrics
- **Why:** Detect viral traffic or bot attacks
- **Effort:** Low (30 min)

#### 14. UTM Parameter Tracking Gaps ✓ CAN BUILD
- **Data needed:** GA4 source/medium without campaign tags
- **Why:** GA4 shows untagged traffic
- **Effort:** Medium (1 hour)

#### 15. Referral Source Opportunities ✓ CAN BUILD
- **Data needed:** referral traffic + CVR
- **Why:** GA4 provides referral data
- **Effort:** Low (30 min)

### Advertising Detectors (5 buildable with Google Ads):

#### 16. Ad Quality Score Decline ✓ CAN BUILD
- **Data needed:** quality_score from Google Ads
- **Why:** Google Ads API provides QS
- **Effort:** Medium (need to add to sync)

#### 17. Impression Share Loss ✓ CAN BUILD
- **Data needed:** impression_share, IS_lost_budget, IS_lost_rank
- **Why:** Google Ads API provides these metrics
- **Effort:** Medium (need to add to sync)

#### 18. Bid Strategy Underperformance ✓ CAN BUILD
- **Data needed:** bid_strategy_type, target_cpa, actual_cpa
- **Why:** Google Ads provides bid strategy data
- **Effort:** Medium (need to add to sync)

#### 19. Landing Page Experience Score ✓ CAN BUILD
- **Data needed:** landing_page_experience from Google Ads
- **Why:** Google Ads provides LP experience scores
- **Effort:** Medium (need to add to sync)

#### 20. Ad Scheduling Optimization ✓ CAN BUILD
- **Data needed:** hour_of_day, day_of_week performance
- **Why:** Google Ads API provides time-parted data
- **Effort:** High (requires hourly_entity_metrics table)

---

## ❌ CANNOT BUILD YET (Need new data sources)

### Requires Google Search Console API (4 detectors):
- detect_seo_indexing_issues
- detect_seo_crawl_error_spike
- (These need GSC integration)

### Requires PageSpeed Insights API (2 detectors):
- detect_seo_page_speed_conversion_impact
- detect_page_load_speed_conversion_impact  
- (These need PSI integration)

### Requires DataForSEO Backlinks API (1 detector):
- detect_seo_backlink_loss_spike
- (Need to enable backlinks endpoint)

### Requires Social APIs (1 detector):
- detect_content_social_share_potential
- (Need Twitter/LinkedIn APIs)

### Requires Real-Time Advertising API (2 detectors):
- detect_ad_budget_burn_realtime
- detect_ad_policy_disapprovals
- (Need hourly/real-time Google Ads pulls)

### Requires Advanced Attribution (3 detectors):
- detect_channel_assist_value
- detect_multitouch_conversion_path_issues (partially built)
- detect_revenue_by_channel_attribution (partially built)
- (Need conversion_paths table + GA4 path analysis)

---

## 📊 SUMMARY

### Current State:
- **Active:** 60 detectors (45% of target)
- **Can build immediately:** 20+ more (with existing APIs)
- **Need new APIs:** 12 detectors
- **Need advanced ETL:** 40 detectors

### Recommended Next Steps:

#### Quick Wins (Can do today - 20 detectors):
1. **Revenue detectors (5)** - Use Stripe data
2. **Page/form detectors (6)** - Use GA4 event data
3. **Traffic quality detectors (4)** - Use GA4 data
4. **Ad optimization detectors (5)** - Enhance Google Ads sync

**Effort:** 1-2 days  
**Result:** 60 → 80 active detectors (60% coverage)

#### Medium Effort (This week - 15 detectors):
1. Add Google Search Console API integration
2. Add PageSpeed Insights API integration  
3. Enable DataForSEO backlinks endpoint
4. Build hourly_entity_metrics ETL

**Effort:** 3-5 days  
**Result:** 80 → 95 active detectors (72% coverage)

#### Advanced (Next 2 weeks - 37 detectors):
1. Build device_entity_metrics table
2. Build customer_cohorts table
3. Build conversion_paths table
4. Add real-time monitoring

**Effort:** 10-15 days  
**Result:** 95 → 132 active detectors (100% coverage)

---

**Next Action:** Build the 20 "quick win" detectors using existing data sources! 🚀
