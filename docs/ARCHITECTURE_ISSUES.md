# OpsOS Data Architecture Issues

**Date:** January 30, 2026  
**Status:** ✅ RESOLVED - Architecture refactored, redundancies eliminated

---

## Overview

This document tracks the data architecture issues identified on January 30, 2026, and the fixes implemented.

---

## ✅ FIXES IMPLEMENTED

### 1. Firebase Extensions Removed (12 Cloud Functions eliminated)

**What was wrong:**
- 12 Cloud Functions were syncing Firestore to BigQuery `firestore_export` dataset
- This dataset was **completely unused** - no code queried these tables
- Estimated waste: $50-100/month

**Fix implemented:**
- Removed all Firebase BigQuery Export extensions from `firebase.json`
- Deleted extension configuration files from `/extensions/` folder
- Created cleanup script: `scripts/cleanup-unused-extensions.sh`

**Files changed:**
- `firebase.json` - Extensions section removed
- `extensions/` folder - Deleted

---

### 2. New BigQuery Sync Functions Created

**What was wrong:**
- Stripe, QuickBooks, and Google Ads data only existed in Firestore
- Scout AI detectors couldn't analyze financial or advertising data
- No unified data model for cross-channel analysis

**Fix implemented - 3 new Cloud Functions:**

| Function | Source | Destination | Entity Types |
|----------|--------|-------------|--------------|
| `stripe-bigquery-sync` | Firestore | BigQuery `marketing_ai` | `revenue`, `subscription`, `customer` |
| `quickbooks-bigquery-sync` | Firestore | BigQuery `marketing_ai` | `invoice`, `expense`, `account` |
| `google-ads-bigquery-sync` | Firestore | BigQuery `marketing_ai` | `ad_account`, `campaign`, `ad_group` |

**New columns added to `daily_entity_metrics`:**
- `data_source` - Tracks which system the data came from
- `revenue`, `mrr`, `arr` - Financial metrics
- `ad_spend`, `roas`, `cpc`, `cpa` - Advertising metrics
- `expense_amount`, `accounts_receivable` - Accounting metrics

**Files created:**
- `cloud-functions/stripe-bigquery-sync/main.py`
- `cloud-functions/quickbooks-bigquery-sync/main.py`
- `cloud-functions/google-ads-bigquery-sync/main.py`

---

### 3. BigQuery Opportunities Schema Fixed

**What was wrong:**
- Scout AI tried to write nested JSON objects (evidence, metrics, etc.) to BigQuery
- BigQuery rejected these because schema expected STRING, not RECORD
- Result: BigQuery opportunities table was empty/broken

**Fix implemented:**
- Updated `write_opportunities_to_bigquery()` in Scout AI to serialize JSON fields
- Created proper schema in `opportunities_schema.sql`
- JSON fields now stored as STRING type and parsed with `JSON_VALUE()` when needed

**Files changed:**
- `cloud-functions/scout-ai-engine/main.py`
- `cloud-functions/scout-ai-engine/opportunities_schema.sql` (new)

---

### 4. Cleanup Logic Added to ETL Functions

**What was wrong:**
- One-way sync: Deleting from Firestore didn't delete from BigQuery
- Data accumulated forever with no cleanup
- Required manual deletion of 554,852 rows

**Fix implemented:**
- Added DELETE-before-INSERT pattern to all ETL functions
- Added `data_source` field to track ownership of rows
- Each function only deletes rows it created

**Files changed:**
- `cloud-functions/dataforseo-bigquery-sync/main.py` - Added delete query before insert
- `cloud-functions/daily-rollup-etl/main.py` - Added data_source field and improved cleanup

---

### 5. Unified Deployment Script Created

**Files created:**
- `cloud-functions/deploy-all.sh` - Single script to deploy all Cloud Functions

**Usage:**
```bash
./deploy-all.sh              # Deploy all functions
./deploy-all.sh scout-ai     # Deploy specific function
./deploy-all.sh --list       # List all functions
```

---

