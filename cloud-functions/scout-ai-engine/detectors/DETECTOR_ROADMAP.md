# Scout AI Detector Implementation Roadmap

**Last Updated:** January 27, 2026  
**Progress:** 117 of 117 detectors built (100%) | 59 operational (50%) 🎊

**Recent Progress:**
- ✅ Content detectors: 2 → 7 (+5, completed Jan 27)
- ✅ SEO detectors: 4 → 11 (+7, completed Jan 26)
- ✅ Total: 47 → 59 operational (+12 in 2 days!)

---

## 📊 Overall Status

| Metric | Count | % |
|--------|-------|---|
| **Detectors Built** | 117/117 | 100% |
| **Fully Operational** | 59/117 | 50% 🎊 |
| **Awaiting Data** | 58/117 | 50% |

---

## 🎯 Status Legend

**Code Status:**
- ✅ **COMPLETE** - Python code written and deployed
- 🚧 **PARTIAL** - Code written but needs enhancement
- ❌ **NOT STARTED** - Not yet implemented

**Data Status:**
- ✅ **AVAILABLE** - All required data exists in BigQuery
- 🔶 **PARTIAL** - Some data available, workarounds used
- ❌ **MISSING** - Required columns/tables don't exist yet

**Operational Status:**
- 🟢 **WORKING** - Detector executes without errors
- 🟡 **NEEDS DATA** - Code ready but blocked on data infrastructure
- 🔴 **SQL ERRORS** - Has bugs that need fixing

---

