# 🤖 Scout AI - Complete Deployment Guide

## Overview

Scout AI is an automated marketing opportunity detection system that:
- Reads your cross-channel marketing data
- Detects 7 types of opportunities automatically
- Scores and prioritizes them
- Surfaces them in a beautiful dashboard
- Sends daily Slack summaries

---

## 📋 Prerequisites

Before deploying, ensure you have:
- ✅ Google Cloud Project (`opsos-864a1`)
- ✅ BigQuery API enabled
- ✅ Cloud Functions API enabled
- ✅ Firestore database set up
- ✅ `gcloud` CLI installed and authenticated
- ✅ Existing marketing data in Firestore:
  - `ga_pages`
  - `ga_campaigns`
  - `dataforseo_keywords`
  - `stripe_products` / `stripe_invoices`
  - `activecampaign_campaigns`

---

## 🚀 Deployment Steps

### Step 1: Create BigQuery Dataset

```bash
# Create the marketing_ai dataset
bq mk --dataset opsos-864a1:marketing_ai
```

### Step 2: Deploy Entity Mapping

```bash
cd "/Users/markhenderson/Cursor Projects/OpsOS/cloud-functions/entity-map-seeder"

# Create table
bq query --use_legacy_sql=false < schema.sql

# Deploy Cloud Function
./deploy.sh

# Seed entity mappings from your existing data
curl -X POST http://localhost:3000/api/entity-map/seed \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

**Expected Result:** 100+ entity mappings created linking your pages, campaigns, keywords, products across platforms.

### Step 3: Deploy Daily Metrics Rollup

```bash
cd "/Users/markhenderson/Cursor Projects/OpsOS/cloud-functions/daily-rollup-etl"

# Create table
bq query --use_legacy_sql=false < schema.sql

# Deploy Cloud Function
./deploy.sh

# Run initial backfill (last 90 days)
curl -X POST http://localhost:3000/api/daily-metrics/sync \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

**Expected Result:** Daily metrics created for all entities across the past 90 days (thousands of rows).

### Step 4: Deploy Scout AI Engine

```bash
cd "/Users/markhenderson/Cursor Projects/OpsOS/cloud-functions/scout-ai-engine"

# Create opportunities and metric_registry tables
bq query --use_legacy_sql=false < schema.sql

# Deploy Cloud Function
./deploy.sh

# (Optional) Set Slack webhook for notifications
gcloud functions deploy scout-ai-engine \
  --set-env-vars SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Step 5: Run Scout AI First Time

```bash
# From your Next.js app
curl -X POST http://localhost:3000/api/opportunities/run \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

**Expected Result:** 20-50 opportunities detected across 7 categories.

### Step 6: Verify in UI

1. Visit: http://localhost:3000/ai/opportunities
2. You should see all detected opportunities
3. Filter by priority, category, status
4. Expand to see details and take actions

---

## 📊 What You Get

### 7 Opportunity Detectors

1. **Scale Winners** 🚀
   - Entities performing well but not getting enough resources
   - Example: Page with 5% conversion rate but only 100 sessions/month

2. **Fix Losers** 🔧
   - High-traffic entities with poor performance
   - Example: 1000 sessions/month but 0.5% conversion rate

3. **Declining Performers** 📉
   - Previously good entities now dropping
   - Example: Traffic down 40% month-over-month

4. **Cross-Channel Gaps** 🎯
   - Organic winners not supported by paid (or vice versa)
   - Example: Page with great organic traffic but $0 in ads

5. **Keyword Cannibalization** ⚠️
   - Multiple pages competing for same keywords
   - Example: 3 pages all ranking for "best CRM" diluting authority

6. **Cost Inefficiency** 💸
   - High spend with poor ROI
   - Example: Campaign spending $500 but only generating $300 revenue

7. **Email Engagement Drop** 📧
   - Email campaigns with declining open/click rates
   - Example: Open rate dropped from 35% to 18%

### Opportunity Dashboard

- **Filter** by status, priority, category
- **Expand** to see full analysis and recommendations
- **Take action**: Acknowledge, Start Working, Mark Complete, Dismiss
- **Track** progress over time

### Daily Notifications (Optional)

Configure Slack webhook to get daily summaries:
- Top 3 high-priority opportunities
- Category breakdown
- Direct link to dashboard

---

## 🔄 Automation

### Daily Rollup (Recommended)

Set up a Cloud Scheduler job to run daily metrics rollup:

```bash
# Create Cloud Scheduler job
gcloud scheduler jobs create http daily-metrics-rollup \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl" \
  --http-method=POST \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}' \
  --time-zone="America/Los_Angeles"
```

### Daily Scout AI Run (Recommended)

```bash
# Create Cloud Scheduler job
gcloud scheduler jobs create http daily-scout-ai-run \
  --schedule="0 6 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/scout-ai-engine" \
  --http-method=POST \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE","sendSlackNotification":true}' \
  --time-zone="America/Los_Angeles"
```

