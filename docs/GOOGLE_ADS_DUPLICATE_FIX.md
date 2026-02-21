# Google Ads Duplicate Data Fix

**Date:** 2026-02-20  
**Issue:** Google Ads revenue and conversions were 3x inflated due to duplicate rows in source table

## Problem

When investigating user reports that "weekly and monthly Google Ads numbers are totally wrong," we discovered that the `marketing_ai.daily_entity_metrics` table contained **3 duplicate rows for every single day** of Google Ads data.

### Evidence

Query to check for duplicates:
```sql
SELECT 
  date,
  canonical_entity_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(CAST(conversions AS STRING), ', ') as conversion_values,
  STRING_AGG(CAST(revenue AS STRING), ', ') as revenue_values
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'ad_account'
  AND canonical_entity_id LIKE 'google_ads_%'
  AND date >= '2026-02-01'
GROUP BY date, canonical_entity_id
HAVING COUNT(*) > 1
```

**Results:** Every single day had 3 identical rows with the same conversions and revenue values.

### Impact

- **Daily metrics view** used `MAX()` aggregation, which masked the duplicates at the view level
- **Reporting tables** were rebuilt *before* the view fix, so they inherited the inflated data
- **Weekly/monthly aggregations** summed the 3x duplicated daily data, causing:
  - February 2026 revenue: $27,915 (actual: $9,305) = **300% inflation**
  - Google Ads appeared to be 100%+ of Stripe revenue (impossible)

## Root Cause

The `google-ads-bigquery-sync` Cloud Function was:
1. Fetching Google Ads data from the API (correct)
2. Attempting to DELETE existing rows for the date range (incomplete)
3. Inserting new rows (correct)
4. **But the DELETE wasn't completing before INSERT**, leading to duplicates on each sync

## Solution

### Step 1: Clean Source Data

Deleted all duplicate rows, keeping only the earliest inserted row:

```sql
DELETE FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE STRUCT(date, canonical_entity_id, organization_id, entity_type, created_at) NOT IN (
  SELECT AS STRUCT date, canonical_entity_id, organization_id, entity_type, MIN(created_at) as created_at
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE (entity_type = 'ad_account' OR entity_type = 'google_ads_campaign')
    AND (canonical_entity_id LIKE 'google_ads_%' OR canonical_entity_id LIKE 'gads_campaign_%')
  GROUP BY date, canonical_entity_id, organization_id, entity_type
)
AND ((entity_type = 'ad_account' AND canonical_entity_id LIKE 'google_ads_%')
     OR (entity_type = 'google_ads_campaign' AND canonical_entity_id LIKE 'gads_campaign_%')
    )
```

**Result:** Deleted 1,550 duplicate rows

### Step 2: Rebuild Reporting Tables

1. **Daily metrics:** Deleted and re-inserted 366 days from clean view
2. **Weekly metrics:** Deleted and re-inserted 53 weeks with corrected Google Ads data
3. **Monthly metrics:** Deleted and re-inserted 13 months with corrected Google Ads data

### Step 3: Fix Cloud Function (Future)

The `google-ads-bigquery-sync/main.py` function was already updated in a previous fix to:
- Explicitly call `.result()` after DELETE query to wait for completion
- Use precise date range matching for deletion
- Log affected rows for debugging

## Results

### Before (with 3x duplicates)
- Week of Feb 16: $5,049 revenue (167% of Stripe)
- Week of Feb 9: $9,801 revenue (99% of Stripe)
- Week of Feb 2: $12,474 revenue (112% of Stripe)
- February total: $27,915 revenue (92% of Stripe)

### After (cleaned)
- Week of Feb 16: $1,683 revenue (22.38% of Stripe) ✅
- Week of Feb 9: $3,267 revenue (32.98% of Stripe) ✅
- Week of Feb 2: $4,158 revenue (37.50% of Stripe) ✅
- **February total: $9,305 revenue (30.57% of Stripe)** ✅

## Verification

To check if duplicates exist:
```sql
-- Check for ad_account duplicates
SELECT 
  date,
  canonical_entity_id,
  COUNT(*) as row_count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'ad_account'
  AND canonical_entity_id LIKE 'google_ads_%'
GROUP BY date, canonical_entity_id
HAVING COUNT(*) > 1
```

Should return 0 rows if clean.

## Prevention

Going forward:
1. The Cloud Function now waits for DELETE to complete before INSERT
2. Monitor for duplicate rows as part of data quality checks
3. Consider adding a unique constraint on `(date, canonical_entity_id, organization_id, entity_type)` if BigQuery supports it

## Related Documentation

- `GOOGLE_ADS_REVENUE_DEDUPLICATION_FIX.md` - Previous view-level deduplication fix
- `GOOGLE_ADS_ATTRIBUTION_FIX.md` - GA4 as source of truth for sessions
- `cloud-functions/data-sync/google-ads-bigquery-sync/main.py` - Updated sync function
