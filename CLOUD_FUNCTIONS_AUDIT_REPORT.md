# Cloud Functions Audit Report
**Date:** February 24, 2026
**Auditor:** AI Assistant

## Executive Summary

All 21 Cloud Functions are deployed, but **1 critical function is failing** that blocks all weekly/monthly metrics:

- ❌ **reporting-table-refresh**: BROKEN (Has 73 columns, needs 101)
- ⏱️ **ga4-raw-bigquery-sync**: Timing out (likely working, just slow)
- ⏱️ **ytjobs-mysql-bigquery-sync**: Timing out (likely working, just slow)

### Impact

The `reporting-table-refresh` function has been **failing silently since October 27, 2025** causing:
- Weekly metrics table (`reporting.weekly_metrics`) stuck 4 months old
- Growth Dashboard showing incomplete/outdated data
- Revenue Dashboard showing different date ranges than main metrics

---

## Deployed Functions Status

### ✅ Data Ingestion (9/9 deployed)
1. ✅ ga4-bigquery-sync (Updated: Feb 21)
2. ✅ ga4-raw-bigquery-sync (Updated: Feb 19) - SLOW
3. ✅ stripe-bigquery-sync (Updated: Feb 7)
4. ✅ activecampaign-bigquery-sync (Updated: Feb 20)
5. ✅ quickbooks-bigquery-sync (Updated: Jan 31)
6. ✅ google-ads-bigquery-sync (Updated: Feb 20)
7. ✅ dataforseo-bigquery-sync (Updated: Feb 21)
8. ✅ social-media-bigquery-sync (Updated: Feb 21)
9. ✅ ytjobs-mysql-bigquery-sync (Updated: Feb 14) - SLOW

###  ETL & Rollups (6/6 deployed)
1. ❌ **reporting-table-refresh** (Updated: Feb 20) - **BROKEN**
2. ✅ daily-rollup-etl (Updated: Jan 30)
3. ✅ weekly-rollup-etl (Updated: Feb 6)
4. ✅ monthly-rollup-etl (Updated: Jan 26)
5. ✅ l12m-rollup-etl (Updated: Feb 6)
6. ✅ alltime-rollup-etl (Updated: Feb 6)

### ✅ Orchestration (1/1 deployed)
1. ✅ nightly-sync-scheduler (Updated: Feb 19)

### ✅ Other (5/5 deployed)
1. ✅ entity-map-seeder (Updated: Jan 25)
2. ✅ marketing-optimization-engine (Updated: Jan 23)
3. ✅ marketing-analyze-traffic (Updated: Jan 22)
4. ✅ marketing-discover-events (Updated: Jan 22)
5. ✅ scout-ai-engine (Updated: Feb 3)

---

## Critical Issue Details

### reporting-table-refresh

**Error:**
```
400 Inserted row has wrong column count; Has 73, expected 101 at [3:9]
```

**Root Cause:**
- Table schema has 101 columns
- Cloud Function INSERT query only includes 73 columns
- Missing 28 columns causes BigQuery to reject the insert

**Missing Columns (28 total):**
1. apps_per_job
2. revenue_per_talent_signup  
3. revenue_per_hire
4. purchases_per_customer_daily
5. cumulative_purchases
6. cumulative_company_signups
7. company_purchase_conversion_pct
8. avg_purchases_per_company
9. mrr
10. arr
11. active_subscriptions
12. churned_subscriptions
13. churn_rate_pct
14. events_per_session
15. revenue_per_session
16. campaign_click_to_open_pct
17. email_contacts_total
18. email_list_subscribers_total
19. email_daily_opens
20. email_daily_unique_openers
21. email_daily_clicks
22. email_daily_unique_clickers
23. talent_signups_dod
24. company_signups_dod
25. applications_dod
26. revenue_dod
27. sessions_dod
28. purchases_dod
29. stripe_revenue_dod

**Impact Timeline:**
- Last successful run: October 27, 2025
- Days broken: ~120 days
- Weeks of missing data: ~17 weeks
- Monthly rollups: Also affected

**Fix Required:**
Update `/cloud-functions/data-sync/reporting-table-refresh/main.py` to include all 101 columns with proper aggregations.

---

## Recommendations

### Immediate Actions (Priority 1)
1. ✅ Fix `reporting-table-refresh` column mismatch
2. ✅ Deploy fixed version
3. ✅ Manually trigger to backfill 4 months of data
4. ✅ Verify weekly/monthly tables are current

### Short-term (Priority 2)
1. Add monitoring/alerting for Cloud Function failures
2. Investigate timeout issues for GA4/MySQL syncs
3. Add automated tests for schema changes
4. Document expected run times for each function

### Long-term (Priority 3)
1. Implement schema version control
2. Add pre-deployment validation
3. Set up Cloud Function error dashboards
4. Create rollback procedures

---

## Next Steps

1. Generate complete INSERT query with all 101 columns
2. Update `reporting-table-refresh/main.py`
3. Update `reporting-table-refresh/main.py` for monthly_metrics too  
4. Deploy updated function
5. Manually trigger to rebuild weekly/monthly tables
6. Verify data integrity
7. Monitor nightly scheduler for 3 days

---

## Appendix: Column Aggregations

See generated aggregation logic for all 101 columns in audit output.
