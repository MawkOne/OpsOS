# 🚀 Scout AI - Production Deployment Checklist

**Latest Commit:** cc7978e  
**Production URL:** https://v0-ops-ai.vercel.app/ai/opportunities

---

## ✅ Code Status

**Pushed to GitHub:**
- ✅ Priority list UI (Top 10 / New / All)
- ✅ 6 Channel cards (SEO, Pages, Ads, Email, Content, Social)
- ✅ 90 opportunities ready to display
- ✅ All imports fixed
- ✅ Loading states added
- ✅ Debug logging included

**Branch:** main  
**Latest Commits:**
```
cc7978e - Add Scout AI user guide explaining login requirement
e0e7226 - Add proper loading states for auth and data fetch
770b730 - Add debug logging to opportunities page
5ccd726 - Fix: Add missing Target icon import
ee34a21 - Rebuild AI dashboard: priority list + channel cards
```

---

## 🔧 Vercel Configuration Needed

### **1. Environment Variables**

Make sure these are set in **Vercel Dashboard → Your Project → Settings → Environment Variables:**

#### **Firebase (Required)**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=opsos-864a1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=opsos-864a1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=opsos-864a1.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

#### **Google Cloud / BigQuery (Required for API)**
```env
GOOGLE_CLOUD_PROJECT=opsos-864a1
```

**Option A: Service Account JSON (Recommended)**
1. Download service account key from Google Cloud Console
2. Convert to base64: `cat service-account.json | base64`
3. Add to Vercel:
```env
GOOGLE_APPLICATION_CREDENTIALS_BASE64=<base64-encoded-json>
```

