# Scout AI - Post-Deployment Setup

**Status:** Cloud Functions deployed ✅  
**Next:** Seed data and run first analysis

---

## 🚀 Quick Start (3 Commands)

Run these in order to get Scout AI running:

### 1. Seed Entity Mappings (~30 seconds)
```bash
curl -X POST http://localhost:3000/api/entity-map/seed \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

**Expected Output:**
```json
{
  "success": true,
  "total_mappings": 142,
  "breakdown": {
    "pages": 65,
    "campaigns": 12,
    "keywords": 48,
    "products": 5,
    "emails": 12
  }
}
```

---

### 2. Backfill Daily Metrics (~2-5 minutes)
```bash
curl -X POST http://localhost:3000/api/daily-metrics/sync \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

**Expected Output:**
```json
{
  "success": true,
  "start_date": "2025-10-25",
  "end_date": "2026-01-24",
  "total_metrics": 8640,
  "breakdown": {
    "pages": 5850,
    "campaigns": 1080,
    "keywords": 1440,
    "products": 90,
    "emails": 180
  }
}
```

---

### 3. Run Scout AI (~30-60 seconds)
```bash
curl -X POST http://localhost:3000/api/opportunities/run \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

**Expected Output:**
```json
{
  "success": true,
  "total_opportunities": 28,
  "breakdown": {
    "scale_winners": 5,
    "fix_losers": 8,
    "declining_performers": 3,
    "cross_channel": 4,
    "seo_issues": 2,
    "cost_inefficiency": 4,
    "email_issues": 2
  }
}
```

---

## 🎉 View Your Opportunities

Visit: **http://localhost:3000/ai/opportunities**

You should see:
- Cards for each opportunity
- Scores (impact, confidence, urgency)
- Evidence and hypothesis
- Recommended actions
- Filter by priority/category/status

---

## 📊 Verify BigQuery Data

### Check Entity Mappings
```bash
bq query --use_legacy_sql=false \
  "SELECT entity_type, COUNT(*) as count 
   FROM \`opsos-864a1.marketing_ai.entity_map\` 
   GROUP BY entity_type"
```

Expected:
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

### Check Daily Metrics
```bash
bq query --use_legacy_sql=false \
  "SELECT date, entity_type, COUNT(*) as entities, SUM(sessions) as total_sessions
   FROM \`opsos-864a1.marketing_ai.daily_entity_metrics\`
   WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
   GROUP BY date, entity_type
   ORDER BY date DESC, entity_type"
```

### Check Opportunities
```bash
bq query --use_legacy_sql=false \
  "SELECT category, priority, COUNT(*) as count
   FROM \`opsos-864a1.marketing_ai.opportunities\`
   WHERE status = 'new'
   GROUP BY category, priority
   ORDER BY priority, category"
```

---

## ⚙️ Optional: Set Up Daily Automation

### Option A: Cloud Scheduler (Recommended)

**Daily Metrics Rollup (2 AM UTC):**
```bash
gcloud scheduler jobs create http daily-metrics-rollup \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl" \
  --http-method=POST \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}' \
  --time-zone="America/Los_Angeles" \
  --location=us-central1
```

**Scout AI Run (6 AM UTC):**
```bash
gcloud scheduler jobs create http daily-scout-ai-run \
  --schedule="0 6 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/scout-ai-engine" \
  --http-method=POST \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE","sendSlackNotification":true}' \
  --time-zone="America/Los_Angeles" \
  --location=us-central1
```

### Option B: Configure Slack Notifications

Add Slack webhook to Scout AI:
```bash
gcloud functions deploy scout-ai-engine \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=./cloud-functions/scout-ai-engine \
  --entry-point=run_scout_ai \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB \
  --set-env-vars SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  --project=opsos-864a1
```

Then enable notifications in API calls:
```bash
curl -X POST http://localhost:3000/api/opportunities/run \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE", "sendSlackNotification": true}'
```

---

## 🐛 Troubleshooting

### "No mappings found"
**Issue:** Firestore collections might be empty or organizationId is wrong.

