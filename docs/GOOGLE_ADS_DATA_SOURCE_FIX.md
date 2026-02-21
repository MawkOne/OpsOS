# Google Ads Data Source Fix - GA4 vs Google Ads API

**Date:** 2026-02-20  
**Issue:** Google Ads conversions and revenue only showing from Jan 23 onwards, despite having historical data available

## Problem

The user correctly pointed out that Google Ads conversion and revenue data was missing before Jan 23, 2026. When questioned, "How is that possible? Conversions & Revenue → From Google Ads API directly", the investigation revealed a data source misconfiguration.

## Root Cause

The `v_master_daily_metrics` view was pulling Google Ads conversions and revenue from the wrong source:

### What Was Happening:
```sql
-- WRONG: Using Google Ads API data (ad_account entity_type)
google_ads_aggregate AS (
  SELECT
    date,
    MAX(conversions) as gads_conversions,
    MAX(revenue) as gads_revenue
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type = 'ad_account'  -- ❌ Only available from Jan 23
    AND canonical_entity_id LIKE 'google_ads_%'
  GROUP BY date
)
```

The `ad_account` entity type data:
- Comes from the Google Ads API sync (`google-ads-bigquery-sync`)
- Only started ingesting on Feb 19, 2026
- Contains data from Jan 23 - Feb 18 (27 days)
- **This is the direct Google Ads API source**

### What Should Have Been Used:

Google Analytics 4 (GA4) has been collecting Google Ads data all along!

The GA4 sync function (`ga4-bigquery-sync/main.py`, lines 448-546) fetches:
- `sessionGoogleAdsCampaignName`
- `sessionGoogleAdsCampaignId`
- `sessionGoogleAdsCampaignType`
- **Conversions and revenue by campaign**

This data:
- Is stored as `entity_type = 'google_ads_campaign'`
- Has been collecting since Jan 1, 2026
- Contains 49 days of historical data
- Is attributed through GA4's Google Ads integration

## Solution

Updated the `google_ads_aggregate` CTE to use GA4's Google Ads campaign data:

```sql
-- CORRECT: Using GA4's Google Ads attribution
google_ads_aggregate AS (
  SELECT
    date,
    SUM(conversions) as gads_conversions,  -- Changed from MAX to SUM
    SUM(revenue) as gads_revenue           -- Sum across all campaigns
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type = 'google_ads_campaign'  -- ✅ GA4 attribution data
    AND canonical_entity_id LIKE 'gads_campaign_%'
  GROUP BY date
)
```

### Changes Made:
1. Changed `entity_type` from `'ad_account'` to `'google_ads_campaign'`
2. Changed `canonical_entity_id` filter from `'google_ads_%'` to `'gads_campaign_%'`
3. Changed aggregation from `MAX()` to `SUM()` (since we're now summing across campaigns)
4. Rebuilt all reporting tables (`daily_metrics`, `weekly_metrics`, `monthly_metrics`)

## Results

### Before (missing historical data):
- Jan 19: 0 conversions, $0 revenue ❌
- Jan 18: 0 conversions, $0 revenue ❌
- Data only from Jan 23 onwards

### After (with GA4 historical data):
- **Jan 19: 1,972 conversions, $1,138 revenue** ✅
- **Jan 18: 1,914 conversions, $1,088 revenue** ✅
- **Jan 15: 1,825 conversions, $1,732 revenue** ✅
- Full history back to Jan 1, 2026

## Data Sources Clarification

### Google Ads Metrics Come From TWO Sources:

1. **Sessions** (from GA4)
   - `gads_sessions` = `paid_search_sessions` + `paid_pmax_sessions`
   - Available for ALL dates
   - Source: GA4 attribution via `ga4-bigquery-sync`

2. **Conversions & Revenue** (from GA4 campaigns)
   - `gads_conversions` = SUM of conversions across all Google Ads campaigns
   - `gads_revenue` = SUM of revenue across all Google Ads campaigns
   - Available back to Jan 1, 2026
   - Source: GA4 Google Ads campaign tracking via `ga4-bigquery-sync`

### Why Not Use Google Ads API?

The Google Ads API data (`ad_account` entity_type) was intended to provide:
- More granular campaign-level metrics
- Cost/spend data (not available in GA4)
- ROAS calculations

However:
- It only has 27 days of data (Jan 23 - Feb 18)
- GA4 already provides conversions and revenue with better historical coverage
- For now, GA4 is the better source of truth

### Future Considerations

If you want deeper Google Ads insights:
- Continue to use GA4 for conversions/revenue (better history)
- Use Google Ads API for:
  - Cost/spend metrics
  - Impression/click data
  - More granular campaign performance
  - ROAS calculations when you need cost data

## Verification

To check the data sources:

```sql
-- Check what data exists by entity_type
SELECT 
  entity_type,
  MIN(date) as first_date,
  MAX(date) as last_date,
  COUNT(DISTINCT date) as days,
  COUNTIF(conversions > 0) as days_with_conversions
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE canonical_entity_id LIKE '%google_ads%' OR canonical_entity_id LIKE '%gads%'
GROUP BY entity_type
```

Expected results:
- `google_ads_campaign`: Jan 1 - present (GA4 source) ✅
- `google_ads_adgroup`: Jan 1 - present (GA4 source) ✅
- `ad_account`: Jan 23 - Feb 18 (Google Ads API source) ⚠️

## Related Documentation

- `GOOGLE_ADS_ATTRIBUTION_FIX.md` - Using GA4 for sessions
- `GOOGLE_ADS_DUPLICATE_FIX.md` - Deduplicating source data
- `cloud-functions/data-sync/ga4-bigquery-sync/main.py` - GA4 sync function (lines 448-546)
