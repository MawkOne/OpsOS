# 🚀 Deploy Scout AI to Vercel

Your Scout AI is now ready to go live at **https://v0-ops-ai.vercel.app/ai**

---

## ✅ What's Changed

### Updated `/ai` Page
- **Before:** Marketing Insights dashboard
- **Now:** Scout AI featured prominently with live opportunity count
- **Link:** https://v0-ops-ai.vercel.app/ai → https://v0-ops-ai.vercel.app/ai/opportunities

### What You'll See:
```
🎯 Scout AI ⭐ Featured
   Live | 30 Found

   Automatically detects marketing opportunities across all channels.
   Scale winners, fix losers, and prevent revenue loss.

   ✓ 30 opportunities detected (153k metrics analyzed)
   ✓ 7 AI detectors running daily
   ✓ Evidence-based recommendations with action steps
   ✓ Impact scoring: Prioritize what matters

   [View Opportunities →]
```

---

## 📦 Deployment Options

### Option 1: Automatic (If Vercel Connected to GitHub)

**Status Check:**
1. Go to https://vercel.com/dashboard
2. Find your "opsos" or "v0-ops-ai" project
3. Check if latest commit (`71d961f`) is deploying

**If Yes:** Wait 2-3 minutes, then visit https://v0-ops-ai.vercel.app/ai ✅

**If No:** Continue to Option 2 ↓

---

### Option 2: Manual Deployment via Vercel CLI

```bash
cd "/Users/markhenderson/Cursor Projects/OpsOS/app"

# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

---

### Option 3: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your Git repository
4. Set root directory to `app/`
5. Click "Deploy"

---

## 🔧 Environment Variables Needed

Make sure these are set in Vercel:

```env
# Firebase (for authentication & Firestore)
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=opsos-864a1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-id

# Google Cloud (for BigQuery API access)
GOOGLE_APPLICATION_CREDENTIALS=path-to-service-account.json
# OR set these individually:
GOOGLE_CLOUD_PROJECT=opsos-864a1
```

**To add these:**
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable
3. Redeploy

---

## ✅ Verify Deployment

### After Deployment:

1. **Visit Main AI Page:**
   https://v0-ops-ai.vercel.app/ai
   - Should see Scout AI featured
   - Should show "30 Found" badge

2. **Visit Opportunities Page:**
   https://v0-ops-ai.vercel.app/ai/opportunities
   - Should show 30 opportunities
   - Filterable by priority/category
   - Expandable cards with details

3. **Test API:**
   ```bash
   curl "https://v0-ops-ai.vercel.app/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE" | jq '.total'
   # Should return: 30
   ```

---

## 🐛 Troubleshooting

### Issue: API returns empty opportunities
**Cause:** BigQuery client not initialized or credentials missing  
**Fix:**
1. Add `GOOGLE_APPLICATION_CREDENTIALS` to Vercel
2. Or copy service account JSON to project
3. Or use Vercel's Google Cloud integration

### Issue: "Cannot read properties of undefined"
**Cause:** Organization context not loading  
**Fix:**
1. Ensure user is logged in
2. Check Firebase auth is working
3. Verify organizationId in Firestore

### Issue: Page shows but no data
**Cause:** API route failing  
**Fix:**
1. Check Vercel function logs
2. Verify BigQuery project ID is correct
3. Test API endpoint directly

---

## 📊 What Users Will See

### Landing Page (https://v0-ops-ai.vercel.app/ai)
```
┌─────────────────────────────────────────┐
│ AI-Powered Insights                     │
│ Unlock growth opportunities...          │
├─────────────────────────────────────────┤
│                                         │
│ 🎯 Scout AI ⭐ Featured                 │
│ Live | 30 Found                         │
│                                         │
│ • 30 opportunities detected             │
│ • 7 AI detectors running daily          │
│ • Evidence-based recommendations        │
│ • Impact scoring                        │
│                                         │
│ [View Opportunities →]                  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ 💡 Marketing Insights                   │
│ Live                                    │
│                                         │
│ Driver analysis, gap analysis...        │
│                                         │
│ [View Insights →]                       │
│                                         │
└─────────────────────────────────────────┘
```

### Opportunities Dashboard (https://v0-ops-ai.vercel.app/ai/opportunities)
```
┌─────────────────────────────────────────┐
│ 🎯 Scout AI Opportunities               │
│                                         │
│ [Status: New ▼] [Priority: All ▼]      │
│ [Category: All ▼]                       │
│ [Run Scout AI] [Refresh]                │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Total: 30 | High: 20 | Medium: 10   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ 🔧 Fix Opportunity: page_mailbox        │
│ HIGH PRIORITY | Impact: 100/100         │
│                                         │
│ 26,544 sessions, 0% conversion          │
│ Even 1% = $50k-100k impact              │
│                                         │
│ [Expand for details ▼]                  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ 🚀 Scale Winner: page_job32134          │
│ HIGH PRIORITY | Impact: 85/100          │
│                                         │
│ [More opportunities...]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎯 Next Steps After Deployment

1. **Share the link** with your team:
   - Main AI: https://v0-ops-ai.vercel.app/ai
   - Opportunities: https://v0-ops-ai.vercel.app/ai/opportunities

2. **Set up daily automation** (optional):
   ```bash
   # Run Scout AI every morning at 6 AM
   gcloud scheduler jobs create http daily-scout-ai-run \
     --schedule="0 6 * * *" \
     --uri="https://us-central1-opsos-864a1.cloudfunctions.net/scout-ai-engine" \
     --http-method=POST \
     --message-body='{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}' \
     --location=us-central1
   ```

3. **Configure Slack alerts** (optional):
   - Add webhook URL to Cloud Function env vars
   - Get daily summaries in Slack

4. **Start taking action**:
   - Review top 5 high-priority opportunities
   - Assign to team members
   - Track results

---

## 📈 Success Metrics

After deploying, you should see:

- ✅ https://v0-ops-ai.vercel.app/ai shows Scout AI
- ✅ Clicking "View Opportunities" shows 30 cards
- ✅ Filters work (priority, category, status)
- ✅ Cards expand to show full details
- ✅ "Run Scout AI" button triggers new detection
- ✅ API returns data from BigQuery

---

## 🎉 You're Live!

Scout AI is now accessible at:
- **Main Dashboard:** https://v0-ops-ai.vercel.app/ai
- **Opportunities:** https://v0-ops-ai.vercel.app/ai/opportunities
- **API:** https://v0-ops-ai.vercel.app/api/opportunities

**30 opportunities waiting for you to take action!** 🚀
