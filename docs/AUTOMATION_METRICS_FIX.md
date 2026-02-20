# Automation Email Metrics Fix

## Problem

The automation email metrics in the daily reporting table were showing impossible numbers:

**Before Fix:**
- Feb 17, 2026: `4,753 sends`, `9,744 opens`, `4,449 clicks`
  - Opens > Sends (impossible!)
  - Clicks almost equal to sends (unrealistic)

## Root Cause

The `v_master_daily_metrics` view uses `LAG()` window functions to calculate daily deltas (differences) from lifetime campaign totals. The issue occurred when:

1. **Campaigns are sparse**: Automation campaigns are only sent on certain days (e.g., Feb 16, Feb 20)
2. **Date spine is complete**: The view creates a row for EVERY day, even days with no campaigns
3. **LAG calculation breaks**: On days with no campaigns (Feb 17-19), the LAG() still calculated a delta from stale lifetime totals from the previous campaign day

This produced incorrect "phantom" metrics on days when no emails were actually sent.

## Solution

Modified the `email_daily_automation` CTE in the view to only calculate deltas when lifetime values actually increase:

```sql
-- FIX: Calculate daily deltas for automation campaigns
-- Only show non-zero values on days when campaigns actually sent
email_daily_automation AS (
SELECT
date,
campaigns_launched as automation_campaigns_launched,
-- Only calculate deltas when there's actual campaign activity on this date
CASE 
  WHEN lifetime_sends > COALESCE(LAG(lifetime_sends) OVER (ORDER BY date), 0)
  THEN GREATEST(0, lifetime_sends - COALESCE(LAG(lifetime_sends) OVER (ORDER BY date), 0))
  ELSE 0
END as automation_sends,
CASE 
  WHEN lifetime_opens > COALESCE(LAG(lifetime_opens) OVER (ORDER BY date), 0)
  THEN GREATEST(0, lifetime_opens - COALESCE(LAG(lifetime_opens) OVER (ORDER BY date), 0))
  ELSE 0
END as automation_opens,
CASE 
  WHEN lifetime_clicks > COALESCE(LAG(lifetime_clicks) OVER (ORDER BY date), 0)
  THEN GREATEST(0, lifetime_clicks - COALESCE(LAG(lifetime_clicks) OVER (ORDER BY date), 0))
  ELSE 0
END as automation_clicks,
avg_open_rate as automation_avg_open_rate,
avg_ctr as automation_avg_ctr
FROM email_lifetime_automation
),
```

## Results

**After Fix:**
- **Feb 15**: `0 sends`, `0 opens`, `0 clicks` ✅
- **Feb 16**: `27,635 sends`, `2,868 opens`, `1,048 clicks` ✅ (realistic ratios)
- **Feb 17**: `0 sends`, `0 opens`, `0 clicks` ✅ (no campaigns sent)
- **Feb 18**: `0 sends`, `0 opens`, `0 clicks` ✅ (no campaigns sent)
- **Feb 19**: `0 sends`, `0 opens`, `0 clicks` ✅ (no campaigns sent)
- **Feb 20**: `513,862 sends`, `168,969 opens`, `35,656 clicks` ✅ (realistic ratios)

## Impact

- **Email Marketing dashboard** now shows accurate automation metrics
- **Weekly/Monthly rollups** will calculate correct totals (only counting actual sends)
- **Reporting integrity** restored - no more impossible metric values

## Files Modified

- `opsos-864a1.marketing_ai.v_master_daily_metrics` (BigQuery view)
- `opsos-864a1.reporting.daily_metrics` (rebuilt from view)

## Date

February 20, 2026
