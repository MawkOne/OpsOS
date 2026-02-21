# Google Ads "(not set)" Campaign Filter

**Date:** 2026-02-20  
**Issue:** Prevent "(not set)" campaigns from inflating Google Ads revenue and conversions

## Problem

GA4 was including traffic with campaign name "(not set)" in Google Ads data, which was inflating metrics by 5-6x:

- **With "(not set)"**: $65,555 revenue (77% of Stripe revenue) ❌
- **Without "(not set)"**: $12,516 revenue (15% of Stripe revenue) ✅

The "(not set)" campaigns captured mostly organic/direct/other traffic that GA4 incorrectly grouped with Google Ads attribution.

## Solution - Three-Layer Protection

To ensure this works going forward for all views and data ingestion, we implemented filtering at three levels:

### 1. ✅ Ingestion Layer (GA4 Sync Function)
**File:** `cloud-functions/data-sync/ga4-bigquery-sync/main.py`

Added filtering in both campaign and ad group ingestion loops:

```python
# Line ~493 - Google Ads Campaigns
for row in campaign_rows:
    date_val = row['dimensionValues'][0]['value']
    date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
    campaign_name = row['dimensionValues'][1]['value']
    campaign_id = row['dimensionValues'][2]['value']
    campaign_type = row['dimensionValues'][3]['value']
    ad_network = row['dimensionValues'][4]['value']
    
    # Skip (not set) campaigns - these are not real Google Ads traffic
    if campaign_name == '(not set)':
        continue
    
    results['google_ads_campaigns'] += 1
    # ... rest of processing
```

```python
# Line ~595 - Google Ads Ad Groups
for row in adgroup_rows:
    date_val = row['dimensionValues'][0]['value']
    date_str = f"{date_val[:4]}-{date_val[4:6]}-{date_val[6:8]}"
    campaign_name = row['dimensionValues'][1]['value']
    adgroup_name = row['dimensionValues'][2]['value']
    adgroup_id = row['dimensionValues'][3]['value']
    
    # Skip (not set) ad groups - these are not real Google Ads traffic
    if adgroup_name == '(not set)' or campaign_name == '(not set)':
        continue
    
    results['google_ads_adgroups'] += 1
    # ... rest of processing
```

**Result:** "(not set)" campaigns are never inserted into `daily_entity_metrics` table going forward.

### 2. ✅ View Layer (BigQuery Views)
**View:** `opsos-864a1.marketing_ai.v_master_daily_metrics`

Updated the `google_ads_aggregate` CTE to filter out "(not set)" campaigns:

```sql
google_ads_aggregate AS (
  SELECT
    date,
    SUM(conversions) as gads_conversions,
    SUM(revenue) as gads_revenue
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type = 'google_ads_campaign'
    AND JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') != '(not set)'
    AND canonical_entity_id LIKE 'gads_campaign_%'
  GROUP BY date
)
```

**Result:** Even if "(not set)" data exists in the source table, the view excludes it from reporting.

### 3. ✅ Data Cleanup (One-Time)
Deleted existing "(not set)" campaigns from the source table:

```sql
DELETE FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type IN ('google_ads_campaign', 'google_ads_adgroup')
  AND (
    JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') = '(not set)'
    OR JSON_EXTRACT_SCALAR(source_breakdown, '$.adgroup_name') = '(not set)'
  )
```

**Result:** Deleted 141 rows of historical "(not set)" data.

## Impact

### Before Fix:
```
Real Google Ads Campaigns:  $12,516 revenue (106,124 sessions)
"(not set)" / Unknown:      $53,039 revenue (654,187 sessions) ❌
Total (inflated):           $65,555 revenue (77% of Stripe)
```

### After Fix:
```
Real Google Ads Campaigns:  $12,516 revenue (106,124 sessions) ✅
"(not set)" / Unknown:      Filtered out
Total (correct):            $12,516 revenue (15% of Stripe)
```

## Future-Proofing

This fix ensures correct Google Ads data **going forward** because:

1. **New data ingestion** automatically excludes "(not set)" at the source
2. **All views** that query Google Ads data use the filtering logic
3. **Reporting tables** (`daily_metrics`, `weekly_metrics`, `monthly_metrics`) are refreshed from the corrected view
4. **API endpoints** read from reporting tables, which get correct data

### What This Protects:

✅ Dashboard pages (`/growth/paid`, etc.)  
✅ API endpoints (`/api/bigquery/reporting-metrics`)  
✅ Weekly/monthly aggregations  
✅ Any future queries that use `v_master_daily_metrics` view  
✅ Manual queries or reports that filter by entity_type  

### What Still Needs Attention:

If you ever:
- Query `daily_entity_metrics` directly (not through the view)
- Create new views that use Google Ads data
- Export data for external analysis

**Always filter out "(not set)":**
```sql
WHERE entity_type = 'google_ads_campaign'
  AND JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') != '(not set)'
```

## Verification

To verify the fix is working:

```sql
-- Check for any remaining (not set) campaigns
SELECT 
  COUNT(*) as not_set_count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type IN ('google_ads_campaign', 'google_ads_adgroup')
  AND (
    JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_name') = '(not set)'
    OR JSON_EXTRACT_SCALAR(source_breakdown, '$.adgroup_name') = '(not set)'
  )
```

Should return **0 rows** after cleanup.

```sql
-- Check Google Ads revenue is reasonable (10-20% of Stripe)
SELECT 
  SUM(gads_revenue) as total_gads_revenue,
  SUM(stripe_revenue) as total_stripe_revenue,
  ROUND(SUM(gads_revenue) / SUM(stripe_revenue) * 100, 2) as gads_pct
FROM `opsos-864a1.reporting.daily_metrics`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

Should show **10-20%** range (not 70%+).

## Related Documentation

- `GOOGLE_ADS_DATA_SOURCE_FIX.md` - Using GA4 campaigns instead of ad_account
- `GOOGLE_ADS_DUPLICATE_FIX.md` - Removing duplicate rows
- `GOOGLE_ADS_ATTRIBUTION_FIX.md` - Using GA4 for sessions attribution

## Deployment

Cloud Function updated and deployed:
```bash
cd cloud-functions/data-sync/ga4-bigquery-sync
gcloud functions deploy ga4-bigquery-sync \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --project=opsos-864a1
```

Next GA4 sync will automatically exclude "(not set)" campaigns.
