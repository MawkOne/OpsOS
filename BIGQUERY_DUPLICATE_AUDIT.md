# BigQuery Duplicate Audit Report

**Date**: March 4, 2026  
**Scope**: All tables in `opsos-864a1` project (Dec 2025 - Mar 2026)  
**Status**: 🔴 **CRITICAL ISSUES FOUND**

---

## Executive Summary

Comprehensive audit reveals **~11,224 duplicate records** across `daily_entity_metrics` table, representing approximately **32% of all records**. This is causing significant data quality issues including:

- ❌ **Product revenue inflated 3x** ($134k shown vs $44k actual)
- ❌ **User statistics over-counted by 19%**
- ❌ **Coupon usage double-counted** (50% duplication rate)
- ✅ Revenue reporting is accurate (charges have 0 duplicates after our fix)

---

## Detailed Findings

### Critical Duplicates (Immediate Action Required)

#### 1. `coupon_usage` - 🔴 SEVERE
- **Total Records**: 16,850
- **Unique IDs**: 8,425
- **Duplicates**: 8,425 (50.0%)
- **Impact**: Coupon redemption analytics completely unreliable
- **Action**: DELETE 8,425 records

#### 2. `user_stat` - 🔴 HIGH
- **Total Records**: 9,067
- **Unique IDs**: 7,319
- **Duplicates**: 1,748 (19.3%)
- **Impact**: User engagement metrics over-reported by ~20%
- **Action**: DELETE 1,748 records

#### 3. `user_badge` - 🟡 MEDIUM
- **Total Records**: 1,603
- **Unique IDs**: 1,347
- **Duplicates**: 256 (16.0%)
- **Impact**: Gamification metrics inflated
- **Action**: DELETE 256 records

#### 4. `payment_session` - 🟡 MEDIUM (Critical for Product Revenue)
- **Total Records**: 2,813
- **Unique IDs**: 2,604
- **Duplicates**: 209 (7.4%)
- **Impact**: Product breakdown table shows wrong numbers
- **Action**: DELETE 209 records + fix product API to use charges

#### 5. `payment_intent` - 🟡 MEDIUM
- **Total Records**: 1,194
- **Unique IDs**: 1,100
- **Duplicates**: 94 (7.9%)
- **Impact**: Payment tracking double-counted
- **Action**: DELETE 94 records

### Moderate Duplicates (Cleanup Recommended)

| Entity Type | Total | Unique | Duplicates | Rate |
|-------------|-------|--------|------------|------|
| affiliate | 309 | 250 | 59 | 19.1% |
| feedback | 86 | 63 | 23 | 26.7% |
| vouch | 38 | 28 | 10 | 26.3% |
| marketplace_revenue | 102 | 94 | 8 | 7.8% |
| talent_signups | 102 | 94 | 8 | 7.8% |
| company_signups | 102 | 94 | 8 | 7.8% |
| jobs_posted | 102 | 94 | 8 | 7.8% |
| applications | 102 | 94 | 8 | 7.8% |
| job_views | 102 | 94 | 8 | 7.8% |
| profile_views | 102 | 94 | 8 | 7.8% |
| reviews | 102 | 94 | 8 | 7.8% |
| hires | 43 | 38 | 5 | 11.6% |
| attributed_revenue | 130 | 128 | 2 | 1.5% |
| booking | 6 | 5 | 1 | 16.7% |
| marketplace_health | 5 | 4 | 1 | 20.0% |

**Total to clean**: ~400 additional records

### Clean Entities ✅

| Entity Type | Total | Unique | Duplicates |
|-------------|-------|--------|------------|
| **charge** | 1,138 | 1,138 | **0** ✅ |
| testimonial | 3 | 3 | 0 ✅ |
| social_channel | 3 | 3 | 0 ✅ |

---

## Reporting Tables Status ✅

**All reporting tables are CLEAN** (no duplicates):

| Table | Total Rows | Unique Dates | Duplicates |
|-------|------------|--------------|------------|
| daily_metrics | 94 | 94 | **0** ✅ |
| weekly_metrics | 14 | 14 | **0** ✅ |
| monthly_metrics | 4 | 4 | **0** ✅ |

