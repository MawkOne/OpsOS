# ⏰ Set Up Daily Scout AI Schedule

## Current Behavior

**✅ Dashboard Auto-Loads Opportunities**
- When you visit `/ai/opportunities`, it automatically fetches from BigQuery
- Shows all 90 existing opportunities immediately
- No need to click "Run Scout AI" to see data

**"Run Scout AI" Button Purpose:**
- Manual trigger to detect NEW opportunities
- Only use when you want to refresh/update the analysis
- Not needed for daily viewing

---

## Set Up Automated Daily Runs

Instead of manual runs, schedule Scout AI to run automatically every morning.

### **Step 1: Set Up Cloud Scheduler Jobs**

Run these commands to create daily automation:

```bash
# 1. Daily Metrics Rollup (2 AM Pacific)
gcloud scheduler jobs create http daily-metrics-rollup \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}' \
  --time-zone="America/Los_Angeles" \
  --location=us-central1 \
  --project=opsos-864a1

# 2. Scout AI Detection (6 AM Pacific)
gcloud scheduler jobs create http daily-scout-ai-run \
  --schedule="0 6 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/scout-ai-engine" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}' \
  --time-zone="America/Los_Angeles" \
  --location=us-central1 \
  --project=opsos-864a1
```

---

## What This Does

### **2 AM Daily:**
1. Pulls yesterday's data from Firestore
2. Aggregates into daily metrics
3. Writes to BigQuery `daily_entity_metrics` table
4. Updates 90-day rolling window

### **6 AM Daily:**
1. Analyzes all daily metrics from BigQuery
2. Runs 7 AI detectors:
   - Scale Winners
   - Fix Losers
   - Declining Performers
   - Cross-Channel Gaps
   - Cost Inefficiency
   - Keyword Cannibalization
   - Email Engagement Issues
3. Writes new opportunities to BigQuery
4. Updates opportunity counts

### **When You Open Dashboard:**
- Automatically loads latest opportunities from BigQuery
- Shows fresh data from 6 AM run
- No manual action needed

---

## Verify Schedules Are Set Up

Check if jobs exist:

```bash
gcloud scheduler jobs list --location=us-central1 --project=opsos-864a1
```

Should show:
```
NAME                   LOCATION      SCHEDULE (TZ)            TARGET_TYPE  STATE
daily-metrics-rollup   us-central1   0 2 * * * (America/...)  HTTP         ENABLED
daily-scout-ai-run     us-central1   0 6 * * * (America/...)  HTTP         ENABLED
```

---

## Test the Schedule

### **Test Metrics Rollup:**
```bash
gcloud scheduler jobs run daily-metrics-rollup \
  --location=us-central1 \
  --project=opsos-864a1
```

### **Test Scout AI:**
```bash
gcloud scheduler jobs run daily-scout-ai-run \
  --location=us-central1 \
  --project=opsos-864a1
```

### **Check Logs:**
```bash
# Metrics rollup logs
gcloud functions logs read daily-rollup-etl --limit=50 --project=opsos-864a1

# Scout AI logs
gcloud functions logs read scout-ai-engine --limit=50 --project=opsos-864a1
```

---

## Your Daily Workflow

### **Morning (After 6 AM):**
1. Open https://v0-ops-ai.vercel.app/ai/opportunities
2. Dashboard auto-loads fresh opportunities
3. Review new/updated items
4. Take action on top priorities

### **No Manual Steps Needed:**
- ✅ Data updates automatically at 2 AM
- ✅ Scout AI runs automatically at 6 AM
- ✅ Dashboard loads data automatically when you visit
- ❌ Don't need to click "Run Scout AI" button

### **"Run Scout AI" Button - When to Use:**
- Only if you want to force a refresh mid-day
- After making big changes to campaigns/pages
- If you suspect data is stale
- Otherwise, ignore it

---

## Optional: Add Slack Notifications

Get a daily summary in Slack when Scout AI completes.

### **Step 1: Create Slack Webhook**
1. Go to https://api.slack.com/apps
2. Create new app → "Incoming Webhooks"
3. Add to your workspace
4. Copy webhook URL (starts with `https://hooks.slack.com/...`)

### **Step 2: Add to Scout AI Cloud Function**

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

### **Step 3: Update Scheduled Job to Send Notifications**

```bash
gcloud scheduler jobs update http daily-scout-ai-run \
  --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE","sendSlackNotification":true}' \
  --location=us-central1 \
  --project=opsos-864a1
```

Now you'll get a Slack message every morning:

```
🎯 Scout AI Daily Summary - Jan 26, 2026

Found 32 opportunities (+2 from yesterday)

🔥 High Priority (21):
• 🔧 Fix: page_mailbox (Impact: 100)
• 🚀 Scale: page_job32134 (Impact: 85)
• 💸 Cost: campaign_retargeting (Impact: 75)
... (18 more)

📊 By Channel:
• SEO: 16 opportunities
• Pages: 9 opportunities
• Ads: 5 opportunities
• Content: 2 opportunities

View all: https://v0-ops-ai.vercel.app/ai/opportunities
```

---

## Costs

**Cloud Scheduler:**
- $0.10 per job per month
- 2 jobs = $0.20/month

**Cloud Functions (Daily Runs):**
- Metrics rollup: ~30 seconds/day = $0.50/month
- Scout AI: ~10 seconds/day = $0.20/month
- Total: ~$0.70/month

**BigQuery:**
- Storage: 200MB = $0.004/month
- Queries: ~100 queries/day = $0.50/month

**Total Monthly Cost:** ~$1.44/month for full automation 💰

---

## Troubleshooting

### "Schedule isn't running"

**Check if jobs exist:**
```bash
gcloud scheduler jobs list --location=us-central1 --project=opsos-864a1
```

**Check job status:**
```bash
gcloud scheduler jobs describe daily-scout-ai-run \
  --location=us-central1 \
  --project=opsos-864a1
```

**Check recent executions:**
```bash
gcloud scheduler jobs run daily-scout-ai-run \
  --location=us-central1 \
  --project=opsos-864a1
```

### "Dashboard shows old data"

**Force refresh:**
1. Click "Run Scout AI" button in dashboard
2. Wait 30 seconds
3. Refresh page

**Check last run:**
```bash
bq query --use_legacy_sql=false \
  "SELECT MAX(detected_at) as last_run 
   FROM \`opsos-864a1.marketing_ai.opportunities\`"
```

### "Opportunities not updating"

**Check Cloud Function logs:**
```bash
gcloud functions logs read scout-ai-engine --limit=100 --project=opsos-864a1
```

Look for:
- "✅ Successfully wrote X opportunities"
- Any error messages

---

## Summary

**Current Setup:**
- ✅ Dashboard auto-loads from BigQuery (no button click needed)
- ⏳ Manual runs only (need to set up schedule)

**After Running Commands Above:**
- ✅ Dashboard auto-loads from BigQuery
- ✅ Scout AI runs automatically at 6 AM daily
- ✅ Metrics update automatically at 2 AM daily
- ✅ Optional: Slack notifications

**Your Workflow:**
1. Open dashboard any time
2. See latest opportunities (auto-loaded)
3. Take action
4. Done! ✨

**No manual "Run Scout AI" clicks needed!** 🎉
