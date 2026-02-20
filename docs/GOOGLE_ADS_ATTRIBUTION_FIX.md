# Google Ads Attribution Fix - Use GA4 as Source of Truth

## Date: 2026-02-20

## Problem
Google Ads metrics had inconsistent and incorrect data due to using two different measurement systems:

1. **Google Ads API** (campaign-level data) reported **3,756 sessions** on Feb 18
2. **GA4 attribution** reported **1,710 paid sessions** on Feb 18  
3. **Result:** Double-counting, missing data, and unreliable metrics

### Specific Issues Found:
- **Feb 19, 2026:** Google Ads API showed 0 sessions, but GA4 showed 794 paid sessions
- **Feb 18, 2026:** Google Ads showed 3,756 sessions, GA4 showed only 1,710
- **Mismatch:** Google Ads reported 2x more sessions than GA4 attributed

## Root Cause
The `v_master_daily_metrics` view pulled session data from two sources:
- `google_ads_campaigns` CTE (from Google Ads API)
- `ga4_daily` CTE (from GA4 attribution)

These are different measurement systems that don't align.

## Solution
**Use GA4 attribution as the single source of truth for Google Ads sessions.**

### Changes Made:

#### 1. Updated View (`v_master_daily_metrics`)
- **Removed:** `google_ads_campaigns` CTE entirely
- **Changed:** Google Ads metrics to use GA4 data:
  - `gads_sessions` = `paid_search_sessions + paid_pmax_sessions` (GA4)
  - `gads_pmax_sessions` = `paid_pmax_sessions` (GA4)
  - `gads_search_sessions` = `paid_search_sessions` (GA4)
- **Kept:** `gads_conversions` and `gads_revenue` from Google Ads API aggregate

#### 2. Rebuilt All Reporting Tables
- `reporting.daily_metrics` - 366 rows (last 365 days)
- `reporting.weekly_metrics` - 53 weeks
- `reporting.monthly_metrics` - 13 months

## Results

### Before Fix (Feb 18, 2026):
```
gads_sessions: 3,756 (Google Ads API)
paid_search + paid_pmax: 1,710 (GA4)
Discrepancy: 2,046 sessions (2x overcounting)
```

### After Fix (Feb 18, 2026):
```
gads_sessions: 1,710 (GA4 attribution)
gads_pmax_sessions: 1,440 (GA4)
gads_search_sessions: 270 (GA4)
Total: 1,710 ✅ (consistent!)
```

### Data Validation:
**Daily (Feb 16-20):** 1,457 + 1,609 + 1,710 + 794 + 0 = **5,570 sessions**  
**Weekly (Feb 16):** **5,570 sessions** ✅  
**Monthly (Feb 2026):** **27,455 sessions** ✅

All granularities now aggregate correctly!

## Benefits
✅ Single source of truth for Google Ads sessions (GA4)  
✅ No more double-counting or mismatched data  
✅ Consistent metrics across daily/weekly/monthly views  
✅ Historical data preserved (365 days)  
✅ Conversions and revenue still from Google Ads API (more accurate)

## Technical Details
- View: `opsos-864a1.marketing_ai.v_master_daily_metrics`
- Modified lines: Removed ~13 line CTE, updated 6 column references
- Tables rebuilt: `daily_metrics`, `weekly_metrics`, `monthly_metrics`
- Data range: Last 365 days from current date