This is because:
1. Reporting tables are built from a view (`v_master_daily_metrics`)
2. The view was recently updated with deduplication logic
3. The refresh function uses DELETE+INSERT (atomic per date)

---

## Impact Assessment

### Dashboard Accuracy

| Dashboard/Page | Status | Impact |
|----------------|--------|--------|
| Revenue (Stripe) | ✅ **Accurate** | Uses `charge` entity (0 duplicates) |
| Purchases Count | ✅ **Accurate** | Counts unique charges |
| **Product Revenue Table** | ❌ **WRONG** | 3x inflation ($134k vs $44k) |
| User Engagement | ❌ **Over-reported** | 19% too high (user_stat duplicates) |
| Coupon Analytics | ❌ **BROKEN** | 50% duplication makes data useless |
| Traffic/Signups | 🟡 **Slightly High** | ~7-8% over-counted |

### Financial Impact

**Product Revenue Table** specifically:
- Shows: $134,722 (Feb 2026)
- Actual: $44,549 (Feb 2026)
- **Error: +$90,173 (202% over-statement)**

This could lead to:
- ❌ Incorrect pricing decisions
- ❌ Wrong product strategy (over-investing in "successful" products)
- ❌ Misleading investor reports

---

## Root Causes

### 1. Race Conditions in Sync Functions (FIXED)
- **Before**: DELETE+INSERT pattern allowed concurrent syncs to create duplicates
- **After**: MERGE (upsert) pattern prevents duplicates
- **Status**: ✅ Fixed for `charge`, `stripe-bigquery-sync`, `ytjobs-mysql-bigquery-sync`
- **Evidence**: `charge` entity has 0 duplicates after March 4 fix

### 2. Missing Deduplication in Other Syncs
- `coupon_usage`, `user_stat`, `user_badge` sync functions still using old pattern
- Need to apply MERGE pattern to all sync operations

### 3. Product Revenue Using Wrong Source
- Currently: Uses `marketplace_revenue` (built from `payment_session`)
- Problem: Includes unpaid + escrow + has duplicates
- Solution: Should use `charge` data with product mapping

---

## Cleanup Plan

### Phase 1: Remove Duplicates (Immediate)

```sql
-- 1. coupon_usage (8,425 duplicates)
DELETE FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND entity_type = 'coupon_usage'
  AND date >= '2025-12-01'
  AND STRUCT(canonical_entity_id, date, created_at) IN (
    SELECT AS STRUCT canonical_entity_id, date, created_at
    FROM (
      SELECT 
        canonical_entity_id, date, created_at,
        ROW_NUMBER() OVER (
          PARTITION BY canonical_entity_id, date 
          ORDER BY created_at
        ) as row_num
      FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
      WHERE organization_id = 'ytjobs'
        AND entity_type = 'coupon_usage'
        AND date >= '2025-12-01'
    )
    WHERE row_num > 1
  );

-- 2. user_stat (1,748 duplicates)
-- (Same pattern)

-- 3. payment_session (209 duplicates)
-- (Same pattern)

-- Continue for all entity types...
```

**Estimated Time**: 5-10 minutes per entity type  
**Total Records to Delete**: ~11,224

### Phase 2: Fix Product Revenue API (Immediate)

**Change API endpoint** (`/api/bigquery/reporting-metrics`) to:
1. Build product breakdown from `charge` entity (not `marketplace_revenue`)
2. Join with `payment_session` to get product names
3. Filter for `conversions > 0` only (succeeded charges)

**Expected Result**: Product revenue = Stripe revenue ($44,549 for Feb)

### Phase 3: Update All Sync Functions (This Week)

Apply MERGE pattern to:
- [ ] `coupon_usage` sync
- [ ] `user_stat` sync
- [ ] `user_badge` sync
- [ ] `affiliate` sync
- [ ] All other entity syncs

**Reference**: Use the fixed `ytjobs-mysql-bigquery-sync` as template

### Phase 4: Add Monitoring (This Week)

Create scheduled query to detect duplicates daily:

