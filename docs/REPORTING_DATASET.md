# Reporting dataset

The **`reporting`** dataset holds materialized tables for fast reporting. Point dashboards and reporting tools at these tables instead of the `marketing_ai` views.

## Tables

| Table | Source view | Partition | Use for |
|-------|-------------|-----------|---------|
| `reporting.daily_metrics` | `marketing_ai.v_master_daily_metrics` | `date` | Day-level reports |
| `reporting.weekly_metrics` | `marketing_ai.v_master_weekly_metrics` | `week_start` | Week-level reports |
| `reporting.monthly_metrics` | `marketing_ai.v_master_monthly_metrics` | `month_start` | Month-level reports |

Same columns as the views; data is copied so reads are fast (no view execution).

## How far back is data complete?

- **Daily view**: Rows exist for **every day from 2025-01-01 through latest** (no gaps).
- **Traffic (sessions)**: GA4 data starts **2025-05-02**; before that `sessions` = 0.
- **Stripe + YTJobs funnel**: Present from **2025-01-01**.
- **Google Ads (gads_*)**: Present from **2026-01-01** only.

So for “complete” daily data including traffic, use **2025-05-02** onward. For funnel + revenue only, **2025-01-01** is complete.

## Refreshing the reporting tables

After syncs (e.g. nightly), refresh so reporting sees new data:

```bash
./scripts/refresh-reporting-tables.sh
```

Or run the three `CREATE OR REPLACE TABLE ... AS SELECT * FROM ...` queries in BigQuery (see script). To run on a schedule, trigger this script from Cloud Scheduler or your CI/nightly job.

## Scheduling (optional)

- **BigQuery Scheduled Queries**: Create one scheduled query per table that runs the corresponding `CREATE OR REPLACE TABLE ... AS SELECT ...` (e.g. daily after 2am).
- **Cloud Scheduler + Cloud Run/Function**: Run `refresh-reporting-tables.sh` in a container or function on a cron schedule.
