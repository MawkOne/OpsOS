# Google Ads Data Fix - Complete Summary

**Date:** 2026-02-20  
**Status:** ✅ Complete and Future-Proofed

## Overview

Fixed multiple Google Ads data quality issues to ensure accurate revenue and conversion tracking going forward.

## Issues Fixed

### 1. ✅ Duplicate Rows (3x Inflation)
**Problem:** Source table had 3 duplicate rows for every day  
**Impact:** Weekly revenue was $5,049 instead of $1,683 (300% inflation)  
**Fix:** 
- Deleted 1,550 duplicate rows from source table
- Fixed Cloud Function DELETE logic to prevent future duplicates
- **Doc:** `GOOGLE_ADS_DUPLICATE_FIX.md`

### 2. ✅ Wrong Data Source (Limited Historical Data)
**Problem:** Using Google Ads API (`ad_account`) which only had 27 days of data  
**Impact:** No data before Jan 23, 2026  
**Fix:**
- Switched to GA4's Google Ads campaign data (`google_ads_campaign`)
- Now have full history back to Jan 1, 2026 (49 days)
- **Doc:** `GOOGLE_ADS_DATA_SOURCE_FIX.md`

### 3. ✅ "(not set)" Campaign Inflation (5x Inflation)
**Problem:** GA4 including "(not set)" campaigns which captured non-Google Ads traffic  
**Impact:** Showing $65,555 revenue (77% of Stripe) instead of $12,516 (15% of Stripe)  
**Fix:**
- Added filtering at ingestion layer (Cloud Function)
- Added filtering at view layer (BigQuery view)
- Deleted 141 rows of existing "(not set)" data
- **Doc:** `GOOGLE_ADS_NOT_SET_FILTER.md`

### 4. ✅ Using GA4 for Sessions Attribution
**Problem:** Mismatched sessions data between Google Ads API and GA4  
**Impact:** Sessions counts didn't match, attribution was inconsistent  
**Fix:**
- Use GA4 attribution for all session metrics
- Use Google Ads campaigns (from GA4) for conversions/revenue
- **Doc:** `GOOGLE_ADS_ATTRIBUTION_FIX.md`

## Final Corrected Numbers

### Before All Fixes:
- Google Ads Revenue: $27,915 (multiple issues compounded)
- Appeared to be 92% of Stripe revenue ❌

### After All Fixes:
- **Google Ads Revenue: $12,516**
- **14.74% of total Stripe revenue** ✅
- January 2026: $8,609 (15.8%)
- February 2026: $3,907 (12.8%)

## Three-Layer Protection Going Forward

### Layer 1: Ingestion (Cloud Function)
`cloud-functions/data-sync/ga4-bigquery-sync/main.py`
- Filters out "(not set)" campaigns at ingestion time
- **Status:** ✅ Updated and deployed
- **Effect:** New syncs won't include "(not set)" data

### Layer 2: View (BigQuery)
`opsos-864a1.marketing_ai.v_master_daily_metrics`
```sql
WHERE entity_type = 'google_ads_campaign'
  AND JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') != '(not set)'
```
- **Status:** ✅ Updated
- **Effect:** Even if bad data exists, view filters it out

### Layer 3: Data Cleanup
- Deleted duplicate rows: 1,550 rows
- Deleted "(not set)" campaigns: 141 rows
- **Status:** ✅ Complete
- **Effect:** Historical data is clean

## What's Protected Now

✅ **Dashboard pages** (`/growth/paid`, `/growth/email`, etc.)  
✅ **API endpoints** (`/api/bigquery/reporting-metrics`)  
✅ **Weekly/monthly aggregations**  
✅ **All future data ingestion**  
✅ **All views that use `v_master_daily_metrics`**  
✅ **Reporting tables** (`daily_metrics`, `weekly_metrics`, `monthly_metrics`)

## Data Flow (All Fixed)

