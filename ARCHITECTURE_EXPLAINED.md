# Data Architecture - Why Firestore → BigQuery → Firestore?

**Your Question:** Why store in Firestore, then BigQuery, then back to Firestore?

---

## 🏗️ Current Architecture

```
Source APIs (GA4, Stripe, ActiveCampaign)
    ↓
Firestore (raw data storage)
    ↓
BigQuery (analytics warehouse) 
    ↓
Scout AI Detectors (SQL queries)
    ↓
Firestore (opportunities)
    ↓
Frontend App (display)
```

---

## 🤔 Why Not Just Use Firestore?

### Problem: Firestore Limitations for Analytics

**1. No SQL / Complex Queries**
```javascript
// What we NEED to do (in BigQuery):
SELECT 
  page,
  AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), 30) THEN cvr END) as recent_cvr,
  AVG(CASE WHEN date < DATE_SUB(CURRENT_DATE(), 30) THEN cvr END) as baseline_cvr,
  PERCENTILE_CONT(cvr, 0.9) as p90_cvr
FROM daily_metrics
WHERE sessions > 100
GROUP BY page
HAVING recent_cvr < baseline_cvr * 0.7
```

```javascript
// What Firestore forces you to do:
// 1. Query ALL documents (no aggregation)
const docs = await db.collection('metrics').get(); // Gets 100K+ docs

// 2. Load into memory and aggregate in JavaScript
const pages = {};
docs.forEach(doc => {
  const data = doc.data();
  if (!pages[data.page]) pages[data.page] = {recent: [], baseline: []};
  // ... manual date filtering and grouping
});

// 3. Calculate percentiles, averages, trends in code
// This is SLOW, memory-intensive, and error-prone
```

**2. Scale Issues**

Our data:
- 117,740 keyword rows (30 days)
- 45,793 page rows  
- 12,990 campaign rows
- **176,523 total rows**

Firestore charges per document read. Running 117 detectors would mean:
- Each detector reads 10K-100K documents
- 117 detectors × 50K avg reads = **5.9 MILLION reads per run**
- Cost: $0.06 per 100K reads = **$3.54 per detector run**
- Daily runs = **$106/month just in Firestore reads**

BigQuery:
- Flat $5/TB queried
- All 117 detectors = ~50 queries = **$0.50 per run**
- Daily runs = **$15/month**

**3. Performance**

Time to run all detectors:
- **Firestore approach:** 5-10 minutes (loading millions of docs into memory)
- **BigQuery approach:** 30-60 seconds (parallel SQL execution)

---

## 🤔 Why Not Just Use BigQuery?

### Problem: BigQuery Limitations for Operational Data

**1. Not Real-Time**
```
User triggers "Sync GA4 Data" button
    ↓
Wait 30 seconds for BigQuery insert
    ↓
Wait for BigQuery cache to clear
    ↓
Query to see new data
    ↓
Total: 1-2 minutes
```

vs Firestore:
```
User triggers "Sync GA4 Data"
    ↓
Write to Firestore
    ↓
Real-time listener updates UI
    ↓
Total: 1-2 seconds
```

**2. No Document Structure / Relationships**
```javascript
// Easy in Firestore:
const org = await db.collection('organizations').doc(orgId).get();
const users = await org.ref.collection('users').get();
const settings = org.data().settings;

// Painful in BigQuery:
// Need separate tables, complex JOINs, denormalization
```

**3. Frontend Can't Query Directly**
- Firestore: Direct access from Next.js (with security rules)
- BigQuery: Requires backend API, service accounts, complex auth

**4. Expensive for Small Queries**
- Fetching 1 opportunity: Firestore = 1 read ($0.000000036)
- Fetching 1 opportunity: BigQuery = 10KB minimum ($0.000005)

---

## ✅ The Right Architecture (What We're Building)

### Firestore = Operational Database
**Use For:**
- ✅ Raw data from APIs (fast writes)
- ✅ User settings, org config
- ✅ Real-time updates
- ✅ Small, frequent reads (opportunities, dashboards)
- ✅ Document relationships

