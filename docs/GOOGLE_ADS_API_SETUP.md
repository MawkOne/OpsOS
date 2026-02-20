# Google Ads API Setup Guide

## Overview
Your Google Ads sync function is already built and deployed. This guide will help you:
1. Get the required credentials
2. Configure the connection
3. Backfill historical data
4. Clean up existing duplicates

---

## 1. Get Google Ads API Credentials

### A. Developer Token
1. Go to [Google Ads](https://ads.google.com)
2. Click **Tools & Settings** (wrench icon) > **API Center**
3. Apply for a developer token
   - If you have a Manager Account (MCC): Use the MCC token
   - If you have a standard account: May require Google approval (test level is fine)
4. Copy your developer token (format: `abc123xyz456`)

### B. Customer ID
1. Look at the top bar in Google Ads
2. Find your Customer ID (format: `123-456-7890`)
3. **Remove the dashes:** `1234567890`

### C. OAuth Tokens
**You need to create an OAuth flow to get these:**

Your environment already has:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Required scope: `https://www.googleapis.com/auth/adwords`

**OAuth Flow Response Will Give You:**
- `access_token` (expires in ~1 hour)
- `refresh_token` (used to get new access tokens)

---

## 2. Store Credentials in Firestore

Create a document at: `google_ads_connections/{organizationId}`

```javascript
{
  developerToken: "YOUR_DEVELOPER_TOKEN",
  customerId: "1234567890",  // No dashes!
  accessToken: "ya29.a0...",  // From OAuth
  refreshToken: "1//...",      // From OAuth
  tokenExpiresAt: Timestamp.now() + 1 hour,
  status: "connected",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
}
```

**Your organizationId:** Check existing data to find it (likely "ytjobs" or similar)

---

## 3. Trigger Initial Sync

### Deployed Function URL:
```
https://us-central1-opsos-864a1.cloudfunctions.net/google-ads-bigquery-sync
```

### A. Full Backfill (365 days of history)

```bash
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/google-ads-bigquery-sync \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "mode": "full",
    "dateRange": "LAST_365_DAYS"
  }'
```

**This will:**
- Delete ALL existing Google Ads data
- Fetch 365 days of data from Google Ads API
- Insert clean, deduplicated data

### B. Daily Incremental Sync (for automation)

```bash
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/google-ads-bigquery-sync \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "mode": "update",
    "dateRange": "LAST_30_DAYS"
  }'
```

**This will:**
- Delete last 30 days only
- Fetch last 30 days from Google Ads API
- Keep older historical data intact

---

## 4. Clean Up Existing Duplicates

**You currently have 3x duplicate rows for all 27 days of existing data.**

After fixing the sync function and running a full resync, clean up the old duplicates:

```sql
-- This will remove the duplicate rows, keeping only one per date
DELETE FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE STRUCT(date, canonical_entity_id, organization_id, created_at) NOT IN (
  SELECT AS STRUCT date, canonical_entity_id, organization_id, MIN(created_at) as created_at
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type = 'ad_account'
    AND canonical_entity_id LIKE 'google_ads_%'
  GROUP BY date, canonical_entity_id, organization_id
)
AND entity_type = 'ad_account'
AND canonical_entity_id LIKE 'google_ads_%'
```

---

## 5. Set Up Daily Automation

Use Cloud Scheduler to run daily syncs:

```bash
gcloud scheduler jobs create http google-ads-daily-sync \
  --schedule="0 6 * * *" \
  --time-zone="America/New_York" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/google-ads-bigquery-sync" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"organizationId":"YOUR_ORG_ID","mode":"update","dateRange":"LAST_30_DAYS"}' \
  --project=opsos-864a1
```

This runs at 6 AM daily to sync the last 30 days.

---

## 6. Verify Data Quality

After running the full backfill, verify:

```sql
-- Check for duplicates (should return 0 rows)
SELECT 
  date,
  canonical_entity_id,
  COUNT(*) as duplicate_count
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'ad_account'
  AND canonical_entity_id LIKE 'google_ads_%'
GROUP BY date, canonical_entity_id
HAVING COUNT(*) > 1

-- Check data coverage
SELECT 
  MIN(date) as first_date,
  MAX(date) as last_date,
  COUNT(DISTINCT date) as total_days
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'ad_account'
  AND canonical_entity_id LIKE 'google_ads_%'
```

**Expected Results:**
- **First date:** Should match your Google Ads account history (up to 365 days back)
- **Last date:** Yesterday or today
- **Duplicate count:** 0 rows (no duplicates)

---

## 7. Rebuild Reporting Tables

After backfilling, rebuild reporting tables to include historical data:

```bash
cd "/Users/markhenderson/Cursor Projects/OpsOS"

# Clear and rebuild all reporting tables
bq query --use_legacy_sql=false "
DELETE FROM \`opsos-864a1.reporting.daily_metrics\`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)"

bq query --use_legacy_sql=false "
INSERT INTO \`opsos-864a1.reporting.daily_metrics\`
SELECT * FROM \`opsos-864a1.marketing_ai.v_master_daily_metrics\`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)"

# Rebuild weekly and monthly
bq query --use_legacy_sql=false "DROP TABLE IF EXISTS \`opsos-864a1.reporting.weekly_metrics\`"
bq query --use_legacy_sql=false "DROP TABLE IF EXISTS \`opsos-864a1.reporting.monthly_metrics\`"

# Run the rebuild scripts from docs/GOOGLE_ADS_REVENUE_DEDUPLICATION_FIX.md
```

---

## Current Status Summary

### Before Setup:
- ❌ 27 days of data (Jan 23 - Feb 18, 2026)
- ❌ All rows duplicated 3x
- ❌ Revenue inflated 3x ($1,335 instead of $445)
- ❌ No historical data before Jan 23

### After Full Setup:
- ✅ Up to 365 days of data (based on Google Ads history)
- ✅ Clean, deduplicated data
- ✅ Correct revenue and conversions
- ✅ Daily automated syncs
- ✅ Both `/growth/paid` and `/leadership/metrics` show accurate data

---

## Troubleshooting

### "Google Ads not connected"
- Check Firestore document exists at `google_ads_connections/{organizationId}`
- Verify `organizationId` matches your data

### "Failed to refresh token"
- OAuth refresh token may be expired
- Re-run OAuth flow to get new tokens

### "API quota exceeded"
- Google Ads API has daily quotas
- For backfill, spread across multiple days if needed
- Basic access: 15,000 operations/day
- Standard access: Higher limits after approval

### Still seeing duplicates
- Run the cleanup SQL query from Step 4
- Verify the function was redeployed with the fix
- Check Cloud Function logs for delete confirmation

---

## Next Steps

1. ✅ **Done:** Fixed duplicate bug in sync function
2. 🔜 **Get credentials** from Google Ads
3. 🔜 **Store in Firestore**
4. 🔜 **Run full backfill** to get 365 days of data
5. 🔜 **Clean up old duplicates**
6. 🔜 **Rebuild reporting tables**
7. 🔜 **Set up daily automation**
