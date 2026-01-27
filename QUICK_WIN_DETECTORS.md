# Quick Win Detectors - Extend Existing Integrations

**Goal:** Unlock 25-30 more detectors by extending integrations we already have

**Current Status:** 59/117 operational (50%)  
**Target:** 85-90/117 operational (75%+)

---

## 🎯 Category 1: GA4 Extensions (HIGH PRIORITY - 8 detectors)

**Integration:** Google Analytics 4 (already connected & syncing)

### What We Need to Add:

| # | Detector | What to Extend | Difficulty | Impact |
|---|----------|----------------|------------|--------|
| 1 | **Mobile vs Desktop CVR Gap** | Add `device_type` to BigQuery aggregation (already in Firestore!) | ⭐ Easy | HIGH |
| 2 | **Page Speed Decline** | Add `page_load_time` from GA4 or PageSpeed API | ⭐⭐ Medium | HIGH |
| 3 | **Conversion Funnel Drop-Off** | Aggregate funnel events we're already capturing | ⭐ Easy | HIGH |
| 4 | **CTA Performance Analysis** | Track click events by element_id/text | ⭐⭐ Medium | MEDIUM |
| 5 | **Video Engagement Gap** | Track video_start, video_progress, video_complete events | ⭐⭐ Medium | MEDIUM |
| 6 | **Traffic Quality by Source** | Calculate quality score by source (already have data) | ⭐ Easy | HIGH |
| 7 | **Channel Mix Optimization** | SQL refinement on existing data | ⭐ Easy | MEDIUM |
| 8 | **Revenue by Channel Attribution** | SQL refinement + revenue linkage | ⭐⭐ Medium | HIGH |

**Implementation Plan:**

```typescript
// 1. Update GA4 sync to capture device dimension
// app/src/app/api/google-analytics/sync/route.ts
const deviceReport = await runReport({
  dimensions: ['deviceCategory', 'date'],
  metrics: ['sessions', 'conversions', 'totalRevenue']
});

// 2. Add page_load_time metric
const performanceReport = await runReport({
  dimensions: ['pagePath', 'date'],
  metrics: ['pageLoadTime', 'serverResponseTime']
});

// 3. Extend event tracking
const ctaReport = await runReport({
  dimensions: ['eventName', 'linkUrl', 'linkText'],
  metrics: ['eventCount']
});
```

**BigQuery Columns to Add:**
- None! Just aggregate existing Firestore data differently
- Optional: `page_load_time`, `server_response_time`

**Estimated Time:** 1-2 days  
**Unlocks:** 8 detectors (+7% progress)

---

## 💰 Category 2: Stripe Extensions (HIGH PRIORITY - 11 detectors)

**Integration:** Stripe (already connected)

### What We Need to Add:

| # | Detector | What to Extend | Difficulty | Impact |
|---|----------|----------------|------------|--------|
| 1 | **MRR/ARR Tracking** | Add `mrr` calculation from subscriptions | ⭐⭐ Medium | HIGH |
| 2 | **Transaction/Refund Anomalies** | Add `transactions`, `refund_count`, `refunds` | ⭐ Easy | HIGH |
| 3 | **Unit Economics Dashboard** | Calculate `ltv`, `cac`, `gross_margin` | ⭐⭐⭐ Hard | HIGH |
| 4 | **Cohort Performance Trends** | Add `first_purchase_date` from customer.created | ⭐ Easy | HIGH |
| 5 | **Customer Churn Spike** | Track subscription cancellations as churn | ⭐⭐ Medium | HIGH |
| 6 | **LTV:CAC Ratio Decline** | Calculate LTV & CAC metrics | ⭐⭐⭐ Hard | HIGH |
| 7 | **Revenue Concentration Risk** | Aggregate revenue by customer_id | ⭐ Easy | MEDIUM |
| 8 | **Pricing Opportunity Analysis** | Track plan/price data from subscriptions | ⭐⭐ Medium | MEDIUM |
| 9 | **Expansion Revenue Gap** | Track upgrades/downgrades from subscription history | ⭐⭐ Medium | HIGH |
| 10 | **Growth Velocity Trends** | SQL refinement on existing revenue data | ⭐ Easy | MEDIUM |
| 11 | **Forecast Deviation** | Build simple forecast model based on trends | ⭐⭐ Medium | MEDIUM |

**Implementation Plan:**

```typescript
// app/src/app/api/stripe/sync/route.ts

// 1. Calculate MRR from active subscriptions
const subscriptions = await stripe.subscriptions.list({
  status: 'active',
  expand: ['data.customer']
});

let mrr = 0;
subscriptions.data.forEach(sub => {
  const amount = sub.items.data[0].price.unit_amount / 100;
  const interval = sub.items.data[0].price.recurring.interval;
  
  // Normalize to monthly
  if (interval === 'month') mrr += amount;
  if (interval === 'year') mrr += amount / 12;
});

// 2. Track refunds
const refunds = await stripe.refunds.list({
  created: { gte: startDate }
});

// 3. Calculate customer metrics
const customer_first_purchase = charges
  .filter(c => c.customer === customerId)
  .sort((a, b) => a.created - b.created)[0]
  .created;
```

