#!/usr/bin/env bash
# Refresh reporting dataset tables from marketing_ai views.
# Run after syncs (e.g. daily). Point reporting tools at opsos-864a1.reporting.*
set -e
PROJECT=opsos-864a1
REGION=northamerica-northeast1

echo "Refreshing reporting.daily_metrics (May 1 2025 through today)..."
bq query --project_id="$PROJECT" --use_legacy_sql=false --location="$REGION" "
CREATE OR REPLACE TABLE \`${PROJECT}.reporting.daily_metrics\`
PARTITION BY date
OPTIONS(description='Materialized daily metrics for reporting. May 1 2025 through today.')
AS
SELECT * FROM \`${PROJECT}.marketing_ai.v_master_daily_metrics\`
WHERE date >= '2025-05-01' AND date <= CURRENT_DATE()
"

echo "Refreshing reporting.weekly_metrics..."
bq query --project_id="$PROJECT" --use_legacy_sql=false --location="$REGION" "
CREATE OR REPLACE TABLE \`${PROJECT}.reporting.weekly_metrics\`
PARTITION BY week_start
OPTIONS(description='Materialized weekly metrics for reporting. Refresh from v_master_weekly_metrics.')
AS
SELECT * FROM \`${PROJECT}.marketing_ai.v_master_weekly_metrics\`
"

echo "Refreshing reporting.monthly_metrics..."
bq query --project_id="$PROJECT" --use_legacy_sql=false --location="$REGION" "
CREATE OR REPLACE TABLE \`${PROJECT}.reporting.monthly_metrics\`
PARTITION BY month_start
OPTIONS(description='Materialized monthly metrics for reporting. Refresh from v_master_monthly_metrics.')
AS
SELECT * FROM \`${PROJECT}.marketing_ai.v_master_monthly_metrics\`
"

echo "Done. reporting.daily_metrics, .weekly_metrics, .monthly_metrics updated."