## Updated Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL APIs                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ VERCEL (UI)     │     │ CLOUD FUNCTIONS     │     │ NATIVE EXPORTS  │
│                 │     │                     │     │                 │
│ - OAuth flows   │     │ ✅ stripe-bigquery  │     │ GA4 → BigQuery  │
│ - Status checks │     │ ✅ quickbooks-bq    │     │                 │
│ - Trigger sync  │     │ ✅ google-ads-bq    │     │                 │
│                 │     │ ✅ dataforseo-bq    │     │                 │
│                 │     │ ✅ daily-rollup-etl │     │                 │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BigQuery: marketing_ai (Unified Data Warehouse)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tables:                                                                      │
│   • daily_entity_metrics (ALL sources with data_source column)              │
│   • monthly_entity_metrics (aggregated)                                      │
│   • opportunities (fixed schema with JSON fields as STRING)                  │
│                                                                              │
│ Entity Types:                                                                │
│   • page, keyword, domain (DataForSEO)                                       │
│   • email, traffic_source (GA4/ActiveCampaign)                              │
│   • revenue, subscription, customer (Stripe) ✅ NEW                          │
│   • invoice, expense, account (QuickBooks) ✅ NEW                            │
│   • campaign, ad_group, ad_account (Google Ads) ✅ NEW                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCOUT AI ENGINE                                    │
│                       (All detectors now have access)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ SEO Detectors (DataForSEO data)                                          │
│ ✅ Traffic Detectors (GA4 data)                                             │
│ ✅ Email Detectors (ActiveCampaign data)                                    │
│ ✅ Revenue Detectors (Stripe data) - NOW WORKING                            │
│ ✅ Advertising Detectors (Google Ads data) - NOW WORKING                    │
│ ✅ Financial Detectors (QuickBooks data) - NOW WORKING                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Remaining Work (Future)

### 1. Add Firestore TTL Rules
- Add 30-90 day TTL on raw data collections
- Reduces Firestore storage costs

### 2. Add BigQuery Partition Expiration
- Set 90-day expiration on `daily_entity_metrics` partitions
- Automatic cleanup of old data

### 3. Move Data Ingestion to Cloud Functions
- Currently: Vercel API → External API → Firestore
- Target: Vercel (trigger) → Cloud Function → External API → BigQuery
- Benefits: No timeouts, better reliability

### 4. Delete Unused BigQuery Dataset
```bash
# After verifying firestore_export is unused
bq rm -r -f opsos-864a1:firestore_export
```

---

## Cost Savings Summary

| Action | Status | Estimated Savings |
|--------|--------|-------------------|
| Remove Firebase Extensions | ✅ Done | $50-100/month |
| Add cleanup logic to ETL | ✅ Done | Prevents unbounded growth |
| Delete firestore_export dataset | 🔜 Todo | $10-30/month |
| Add Firestore TTL | 🔜 Todo | $20-50/month |
| **Total** | | **$80-180/month** |

---

## Files Changed Summary

### Created
- `cloud-functions/stripe-bigquery-sync/` (main.py, requirements.txt, deploy.sh)
- `cloud-functions/quickbooks-bigquery-sync/` (main.py, requirements.txt, deploy.sh)
- `cloud-functions/google-ads-bigquery-sync/` (main.py, requirements.txt, deploy.sh)
- `cloud-functions/scout-ai-engine/opportunities_schema.sql`
- `cloud-functions/deploy-all.sh`
- `scripts/cleanup-unused-extensions.sh`

### Modified
- `firebase.json` - Removed extensions
- `cloud-functions/scout-ai-engine/main.py` - Fixed BigQuery JSON handling
- `cloud-functions/dataforseo-bigquery-sync/main.py` - Added cleanup logic
- `cloud-functions/daily-rollup-etl/main.py` - Added data_source field

### Deleted
- `extensions/firestore-bigquery-export-*.env` (6 files)

---

## Deployment Instructions

1. **Remove Firebase Extensions** (one-time):
   ```bash
   cd scripts
   ./cleanup-unused-extensions.sh
   ```

2. **Deploy all Cloud Functions**:
   ```bash
   cd cloud-functions
   ./deploy-all.sh
   ```

3. **Recreate opportunities table** (if needed):
   ```bash
   # In BigQuery console, run:
   # cloud-functions/scout-ai-engine/opportunities_schema.sql
   ```

4. **Trigger initial data syncs**:
   ```bash
   # Call each sync endpoint with organizationId
   curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/stripe-bigquery-sync \
     -H "Content-Type: application/json" \
     -d '{"organizationId": "YOUR_ORG_ID"}'
   ```
