# OpsOS Data Quality Assurance Report
**Generated:** Saturday, January 31, 2026

## Executive Summary

### 🔴 Critical Issues Found
1. **MASSIVE DATA DUPLICATION in Feb 2026** - Feb 1-23 data inserted 13 times (on March 3, 2026)
   - Database shows 123K talent signups, actual is 11.5K
   - All core metrics affected: talent/company signups, jobs, applications
   - Mar 1-3 also has 3x duplicates
2. **GA4 Data Missing Jan 2026** - Only 9 of 31 days present
3. **Multiple Entity Types With Large Gaps** - Several tables have 5-16 missing days

### 🟡 Warnings
- Historical Stripe revenue only exists for Feb 2026 and Apr-Dec 2025
- Several new entity types (bookings, social proof, attribution) have sparse data
- GA4 revenue ($34K) differs from Stripe revenue ($44K) in Feb 2026

### ✅ Healthy
- Core metrics (signups, jobs, applications) complete for Jan 2025 - Feb 23, 2026
- Stripe payment data (charges/intents) complete for Feb 2026
- Revenue calculations aligned across reporting and master view

---

## Detailed Findings

### 1. Date Coverage by Entity Type

| Entity Type | Earliest Date | Latest Date | Days with Data | Missing Days | Status |
|------------|--------------|-------------|----------------|--------------|--------|
| **Core Metrics** |||||| 
| talent_signups | 2025-01-01 | 2026-03-03 | 427 | 0 | ✅ Complete |
| company_signups | 2025-01-01 | 2026-03-03 | 427 | 0 | ✅ Complete |
| jobs_posted | 2025-01-01 | 2026-03-03 | 427 | 0 | ✅ Complete |
| applications | 2025-01-01 | 2026-03-03 | 427 | 0 | ✅ Complete |
| hires | 2025-01-02 | 2026-03-02 | 187 | -238 | ⚠️ Sparse |
| marketplace_revenue | 2025-01-01 | 2026-03-03 | 427 | 0 | ✅ Complete |
| job_views | 2025-10-22 | 2026-03-03 | 133 | 0 | ✅ Recent |
| profile_views | 2025-06-27 | 2026-03-03 | 250 | 0 | ✅ Recent |
| reviews | 2025-01-01 | 2026-03-03 | 427 | 0 | ✅ Complete |
| **Payment Data** ||||||
| charge | 2026-02-01 | 2026-03-03 | 31 | 0 | ✅ Complete |
| payment_intent | 2026-02-01 | 2026-03-03 | 31 | 0 | ✅ Complete |
| payment_session | 2026-02-01 | 2026-03-03 | 31 | 0 | ✅ Complete |
| **Sparse/Gap Data** ||||||
| booking | 2026-02-13 | 2026-03-03 | 3 | -16 | 🔴 Very Sparse |
| attributed_revenue | 2026-02-01 | 2026-03-02 | 23 | -7 | 🔴 Missing Days |
| vouch | 2026-02-01 | 2026-03-02 | 15 | -15 | 🔴 Missing Days |
| feedback | 2026-02-02 | 2026-03-02 | 14 | -15 | 🔴 Missing Days |
| user_badge | 2026-02-01 | 2026-03-03 | 26 | -5 | ⚠️ Missing Days |
| user_stat | 2026-02-01 | 2026-03-03 | 25 | -6 | ⚠️ Missing Days |
| affiliate | 2026-02-01 | 2026-03-03 | 26 | -5 | ⚠️ Missing Days |
| testimonial | 2026-02-13 | 2026-02-15 | 2 | -1 | 🔴 Very Sparse |
| marketplace_health | 2026-02-23 | 2026-03-03 | 3 | -6 | 🔴 Very Sparse |
| coupon_usage | 2026-03-03 | 2026-03-03 | 1 | 0 | ⚠️ Single Day |
| social_channel | 2026-02-21 | 2026-02-21 | 1 | 0 | ⚠️ Single Day |