## 📧 Email Marketing (13/13 built, 13/13 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Email Engagement Drop | ✅ | ✅ | 🟢 | None |
| 2 | Bounce Rate Spike | ✅ | ✅ | 🟢 | None |
| 3 | Click-to-Open Rate Decline | ✅ | ✅ | 🟢 | None |
| 4 | High Opens Low Clicks | ✅ | ✅ | 🟢 | None |
| 5 | List Health Decline | ✅ | ✅ | 🟢 | None |
| 6 | Optimal Frequency Deviation | ✅ | ✅ | 🟢 | None |
| 7 | Spam Complaint Spike | ✅ | ✅ | 🟢 | None |
| 8 | Email Trends (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 9 | Email Volume Gap | ✅ | ✅ | 🟢 | None |
| 10 | Revenue Per Subscriber Decline | ✅ | ✅ | 🟢 | None |
| 11 | Device/Client Performance Gap | ✅ | ✅ | 🟢 | None |
| 12 | A/B Test Recommendations | ✅ | ✅ | 🟢 | None |
| 13 | List Segmentation Opportunities | ✅ | ✅ | 🟢 | None |

**Category Status:** ✅ **100% Operational** - All email detectors fully working

---

## 💵 Revenue & Metrics (19/19 built, 8/19 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Revenue Anomaly | ✅ | ✅ | 🟢 | None |
| 2 | Metric Anomalies | ✅ | ✅ | 🟢 | None |
| 3 | Revenue Trends (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 4 | AOV Decline | ✅ | ✅ | 🟢 | None |
| 5 | Payment Failure Spike | ✅ | 🔶 | 🟢 | Partial data |
| 6 | New Customer Decline | ✅ | ✅ | 🟢 | None |
| 7 | Discount Cannibalization | ✅ | ✅ | 🟢 | None |
| 8 | Seasonality Deviation | ✅ | ✅ | 🟢 | None |
| 9 | MRR/ARR Tracking | ✅ | ❌ | 🟡 | Need `mrr` column |
| 10 | Transaction/Refund Anomalies | ✅ | ❌ | 🟡 | Need `transactions`, `refund_count`, `refunds` columns |
| 11 | Forecast Deviation | ✅ | 🔶 | 🟡 | Using proxy (trend-based) - need forecast table |
| 12 | Unit Economics Dashboard | ✅ | ❌ | 🟡 | Need `ltv`, `cac`, `gross_margin` columns |
| 13 | Growth Velocity Trends | ✅ | ✅ | 🟡 | SQL needs refinement |
| 14 | Cohort Performance Trends | ✅ | ❌ | 🟡 | Need `first_purchase_date` column |
| 15 | Customer Churn Spike | ✅ | ❌ | 🟡 | Need churn tracking columns |
| 16 | LTV:CAC Ratio Decline | ✅ | ❌ | 🟡 | Need `ltv`, `cac` columns |
| 17 | Revenue Concentration Risk | ✅ | ❌ | 🟡 | Need customer-level revenue data |
| 18 | Pricing Opportunity Analysis | ✅ | ❌ | 🟡 | Need pricing/plan data |
| 19 | Expansion Revenue Gap | ✅ | ❌ | 🟡 | Need upsell/expansion tracking |

**Category Status:** 🟡 **42% Operational** - Need revenue-specific columns in BigQuery

**Required Data Additions:**
- `mrr` (Monthly Recurring Revenue)
- `arr` (Annual Recurring Revenue)  
- `ltv` (Lifetime Value)
- `cac` (Customer Acquisition Cost)
- `transactions` (Transaction count)
- `refund_count`, `refunds` (Refund metrics)
- `gross_margin` (Margin percentage)
- `first_purchase_date` (Customer cohort tracking)
- `churn_date` (Churn tracking)
- Customer-level revenue aggregations

---

## 📄 Pages & CRO (18/18 built, 10/18 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | High Traffic Low Conversion | ✅ | ✅ | 🟢 | None |
| 2 | Page Engagement Decay | ✅ | ✅ | 🟢 | None |
| 3 | Scale Winners | ✅ | ✅ | 🟢 | None |
| 4 | Fix Losers | ✅ | ✅ | 🟢 | None |
| 5 | Scale Winners (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 6 | Form Abandonment Spike | ✅ | ✅ | 🟢 | None |
| 7 | Cart Abandonment Increase | ✅ | 🔶 | 🟢 | Partial data |
| 8 | Page Error Rate Spike | ✅ | 🔶 | 🟢 | Partial data |
| 9 | Micro-Conversion Drop | ✅ | ✅ | 🟢 | None |
| 10 | Exit Rate Increase | ✅ | ✅ | 🟢 | None |
| 11 | Mobile vs Desktop CVR Gap | ✅ | ❌ | 🟡 | Need `device_type` dimension |
| 12 | A/B Test Opportunities | ✅ | ✅ | 🟡 | SQL needs refinement |
| 13 | Page Speed Decline | ✅ | ❌ | 🟡 | Need `page_load_time` metric |
| 14 | Conversion Funnel Drop-Off | ✅ | ❌ | 🟡 | Need funnel step tracking |
| 15 | CTA Performance Analysis | ✅ | ❌ | 🟡 | Need CTA click tracking |
| 16 | Video Engagement Gap | ✅ | ❌ | 🟡 | Need video metrics |
| 17 | Social Proof Opportunities | ✅ | ❌ | 🟡 | Need review/testimonial data |
| 18 | Trust Signal Gaps | ✅ | ❌ | 🟡 | Need trust signal metrics |

**Category Status:** 🟡 **56% Operational**

**Required Data Additions:**
- `device_type` dimension (mobile/desktop/tablet)
- `page_load_time` metric
- Funnel step events: `checkout_started`, `add_to_cart`, `purchase_completed`
- `cta_clicks` by button/link
- Video metrics: `video_plays`, `video_completion_rate`
- `error_count` for pages
- Review/trust signal data

---

## 🚦 Traffic Sources (16/16 built, 7/16 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Cross-Channel Gaps | ✅ | ✅ | 🟢 | None |
| 2 | Declining Performers | ✅ | ✅ | 🟢 | None |
| 3 | Declining Performers (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 4 | Bot/Spam Traffic Spike | ✅ | ✅ | 🟢 | None |
| 5 | Traffic Spike Quality Check | ✅ | ✅ | 🟢 | None |
| 6 | UTM Parameter Gaps | ✅ | ✅ | 🟢 | None |
| 7 | Referral Opportunities | ✅ | ✅ | 🟢 | None |
| 8 | Traffic Source Disappearance | ✅ | ✅ | 🟡 | SQL needs refinement |
| 9 | Channel Dependency Risk | ✅ | ✅ | 🟡 | SQL needs refinement |
| 10 | Revenue by Channel Attribution | ✅ | ✅ | 🟡 | SQL needs refinement |
| 11 | Multi-Touch Path Issues | ✅ | ❌ | 🟡 | Need multi-touch attribution data |
| 12 | Traffic Quality by Source | ✅ | ✅ | 🟡 | SQL needs refinement |
| 13 | CAC by Channel | ✅ | ❌ | 🟡 | Need `cac` by channel calculation |
| 14 | Channel Mix Optimization | ✅ | ✅ | 🟡 | SQL needs refinement |
| 15 | Attribution Model Comparison | ✅ | ❌ | 🟡 | Need multiple attribution models |
| 16 | Cross-Device Journey Issues | ✅ | ❌ | 🟡 | Need cross-device tracking |

**Category Status:** 🟡 **44% Operational**

**Required Data Additions:**
- Multi-touch attribution path data
- CAC calculation by channel
- Multiple attribution model support
- Cross-device user journey tracking

---

## 🔍 SEO (12/12 built, 4/12 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Keyword Cannibalization | ✅ | ✅ | 🟢 | None |
| 2 | Striking Distance Keywords | ✅ | ✅ | 🟢 | None |
| 3 | Rank Drops | ✅ | ✅ | 🟢 | None |
| 4 | Rank Trends (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 5 | Rank Volatility (Daily) | ✅ | ✅ | 🟡 | SQL needs refinement |
| 6 | Content Freshness Decay | ✅ | ❌ | 🟡 | Need `content_publish_date`, `last_update_date` |
| 7 | Technical SEO Health Score | ✅ | ❌ | 🟡 | Need technical SEO crawl data |
| 8 | Internal Link Opportunities | ✅ | ❌ | 🟡 | Need internal link graph data |
| 9 | Featured Snippet Opportunities | ✅ | ❌ | 🟡 | Need snippet status from Search Console |
| 10 | Backlink Quality Decline | ✅ | ❌ | 🟡 | Need backlink quality data (Ahrefs/Moz) |
| 11 | Core Web Vitals Failing | ✅ | ❌ | 🟡 | Need PageSpeed Insights API data |
| 12 | Schema Markup Gaps | ✅ | ❌ | 🟡 | Need schema markup detection |

**Category Status:** 🟡 **33% Operational**

**Required Data Additions:**
- Content metadata: `publish_date`, `last_update_date`
- Technical SEO crawl data (from Screaming Frog or similar)
- Internal link structure data
- Featured snippet tracking (Search Console API)
- Backlink data (Ahrefs, Moz, or similar)
- Core Web Vitals metrics (PageSpeed Insights API)
- Schema markup detection

---

## 💰 Advertising (13/13 built, 3/13 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Cost Inefficiency | ✅ | ✅ | 🟢 | None |
| 2 | Paid Waste | ✅ | ✅ | 🟢 | None |
| 3 | Campaign Trends (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 4 | Ad Retargeting Gap | ✅ | ❌ | 🟡 | Need retargeting campaign tracking |
| 5 | Creative Fatigue | ✅ | ❌ | 🟡 | Need creative/ad copy tracking |
| 6 | Audience Saturation (Proxy) | ✅ | 🔶 | 🟡 | Using frequency proxy - need audience data |
| 7 | Device/Geo Optimization Gaps | ✅ | ❌ | 🟡 | Need device/geo dimensions in ad data |
| 8 | Quality Score Decline | ✅ | ❌ | 🟡 | Need Google Ads quality scores |
| 9 | Impression Share Loss | ✅ | ❌ | 🟡 | Need impression share metrics |
| 10 | Ad Schedule Optimization | ✅ | ❌ | 🟡 | Need hour-of-day performance data |
| 11 | Negative Keyword Opportunities | ✅ | ❌ | 🟡 | Need search term report data |
| 12 | Competitor Activity Alerts | ✅ | ❌ | 🟡 | Need auction insights data |
| 13 | Landing Page Relevance Gap | ✅ | ❌ | 🟡 | Need landing page performance by ad |

**Category Status:** 🟡 **23% Operational**

**Required Data Additions:**
- Google Ads API enhanced metrics:
  - Quality scores
  - Impression share metrics
  - Auction insights
  - Search term reports
  - Hour-of-day performance
  - Device/geo dimensions
  - Creative/ad copy tracking
  - Landing page tracking
  - Retargeting campaign flags

---

## ✍️ Content (11/11 built, 7/11 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Content Decay | ✅ | ✅ | 🟢 | None |
| 2 | Content Decay (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 3 | Publishing Volume Gap | ✅ | ✅ | 🟢 | None - Uses `publish_date` |
| 4 | Content-to-Lead Attribution | ✅ | ❌ | 🟡 | Need lead source attribution |
| 5 | Topic Gap Analysis | ✅ | ❌ | 🟡 | Need content taxonomy/topics |
| 6 | Content Format Winners | ✅ | ✅ | 🟢 | None - Uses `content_type` |
| 7 | Engagement Rate Decline | ✅ | ✅ | 🟢 | None - Uses `engagement_rate` from GA4 |
| 8 | Dwell Time Decline | ✅ | ✅ | 🟢 | None - Uses `dwell_time` from GA4 |
| 9 | Content Pillar Opportunities | ✅ | ❌ | 🟡 | Need content pillar/cluster tracking |
| 10 | Republishing Opportunities | ✅ | ✅ | 🟢 | None - Uses `publish_date` + history |
| 11 | Content Distribution Gap | ✅ | ❌ | 🟡 | Need distribution channel tracking |

**Category Status:** 🟢 **64% Operational** (7/11)

**✅ Data Now Available (Phase 2):**
- ✅ `content_type` - Inferred from URL paths (blog, video, guide, etc.)
- ✅ `publish_date`, `last_update_date` - Added in Phase 2
- ✅ `dwell_time` - From GA4 `userEngagementDuration`
- ✅ `engagement_rate` - From GA4 engaged sessions
- ✅ `scroll_depth` - From GA4 scrolled users
- ✅ Performance history - Full 365-day lookback

**🟡 Still Need for Remaining 4 Detectors:**
- `topic_tags` / `content_pillar` (for Topic Gap & Pillar Opportunities)
- Lead source attribution data (for Content-to-Lead)
- Distribution channel tracking (for Distribution Gap)
- Social shares, comments (nice-to-have)

---

## 🏗️ System & Data Quality (15/15 built, 0/15 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Data Freshness Issues | ✅ | ✅ | 🟡 | SQL needs refinement |
| 2 | Entity Mapping Quality Decline | ✅ | 🔶 | 🟡 | Need entity mapping quality metrics |
| 3 | Data Source Disconnection | ✅ | ❌ | 🟡 | Need sync status tracking |
| 4 | Metric Calculation Errors | ✅ | ❌ | 🟡 | Need error logging table |
| 5 | BigQuery Cost Spike | ✅ | ❌ | 🟡 | Need BigQuery billing API |
| 6 | API Rate Limit Approaching | ✅ | ❌ | 🟡 | Need API usage tracking |
| 7 | Duplicate Data Detection | ✅ | ✅ | 🟡 | SQL needs refinement |
| 8 | Missing Data Gaps | ✅ | ✅ | 🟡 | SQL needs refinement |
| 9 | Schema Drift Detection | ✅ | ❌ | 🟡 | Need schema version tracking |
| 10 | Data Quality Score | ✅ | 🔶 | 🟡 | Need quality score calculations |
| 11 | Alert Fatigue Detection | ✅ | ❌ | 🟡 | Need opportunity interaction tracking |
| 12 | False Positive Rate | ✅ | ❌ | 🟡 | Need user feedback on opportunities |
| 13 | Opportunity Resolution Tracking | ✅ | ❌ | 🟡 | Need resolution status tracking |
| 14 | Detector Performance Monitoring | ✅ | ❌ | 🟡 | Need detector execution metrics |
| 15 | Cross-Detector Correlation | ✅ | ❌ | 🟡 | Need historical opportunity data |

**Category Status:** 🟡 **0% Operational** - All need system monitoring infrastructure

**Required Data Additions:**
- Sync status tracking table
- Error logging table
- BigQuery billing API integration
- API usage tracking
- Schema version history
- Opportunity interaction events (viewed, dismissed, resolved)
- Detector execution metrics
- User feedback on opportunities

---

## 📊 Summary by Data Infrastructure Needs

### ✅ Fully Covered (47 detectors working)
- **Email metrics:** sends, opens, clicks, bounces, list_size
- **Basic analytics:** sessions, conversions, revenue (attributed)
- **SEO basics:** impressions, clicks, position (for 4 detectors)
- **Traffic sources:** source, medium, campaign
- **Basic revenue:** revenue, conversions

### 🔶 Partially Covered (10 detectors)
Using proxies or limited data:
- Payment failures (have some data)
- Cart abandonment (have add-to-cart events partially)
- Device performance (using engagement proxy)

### ❌ Missing Infrastructure (60 detectors blocked)

**Priority 1 - Core Revenue Metrics:**
- MRR/ARR tracking
- LTV & CAC calculations
- Transaction & refund counts
- Customer cohorts
- Churn tracking

**Priority 2 - Enhanced Analytics:**
- Device/geo dimensions
- Dwell time & engagement depth
- Page speed metrics
- Funnel step tracking

**Priority 3 - Advanced Features:**
- Multi-touch attribution
- A/B test tracking
- Content metadata
- Video analytics
- System monitoring

---

## 🎯 Recommended Next Steps

**Option A: Enable More Detectors (Quick Wins)**
1. Add missing columns to `daily_entity_metrics`:
   - `mrr`, `ltv`, `cac`, `transactions`, `refunds`
   - `device_type`, `dwell_time`, `page_load_time`
2. Enable 20-30 more detectors immediately

**Option B: Focus on What Works (Current)**
- Use 47 operational detectors now
- Add data infrastructure incrementally
- Unlock detectors as data becomes available

**Option C: Full Infrastructure Build**
- Complete all missing data columns
- Integrate all API sources fully
- Unlock all 117 detectors

---

## 📁 File Structure

All detectors organized in modular structure:
```
detectors/
  ├── email/          (13 files) ✅
  ├── revenue/        (19 files) ✅
  ├── pages/          (18 files) ✅
  ├── traffic/        (16 files) ✅
  ├── seo/            (12 files) ✅
  ├── advertising/    (13 files) ✅
  ├── content/        (11 files) ✅
  ├── system/         (15 files) ✅
  └── DETECTOR_ROADMAP.md (this file)
```

Each detector is a standalone file with:
- Clear docstring with metadata
- BigQuery SQL queries
- Error handling
- Opportunity generation logic

---

**Legend:**
- 🟢 **Working** = Executes successfully with current data
- 🟡 **Needs Data** = Code ready, blocked on data
- 🔴 **Has Bugs** = Needs SQL/code fixes
- ✅ **Available** = Data exists in system
- 🔶 **Partial** = Some data available
- ❌ **Missing** = Data doesn't exist yet

---

## ✅ IMPLEMENTATION TASKS TO COMPLETE ALL 117 DETECTORS

**Current:** 47/117 operational (40%)  
**Goal:** 117/117 operational (100%)  
**Tasks Needed:** 42 tasks to unlock 70 detectors

---

### 🎯 Phase 1: Core Revenue Infrastructure (Unlocks 11 detectors)

**Task 1.1: Add MRR/ARR Tracking Columns**
- Add `mrr` (decimal) column to `daily_entity_metrics`
- Add `arr` (decimal) column to `daily_entity_metrics`
- Update Stripe sync to calculate MRR from subscriptions
- **Unlocks:** MRR/ARR Tracking detector

**Task 1.2: Add Transaction & Refund Columns**
- Add `transactions` (integer) column to `daily_entity_metrics`
- Add `refund_count` (integer) column to `daily_entity_metrics`
- Add `refunds` (decimal) column to `daily_entity_metrics`
- Update Stripe/payment sync to capture transaction counts
- **Unlocks:** Transaction/Refund Anomalies detector

**Task 1.3: Add LTV & CAC Columns**
- Add `ltv` (decimal) column to `daily_entity_metrics`
- Add `cac` (decimal) column to `daily_entity_metrics`
- Add `gross_margin` (decimal) column to `daily_entity_metrics`
- Implement LTV calculation logic (average revenue per customer lifetime)
- Implement CAC calculation logic (marketing spend / new customers)
- **Unlocks:** Unit Economics Dashboard, LTV:CAC Ratio Decline (3 detectors)

**Task 1.4: Add Customer Cohort Tracking**
- Add `first_purchase_date` (date) column to `daily_entity_metrics`
- Add `customer_cohort` (string) column to `daily_entity_metrics`
- Add `churn_date` (date) column to `daily_entity_metrics`
- Implement cohort aggregation logic in sync
- **Unlocks:** Cohort Performance Trends, Customer Churn Spike (2 detectors)

**Task 1.5: Add Customer Revenue Details**
- Add `customer_id` dimension support
- Add `is_expansion_revenue` (boolean) flag
- Add `plan_tier` (string) for pricing analysis
- Create customer-level revenue aggregation table
- **Unlocks:** Revenue Concentration Risk, Pricing Opportunity, Expansion Revenue Gap (3 detectors)

---

### 📊 Phase 2: Enhanced Page Analytics (Unlocks 8 detectors)

**Task 2.1: Add Device Dimension**
- Add `device_type` (string: mobile/desktop/tablet) column to `daily_entity_metrics`
- Update GA4 sync to capture device dimension
- Aggregate metrics by device type
- **Unlocks:** Mobile vs Desktop CVR Gap (1 detector)

**Task 2.2: Add Page Performance Metrics**
- Add `page_load_time` (decimal) column to `daily_entity_metrics`
- Add `dwell_time` (decimal) / `avg_time_on_page` column
- Add `scroll_depth` (decimal) column
- Integrate PageSpeed Insights API for performance data
- Update GA4 sync to capture engagement metrics
- **Unlocks:** Page Speed Decline, Dwell Time Decline (2 detectors)

**Task 2.3: Add Funnel Step Events**
- Add `checkout_started` (integer) column to `daily_entity_metrics`
- Add `add_to_cart` (integer) column to `daily_entity_metrics`
- Add `purchase_completed` (integer) column
- Update GA4 sync to capture ecommerce events
- **Unlocks:** Conversion Funnel Drop-Off, Cart Abandonment (enhanced) (2 detectors)

**Task 2.4: Add CTA & Engagement Tracking**
- Add `cta_clicks` table or column (by button/link)
- Add `error_count` (integer) column for page errors
- Add `video_plays`, `video_completion_rate` columns
- **Unlocks:** CTA Performance, Video Engagement Gap, Error Rate (enhanced) (3 detectors)

---

### 🔍 Phase 3: SEO Tool Integrations (Unlocks 8 detectors)

**Task 3.1: Add Content Metadata Tracking**
- Add `content_publish_date` (date) column to `daily_entity_metrics`
- Add `last_update_date` (date) column
- Add `content_type` (string) column (blog, video, etc.)
- Add `word_count` (integer) column
- Implement content crawling/scraping for metadata
- **Unlocks:** Content Freshness Decay, Republishing Opportunities (2 detectors)

**Task 3.2: Integrate Technical SEO Crawl Data**
- Set up Screaming Frog or similar crawler
- Create `technical_seo_metrics` table with:
  - `page_url`, `status_code`, `redirect_chains`
  - `meta_tags_present`, `h1_tags`, `canonical_tags`
  - `image_alt_missing`, `broken_links`
- Schedule weekly crawls
- **Unlocks:** Technical SEO Health Score (1 detector)

**Task 3.3: Add Internal Link Graph**
- Create `internal_links` table with:
  - `from_url`, `to_url`, `anchor_text`, `link_position`
- Build link graph from crawl data
- Calculate PageRank-style metrics
- **Unlocks:** Internal Link Opportunities (1 detector)

**Task 3.4: Integrate Search Console Enhanced Data**
- Add `featured_snippet_status` (boolean) column
- Add `snippet_type` (string) column
- Update Search Console sync to capture snippet data
- **Unlocks:** Featured Snippet Opportunities (1 detector)

**Task 3.5: Integrate Backlink Data**
- Sign up for Ahrefs, Moz, or similar backlink API
- Create `backlinks` table with:
  - `from_domain`, `to_url`, `anchor_text`
  - `domain_rating`, `url_rating`, `first_seen`, `last_seen`
- Schedule daily/weekly backlink syncs
- **Unlocks:** Backlink Quality Decline (1 detector)

**Task 3.6: Integrate PageSpeed Insights API**
- Sign up for PageSpeed Insights API key
- Create `core_web_vitals` table with:
  - `page_url`, `lcp`, `fid`, `cls`, `ttfb`
  - `mobile_score`, `desktop_score`
- Schedule weekly performance audits for top pages
- **Unlocks:** Core Web Vitals Failing (1 detector)

**Task 3.7: Add Schema Markup Detection**
- Implement schema.org markup detection in crawler
- Create `schema_markup` table with:
  - `page_url`, `schema_types`, `validation_errors`
- Track schema coverage and errors
- **Unlocks:** Schema Markup Gaps (1 detector)

---

### 💰 Phase 4: Google Ads API Enhancement (Unlocks 10 detectors)

**Task 4.1: Add Quality Score Metrics**
- Update Google Ads sync to fetch quality scores
- Add `quality_score` (integer 1-10) column to `daily_entity_metrics`
- Add `quality_score_components` (JSON) for detailed breakdown
- **Unlocks:** Quality Score Decline (1 detector)

**Task 4.2: Add Impression Share Metrics**
- Add `impression_share` (decimal) column
- Add `lost_impression_share_rank` (decimal) column
- Add `lost_impression_share_budget` (decimal) column
- Update Google Ads sync to capture impression share data
- **Unlocks:** Impression Share Loss (1 detector)

**Task 4.3: Add Device & Geo Dimensions**
- Add `device_type` dimension to ad metrics
- Add `geo_location` (country/region) dimension
- Aggregate ad performance by device/geo
- **Unlocks:** Device/Geo Optimization Gaps (1 detector)

**Task 4.4: Add Ad Schedule Data**
- Add `hour_of_day` dimension to ad metrics
- Add `day_of_week` dimension
- Aggregate performance by time segments
- **Unlocks:** Ad Schedule Optimization (1 detector)

**Task 4.5: Add Search Term Reports**
- Create `search_terms` table with:
  - `search_term`, `campaign_id`, `clicks`, `conversions`, `cost`
  - `match_type`, `is_negative_keyword`
- Sync daily search term performance
- **Unlocks:** Negative Keyword Opportunities (1 detector)

**Task 4.6: Add Auction Insights Data**
- Enable Auction Insights API access
- Create `auction_insights` table with:
  - `competitor_domain`, `impression_share`, `overlap_rate`
  - `position_above_rate`, `top_of_page_rate`
- **Unlocks:** Competitor Activity Alerts (1 detector)

**Task 4.7: Add Creative & Landing Page Tracking**
- Add `creative_id` dimension to ad metrics
- Add `landing_page_url` dimension
- Add `ad_copy_text` for tracking variations
- Track creative performance over time
- **Unlocks:** Creative Fatigue, Landing Page Relevance Gap, Ad Retargeting Gap (3 detectors)

**Task 4.8: Add Audience Saturation Data**
- Add `audience_id` dimension
- Add `frequency` (average impressions per user)
- Track audience reach and saturation
- **Unlocks:** Audience Saturation (1 detector)

---

### ✍️ Phase 5: Content Intelligence (Unlocks 9 detectors)

**Task 5.1: Add Content Publishing Metadata**
- Add `content_type` (string) column: blog, video, infographic, ebook, etc.
- Add `publish_date` (date) column
- Add `last_update_date` (date) column
- Add `author` (string) column
- Add `word_count` (integer) column
- Implement content metadata extraction/API
- **Unlocks:** Publishing Volume Gap, Republishing Opportunities (2 detectors)

**Task 5.2: Add Content Topic/Taxonomy**
- Add `topic_tags` (array) column
- Add `content_pillar` (string) column
- Add `target_audience` (string) column
- Implement topic classification (manual or AI-based)
- **Unlocks:** Topic Gap Analysis, Content Pillar Opportunities (2 detectors)

**Task 5.3: Add Content Format Tracking**
- Add `content_format` dimension (text, video, podcast, infographic)
- Add `content_length_bucket` (short/medium/long)
- Track format performance separately
- **Unlocks:** Content Format Winners (1 detector)

**Task 5.4: Add Engagement Depth Metrics**
- Add `engagement_rate` column (likes, shares, comments)
- Add `dwell_time` column (already mentioned in Phase 2)
- Add `scroll_depth` column
- Add `social_shares` column
- **Unlocks:** Engagement Rate Decline (1 detector)

**Task 5.5: Add Lead Attribution to Content**
- Link content views to lead generation events
- Add `leads_generated` column to content metrics
- Add `lead_source_content_id` to leads table
- **Unlocks:** Content-to-Lead Attribution (1 detector)

**Task 5.6: Add Distribution Channel Tracking**
- Add `distribution_channels` (array) column
- Track where content is shared/promoted
- Add `syndication_partner` for republished content
- Add performance by distribution channel
- **Unlocks:** Content Distribution Gap (1 detector)

---

### 🚦 Phase 6: Attribution & Traffic Intelligence (Unlocks 9 detectors)

**Task 6.1: Implement Multi-Touch Attribution**
- Create `attribution_paths` table with:
  - `user_id`, `touchpoint_sequence`, `conversion_id`
  - `touchpoint_source`, `touchpoint_medium`, `touchpoint_timestamp`
- Implement attribution models: first-touch, last-touch, linear, time-decay, position-based
- Store attribution weights per touchpoint
- **Unlocks:** Multi-Touch Path Issues, Attribution Model Comparison (2 detectors)

**Task 6.2: Add CAC by Channel Calculation**
- Calculate CAC per marketing channel
- Add `channel_cac` aggregation logic
- Add `new_customers_by_channel` tracking
- Store in dedicated aggregation or column
- **Unlocks:** CAC by Channel (1 detector)

**Task 6.3: Add Cross-Device Journey Tracking**
- Implement User-ID tracking across devices
- Create `cross_device_journeys` table with:
  - `user_id`, `device_sequence`, `conversion_device`
- Track device switching patterns
- **Unlocks:** Cross-Device Journey Issues (1 detector)

**Task 6.4: Enhance Traffic Source Tracking**
- Add `source_medium_combination` dimension
- Add `is_returning_traffic` flag
- Add `traffic_source_tier` (primary/secondary/tertiary)
- **Unlocks:** Traffic Source Disappearance, Channel Dependency Risk (2 detectors)

**Task 6.5: Add Traffic Quality Scoring**
- Add `bounce_rate` column to traffic metrics
- Add `pages_per_session` column
- Add `avg_session_duration` column
- Add `conversion_rate_by_source` calculation
- Create traffic quality score algorithm
- **Unlocks:** Traffic Quality by Source, Channel Mix Optimization (3 detectors)

---

### 🏗️ Phase 7: System Monitoring Infrastructure (Unlocks 15 detectors)

**Task 7.1: Create Sync Status Tracking**
- Create `sync_status` table in Firestore with:
  - `data_source`, `last_sync_time`, `sync_status`, `error_message`
  - `records_synced`, `sync_duration_ms`
- Update all sync routes to log status
- **Unlocks:** Data Source Disconnection, Data Freshness Issues (2 detectors)

**Task 7.2: Create Error Logging System**
- Create `error_logs` table with:
  - `error_type`, `detector_id`, `timestamp`, `error_message`
  - `affected_organization`, `stack_trace`
- Log all detector errors centrally
- **Unlocks:** Metric Calculation Errors (1 detector)

**Task 7.3: Add BigQuery Cost Monitoring**
- Integrate BigQuery Billing API
- Create `bigquery_usage` table with:
  - `query_date`, `bytes_processed`, `cost`, `query_type`
- Track daily/weekly costs
- **Unlocks:** BigQuery Cost Spike (1 detector)

**Task 7.4: Add API Rate Limit Tracking**
- Create `api_usage` table with:
  - `api_name`, `requests_made`, `rate_limit`, `timestamp`
- Track usage for all external APIs (Google Ads, ActiveCampaign, etc.)
- **Unlocks:** API Rate Limit Approaching (1 detector)

**Task 7.5: Add Schema Version Tracking**
- Create `schema_versions` table with:
  - `table_name`, `schema_json`, `version`, `changed_at`
- Track schema changes over time
- Implement automated schema diff detection
- **Unlocks:** Schema Drift Detection (1 detector)

**Task 7.6: Add Data Quality Metrics**
- Implement data quality checks:
  - Null rate by column
  - Duplicate record detection
  - Outlier detection
  - Data type validation
- Create `data_quality_metrics` table
- **Unlocks:** Data Quality Score, Duplicate Data Detection, Missing Data Gaps (3 detectors)

**Task 7.7: Add Entity Mapping Quality Tracking**
- Create `entity_mapping_quality` table with:
  - `canonical_entity_id`, `confidence_score`, `source_count`
  - `last_validated`, `has_conflicts`
- Track entity resolution confidence
- **Unlocks:** Entity Mapping Quality Decline (1 detector)

**Task 7.8: Create Opportunity Interaction Tracking**
- Create `opportunity_interactions` table with:
  - `opportunity_id`, `user_id`, `action_type`, `timestamp`
  - Actions: viewed, dismissed, resolved, acted_on, false_positive
- Track user engagement with opportunities
- **Unlocks:** Alert Fatigue, False Positive Rate, Opportunity Resolution (3 detectors)

**Task 7.9: Add Detector Performance Metrics**
- Create `detector_executions` table with:
  - `detector_id`, `execution_time_ms`, `opportunities_found`
  - `errors_count`, `timestamp`, `organization_id`
- Log every detector execution
- **Unlocks:** Detector Performance Monitoring, Cross-Detector Correlation (2 detectors)

---

### 📈 Phase 8: SQL Query Refinement (Unlocks remaining detectors)

**Task 8.1: Fix Ambiguous Column SQL Errors**
- Fix remaining detectors with "Column name X is ambiguous" errors
- Add proper table aliases (m., e.) throughout queries
- Test all queries against actual schema
- **Unlocks:** A/B Test Opportunities, several traffic/content detectors

**Task 8.2: Fix Multi-Timeframe Detector Syntax**
- Fix `paid_campaigns_multitimeframe` CTE syntax error
- Fix `declining_performers_multitimeframe` if needed
- Validate all CTE-based queries
- **Unlocks:** 2-3 multi-timeframe detectors

**Task 8.3: Add Missing Entity Name Support**
- Decide on entity naming strategy:
  - Option A: Add `entity_name` column to `entity_map` table
  - Option B: Use `entity_id` as display name
  - Option C: Create computed name from metadata
- Update all queries to use consistent entity identification
- **Unlocks:** Better UX across all detectors

**Task 8.4: Test All 117 Detectors with Real Data**
- Run each detector individually
- Document any remaining SQL errors
- Fix query syntax issues
- Validate opportunity generation
- **Unlocks:** Ensures all detectors truly operational

---

## 📋 ACTIONABLE TASK CHECKLIST

Copy this checklist to start implementation:

### Core Revenue (11 detectors) - PRIORITY 1
- [ ] Task 1.1: Add MRR/ARR columns → Stripe sync update
- [ ] Task 1.2: Add transaction/refund columns → Payment sync update  
- [ ] Task 1.3: Add LTV/CAC columns → Calculation logic
- [ ] Task 1.4: Add cohort tracking → Customer lifecycle tracking
- [ ] Task 1.5: Add customer revenue details → Aggregation tables

### Enhanced Analytics (8 detectors) - PRIORITY 2
- [x] Task 2.1: Add device dimension → ✅ DONE (GA4 sync updated)
- [x] Task 2.2: Add page performance metrics → ✅ DONE (dwell_time, scroll_depth added)
- [x] Task 2.3: Add funnel events → ✅ DONE (add_to_cart, checkout, purchase)
- [ ] Task 2.4: ETL aggregation → Need to aggregate device/performance data to page level
- [ ] Task 2.5: Add CTA/engagement tracking → Event tracking

**Status:** Data captured in Firestore & BigQuery, needs ETL aggregation for remaining detectors

### SEO Tools (1 remaining detector) - PRIORITY 3
- [x] Task 3.1: Add content metadata → ✅ DONE (publish_date, content_type, word_count)
- [x] Task 3.2: Technical SEO data → ✅ DONE (DataForSEO onpage_score, broken_links)
- [x] Task 3.3: Internal link data → ✅ DONE (DataForSEO broken_links_count)
- [x] Task 3.4: Backlink data → ✅ DONE (DataForSEO backlinks, referring_domains)
- [x] Task 3.5: PageSpeed/Core Web Vitals → ✅ DONE (DataForSEO LCP, FID, CLS)
- [x] Task 3.6: Schema markup → ✅ DONE (DataForSEO has_schema_markup)
- [x] Task 3.7: Rank tracking → ✅ DONE (DataForSEO position, position_change)
- [ ] Task 3.8: Featured snippets → Search Console enhancement (for 1 remaining detector)

**Status:** 11/12 operational (92%) - DataForSEO integration unlocked everything!

### Google Ads (10 detectors) - PRIORITY 4
- [ ] Task 4.1: Quality scores → Ads API enhancement
- [ ] Task 4.2: Impression share → Ads API enhancement
- [ ] Task 4.3: Device/geo dimensions → Ads API breakdown
- [ ] Task 4.4: Ad schedule data → Time-based reporting
- [ ] Task 4.5: Search terms → Search term reports
- [ ] Task 4.6: Auction insights → Competitive data
- [ ] Task 4.7: Creative tracking → Ad variation tracking
- [ ] Task 4.8: Audience data → Audience performance

### Content Intelligence (4 remaining detectors) - PRIORITY 5
- [x] Task 5.1: Publishing metadata → ✅ DONE (Phase 2)
- [x] Task 5.2: Format tracking → ✅ DONE (content_type inference)
- [x] Task 5.3: Engagement depth → ✅ DONE (dwell_time, engagement_rate)
- [ ] Task 5.4: Topic taxonomy → Classification system (for Topic Gap)
- [ ] Task 5.5: Lead attribution → Content-to-lead linking (for Attribution detector)
- [ ] Task 5.6: Distribution channels → Multi-channel tracking (for Distribution Gap)

**Status:** 7/11 operational (64%) - Phase 2 data unlocked 5 detectors!

### Attribution & Traffic (9 detectors) - PRIORITY 6
- [ ] Task 6.1: Multi-touch attribution → Attribution engine
- [ ] Task 6.2: CAC by channel → Channel economics
- [ ] Task 6.3: Cross-device tracking → User-ID implementation
- [ ] Task 6.4: Enhanced source tracking → Source intelligence
- [ ] Task 6.5: Traffic quality scoring → Quality algorithms

### System Monitoring (15 detectors) - PRIORITY 7
- [ ] Task 7.1: Sync status tracking → Monitoring dashboard
- [ ] Task 7.2: Error logging system → Centralized errors
- [ ] Task 7.3: BigQuery cost monitoring → Billing API
- [ ] Task 7.4: API rate limits → Usage tracking
- [ ] Task 7.5: Schema versioning → Version control
- [ ] Task 7.6: Data quality metrics → Quality scoring
- [ ] Task 7.7: Entity mapping quality → Confidence tracking
- [ ] Task 7.8: Opportunity interactions → User engagement
- [ ] Task 7.9: Detector performance → Execution metrics

### SQL Refinement (Ongoing)
- [ ] Task 8.1: Fix ambiguous column errors → Query cleanup
- [ ] Task 8.2: Fix multi-timeframe syntax → CTE validation
- [ ] Task 8.3: Entity naming strategy → Schema decision
- [ ] Task 8.4: Test all 117 detectors → Validation suite

---

## 🚀 Quick Start: Path to 85% Operational

**Current Status:** 59/117 operational (50%) 🎊

**To reach 70% (15 more detectors):**
1. **ETL aggregation for device/performance data** (Task 2.1-2.2) → +5-8 detectors
2. **Google Ads enhanced metrics** (Task 4.1-4.2) → +3-5 detectors
3. **Traffic quality scoring** (Task 6.5) → +2-3 detectors

**To reach 85% (20 more after that):**
4. **Add 5 revenue columns** (Task 1.1, 1.2, 1.3) → +11 detectors
5. **Attribution engine** (Task 6.1-6.2) → +5 detectors
6. **Content taxonomy** (Task 5.4) → +2 detectors
7. **SQL refinement** (Task 8.1) → +2-3 detectors

**Total Path: 50% → 70% → 85%** (100/117 operational)

---

## 📊 Estimated Effort by Phase

| Phase | Tasks | Detectors | Effort | Timeline |
|-------|-------|-----------|--------|----------|
| Phase 1: Core Revenue | 5 | 11 | High | 2-4 weeks |
| Phase 2: Enhanced Analytics | 4 | 8 | Medium | 1-2 weeks |
| Phase 3: SEO Tools | 7 | 8 | High | 4-6 weeks |
| Phase 4: Google Ads | 8 | 10 | High | 3-5 weeks |
| Phase 5: Content | 6 | 9 | Medium | 2-4 weeks |
| Phase 6: Attribution | 5 | 9 | High | 3-5 weeks |
| Phase 7: System | 9 | 15 | Medium | 2-3 weeks |
| Phase 8: SQL | 4 | All | Low | 1 week |
| **TOTAL** | **48** | **70** | **Mixed** | **18-30 weeks** |

Note: Many tasks can be done in parallel. Actual timeline depends on team size and priorities.

---

## 🎯 Recommended Approach

**Incremental Activation:**
1. Start with **Phase 1 (Revenue)** - highest business value
2. Do **Phase 2 (Analytics)** in parallel - relatively easy
3. Tackle **Phase 8 (SQL)** continuously as you build
4. Add **Phase 3-7** based on business priorities

**Benefits of This Approach:**
- Unlock detectors incrementally
- See value quickly (11-19 detectors in first month)
- Validate infrastructure changes before moving on
- Adjust priorities based on what works

---

**Ready to start? Pick a phase and begin! Each task is well-defined and actionable.** 🚀
