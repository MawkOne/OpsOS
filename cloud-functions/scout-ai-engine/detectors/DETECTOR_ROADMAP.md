# Scout AI Detector Implementation Roadmap

**Last Updated:** January 27, 2026  
**Progress:** 117 of 117 detectors built (100%) | 47 operational (40%)

---

## 📊 Overall Status

| Metric | Count | % |
|--------|-------|---|
| **Detectors Built** | 117/117 | 100% |
| **Fully Operational** | 47/117 | 40% |
| **Awaiting Data** | 70/117 | 60% |

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

## ✍️ Content (11/11 built, 2/11 operational)

| # | Detector | Code | Data | Status | Blocks |
|---|----------|------|------|--------|--------|
| 1 | Content Decay | ✅ | ✅ | 🟢 | None |
| 2 | Content Decay (Multi-Timeframe) | ✅ | ✅ | 🟢 | None |
| 3 | Publishing Volume Gap | ✅ | ❌ | 🟡 | Need content publish tracking |
| 4 | Content-to-Lead Attribution | ✅ | ❌ | 🟡 | Need lead source attribution |
| 5 | Topic Gap Analysis | ✅ | ❌ | 🟡 | Need content taxonomy/topics |
| 6 | Content Format Winners | ✅ | ❌ | 🟡 | Need content format tracking |
| 7 | Engagement Rate Decline | ✅ | ❌ | 🟡 | Need engagement metrics by content |
| 8 | Dwell Time Decline | ✅ | ❌ | 🟡 | Need `dwell_time` / `avg_time_on_page` |
| 9 | Content Pillar Opportunities | ✅ | ❌ | 🟡 | Need content pillar/cluster tracking |
| 10 | Republishing Opportunities | ✅ | ❌ | 🟡 | Need content age + performance history |
| 11 | Content Distribution Gap | ✅ | ❌ | 🟡 | Need distribution channel tracking |

**Category Status:** 🟡 **18% Operational**

**Required Data Additions:**
- Content metadata:
  - `content_type` (blog, video, infographic, etc.)
  - `publish_date`, `last_update_date`
  - `topic_tags` / `content_pillar`
  - `author`, `word_count`
- Engagement metrics:
  - `dwell_time` / `avg_time_on_page`
  - `scroll_depth`
  - `shares`, `comments`
- Distribution tracking:
  - `distribution_channels` (email, social, organic, etc.)
  - `syndication_performance`

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