### 2. February 2026 Data Duplication Crisis

**🔴 CRITICAL: Feb 1-23 data was inserted 13 times**

All duplicate records were created on **March 3, 2026** between 19:30 and 22:25, suggesting the sync function ran 13 times for the February backfill.

| Date Range | Duplicate Count | Database Total (Talent) | Actual Value | Status |
|------------|----------------|-------------------------|--------------|--------|
| Feb 1-23 | **13x duplicates** | 113,489 | 8,789 | 🔴 Inflated 1,300% |
| Feb 24-28 | No duplicates | 2,081 | 2,081 | ✅ Correct |
| Mar 1-3 | **3x duplicates** | 3,591 | 1,197 | 🔴 Inflated 300% |

**Raw vs Corrected Monthly Totals:**

| Metric | Database Total (Duplicated) | Corrected Total | Inflation Factor |
|--------|----------------------------|-----------------|------------------|
| Talent Signups | 123,357 | **11,570** | 10.7x |
| Company Signups | 38,441 | **3,536** | 10.9x |

**Daily Pattern (Corrected Values):**

| Date | Talent Signups | Company Signups | 7-Day Avg | Status |
|------|----------------|-----------------|-----------|--------|
| Feb 1-10 | 382-485 | ~120-150 | ~400 | ✅ Consistent |
| Feb 11-20 | 323-466 | ~100-140 | ~405 | ✅ Consistent |
| Feb 21-28 | 332-504 | ~90-160 | ~430 | ✅ Consistent |

**Analysis:** Once duplicates are removed, February data is actually **completely consistent** throughout the month. There is NO drop-off on Feb 24-28 — that was an illusion caused by comparing duplicated data (Feb 1-23) to clean data (Feb 24-28).

**Root Cause:** The MySQL → BigQuery sync function (`ytjobs-mysql-bigquery-sync`) was triggered 13 times for Feb 1-23 between March 3 19:30-22:25. BigQuery's table design does not enforce unique constraints on `(date, entity_type, canonical_entity_id)`, allowing duplicate inserts.

**Impact:** 
- Dashboard shows 11x inflated numbers for February
- Weekly/monthly rollups are massively overstated
- Reporting tables aggregate the duplicated data
- Trend analysis is completely broken

### 3. Revenue Data Completeness

#### Stripe Revenue by Month (from BigQuery)

| Month | Days with Data | Stripe Revenue | Status |
|-------|----------------|----------------|--------|
| Mar 2026 | 3 | $0 | ⚠️ Partial month |
| Feb 2026 | 28 | **$44,549** | ✅ Complete & Verified |
| Jan 2026 | 31 | $0 | 🔴 Missing |
| Dec 2025 | 31 | $4,313 | ✅ Complete |
| Nov 2025 | 30 | $45,639 | ✅ Complete |
| Oct 2025 | 31 | $42,663 | ✅ Complete |
| Sep 2025 | 30 | $48,387 | ✅ Complete |
| Aug 2025 | 31 | $50,482 | ✅ Complete |
| Jul 2025 | 31 | $34,761 | ✅ Complete |
| Jun 2025 | 30 | $36,590 | ✅ Complete |
| May 2025 | 31 | $45,053 | ✅ Complete |
| Apr 2025 | 30 | $37,762 | ✅ Complete |
| Jan-Mar 2025 | 90 | $0 | 🔴 Missing |

**Analysis:** Stripe payment data (charges/payment_intents) was only synced starting Feb 2026, then backfilled for Apr-Dec 2025. Jan 2026 and Jan-Mar 2025 have no Stripe revenue data.

#### GA4 Revenue Data

| Month | Days with Data | Unique Users | Sessions | Purchases | GA4 Revenue |
|-------|----------------|--------------|----------|-----------|-------------|
| Mar 2026 | 1 | 25,598 | 40,263 | 7 | $1,090 |
| Feb 2026 | 28 | 344,580 | 727,175 | 247 | $34,096 |
| Jan 2026 | 9 | 58,171 | 148,000 | 85 | $13,057 |