**BigQuery Columns to Add:**
- `mrr` (FLOAT64) - Monthly Recurring Revenue
- `arr` (FLOAT64) - Annual Recurring Revenue  
- `transactions` (INT64) - Transaction count
- `refund_count` (INT64) - Number of refunds
- `refunds` (FLOAT64) - Refund amount
- `first_purchase_date` (DATE) - Customer cohort date
- `churn_date` (DATE) - When customer churned
- `customer_ltv` (FLOAT64) - Lifetime value
- `plan_name` (STRING) - Subscription plan
- `is_expansion` (BOOL) - Upgrade/expansion flag

**Estimated Time:** 3-4 days  
**Unlocks:** 11 detectors (+9% progress)

---

## 🔍 Category 3: DataForSEO/Search Console Extensions (MEDIUM PRIORITY - 1 detector)

**Integration:** DataForSEO (already connected), Google Search Console (partially connected)

### What We Need to Add:

| # | Detector | What to Extend | Difficulty | Impact |
|---|----------|----------------|------------|--------|
| 1 | **Featured Snippet Opportunities** | Get snippet status from Search Console API | ⭐⭐ Medium | MEDIUM |

**Implementation Plan:**

```typescript
// app/src/app/api/google-analytics/search-console/route.ts

// Already have Search Console access via GA4 connection
// Just need to query for featured snippets

const snippetData = await searchConsole.searchanalytics.query({
  siteUrl: siteUrl,
  resource: {
    startDate: startDate,
    endDate: endDate,
    dimensions: ['query', 'page'],
    dimensionFilterGroups: [{
      filters: [{
        dimension: 'searchAppearance',
        expression: 'RICH_RESULT' // Featured snippets show as rich results
      }]
    }]
  }
});
```

**BigQuery Columns to Add:**
- `has_featured_snippet` (BOOL)
- `snippet_type` (STRING) - paragraph, list, table, etc.
- `snippet_position` (INT64)

**Estimated Time:** 0.5 days  
**Unlocks:** 1 detector (+1% progress)

---

## 📱 Category 4: Google Ads API Integration (MEDIUM PRIORITY - 10 detectors)

**Integration:** NEW - Google Ads API (would need to add)

### What We Need to Add:

| # | Detector | What to Extend | Difficulty | Impact |
|---|----------|----------------|------------|--------|
| 1 | **Quality Score Decline** | Google Ads API - quality_score metric | ⭐⭐ Medium | HIGH |
| 2 | **Impression Share Loss** | Google Ads API - impression share metrics | ⭐⭐ Medium | HIGH |
| 3 | **Ad Schedule Optimization** | Google Ads API - hour-of-day breakdown | ⭐⭐ Medium | MEDIUM |
| 4 | **Negative Keyword Opportunities** | Google Ads API - search term reports | ⭐⭐ Medium | HIGH |
| 5 | **Competitor Activity Alerts** | Google Ads API - auction insights | ⭐⭐⭐ Hard | MEDIUM |
| 6 | **Landing Page Relevance Gap** | Link Ads data to page performance | ⭐⭐ Medium | MEDIUM |
| 7 | **Creative Fatigue** | Track ad copy/creative performance over time | ⭐⭐ Medium | MEDIUM |
| 8 | **Device/Geo Optimization Gaps** | Google Ads API - device/geo dimensions | ⭐ Easy | MEDIUM |
| 9 | **Ad Retargeting Gap** | Track remarketing campaigns | ⭐⭐ Medium | LOW |
| 10 | **Audience Saturation** | Frequency cap & audience size tracking | ⭐⭐⭐ Hard | LOW |

**Implementation Plan:**

```typescript
// app/src/app/api/google-ads/sync/route.ts (NEW FILE)

import { GoogleAdsApi } from 'google-ads-api';

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
});

// Query for quality scores
const query = `
  SELECT
    campaign.id,
    ad_group.id,
    ad_group_criterion.keyword.text,
    metrics.quality_score,
    metrics.search_impression_share,
    metrics.search_rank_lost_impression_share,
    segments.hour,
    segments.device
  FROM keyword_view
  WHERE segments.date DURING LAST_30_DAYS
`;

const results = await customer.query(query);
```

**BigQuery Columns to Add:**
- `quality_score` (FLOAT64)
- `impression_share` (FLOAT64)
- `impression_share_lost_rank` (FLOAT64)
- `impression_share_lost_budget` (FLOAT64)
- `hour_of_day` (INT64)
- `ad_creative_id` (STRING)
- `ad_copy` (STRING)
- `search_terms` (STRING array)

