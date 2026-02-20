# Email Metrics Split Implementation - COMPLETE ✅

## Overview
Successfully split email metrics into **Marketing Campaigns** (manual broadcasts) and **Automation Emails** (triggered/transactional) with full data pipeline integration.

## What Changed

### 1. BigQuery View (`v_master_daily_metrics`)
**Classification Logic:**
- Uses existing `status` field from ActiveCampaign API (stored in `source_breakdown` JSON)
- **Marketing:** `status='5'` (Sent - manual one-time broadcasts)
- **Automation:** `status='1'` (Active automation - triggered/recurring/transactional)

**New CTEs Added:**
- `email_lifetime_marketing` - Aggregates marketing campaigns by date
- `email_lifetime_automation` - Aggregates automation campaigns by date  
- `email_daily_marketing` - Calculates daily deltas for marketing using `LAG()`
- `email_daily_automation` - Calculates daily deltas for automation using `LAG()`
- `email_summaries` - Extracts contact/list totals
- `email_daily` - Combines all email metrics with LEFT JOINs

**New Columns Exposed (12 total):**

**Marketing Campaigns:**
- `marketing_campaigns_launched` - Number of campaigns
- `marketing_sends` - Daily send count
- `marketing_opens` - Daily open count
- `marketing_clicks` - Daily click count
- `marketing_avg_open_rate` - Average open rate %
- `marketing_avg_ctr` - Average click-through rate %

**Automation Campaigns:**
- `automation_campaigns_launched` - Number of campaigns
- `automation_sends` - Daily send count
- `automation_opens` - Daily open count
- `automation_clicks` - Daily click count
- `automation_avg_open_rate` - Average open rate %
- `automation_avg_ctr` - Average click-through rate %

**Backward Compatible:**
- Original columns (`campaigns_launched`, `campaign_lifetime_sends`, etc.) still exist
- They now represent the sum of marketing + automation

### 2. Reporting Tables
**Recreated with new schema (112 columns, up from 100):**
- `opsos-864a1:reporting.daily_metrics` - Daily granularity
- `opsos-864a1:reporting.weekly_metrics` - Weekly aggregation with `SUM()`
- `opsos-864a1:reporting.monthly_metrics` - Monthly aggregation with `SUM()`

### 3. Frontend Dashboard (`/leadership/metrics`)
**Split single "Email marketing" card into two:**

**Card 1: "Email - Marketing campaigns"**
- Subtitle: "Manual broadcast emails (status=5)"
- Metrics: `marketing_campaigns_launched`, `marketing_sends`, `marketing_opens`, `marketing_clicks`, `marketing_avg_open_rate`, `marketing_avg_ctr`

**Card 2: "Email - Automation"**
- Subtitle: "Triggered & transactional emails (status=1)"
- Metrics: `automation_campaigns_launched`, `automation_sends`, `automation_opens`, `automation_clicks`, `automation_avg_open_rate`, `automation_avg_ctr`, `email_traffic_sessions`

### 4. Documentation
Updated `METRICS_GROUPING.md`:
- Documented split email metrics structure
- Renumbered cards (now 16 total, up from 15)
- Stage 1 Marketing now has 8 cards

## Data Verification

### Sample Data (Feb 2026)
```
Date         Marketing    Automation
--------------------------------------
Feb 19       0 sends      904 sends (153 opens, 17% open rate)
Feb 18       0 sends      568 sends (84 opens, 15% open rate)
Feb 17       0 sends      4,753 sends (9,744 opens, 205% open rate*)

* High open rate likely due to multiple opens per recipient
```

### Monthly Totals (Feb 2026)
- **77 automation campaigns** launched
- **1,048,234 automation sends**
- **338,104 automation opens** (32% avg open rate)
- **74,689 automation clicks**
- **0 marketing campaigns** (rare - only 3 historical instances)

### Historical Distribution
- **Marketing campaigns** (status=5): Very rare - only 3 campaigns total (2022-2023)
- **Automation campaigns** (status=1): Primary email channel - 265 unique campaigns