This will:
1. Run at 2 AM: Update daily metrics from previous day
2. Run at 6 AM: Detect new opportunities + send Slack summary

---

## 🧪 Testing

### Test 1: Entity Mapping

```bash
# Check entity map
bq query --use_legacy_sql=false \
  "SELECT entity_type, COUNT(*) as count 
   FROM \`opsos-864a1.marketing_ai.entity_map\` 
   GROUP BY entity_type"
```

Expected output:
```
+-------------+-------+
| entity_type | count |
+-------------+-------+
| page        |    65 |
| campaign    |    12 |
| keyword     |    48 |
| product     |     5 |
| email       |    12 |
+-------------+-------+
```

### Test 2: Daily Metrics

```bash
# Check daily metrics
bq query --use_legacy_sql=false \
  "SELECT date, entity_type, COUNT(*) as entity_count, SUM(sessions) as total_sessions
   FROM \`opsos-864a1.marketing_ai.daily_entity_metrics\`
   WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
   GROUP BY date, entity_type
   ORDER BY date DESC"
```

Expected: Rows for each day with session counts.

### Test 3: Opportunities

```bash
# Check opportunities
bq query --use_legacy_sql=false \
  "SELECT category, priority, COUNT(*) as count
   FROM \`opsos-864a1.marketing_ai.opportunities\`
   GROUP BY category, priority
   ORDER BY priority, category"
```

Expected: Opportunities across different categories and priorities.

---

## 🐛 Troubleshooting

### "Dataset not found"

```bash
bq mk --dataset opsos-864a1:marketing_ai
```

### "Cloud Function deployment failed"

Check you're authenticated:
```bash
gcloud auth list
gcloud config set project opsos-864a1
```

### "Seeding returns 0 mappings"

Check Firestore has data:
1. Go to Firebase Console → Firestore
2. Verify collections exist: `ga_pages`, `ga_campaigns`, etc.
3. Verify `organizationId` field matches: `SBjucW1ztDyFYWBz7ZLE`

### "Scout AI finds 0 opportunities"

Check daily metrics exist:
```bash
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) as total_rows
   FROM \`opsos-864a1.marketing_ai.daily_entity_metrics\`"
```

If 0 rows, run the daily rollup first:
```bash
curl -X POST http://localhost:3000/api/daily-metrics/sync \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

### "UI shows no opportunities"

1. Check Firestore `opportunities` collection exists
2. Check browser console for errors
3. Try clicking "Run Scout AI" button
4. Check organizationId in query parameters

---

## 📈 Monitoring

### BigQuery Costs

Scout AI queries are optimized with:
- Partitioned tables (by date)
- Clustered columns (by organization, entity)
- Date filters to limit scans

Expected cost: < $1/day for typical usage.

### Cloud Function Costs

- Entity Map Seeder: Runs once, ~30 seconds
- Daily Rollup: Runs daily, ~2-3 minutes
- Scout AI: Runs daily, ~1-2 minutes

Expected cost: < $5/month.

### Storage Costs

- BigQuery: ~1 GB for 90 days of data
- Firestore: Minimal (mostly references)

Expected cost: < $1/month.

---

## 🎯 Next Steps

After deployment:

1. **Review opportunities** daily in the dashboard
2. **Take action** on high-priority items
3. **Track results** by marking opportunities as completed
4. **Customize** detector thresholds in `main.py` and `detectors.py`
5. **Add more detectors** for your specific use cases
6. **Set up Slack** for daily summaries

---

## 📚 Additional Resources

- **Scout AI Implementation Plan**: `SCOUT_AI_IMPLEMENTATION_PLAN.md`
- **Entity Map Seeder README**: `cloud-functions/entity-map-seeder/README.md`
- **BigQuery Schema**: `cloud-functions/scout-ai-engine/schema.sql`
- **Cloud Functions**:
  - `cloud-functions/entity-map-seeder/`
  - `cloud-functions/daily-rollup-etl/`
  - `cloud-functions/scout-ai-engine/`

---

## ✅ Deployment Checklist

- [ ] BigQuery dataset `marketing_ai` created
- [ ] Entity map table + seeder deployed
- [ ] Entity mappings seeded (100+ mappings)
- [ ] Daily metrics table created
- [ ] Daily rollup ETL deployed
- [ ] Daily metrics backfilled (90 days)
- [ ] Opportunities + metric_registry tables created
- [ ] Scout AI Engine deployed
- [ ] Scout AI run successfully (20+ opportunities)
- [ ] Opportunities visible in UI
- [ ] (Optional) Cloud Scheduler jobs created
- [ ] (Optional) Slack webhook configured

---

**Need help?** Check the troubleshooting section or review the code in `cloud-functions/`.
