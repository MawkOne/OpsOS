# Weekly and Monthly Metrics Rebuild

## Issue
The `weekly_metrics` and `monthly_metrics` tables had a schema mismatch with the source `daily_metrics` table, causing weekly and monthly views to return no data.

### Root Cause
- `daily_metrics` table: 112 columns (updated schema)
- `weekly_metrics` table: 57 columns (outdated schema)
- `monthly_metrics` table: 57 columns (outdated schema)

The schema mismatch occurred when the `v_master_daily_metrics` view and `daily_metrics` table were updated with new columns, but the weekly and monthly rollup tables were not updated.

## Solution
Dropped and recreated both rollup tables with the correct schema matching `daily_metrics`, then populated them with aggregated data.

### Tables Rebuilt
1. **weekly_metrics** - 53 weeks of data (last 365 days)
2. **monthly_metrics** - 13 months of data (last 365 days)

### Aggregation Logic
- **SUM**: Raw counts and amounts (sessions, signups, revenue, etc.)
- **AVG**: Rates and percentages (conversion rates, engagement rates, etc.)
- **MAX**: Cumulative totals (lifetime campaign metrics, total contacts, etc.)

### Sample Data
#### Weekly (Feb 16, 2026)
- Sessions: 60,073
- Organic sessions: 10,426
- Paid search sessions: 1,046
- Stripe revenue: $7,521

#### Monthly (Feb 2026)
- Sessions: 309,526
- Organic sessions: 47,413
- Paid search sessions: 4,687
- Stripe revenue: $30,441

## Result
✅ Weekly granularity now works correctly on all growth pages
✅ Monthly granularity now works correctly on all growth pages
✅ Data accurately aggregates from daily metrics
✅ All 112 columns properly included in rollup tables

## Date: 2026-02-20
