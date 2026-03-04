# Reporting Table Refresh Fix - Status Report
**Date:** February 24, 2026 23:26 UTC

## Problem
The `reporting-table-refresh` Cloud Function has been failing since October 27, 2025 (4 months) due to column count/type mismatches between the INSERT query and the table schema.

## Progress
✅ Identified root cause: Missing 28 columns (73 → 101)
✅ Added all missing columns
✅ Removed 10 columns that don't exist in table (year, week_label, week_start_date, week_end_date, days_in_week, talent_signups_daily_avg, etc.)
✅ Fixed week_num to be INTEGER instead of STRING
✅ Deployed function 4 times with corrections

## Current Issue
Column type/order mismatches causing BigQuery rejection:
- Error: "column 16 has type FLOAT64 which cannot be inserted into column profile_views, which has type INT64"
- The column order in the INSERT SELECT doesn't match the table schema order
- Some INTEGER columns need explicit CAST to avoid FLOAT64 from AVG/ROUND

## Two Paths Forward

### Option 1: Continue Fixing (30-60 min)
Generate a query that exactly matches the table schema column-by-column:
- Get exact column order from `bq show` 
- Match each column's type (INT64 vs FLOAT64)
- Add explicit CAST where needed
- Test and deploy

**Pros:** Fixes the root cause permanently
**Cons:** More time debugging, risk of additional errors

### Option 2: Temporary Workaround (5 min)
Change the Revenue Dashboard and Growth Metrics to query `daily_entity_metrics` directly:
- No dependency on broken weekly rollup
- Data will be current immediately
- Product data already works this way

**Pros:** Immediate fix, data works now
**Cons:** Dashboard queries slower, rollup still broken for other uses

## Recommendation
Since it's late and you need working data now, I recommend:
1. **Immediately:** Use Option 2 workaround to unblock dashboard
2. **Tomorrow:** Complete Option 1 fix for long-term solution

## Files Changed
- `/cloud-functions/data-sync/reporting-table-refresh/main.py` (partially fixed, needs completion)
- Deployed to Cloud Functions 4 times
- Latest deployment: revision 00015-vaf

## Next Steps if Continuing Fix
1. Generate exact column-by-column SELECT matching table schema order
2. Add explicit CAST(x AS INT64) for all integer aggregations  
3. Test locally with bq query before deploying
4. Deploy and backfill 150 days of data