**Estimated Time:** 4-5 days (includes OAuth setup)  
**Unlocks:** 10 detectors (+9% progress)

---

## 📊 Category 5: SQL Refinement (LOW PRIORITY - 5 detectors)

**Integration:** None - just fix existing SQL

### What We Need to Fix:

| # | Detector | What to Fix | Difficulty | Impact |
|---|----------|-------------|------------|--------|
| 1 | **A/B Test Opportunities** | Fix column ambiguity in JOIN | ⭐ Easy | LOW |
| 2 | **Traffic Source Disappearance** | Fix missing table alias | ⭐ Easy | MEDIUM |
| 3 | **Channel Dependency Risk** | Validate concentration calculation | ⭐ Easy | MEDIUM |
| 4 | **Data Freshness Issues** | Fix date comparison logic | ⭐ Easy | LOW |
| 5 | **Duplicate Data Detection** | Add proper GROUP BY | ⭐ Easy | LOW |

**Estimated Time:** 0.5 days  
**Unlocks:** 5 detectors (+4% progress)

---

## 📈 Category 6: Advanced Attribution (LOW PRIORITY - 3 detectors)

**Integration:** Custom attribution engine (complex)

### What We Need to Build:

| # | Detector | What to Build | Difficulty | Impact |
|---|----------|---------------|------------|--------|
| 1 | **Multi-Touch Path Issues** | Attribution engine with path tracking | ⭐⭐⭐⭐ Very Hard | MEDIUM |
| 2 | **Attribution Model Comparison** | Multiple attribution models | ⭐⭐⭐⭐ Very Hard | MEDIUM |
| 3 | **Cross-Device Journey Issues** | Cross-device user tracking | ⭐⭐⭐⭐ Very Hard | LOW |

**Estimated Time:** 10+ days  
**Unlocks:** 3 detectors (+3% progress)

---

## 📝 Category 7: Content Intelligence (LOW PRIORITY - 4 detectors)

**Integration:** Content taxonomy system (new)

### What We Need to Build:

| # | Detector | What to Build | Difficulty | Impact |
|---|----------|---------------|------------|--------|
| 1 | **Topic Gap Analysis** | Content classification/tagging system | ⭐⭐⭐ Hard | MEDIUM |
| 2 | **Content Pillar Opportunities** | Content cluster mapping | ⭐⭐⭐ Hard | LOW |
| 3 | **Content-to-Lead Attribution** | Lead source tracking | ⭐⭐ Medium | MEDIUM |
| 4 | **Content Distribution Gap** | Distribution channel tracking | ⭐⭐ Medium | LOW |

**Estimated Time:** 5-7 days  
**Unlocks:** 4 detectors (+3% progress)

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### **Sprint 1: GA4 Extensions (1-2 days) → +8 detectors**
- Device aggregation
- Funnel aggregation  
- Quality scoring
- SQL refinements
- **Target: 67/117 (57%)**

### **Sprint 2: Stripe Revenue Extensions (3-4 days) → +11 detectors**
- MRR/ARR calculation
- Transaction/refund tracking
- Cohort tracking
- Churn detection
- Revenue concentration
- **Target: 78/117 (67%)**

### **Sprint 3: SQL Fixes (0.5 days) → +5 detectors**
- Fix ambiguous columns
- Validate queries
- **Target: 83/117 (71%)**

### **Sprint 4: Google Ads API (4-5 days) → +10 detectors**
- OAuth setup
- Quality scores
- Impression share
- Search terms
- Hour-of-day
- **Target: 93/117 (79%)**

### **Sprint 5: Search Console Enhancement (0.5 days) → +1 detector**
- Featured snippet tracking
- **Target: 94/117 (80%)**

---

## 📊 TOTAL POTENTIAL

**Quick Wins (Sprints 1-3):** 24 detectors in ~5 days → **71% operational**  
**Medium Effort (Sprint 4):** 10 detectors in ~5 days → **79% operational**  
**Full Completion:** 35 detectors in ~10 days → **80% operational (94/117)**

**Remaining 23 detectors require:**
- Advanced attribution engine (3 detectors)
- Content taxonomy system (4 detectors)
- System monitoring infrastructure (15 detectors)
- Video/CTA tracking (1 detector)

---

## 🚀 START HERE: Sprint 1 Tasks

**Day 1:**
1. ✅ Add device_type aggregation to ETL
2. ✅ Add funnel event aggregation
3. ✅ Implement 3 device/funnel detectors

**Day 2:**
4. ✅ Add traffic quality scoring
5. ✅ Fix SQL refinement issues
6. ✅ Implement 5 quality/channel detectors

**Deploy & Test:**
- Run all 8 new detectors
- Verify opportunities generated
- **Celebrate hitting 57%!** 🎉