**Examples:**
- `ga_device_metrics` - Raw GA4 data as it arrives
- `opportunities` - Detector results for app to display
- `organizations` - User settings and config

### BigQuery = Analytics Warehouse  
**Use For:**
- ✅ Complex SQL analytics
- ✅ Time-series aggregations (30/60/90 day trends)
- ✅ Cross-dataset JOINs
- ✅ Percentile calculations
- ✅ Large-scale pattern detection

**Examples:**
- `daily_entity_metrics` - Aggregated daily metrics by entity
- `entity_map` - Canonical entity IDs and mappings
- Historical data for trend analysis

### The Flow (Fixed)

```
1. API Sync (Real-Time)
   GA4 API → Firestore (ga_device_metrics, ga_page_performance)
   [Fast: Users see data immediately]

2. Daily ETL (Scheduled)
   Firestore → BigQuery (daily_entity_metrics)
   [Aggregates: Roll up to page-level daily metrics]
   [Runs: Once per day at night]

3. Detector Execution (On-Demand)
   BigQuery SQL → Find patterns
   [Fast: 30-60 seconds for all 117 detectors]
   
4. Store Results (Real-Time)
   Opportunities → Firestore
   [Fast: Users see insights immediately]

5. Frontend Display (Real-Time)
   Firestore → Next.js App
   [Fast: Real-time listeners, instant updates]
```

---

## 🚨 The ACTUAL Problem

The architecture is sound. The problem is **we're not running the ETL properly**.

**What's Broken:**
- ❌ Email data never reaches BigQuery (2 rows instead of 1000s)
- ❌ Device metrics in Firestore but not aggregated to BigQuery
- ❌ Funnel events in Firestore but not aggregated
- ❌ Traffic sources never created as entities

**The Fix:**
Build proper ETL that:
1. ✅ Runs daily (Cloud Scheduler)
2. ✅ Reads from Firestore collections
3. ✅ Aggregates to page/campaign/email level
4. ✅ Writes to BigQuery `daily_entity_metrics`
5. ✅ Enables detectors to find opportunities

---

## 📊 Real-World Analogy

Think of it like a retail business:

**Firestore = Cash Registers**
- Records every transaction as it happens
- Fast, real-time
- Cashiers can look up customer info instantly
- But can't answer "What was our average sale by region last quarter?"

**BigQuery = Data Warehouse**
- Transactions copied nightly from registers
- Runs complex reports: trends, forecasts, anomalies
- Slow to update (batch processing)
- But answers complex questions in seconds

**Opportunities (back in Firestore) = Actionable Insights**
- "Store #42's sales dropped 30% this week"
- Manager sees this on their dashboard (Firestore)
- Generated by analyzing warehouse data (BigQuery)

---

## 💡 Could We Simplify?

### Option 1: Firestore Only?
**Pros:** Simpler architecture  
**Cons:** 
- 10x slower detector execution
- 5x more expensive
- Can't do complex SQL analytics
- Manual aggregation in code (error-prone)

**Verdict:** ❌ Doesn't scale past ~10K rows

### Option 2: BigQuery Only?
**Pros:** Powerful analytics  
**Cons:**
- No real-time updates for users
- Frontend can't query directly
- Expensive for small reads
- No document structure

**Verdict:** ❌ Poor user experience

### Option 3: Hybrid (Current)
**Pros:**
- Fast writes (Firestore)
- Fast reads for UI (Firestore)
- Powerful analytics (BigQuery)
- Cost-effective at scale

**Cons:**
- More complex (2 databases)
- ETL pipeline needed
- Data can be out of sync

**Verdict:** ✅ Industry standard for good reason

---

## 🎯 Bottom Line

**The architecture is correct.**  
**The problem is execution:** We built the detectors before building the ETL to populate BigQuery properly.

**What needs to happen:**
1. Fix ETL (aggregate Firestore → BigQuery daily)
2. Ensure all source data flows properly
3. Then detectors will work as designed

**Think of it as:**
- Firestore = Fast operational database (shopping cart, user sessions)
- BigQuery = Analytics warehouse (business intelligence, pattern detection)
- Both needed, different purposes

The architecture isn't the problem. **The broken ETL is the problem.**