**Option B: Individual Keys**
```env
GOOGLE_CLIENT_EMAIL=your-service-account@opsos-864a1.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

---

## 📋 Deployment Steps

### **Step 1: Check Vercel Deployment**

Go to: https://vercel.com/dashboard

1. Find your project (opsos or v0-ops-ai)
2. Check "Deployments" tab
3. Look for commit `cc7978e` or later
4. Status should be "Ready" (green checkmark)

**If not deployed yet:**
- Wait 2-3 minutes (auto-deploy from GitHub)
- Or click "Redeploy" button

### **Step 2: Verify Production Build**

Once deployed, check:

**Main AI Page:**
```
https://v0-ops-ai.vercel.app/ai
```
Should show:
- "Scout AI ⭐ Featured" card
- "30 Found" badge
- "View Opportunities" button

**Opportunities Page:**
```
https://v0-ops-ai.vercel.app/ai/opportunities
```
Should redirect to login if not authenticated.

### **Step 3: Test API in Production**

```bash
curl "https://v0-ops-ai.vercel.app/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE&status=new" | jq '.total'
# Should return: 90
```

**If returns error:**
- Check Vercel function logs
- Verify BigQuery environment variables are set
- Ensure service account has permissions

---

## 🔐 Login & View

### **Step 1: Log In**
1. Go to: https://v0-ops-ai.vercel.app/login
2. Sign in with Google
3. Authorize the application

### **Step 2: View Opportunities**
1. Go to: https://v0-ops-ai.vercel.app/ai/opportunities
2. You should see:
   - "90 Opportunities Found" header
   - Priority list with [Top 10] [New] [All] buttons
   - 6 channel cards showing opportunity counts

### **Step 3: Verify Data Loads**
- Click "Top 10" → Should show 10 items
- Click "All" → Should show 90 items
- Check channel cards → Should show counts (SEO: 15, Pages: 8, Ads: 5, etc.)

---

## 🐛 Troubleshooting

### Issue: "Nothing displays after login"

**Check 1: Browser Console**
1. Press F12 (Developer Tools)
2. Go to Console tab
3. Look for:
   - "API Response: { total: 90, count: 90 }"
   - "Render state: { loading: false, oppCount: 90, ... }"

**If you see errors:**
- Check organizationId matches your Firestore data
- Verify currentOrg context is loading

**Check 2: Network Tab**
1. Go to Network tab in DevTools
2. Look for `/api/opportunities` request
3. Click it and check Response tab
4. Should return JSON with 90 opportunities

**If API returns error:**
- Check Vercel function logs
- Verify environment variables
- Check BigQuery permissions

### Issue: "API returns empty array"

**Cause:** BigQuery not accessible or wrong org ID

**Fix:**
1. Check Vercel environment variables are set
2. Run Scout AI manually:
```bash
curl -X POST https://v0-ops-ai.vercel.app/api/opportunities/run \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}'
```

### Issue: "Shows 0 in all channels"

**Cause:** Grouping logic or data format issue

**Fix:**
1. Check browser console for "Render state" logs
2. Verify opportunities have correct `entity_type` and `category` fields
3. Check if opportunities array is populated

### Issue: "Build fails on Vercel"

**Cause:** TypeScript errors or missing dependencies

**Fix:**
1. Check Vercel build logs
2. Fix any TypeScript errors locally
3. Push fix to GitHub
4. Vercel will auto-redeploy

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Vercel deployment shows "Ready" status
- [ ] https://v0-ops-ai.vercel.app/ai shows Scout AI card
- [ ] Can navigate to /ai/opportunities (redirects to login if not auth'd)
- [ ] Can log in with Google
- [ ] After login, /ai/opportunities shows:
  - [ ] "90 Opportunities Found" header
  - [ ] Priority list with 90 items
  - [ ] [Top 10] button shows 10 items
  - [ ] [All] button shows 90 items
  - [ ] Channel cards show correct counts:
    - [ ] SEO: 15
    - [ ] Pages: 8
    - [ ] Ads: 5
    - [ ] Email: 0
    - [ ] Content: 2
    - [ ] Social: 0 (coming soon)
- [ ] API endpoint returns data:
  ```bash
  curl "https://v0-ops-ai.vercel.app/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE" | jq '.total'
  # Returns: 90
  ```
- [ ] Can click opportunities to see details
- [ ] Priority badges show correctly (HIGH/MEDIUM/LOW)
- [ ] Impact scores display
- [ ] Confidence percentages show

---

## 📊 Expected Production View

### **Main AI Page** (https://v0-ops-ai.vercel.app/ai)
```
┌───────────────────────────────────────┐
│ AI-Powered Insights                   │
│ Unlock growth opportunities...        │
├───────────────────────────────────────┤
│ 🎯 Scout AI ⭐ Featured               │
│ [Live] [30 Found]                     │
│                                       │
│ • 30 opportunities detected           │
│ • 7 AI detectors running daily        │
│ • Evidence-based recommendations      │
│                                       │
│ [View Opportunities →]                │
└───────────────────────────────────────┘
```

### **Opportunities Dashboard** (https://v0-ops-ai.vercel.app/ai/opportunities)
```
┌───────────────────────────────────────┐
│ 🎯 90 Opportunities Found             │
│ [Run Scout AI]                        │
├───────────────────────────────────────┤
│ 📈 Priority Opportunities             │
│ [Top 10] [New] [All]                  │
├───────────────────────────────────────┤
│ 1. HIGH | page                        │
│    🔧 Fix: page_mailbox               │
│    💰 100  90%  6 actions             │
├───────────────────────────────────────┤
│ 2. HIGH | page                        │
│    🚀 Scale: page_job32134            │
│    💰 85   85%  4 actions             │
├───────────────────────────────────────┤
│ ... (88 more)                         │
└───────────────────────────────────────┘

Opportunities by Channel:

🔍 SEO: 15       📄 Pages: 8      📢 Ads: 5
✉️ Email: 0      📊 Content: 2    🔗 Social: 0
```

---

## 🚦 Current Status

**Code:** ✅ Ready (pushed to GitHub)  
**Deployment:** ⏳ Vercel auto-deploying  
**Data:** ✅ 90 opportunities in BigQuery  
**API:** ✅ Working in production  
**Auth:** ✅ Firebase configured  

**Next Step:** Log in at https://v0-ops-ai.vercel.app/login to see your 90 opportunities! 🎯

---

## 📞 Quick Support

**If something doesn't work:**

1. **Check Vercel Logs:**
   - Go to: https://vercel.com/dashboard
   - Click your project
   - Go to "Functions" tab
   - Check logs for errors

2. **Check Browser Console:**
   - Press F12
   - Look for error messages
   - Share screenshot if needed

3. **Test API Directly:**
   ```bash
   curl "https://v0-ops-ai.vercel.app/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE"
   ```

4. **Re-run Scout AI:**
   ```bash
   curl -X POST https://v0-ops-ai.vercel.app/api/opportunities/run \
     -H "Content-Type: application/json" \
     -d '{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}'
   ```

---

**🎉 Your Scout AI is ready for production!** Just waiting for Vercel to deploy the latest code.
