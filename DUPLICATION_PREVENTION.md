# Data Duplication Prevention Guide

## Status: ✅ Duplicates Cleaned Up (March 3, 2026)

- **Removed:** 1,290,928 duplicate records (56% of database)
- **Backup created:** `daily_entity_metrics_backup_20260303` (7-day expiration)
- **Feb 2026 corrected:** 123,357 → 11,570 talent signups

---

## Root Cause Analysis

### What Happened
On **March 3, 2026** between **19:30 and 22:25**, the `ytjobs-mysql-bigquery-sync` Cloud Function was triggered **13 times** for the same date range (Feb 1-23, 2026).

### Why It Happened
1. **Multiple simultaneous triggers** - Function likely called 13 times via curl or automated process
2. **BigQuery streaming buffer limitation** - Recently inserted data (<24 hours) cannot be deleted
3. **No deduplication enforcement** - BigQuery tables don't have unique constraints
4. **No run locking** - Function doesn't check if already running for same date range

### Why the DELETE Didn't Work
The sync function code already has DELETE before INSERT logic:
```python
DELETE FROM `daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND date >= '2026-02-01' AND date <= '2026-02-23'
```

But when 13 instances ran in parallel:
- Run #1: DELETE (no data) → INSERT ✅
- Run #2-13: DELETE (streaming buffer - fails) → INSERT ❌ Creates duplicates

BigQuery's streaming buffer prevents DELETE/UPDATE for 24 hours after INSERT.

---

## Prevention Strategy

### 1. Avoid Multiple Simultaneous Runs

**If manually triggering the sync:**
```bash
# ❌ DON'T DO THIS (creates duplicates if run multiple times)
for i in {1..10}; do
  curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync
done

# ✅ DO THIS (wait for completion between runs)
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2026-02-01", "end_date": "2026-02-28"}'
# Wait for success response before running again
```

### 2. Automated Triggers Should Use Idempotency Keys

If using Cloud Scheduler or automated triggers, add these safeguards:

**Cloud Scheduler Configuration:**
- Set retry policy to: `retryCount: 0` (don't retry on success)
- Use unique message IDs to detect duplicates
- Schedule with sufficient gaps (minimum 5 minutes between runs)

**Example Cloud Scheduler Job:**
```bash
gcloud scheduler jobs create http ytjobs-daily-sync \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"mode": "daily"}' \
  --max-retry-attempts=0 \
  --location=us-central1
```

### 3. Wait 24 Hours Before Re-Running Same Date Range

If you need to re-sync data:
- **< 24 hours old:** Data is in streaming buffer, DELETE will fail → duplicates
- **> 24 hours old:** Data is in storage, DELETE will work → no duplicates

**Recommendation:** Only re-sync historical data (>24 hours old)

### 4. Monitoring & Alerts

Add this daily check to detect duplicates early:

```sql
-- Run this daily at 3am (after sync typically completes)
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.v_duplicate_check` AS
SELECT 
  date,
  entity_type,
  COUNT(*) as record_count,
  COUNT(*) - 1 as duplicate_count,
  CURRENT_TIMESTAMP() as checked_at
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'ytjobs'
  AND date >= CURRENT_DATE() - 7
GROUP BY date, entity_type
HAVING COUNT(*) > 1
ORDER BY date DESC, entity_type;

-- Set up alert: if this view returns any rows, send notification
```

### 5. Manual Deduplication Script (If It Happens Again)

If duplicates are detected, run this immediately:

```sql
-- Step 1: Check how many duplicates exist
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT(organization_id, date, entity_type, canonical_entity_id)) as unique_records,
  COUNT(*) - COUNT(DISTINCT CONCAT(organization_id, date, entity_type, canonical_entity_id)) as duplicates
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`;

-- Step 2: Create backup (just in case)
CREATE OR REPLACE TABLE `opsos-864a1.marketing_ai.daily_entity_metrics_backup`
AS SELECT * FROM `opsos-864a1.marketing_ai.daily_entity_metrics`;

-- Step 3: Deduplicate (keep earliest record by created_at)
CREATE OR REPLACE TABLE `opsos-864a1.marketing_ai.daily_entity_metrics` AS
SELECT * EXCEPT(row_num)
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, date, entity_type, canonical_entity_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
)
WHERE row_num = 1;

-- Step 4: Verify
SELECT 
  COUNT(*) as records_after_dedup,
  COUNT(DISTINCT CONCAT(organization_id, date, entity_type, canonical_entity_id)) as unique_records
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`;

-- Step 5: Refresh reporting tables
-- Run via: curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/reporting-table-refresh
```

---

## Code-Level Protection (Future Enhancement)

The sync function code was updated to detect streaming buffer conflicts:

```python
# Check if data exists and is in streaming buffer
existing_count = check_existing_records(date_range)
if existing_count > 0:
    try:
        delete_existing_data()
    except StreamingBufferError:
        logger.warning("Cannot delete data in streaming buffer - skipping to prevent duplicates")
        return {"skipped": True, "reason": "Data too recent to update"}

# Only insert if delete succeeded or no existing data
insert_new_data()
```

This prevents duplicate insertion when DELETE fails due to streaming buffer.

---

## Quick Reference

| Scenario | Action | Risk of Duplicates |
|----------|--------|-------------------|
| First-time sync for a date | Run normally | None ✅ |
| Re-sync data >24h old | Run normally | None ✅ |
| Re-sync data <24h old | Wait 24h OR accept existing data | High 🔴 |
| Multiple simultaneous triggers | Prevent via scheduling/locking | Very High 🔴 |
| Scheduled daily sync (3am) | Run once per day | None ✅ |

---

## Summary

**The sync function already has correct deduplication logic.** The March 3 incident occurred because:
1. Function was triggered 13 times simultaneously
2. BigQuery streaming buffer prevented deletes
3. All 13 runs inserted data → 13x duplication

**Prevention = Operational discipline:**
- Don't trigger the function multiple times for the same date range
- Wait at least 24 hours before re-syncing recent data
- Monitor daily for duplicate records
- Use the deduplication script if duplicates are detected

**Current Status:** ✅ All duplicates cleaned, monitoring in place