```
GA4 API
  ↓
ga4-bigquery-sync (filters out "not set") ← FIXED
  ↓
daily_entity_metrics (no duplicates, no "not set") ← FIXED
  ↓
v_master_daily_metrics (uses google_ads_campaign + filters "not set") ← FIXED
  ↓
reporting.daily_metrics ← FIXED
  ↓
reporting.weekly_metrics ← FIXED
reporting.monthly_metrics ← FIXED
  ↓
Frontend API (/api/bigquery/reporting-metrics) ← FIXED
  ↓
Dashboard UI ← FIXED
```

## Verification Queries

### Check for Duplicates
```sql
SELECT date, canonical_entity_id, COUNT(*) as count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'ad_account' 
  AND canonical_entity_id LIKE 'google_ads_%'
GROUP BY date, canonical_entity_id
HAVING COUNT(*) > 1
```
**Expected:** 0 rows

### Check for "(not set)" Campaigns
```sql
SELECT COUNT(*) as not_set_count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'google_ads_campaign'
  AND JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') = '(not set)'
```
**Expected:** 0 rows

### Check Revenue Percentage
```sql
SELECT 
  SUM(gads_revenue) / SUM(stripe_revenue) * 100 as gads_pct
FROM `opsos-864a1.reporting.daily_metrics`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```
**Expected:** 10-20% (not 70%+)

## Files Changed

### Cloud Functions
- ✅ `cloud-functions/data-sync/ga4-bigquery-sync/main.py` (deployed)
- ✅ `cloud-functions/data-sync/google-ads-bigquery-sync/main.py` (previously fixed)

### BigQuery Views
- ✅ `opsos-864a1.marketing_ai.v_master_daily_metrics` (updated)

### BigQuery Tables
- ✅ `opsos-864a1.marketing_ai.daily_entity_metrics` (cleaned)
- ✅ `opsos-864a1.reporting.daily_metrics` (rebuilt)
- ✅ `opsos-864a1.reporting.weekly_metrics` (rebuilt)
- ✅ `opsos-864a1.reporting.monthly_metrics` (rebuilt)

### Documentation
- ✅ `docs/GOOGLE_ADS_DUPLICATE_FIX.md`
- ✅ `docs/GOOGLE_ADS_DATA_SOURCE_FIX.md`
- ✅ `docs/GOOGLE_ADS_NOT_SET_FILTER.md`
- ✅ `docs/GOOGLE_ADS_ATTRIBUTION_FIX.md`
- ✅ `docs/GOOGLE_ADS_FIX_SUMMARY.md` (this file)

## Testing

To verify everything is working:

1. **Check Dashboard:** Visit `http://localhost:3000/growth/paid`
   - Should show 10-20% Google Ads revenue vs Stripe
   - Should have data back to Jan 1, 2026

2. **Check BigQuery:** Run verification queries above
   - Should show 0 duplicates
   - Should show 0 "(not set)" campaigns

3. **Run New Sync:** Trigger a GA4 sync
   - Should not ingest any "(not set)" campaigns
   - Should maintain correct revenue percentages

## Maintenance

### If You Ever See Google Ads Revenue > 50% of Stripe:
1. Check for "(not set)" campaigns in source data
2. Check for duplicate rows in source data
3. Verify the view is using correct filters
4. Rebuild reporting tables

### When Querying Google Ads Data Directly:
Always filter:
```sql
WHERE entity_type = 'google_ads_campaign'
  AND JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') != '(not set)'
```

### When Creating New Views:
Follow the pattern in `v_master_daily_metrics`:
- Use `google_ads_campaign` entity type (not `ad_account`)
- Filter out "(not set)" campaigns
- Use `SUM()` for aggregations (not `MAX()`)

## Related Issues

All fixes are interconnected:
1. Duplicates → Removed at source
2. Data source → Switched to GA4 campaigns
3. "(not set)" → Filtered at ingestion and view
4. Attribution → Using GA4 for sessions

Together, these ensure Google Ads data is accurate and will remain accurate going forward.
