# OpsOS Data Architecture Issues

**Date:** January 30, 2026  
**Status:** ⚠️ CRITICAL - Multiple redundancies, broken components, inefficient data flow

---

## Overview

The current data architecture has evolved into a complex, multi-layered system with significant inefficiencies, redundancies, and failure points. This document outlines the complete data flow from ingestion to opportunity detection.

---

## Current Architecture: Ingestion → Opportunity Detection

### STEP 1: Data Ingestion (External APIs → Firestore)

#### A. Google Analytics 4
- **Native Export:** GA4 → BigQuery `analytics_301802672` dataset (raw event data)
  - Status: ✅ Active, clean
  - Usage: Raw user event data for deep analysis
  - Cost: Storage costs for all GA4 events
  
- **API Integration:** Vercel API routes → GA4 Data API → Returns to UI
  - Endpoint: `/api/google-analytics/pages`
  - Purpose: Fetch page metrics for UI display
  - Does NOT write to any database

#### B. DataForSEO
- **Vercel API** (`/api/dataforseo/sync`) calls DataForSEO API
- **Writes to Firestore** collections:
  - `dataforseo_pages` (373+ pages)
  - `dataforseo_keywords` (1000 keywords)
  - `dataforseo_backlinks` (backlink data)
  - `dataforseo_referring_domains` (referring domain data)
  - `dataforseo_rank_history` (historical rank data)

**Issues:**
- ❌ Stores ALL crawled pages (373+), even though only 12-140 are needed
- ❌ No cleanup - data accumulates forever
- ❌ Firestore storage costs for unused data
- ❌ Redundant layer (see Step 2)

#### C. ActiveCampaign
- **Unknown sync process** → Firestore `activecampaign_campaigns`
- Status: ❓ Sync mechanism not documented

---

### STEP 2: Firestore → BigQuery Sync (Multiple Competing Processes)

#### A. Firebase Extensions (Auto-sync to `firestore_export` dataset)

**12 Cloud Functions running:**
- `ext-firestore-bigquery-export-dfs-keywords-*`
- `ext-firestore-bigquery-export-dfs-backlinks-*`
- `ext-firestore-bigquery-export-dfs-rank-history-*`
- `ext-firestore-bigquery-export-dfs-refdoms-*`
- (3 functions per collection: setup, init, sync)

**Destination:** BigQuery `firestore_export` dataset
- `dataforseo_keywords_raw_changelog` (raw Firestore mirror)
- `dataforseo_backlinks_raw_changelog` (raw Firestore mirror)
- `dataforseo_rank_history_raw_changelog` (raw Firestore mirror)
- `dataforseo_referring_domains_raw_changelog` (raw Firestore mirror)
- Plus `*_latest` views for each

**Issues:**
- ❌ **COMPLETELY UNUSED** - No code queries these tables
- ❌ **Duplicate storage costs** - Same data in Firestore AND BigQuery
- ❌ **12 Cloud Functions** running constantly for no reason
- ❌ **Waste of money** - Paying for storage, compute, Firestore reads

#### B. Custom ETL Functions → `marketing_ai.daily_entity_metrics`

**1. `daily-rollup-etl` (Python)**
- Reads from Firestore:
  - `activecampaign_campaigns` → entity_type: 'email'
  - `ga_page_performance` → entity_type: 'page'
  - Traffic sources → entity_type: 'traffic_source'
  - Paid campaigns → entity_type: 'campaign'
- Writes to: `marketing_ai.daily_entity_metrics`

**Issues:**
- ⚠️ **Also writes pages** - conflicts with dataforseo-bigquery-sync
- ⚠️ **No deduplication** - Both functions can write same page

**2. `dataforseo-bigquery-sync` (Python)**
- Reads from Firestore:
  - `dataforseo_pages`
  - `dataforseo_keywords`
  - `dataforseo_backlinks`
  - `dataforseo_rank_history`
- **Filters:** ONLY priority pages (if configured)
- Writes to: `marketing_ai.daily_entity_metrics`
  - entity_type: 'page' (with is_priority_page flag)
  - entity_type: 'keyword' (previously, now removed)
  - entity_type: 'domain' (summary metrics)

**Issues:**
- ❌ **One-way sync only** - Deletion in Firestore doesn't delete in BigQuery
- ❌ **No cleanup** - Old data accumulates forever
- ❌ **Non-idempotent** - Running multiple times causes issues
- ❌ **Depends on Firestore** - Extra layer of complexity

