# DataForSEO BigQuery Backfill - What It Does

## Overview
The sync has been updated to backfill **12 months of historical rank data** from DataForSEO into BigQuery.

## What Gets Synced

### 1. **Historical Data** (NEW! ✨)
**Source:** `dataforseo_rank_history` Firestore collection  
**Time Range:** Last 12 months (monthly data)  
**Entity Type:** `domain` (aggregated metrics)

**Data Points per Month:**
- Date: Last day of each month
- Organic traffic estimate (`sessions`)
- Keyword count (`impressions`)
- Position distribution (top 3, top 10, 11-20, etc.)
- Rank breakdown stored in `source_breakdown` JSON field

**Example:**
```
date: 2025-12-31 (December)
canonical_entity_id: "ytjobs.co"
entity_type: "domain"
sessions: 15000 (organic traffic estimate)
impressions: 1015 (total keywords ranking)
source_breakdown: {
  "pos1": 5,
  "pos2_3": 12,
  "pos4_10": 85,
  "top3_keywords": 17,
  "top10_keywords": 102,
  "total_keywords": 1015
}
```

### 2. **Current Snapshot Data** (Existing)
**Source:** `dataforseo_pages`, `dataforseo_keywords`, `dataforseo_backlinks` Firestore collections  
**Time Range:** Today's date  
**Entity Type:** `page` (individual pages)

**Data Points:**
- Current backlink counts
- Referring domains
- Core Web Vitals (LCP, FID)
- On-page SEO score
- Technical checks (broken links, missing meta, etc.)
- Schema markup status
- Keyword positions

## What This Enables

### Now Working:
1. ✅ **SEO Rank Trends Multitimeframe** - Has 12 months of historical data
2. ✅ **Content Freshness Decay** - Can now detect traffic decline over time
3. ✅ **Rank Drops** - Can compare current vs historical positions

### Still Need Daily Data For:
- **Backlink Quality Decline** - Needs daily snapshots to detect week-over-week changes
- **Rank Volatility Daily** - Needs day-to-day position tracking
- **Core Web Vitals Changes** - Needs daily performance snapshots

## How to Use

### Option 1: Via App UI
1. Go to `/sources/dataforseo`
2. Click "Sync to BigQuery"
3. Backfill is enabled by default

### Option 2: Via API
```bash
curl -X POST https://your-app.com/api/dataforseo/sync-to-bigquery \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "your-org-id",
    "backfillHistory": true
  }'
```

### Option 3: Cloud Function
```bash
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/sync-dataforseo-to-bigquery \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "your-org-id",
    "backfillHistory": true
  }'
```

## Expected Results

**Before Sync:**
- 373 pages with 1 day of data
- Most detectors return 0 (no historical comparison)

**After Sync:**
- 12 monthly domain-level aggregate records
- 373 current page-level snapshot records
- **Total: ~385 rows** in BigQuery

**Detectors That Will Work:**
- ✅ SEO Striking Distance (current data)
- ✅ Content Freshness Decay (historical + current comparison)
- ✅ Technical SEO Health Score (current data)
- ✅ Schema Markup Gaps (current data)
- ✅ SEO Rank Trends Multitimeframe (12 months of data!)

## Going Forward

**For Full Daily Time-Series:**
Run this sync **daily** (via cron/scheduler) to build up:
- Daily page snapshots
- Daily backlink counts
- Daily position tracking
- Week-over-week comparisons

**Recommended Schedule:**
- Daily: 2 AM UTC (after DataForSEO sync completes)
- Set `backfillHistory: false` after first run (already backfilled)

## Data Schema

**BigQuery Table:** `marketing_ai.daily_entity_metrics`

**Historical Rows:**
```sql
SELECT 
  date,
  canonical_entity_id,
  entity_type,
  sessions as organic_traffic_estimate,
  impressions as keyword_count,
  JSON_EXTRACT(source_breakdown, '$.top10_keywords') as top_10_count
FROM marketing_ai.daily_entity_metrics
WHERE organization_id = 'your-org'
  AND entity_type = 'domain'
ORDER BY date DESC
LIMIT 12
```

**Current Page Snapshots:**
```sql
SELECT 
  canonical_entity_id,
  backlinks_total,
  referring_domains,
  onpage_score,
  core_web_vitals_lcp,
  has_schema_markup
FROM marketing_ai.daily_entity_metrics
WHERE organization_id = 'your-org'
  AND entity_type = 'page'
  AND date = CURRENT_DATE()
ORDER BY backlinks_total DESC
```