**Fix:**
1. Check Firestore has data: Firebase Console → Firestore
2. Verify collections exist: `ga_pages`, `ga_campaigns`, etc.
3. Check organizationId field matches: `SBjucW1ztDyFYWBz7ZLE`

### "No metrics created"
**Issue:** Entity mappings don't exist or Firestore has no monthly data.

**Fix:**
1. Run entity mapping seeder first (step 1)
2. Check Firestore has monthly aggregates with `month` and `year` fields
3. Check Cloud Function logs: `gcloud functions logs read daily-rollup-etl --limit=50`

### "No opportunities detected"
**Issue:** Daily metrics table is empty.

**Fix:**
1. Run daily metrics sync first (step 2)
2. Verify data in BigQuery:
   ```bash
   bq query --use_legacy_sql=false \
     "SELECT COUNT(*) as total FROM \`opsos-864a1.marketing_ai.daily_entity_metrics\`"
   ```
3. Need at least 100+ rows for detectors to find patterns

### "Cloud Function timeout"
**Issue:** Processing large dataset.

**Fix:**
- Increase timeout: `--timeout=900s` (15 minutes max)
- Increase memory: `--memory=2GB`
- Process smaller date ranges first

### "Permission denied"
**Issue:** Service account lacks permissions.

**Fix:**
```bash
# Grant BigQuery permissions
gcloud projects add-iam-policy-binding opsos-864a1 \
  --member="serviceAccount:opsos-864a1@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# Grant Firestore permissions
gcloud projects add-iam-policy-binding opsos-864a1 \
  --member="serviceAccount:opsos-864a1@appspot.gserviceaccount.com" \
  --role="roles/datastore.user"
```

---

## 📈 Monitor Performance

### Check Cloud Function Logs
```bash
# Entity Map Seeder
gcloud functions logs read entity-map-seeder --limit=50

# Daily Rollup ETL
gcloud functions logs read daily-rollup-etl --limit=50

# Scout AI Engine
gcloud functions logs read scout-ai-engine --limit=50
```

### View in Cloud Console
- **BigQuery**: https://console.cloud.google.com/bigquery?project=opsos-864a1
- **Cloud Functions**: https://console.cloud.google.com/functions/list?project=opsos-864a1
- **Firestore**: https://console.firebase.google.com/project/opsos-864a1/firestore

### Check Costs
```bash
# BigQuery costs (should be < $1/day)
bq ls -j --max_results=100

# Cloud Functions costs (should be < $5/month)
gcloud functions list --format="table(name,runtime,availableMemoryMb)"
```

---

## ✅ Success Checklist

- [ ] Entity mappings created (100+ entries)
- [ ] Daily metrics backfilled (1000+ rows)
- [ ] Opportunities detected (10+ opportunities)
- [ ] UI shows opportunities at `/ai/opportunities`
- [ ] Can filter by priority/category
- [ ] Can mark opportunities as acknowledged/completed
- [ ] BigQuery tables visible in console
- [ ] Cloud Functions deployed and running
- [ ] (Optional) Cloud Scheduler jobs created
- [ ] (Optional) Slack notifications working

---

## 🎯 Next Steps After Setup

1. **Review Opportunities** - Check what Scout AI found
2. **Take Action** - Manually implement top recommendations
3. **Track Results** - Mark opportunities as completed
4. **Iterate** - Scout AI learns from what works
5. **Expand** - Add more detectors for your specific use cases
6. **Automate** - Set up daily runs with Cloud Scheduler

---

## 📚 Additional Documentation

- **Deployment Guide**: `SCOUT_AI_DEPLOYMENT_GUIDE.md`
- **Architecture**: `SCOUT_AI_README.md`
- **Build Summary**: `SCOUT_AI_BUILD_SUMMARY.md`
- **API Testing**: `API_TEST_RESULTS.md`
- **QA Report**: `QA_REPORT.md`
- **Data Alignment**: `DATA_FORMAT_ALIGNMENT_ANALYSIS.md`

---

**Ready to detect opportunities!** 🚀