**3. `monthly-rollup-etl` (Python)**
- Reads: `marketing_ai.daily_entity_metrics`
- Aggregates: Monthly summaries
- Writes to: `marketing_ai.monthly_entity_metrics`

---

### STEP 3: Scout AI Detectors Query BigQuery

**Query:** `marketing_ai.daily_entity_metrics`

**12+ SEO Detectors** (Python functions in scout-ai-engine):
```sql
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = @org_id
  AND entity_type = 'page'  -- or 'keyword', 'campaign', etc.
  AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
```

**Detectors:**
- detect_core_web_vitals_failing.py (pages)
- detect_schema_markup_gaps.py (pages)
- detect_backlink_quality_decline.py (pages)
- detect_internal_link_opportunities.py (pages)
- detect_seo_rank_drops.py (keywords)
- detect_keyword_cannibalization.py (keywords)
- detect_seo_striking_distance.py (keywords)
- detect_technical_seo_health_score.py (pages)
- detect_content_freshness_decay.py (pages)
- detect_rank_volatility_daily.py (pages)
- + 80+ more detectors across all categories

**Issues:**
- ❌ **Query stale data** - No data freshness validation
- ❌ **No awareness of priority pages** - Removed all filtering logic
- ⚠️ **Keyword detectors fail silently** - No keyword data exists anymore

---

### STEP 4: Scout AI Writes Opportunities (Dual Write - Partially Broken)

**A. BigQuery Write (BROKEN ❌)**
```python
table_ref = bq.dataset('marketing_ai').table('opportunities')
errors = bq.insert_rows_json(table_ref, opportunities, ...)
```

**Issues:**
- ❌ **Schema errors:** JSON fields (evidence, metrics, historical_performance) fail validation
- ❌ **"This field: evidence is not a record"** errors
- ❌ **No opportunities actually saved to BigQuery**

**B. Firestore Write (WORKS ✅)**
```python
for opp in opportunities:
    db.collection('opportunities').document(opp['id']).set(opp)
```

**Status:** ✅ Works correctly, all opportunities saved

**Issues:**
- ⚠️ **Only source of truth** - BigQuery write is broken
- ⚠️ **No deletion logic** - Old opportunities accumulate
- ⚠️ **Manual cleanup required**

---

### STEP 5: UI Displays Opportunities

**Frontend:** `/ai/seo` page
- API Call: `GET /api/opportunities?organizationId=xxx&status=new`
- **Reads from:** Firestore `opportunities` collection (NOT BigQuery)
- Filters: Last 7 days (client-side filter added to hide old data)
- Displays: Opportunity cards in UI

**Issues:**
- ⚠️ **Only reads Firestore** - BigQuery opportunities table is unused
- ⚠️ **Client-side date filtering** - Inefficient, should be database query
- ⚠️ **No pagination** - Limits to 100 opportunities

---

## Problem Summary

### 1. **Three BigQuery Datasets - Why?**

| Dataset | Purpose | Status | Cost Impact |
|---------|---------|--------|-------------|
| `analytics_301802672` | GA4 raw event data | ✅ Used for deep analysis | Reasonable |
| `firestore_export` | Firebase Extension mirrors | ❌ **COMPLETELY UNUSED** | **WASTE** |
| `marketing_ai` | Unified data warehouse | ✅ Used by all detectors | Necessary |

**Recommendation:** Delete `firestore_export` dataset entirely

### 2. **Redundant Firestore Storage**

**ALL DataForSEO data stored in BOTH:**
- Firestore collections (5 collections)
- BigQuery `firestore_export` dataset (via Firebase Extensions)
- BigQuery `marketing_ai` dataset (via custom ETL)

**Cost:** 3x storage for the same data

### 3. **12+ Unused Cloud Functions**

Firebase Extensions created 12 Cloud Functions that:
- ❌ Run constantly
- ❌ Sync Firestore → `firestore_export` 
- ❌ Nothing reads from `firestore_export`
- ❌ Pure waste of compute/storage

### 4. **One-Way Sync Issues**

All syncs are **append-only** with no cleanup:
- Delete from Firestore → Still in BigQuery
- Old data accumulates forever
- Required **manual deletion of 554,852 rows** today
- Will require manual cleanup again in future

### 5. **Broken BigQuery Opportunities Write**

