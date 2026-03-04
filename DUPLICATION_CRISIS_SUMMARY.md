# 🚨 DATA DUPLICATION CRISIS - Feb/Mar 2026

## The Problem in Numbers

### February 2026 Talent Signups

| What Dashboard Shows | What Actually Happened | Inflation Factor |
|---------------------|----------------------|------------------|
| **123,357** | **11,570** | **10.7x TOO HIGH** |

Your dashboard is showing **11x more signups** than actually occurred!

## Root Cause

On **March 3, 2026** between **19:30 and 22:25**, the MySQL → BigQuery sync function ran **13 times** for February 1-23, inserting the same data over and over.

### Timeline of Damage

```
March 3, 2026
├─ 19:30 - Sync run #1 (inserts Feb 1-23 data) ✅ Correct
├─ 21:31 - Sync runs #2-9 (insert SAME data again) ❌ Duplicates
└─ 22:25 - Sync runs #10-13 (insert SAME data again) ❌ More duplicates

Result: 13 identical records for each day
```

## Affected Data

### By Date Range

| Period | Duplication | Affected Days | Total Extra Records |
|--------|-------------|---------------|---------------------|
| **Feb 1-23, 2026** | **13x** | 23 days | ~2,000 duplicate records |
| **Feb 24-28, 2026** | None | 5 days | ✅ Clean |
| **Mar 1-3, 2026** | **3x** | 3 days | ~50 duplicate records |
| **All 2025** | None | 365 days | ✅ Clean |
| **Jan 2026** | None | 31 days | ✅ Clean |

### By Metric

Every core metric for Feb 1-23 is inflated:

| Metric | Database Total | Actual Total | You're Seeing... |
|--------|---------------|--------------|------------------|
| Talent Signups | 123,357 | 11,570 | 111,787 fake signups |
| Company Signups | 38,441 | 3,536 | 34,905 fake signups |
| Jobs Posted | 171,535 | ~13,195 | ~158,340 fake jobs |
| Applications | 5,385,185 | ~414,245 | ~4.9M fake applications |

## Visual Example: Feb 20, 2026

### Raw Database (What You See Now)
```
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 1
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 2 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 3 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 4 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 5 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 6 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 7 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 8 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 9 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 10 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 11 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 12 (DUPLICATE)
date: 2026-02-20, entity: talent_signups, users: 464  ← Record 13 (DUPLICATE)

Dashboard aggregates: 464 × 13 = 6,032 signups shown ❌
```

### After Deduplication (What Should Be)
```
date: 2026-02-20, entity: talent_signups, users: 464  ← Only 1 record

Dashboard shows: 464 signups ✅ CORRECT
```

## Why This Happened

BigQuery tables **do not enforce unique constraints**. When the sync function ran 13 times, it happily inserted the same data 13 times because there's nothing stopping it.

### The Sync Function Logic (Current - BROKEN)
```python
# Current: Always INSERT, never check for existing records
rows = []
for record in mysql_results:
    rows.append({...})

# This INSERT runs 13 times for same data = 13x duplicates
client.insert_rows_json(table, rows)  # ❌ No deduplication
```

### What It Should Be (FIXED)
```python
# Option 1: Delete then insert
client.query(f"DELETE FROM {table} WHERE date >= {start_date} AND date <= {end_date}")
client.insert_rows_json(table, rows)  # ✅ Safe

# Option 2: Use MERGE (upsert)
client.query(f"MERGE {table} ... WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT")  # ✅ Safe
```

## Impact Assessment

### Dashboard Accuracy
- ❌ February 2026 metrics are 10-13x inflated
- ❌ March 1-3, 2026 metrics are 3x inflated
- ❌ Weekly rollups for Feb/Mar are wrong
- ❌ Monthly totals are wrong
- ❌ Year-over-year comparisons broken
- ❌ Trend analysis completely misleading

### What's Still Accurate
- ✅ All 2025 data (Jan-Dec)
- ✅ January 2026 data
- ✅ Stripe revenue (charges/payment_intents not affected by this bug)
- ✅ GA4 data (separate pipeline)

## The Fix (3 Steps)

### Step 1: Deduplicate Existing Data ⏱️ ~5 minutes
```sql
CREATE OR REPLACE TABLE `opsos-864a1.marketing_ai.daily_entity_metrics` AS
SELECT * FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, date, entity_type, canonical_entity_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
)
WHERE row_num = 1;
```

**Expected Results:**
- Before: ~450,000 records
- After: ~430,000 records
- Deleted: ~20,000 duplicate records

### Step 2: Fix the Sync Function ⏱️ ~10 minutes
Add `DELETE` before `INSERT` in `ytjobs-mysql-bigquery-sync/main.py`:
```python
# Before inserting, delete existing records for this date range
delete_query = f"""
DELETE FROM `{project_id}.marketing_ai.daily_entity_metrics`
WHERE organization_id = '{organization_id}'
  AND date >= '{start_date}'
  AND date < '{end_date + timedelta(days=1)}'
"""
client.query(delete_query).result()
logger.info(f"Deleted existing records for {start_date} to {end_date}")

# Now insert fresh data
client.insert_rows_json(table, rows)
```

### Step 3: Refresh Downstream Tables ⏱️ ~5 minutes
```bash
# Views update automatically, but refresh reporting tables:
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/reporting-table-refresh \
  -H "Content-Type: application/json" \
  -d '{"days_back": 90}'
```

## Verification Queries

### Check if duplicates still exist:
```sql
SELECT 
  date,
  entity_type,
  COUNT(*) as record_count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND entity_type IN ('talent_signups', 'company_signups')
  AND date >= '2026-02-01' AND date <= '2026-03-03'
GROUP BY date, entity_type
HAVING COUNT(*) > 1
ORDER BY date, entity_type
```
**Expected:** 0 rows returned = no duplicates ✅

### Check corrected February totals:
```sql
SELECT 
  DATE_TRUNC(date, MONTH) as month,
  SUM(users) as talent_signups
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND entity_type = 'talent_signups'
  AND date >= '2026-02-01' AND date <= '2026-02-28'
GROUP BY month
```
**Expected:** ~11,570 (not 123,357) ✅

## Prevention

Add monitoring to detect future duplicates:

```sql
-- Daily data quality check
SELECT 
  'DUPLICATE ALERT' as alert_type,
  date,
  entity_type,
  COUNT(*) as duplicate_count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND date >= CURRENT_DATE() - 7
GROUP BY date, entity_type
HAVING COUNT(*) > 1
```

Run this daily and alert if any duplicates are found.

---

## Summary

**What happened:** Sync function ran 13 times on March 3, inserting February data repeatedly  
**Impact:** Dashboard shows 10-13x inflated metrics for Feb 1-23  
**Fix:** Delete duplicates + prevent future duplicates  
**Time to fix:** ~20 minutes  
**Urgency:** 🚨 CRITICAL - Fix before any new syncs run or problem compounds