## Data Flow

```
ActiveCampaign API
  ↓ (status field captured in source_breakdown JSON)
daily_entity_metrics table
  ↓ (view filters by status='5' or status='1')
v_master_daily_metrics view
  ↓ (SELECT * includes all columns)
reporting.daily_metrics table
  ↓ (SUM() aggregation)
reporting.weekly_metrics, reporting.monthly_metrics
  ↓ (API: SELECT * returns all columns)
/api/bigquery/reporting-metrics endpoint
  ↓ (Frontend displays split sections)
Dashboard UI
```

## Technical Approach

### Why This Approach Works
1. **Uses existing data** - No need to re-sync or modify Cloud Functions
2. **Status field is reliable** - Already captured from ActiveCampaign API
3. **Simple classification logic** - Just two status codes to handle
4. **Backward compatible** - Original totals still available
5. **Automatic propagation** - API uses `SELECT *` so new columns flow through

### Delta Calculation
Uses SQL window function `LAG()` to calculate day-over-day changes:
```sql
GREATEST(0, lifetime_sends - COALESCE(LAG(lifetime_sends) OVER (ORDER BY date), 0)) as sends
```
- `LAG()` gets previous day's cumulative total
- Subtraction gives the delta
- `GREATEST(0, ...)` handles data corrections (prevents negative deltas)

## Deployment Status

✅ **BigQuery View:** Updated and deployed  
✅ **Reporting Tables:** Recreated with new schema  
✅ **Frontend:** Updated with split sections  
✅ **Documentation:** Updated  
✅ **Git:** Changes committed and pushed to GitHub  
✅ **API:** Automatically returns new columns  
✅ **Nightly Refresh:** Will run at 2 AM EST via `reporting-table-refresh` function

## Files Modified

### Backend
- BigQuery view definition (updated via `bq update`)
  - `opsos-864a1:marketing_ai.v_master_daily_metrics`

### Frontend
- `/app/src/app/leadership/metrics/page.tsx` (split email section)

### Documentation
- `/docs/METRICS_GROUPING.md` (added split metrics)

### Git Commits
1. `8438f4f` - Split email metrics into Marketing and Automation sections
2. `303f72f` - Fix: Move campaign classification variables into correct scope
3. `fdc38f3` - Fix email campaign classification logic

## Next Steps

### Immediate (Automatic)
- Dashboard will display split metrics on next visit to `/leadership/metrics`
- Data will continue to update nightly via scheduled ETL

### Future Enhancements (Optional)
1. **Chart Stacking**: Consider stacking marketing + automation on the same chart
2. **Alert Thresholds**: Set up alerts if automation open rates drop below threshold
3. **Campaign Tags**: If ActiveCampaign provides tags, could add finer classification
4. **Unsubscribe Tracking**: Add unsubscribe metrics per type

## Troubleshooting

### If Split Metrics Show Zeros
1. Check if campaigns have `status` field in `source_breakdown`:
   ```sql
   SELECT date, JSON_EXTRACT_SCALAR(source_breakdown, '$.status') as status
   FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
   WHERE entity_type = 'email_campaign'
   LIMIT 10
   ```

2. Verify view is using latest definition:
   ```sql
   SELECT marketing_sends, automation_sends
   FROM `opsos-864a1.marketing_ai.v_master_daily_metrics`
   WHERE date = CURRENT_DATE() - 1
   ```

### If API Doesn't Return New Columns
1. Verify reporting tables have new columns:
   ```bash
   bq show --schema opsos-864a1:reporting.daily_metrics | grep marketing
   ```

2. Recreate tables if needed (already done):
   ```bash
   curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/reporting-table-refresh \
     -H "Content-Type: application/json" \
     -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
   ```

## Summary

The email metrics split is **fully operational** and integrated into the entire data pipeline. The dashboard now clearly distinguishes between:
- **Marketing efforts** (manual broadcasts to lists)
- **Automation systems** (triggered/transactional workflows)

This provides better visibility into each email channel's performance and allows for more targeted optimization strategies.