Scout AI tries to write to both:
- ✅ Firestore (works)
- ❌ BigQuery (fails with schema errors)

Result: BigQuery `opportunities` table is empty/broken

### 6. **DataForSEO Waste**

**Current behavior:**
- Crawls 373 pages
- Stores all 373 in Firestore
- Filters to 12 priority pages
- Only uses 12 in BigQuery

**Cost:** Paying for 373 pages, using 12 (97% waste)

**Fix in progress:** Set `respect_sitemap: false` to only crawl priority URLs

### 7. **No Data Lifecycle Management**

- No TTL on Firestore documents
- No partitioning/expiration on BigQuery tables
- Data grows infinitely
- Manual cleanup required

---

## Recommended Clean Architecture

### Option A: Skip Firestore Entirely (Best)

```
DataForSEO API
    ↓ (direct call from Cloud Function)
Cloud Function: dataforseo-direct-to-bigquery
    ↓ (filter priority pages)
    ↓ (write directly)
BigQuery: marketing_ai.daily_entity_metrics
    ↓
Scout AI Detectors
    ↓
BigQuery: marketing_ai.opportunities (fix schema)
    ↓
UI (query BigQuery via API)
```

**Benefits:**
- ✅ No Firestore costs
- ✅ Single source of truth
- ✅ Simpler code
- ✅ Faster queries
- ✅ Easier to maintain

### Option B: Keep Firestore for Real-time (Acceptable)

```
DataForSEO API
    ↓
Firestore (priority pages ONLY)
    ↓ (scheduled sync, with deletion logic)
BigQuery: marketing_ai.daily_entity_metrics
    ↓
Scout AI Detectors
    ↓
BigQuery: marketing_ai.opportunities
    ↓
Firestore (for real-time UI)
    ↓
UI
```

**Benefits:**
- ✅ Firestore for real-time updates
- ✅ BigQuery for analytics/detectors
- ⚠️ More complex, but manageable

---

## Immediate Action Items

### 1. Delete Unused Infrastructure

```bash
# Delete Firebase Extensions (12 functions)
gcloud functions delete ext-firestore-bigquery-export-dfs-keywords-* --region=us-central1
gcloud functions delete ext-firestore-bigquery-export-dfs-backlinks-* --region=us-central1
gcloud functions delete ext-firestore-bigquery-export-dfs-rank-history-* --region=us-central1
gcloud functions delete ext-firestore-bigquery-export-dfs-refdoms-* --region=us-central1

# Delete unused dataset
bq rm -r -f opsos-864a1:firestore_export
```

**Savings:** ~$50-200/month in compute + storage

### 2. Fix BigQuery Opportunities Schema

Convert JSON fields to proper RECORD types or stringify them before insert.

### 3. Add Cleanup Logic to Sync Functions

```python
# Before inserting new data, delete old data
DELETE FROM daily_entity_metrics
WHERE organization_id = @org_id
  AND entity_type = 'page'
  AND date < CURRENT_DATE()
```

### 4. Implement Data Lifecycle Policies

- Firestore: 30-day TTL on dataforseo_* collections
- BigQuery: Partition expiration on daily_entity_metrics (90 days)
- Scheduled cleanup jobs

---

## Cost Impact

**Current waste:**
- Firebase Extensions: ~12 functions × $0.40/million invocations
- Firestore storage: ~5 collections × duplicate data
- BigQuery `firestore_export`: Unused dataset storage
- DataForSEO: Crawling 373 pages, using 12 (97% waste)

**Estimated monthly waste:** $100-300/month on unused/redundant infrastructure

---

## Priority Pages Implementation Issues

During priority pages implementation, we discovered:

1. **Priority filtering happened too late** (after crawling 373 pages)
2. **No deletion logic** - Required manual deletion of 554,852 rows
3. **Keyword vs Page entity confusion** - Detectors analyze different entity types
4. **One-way sync** - Firestore deletes don't propagate to BigQuery
5. **Multiple sync processes** - daily-rollup-etl AND dataforseo-bigquery-sync both write pages

---

## Conclusion

The architecture works but is unnecessarily complex, expensive, and fragile. A refactor to eliminate Firestore intermediaries and unused Firebase Extensions would:
- Reduce costs by ~30-50%
- Simplify maintenance
- Reduce failure points
- Improve data freshness
- Make the system more predictable

**Recommendation:** Implement "Option A: Skip Firestore Entirely" for DataForSEO data flow.
