# Google Ads Revenue Deduplication Fix

## Date: 2026-02-20

## Problem
Google Ads revenue and conversions were **triple-counted** due to duplicate rows in `daily_entity_metrics`.

### Example (Feb 18, 2026):
**Before fix:**
- 3 duplicate rows each with: 479 conversions, $445 revenue
- Dashboard showed: **1,437 conversions** (479 × 3), **$1,335 revenue** ($445 × 3)
- Google Ads revenue appeared to be 90% of Stripe revenue ($1,335 / $1,484) ❌

**After fix:**
- Deduplicated to: **479 conversions**, **$445 revenue**
- Google Ads revenue is 30% of Stripe revenue ($445 / $1,484) ✅

## Root Cause
The `google_ads_aggregate` CTE in `v_master_daily_metrics` used `SUM()` without deduplication:

```sql
google_ads_aggregate AS (
  SELECT
    date,
    SUM(conversions) as gads_conversions,  -- ❌ Counts all duplicates
    SUM(revenue) as gads_revenue           -- ❌ Counts all duplicates
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type = 'ad_account'
    AND canonical_entity_id LIKE 'google_ads_%'
  GROUP BY date
)
```

## Duplicate Analysis
Every single day in February 2026 had **exactly 3 duplicate rows** for Google Ads `ad_account` data:

```
date        | canonical_entity_id  | duplicate_count
2026-02-18  | google_ads_2026-02-18| 3
2026-02-17  | google_ads_2026-02-17| 3
2026-02-16  | google_ads_2026-02-16| 3
... (all days have 3 duplicates)
```

## Solution
Changed aggregation from `SUM()` to `MAX()` to deduplicate:

```sql
google_ads_aggregate AS (
  SELECT
    date,
    MAX(conversions) as gads_conversions,  -- ✅ Deduplicates
    MAX(revenue) as gads_revenue           -- ✅ Deduplicates
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type = 'ad_account'
    AND canonical_entity_id LIKE 'google_ads_%'
  GROUP BY date
)
```

This follows the same pattern used for YTJobs deduplication in the view.

## Results

### Before & After Comparison:

| Date | Metric | Before (3x) | After (deduplicated) | Stripe Revenue | GAds % |
|------|--------|-------------|---------------------|----------------|---------|
| Feb 18 | Conversions | 1,437 | **479** | - | - |
| Feb 18 | Revenue | $1,335 | **$445** | $1,484 | 30% ✅ |
| Feb 17 | Conversions | 1,107 | **369** | - | - |
| Feb 17 | Revenue | $891 | **$297** | $1,909 | 16% ✅ |
| Feb 16 | Conversions | 858 | **286** | - | - |
| Feb 16 | Revenue | $2,823 | **$941** | $1,585 | 59% ✅ |

### Aggregated Data (Corrected):
- **Weekly (Feb 16-20):** $1,683 Google Ads revenue
- **Monthly (Feb 2026):** $9,305 Google Ads revenue vs $30,441 Stripe (31%)

## Impact
✅ **Both pages now show correct data:**
- `/growth/paid` (new growth pages)
- `/leadership/metrics` (existing dashboard)

Both pages use the same `reporting-metrics` API endpoint, so they automatically show the deduplicated data.

## Technical Changes
1. **View updated:** `opsos-864a1.marketing_ai.v_master_daily_metrics`
2. **Tables rebuilt:**
   - `reporting.daily_metrics` (366 days)
   - `reporting.weekly_metrics` (53 weeks)
   - `reporting.monthly_metrics` (13 months)

## Validation
Google Ads revenue now makes sense:
- Typically 15-60% of Stripe revenue (varies by day)
- Monthly average ~30% of total revenue
- No more impossible values (revenue > Stripe revenue)