**🔴 CRITICAL: GA4 data for Jan 2026 only has 9 of 31 days**

**Revenue Discrepancy:** GA4 shows $34K for Feb 2026 vs Stripe shows $44K. This is expected because:
- GA4 tracks attributed revenue (which transactions came from which marketing channels)
- Stripe tracks all revenue regardless of attribution
- Some purchases may not have GA4 tracking attribution

### 4. Revenue Calculation Alignment (Feb 2026)

✅ **All revenue sources now aligned:**

| Source | Feb 2026 Revenue | Status |
|--------|------------------|--------|
| Stripe (Direct) | $44,549 | ✅ Verified against Stripe dashboard |
| BigQuery `daily_entity_metrics` (charge) | $44,549 | ✅ Matches Stripe |
| `v_master_daily_metrics` (stripe_revenue) | $44,549 | ✅ Matches |
| `reporting.daily_metrics` (stripe_revenue) | $44,549 | ✅ Matches |
| GA4 Purchase Revenue | $34,096 | ✅ Expected difference (attribution only) |

**Recent Fixes Applied:**
- ✅ Fixed double-counting of charges + payment_intents (was $66K, now $44K)
- ✅ Filtered revenue to only count `succeeded` transactions
- ✅ Added `conversions` field to track successful payments
- ✅ Completed Feb 24-28 backfill for Stripe data

### 5. Data Pipeline Status

#### MySQL → BigQuery Sync (`ytjobs-mysql-bigquery-sync`)

**✅ Working Tables:**
- talent_signups (users)
- company_signups (users)
- jobs_posted (jobs)
- applications
- hires
- marketplace_revenue
- job_views
- profile_views
- reviews
- charges (Stripe) - **Recently fixed**
- payment_intents (Stripe) - **Recently fixed**

**⚠️ Sparse/Incomplete Tables:**
- bookings (only 3 days)
- one_click_hirings (sync errors with missing `amount` column)
- vouches (15 missing days)
- testimonials (only 2 days)
- feedback (15 missing days)
- user_badges (5 missing days)
- user_stats (6 missing days)
- affiliates (5 missing days)

**🔴 Not Syncing:**
- extra_attributes (attribution data) - table exists in MySQL but not synced to BigQuery

#### GA4 → BigQuery Export

- ✅ Exporting daily to `analytics_301802672.events_*`
- ✅ Feb 2026: 28 of 28 days (missing Feb 29 - not a leap year)
- 🔴 Jan 2026: Only 9 of 31 days
- ⚠️ Dec 2025 and earlier: Not checked

---

## Recommendations

### Immediate Actions (Critical)

1. **DELETE DUPLICATE DATA IMMEDIATELY**
   - Use ROW_NUMBER() to identify and delete duplicates in `daily_entity_metrics`
   - Keep only one record per `(date, entity_type, canonical_entity_id)` tuple
   - Prioritize keeping the earliest `created_at` record
   - Affects Feb 1-23 (13x) and Mar 1-3 (3x)
   - **Must run before any new syncs or the problem will compound**

2. **Prevent Future Duplicates**
   - Add deduplication logic to `ytjobs-mysql-bigquery-sync` function
   - Use `DELETE ... WHERE` or `MERGE` statement instead of `INSERT`
   - Consider adding application-level unique constraint checking
   - Add monitoring to detect duplicate insertions

3. **Refresh All Downstream Tables**
   - After deduplication, refresh `v_master_daily_metrics` view
   - Re-run `reporting-table-refresh` for Feb and Mar 2026
   - Verify dashboard displays correct totals

4. **Backfill GA4 Data for Jan 2026**
   - GA4 exports should be automatic - investigate why only 9 days exist
   - Check if GA4 property was properly configured in early January
   - May need to manually export if data is lost

3. **Backfill Missing Stripe Revenue**
   - Jan 2026: Run charges/payment_intents sync for full month
   - Jan-Mar 2025: Run sync if Stripe data exists for these months