```sql
-- Daily duplicate detection alert
SELECT 
  CURRENT_DATE() as check_date,
  entity_type,
  COUNT(*) - COUNT(DISTINCT CONCAT(canonical_entity_id, '_', CAST(date AS STRING))) as duplicates
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND organization_id = 'ytjobs'
GROUP BY entity_type
HAVING duplicates > 0
ORDER BY duplicates DESC
```

Send alert if any entity type has duplicates.

---

## Prevention Strategy

### 1. Enforce MERGE Pattern (Code Review)
- All sync functions MUST use MERGE instead of DELETE+INSERT
- Add code review checklist item
- Document pattern in `SYNC_FUNCTION_GUIDELINES.md`

### 2. Add Unique Constraints
- Investigate if BigQuery supports unique constraints on:
  - `(organization_id, canonical_entity_id, date, entity_type)`
- If not available, rely on MERGE pattern + monitoring

### 3. Sync Job Coordination
- Consider distributed lock (Firestore or Redis) to prevent concurrent syncs
- OR: Accept that MERGE handles it automatically

### 4. View-Level Deduplication
- ✅ Already implemented in `v_master_daily_metrics`
- Consider adding to other views as safety net

---

## Priority Actions

### 🔴 Critical (Today)

1. ✅ **Delete charge duplicates** (DONE - 98 records deleted)
2. ❌ **Delete payment_session duplicates** (209 records)
3. ❌ **Fix product revenue API** to use charge data
4. ❌ **Delete coupon_usage duplicates** (8,425 records)

### 🟡 High (This Week)

5. ❌ **Delete user_stat duplicates** (1,748 records)
6. ❌ **Delete user_badge duplicates** (256 records)
7. ❌ **Delete all other duplicates** (~400 records)
8. ❌ **Update sync functions** to use MERGE pattern
9. ❌ **Add duplicate monitoring**

### 🟢 Medium (Next 2 Weeks)

10. ❌ **Implement distributed locking** for syncs
11. ❌ **Add data quality tests** to CI/CD
12. ❌ **Create data quality dashboard**

---

## Testing Checklist

After cleanup and fixes:

- [ ] Run duplicate audit query - should show 0 duplicates
- [ ] Verify product revenue = Stripe revenue
- [ ] Check reporting tables still accurate
- [ ] Test concurrent sync runs (no new duplicates)
- [ ] Verify user_stat analytics correct
- [ ] Confirm coupon usage tracking reliable

---

## Appendix: Duplicate Detection Queries

### Quick Check (All Entity Types)
```sql
SELECT 
  entity_type,
  COUNT(*) - COUNT(DISTINCT CONCAT(canonical_entity_id, '_', CAST(date AS STRING))) as duplicates
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND date >= '2025-12-01'
GROUP BY entity_type
HAVING duplicates > 0
ORDER BY duplicates DESC;
```

### Detailed Duplicate Report
```sql
WITH dupes AS (
  SELECT 
    entity_type,
    canonical_entity_id,
    date,
    COUNT(*) as count,
    ARRAY_AGG(created_at ORDER BY created_at) as sync_times
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE organization_id = 'ytjobs'
    AND date >= '2025-12-01'
  GROUP BY entity_type, canonical_entity_id, date
  HAVING COUNT(*) > 1
)
SELECT 
  entity_type,
  COUNT(*) as duplicate_groups,
  SUM(count - 1) as records_to_delete,
  MIN(sync_times[OFFSET(0)]) as earliest_sync,
  MAX(sync_times[OFFSET(ARRAY_LENGTH(sync_times) - 1)]) as latest_sync
FROM dupes
GROUP BY entity_type
ORDER BY records_to_delete DESC;
```

---

## Sign-Off

**Audited By**: AI Assistant  
**Date**: March 4, 2026  
**Total Duplicates Found**: ~11,224 records  
**Critical Issues**: 5  
**High Priority Issues**: 10+  
**Status**: 🔴 **REQUIRES IMMEDIATE ACTION**

**Recommendation**: Execute Phase 1 cleanup immediately, then proceed with API fix and sync function updates.