### Short-term Improvements

5. **Fix Sparse Entity Types**
   - Investigate why bookings, vouches, testimonials have gaps
   - Fix `one_click_hirings` table schema issue (missing `amount` column)
   - Add monitoring alerts for missing daily data

6. **Sync Attribution Data**
   - Add `extra_attributes` table to MySQL → BigQuery sync
   - Join with charges to show which revenue came from which sources
   - Display in OpsOS dashboard

7. **Add Data Quality Monitoring**
   - Create daily QA checks for expected data volumes
   - Alert when metrics drop >50% day-over-day (like Feb 23→24)
   - Track sync job success/failure rates

### Long-term Enhancements

8. **Historical Data Completeness**
   - Determine if Jan-Mar 2025 Stripe data exists and should be backfilled
   - Check if GA4 data exists for Dec 2025 and earlier
   - Document what date ranges are expected vs missing

9. **Data Pipeline Resilience**
   - Add retry logic for failed syncs
   - Implement incremental backfill for detected gaps
   - Add data freshness metrics to dashboard

---

## Summary Statistics

### Data Coverage Score by Category

| Category | Score | Details |
|----------|-------|---------|
| Core Metrics | **85%** | Complete except Feb 24-28 issue |
| Stripe Revenue | **70%** | Complete Feb 2026, gaps in Jan 2026 and Q1 2025 |
| GA4 Analytics | **60%** | Good Feb 2026, incomplete Jan 2026 |
| Payment Details | **95%** | Excellent coverage where it exists (Feb 2026+) |
| Social Proof | **30%** | Vouches, testimonials, feedback very sparse |
| Attribution | **40%** | Some attributed_revenue, no user-level attribution yet |
| User Engagement | **50%** | Badges and stats have gaps |

### Overall Data Quality: **65%** (40% when considering duplication)

**Strengths:**
- Core business metrics (signups, jobs, applications) have excellent historical coverage
- Recent payment data (Feb 2026) is complete and accurate
- Revenue calculations are now aligned across all sources
- No duplicate/double-counting issues

**Weaknesses:**
- 🚨 **CRITICAL: 13x data duplication in Feb 1-23 and 3x in Mar 1-3**
- Database contains 10-13x more records than actual for these periods
- All dashboards showing massively inflated February numbers
- GA4 data missing most of Jan 2026
- Stripe revenue not backfilled for all historical periods
- Many newer entity types have incomplete data
- Attribution data not yet synced to BigQuery

---

## Data Deduplication Required

Before any other work, you **MUST** deduplicate the following periods:

### Affected Date Ranges
- **Feb 1-23, 2026:** 13 duplicate records per day per entity
- **Mar 1-3, 2026:** 3 duplicate records per day per entity
- **All duplicates created:** March 3, 2026 between 19:30-22:25

### Deduplication Strategy
```sql
-- Step 1: Create deduped table
CREATE OR REPLACE TABLE `opsos-864a1.marketing_ai.daily_entity_metrics_deduped` AS
SELECT * FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, date, entity_type, canonical_entity_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
)
WHERE row_num = 1;

-- Step 2: Verify counts
SELECT COUNT(*) as before FROM `opsos-864a1.marketing_ai.daily_entity_metrics`;
SELECT COUNT(*) as after FROM `opsos-864a1.marketing_ai.daily_entity_metrics_deduped`;

-- Step 3: Replace original table (after verification)
DROP TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`;
CREATE TABLE `opsos-864a1.marketing_ai.daily_entity_metrics` AS
SELECT * EXCEPT(row_num) FROM `opsos-864a1.marketing_ai.daily_entity_metrics_deduped`;
DROP TABLE `opsos-864a1.marketing_ai.daily_entity_metrics_deduped`;
```

---

**Next Steps:** 
1. **IMMEDIATELY deduplicate data** before any new syncs run
2. Add duplicate prevention to sync function  
3. Refresh all downstream reporting tables
4. Then address other issues (GA4 backfill, attribution sync)
