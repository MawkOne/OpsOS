# 🎯 Scout AI Dashboard - User Guide

## How to Access

1. **Log in at:** http://localhost:3000/login (or https://v0-ops-ai.vercel.app/login)
2. **Navigate to:** http://localhost:3000/ai/opportunities

---

## What You'll See

### **Top Section: 90 Opportunities Found**

The header shows the total count and a "Run Scout AI" button to detect new opportunities.

---

### **Priority List (Top 10/New/All)**

A sortable list showing your opportunities in priority order:

```
┌──────────────────────────────────────────────────┐
│ 📈 Priority Opportunities  [Top 10][New][All]   │
├──────────────────────────────────────────────────┤
│ 1  [HIGH] page                                   │
│    🔧 Fix Opportunity: page_mailbox              │
│    This page gets 26,544 sessions but 0%...      │
│    💰 100  90%  6 actions                        │
├──────────────────────────────────────────────────┤
│ 2  [HIGH] page                                   │
│    🚀 Scale Winner: page_job32134                │
│    High conversion, low traffic opportunity      │
│    💰 85   85%  4 actions                        │
├──────────────────────────────────────────────────┤
│ ... (8 more in top 10)                           │
└──────────────────────────────────────────────────┘
```

**Buttons:**
- **Top 10** - Shows highest priority 10 items
- **New** - Shows only new/unaddressed opportunities  
- **All** - Shows all 90 opportunities

---

### **Channel Cards (6 Cards)**

Opportunities grouped by marketing channel:

```
┌─────────────┬─────────────┬─────────────┐
│ 🔍 SEO      │ 📄 Pages    │ 📢 Ads      │
│             │             │             │
│     15      │      8      │      5      │
│ opportunities│opportunities│opportunities│
│             │             │             │
│ [H] Fix...  │ [H] Scale...│ [H] Cost... │
│ [M] Drop... │ [M] Cross...│ [M] ROI...  │
│ +13 more    │ +6 more     │ +3 more     │
└─────────────┴─────────────┴─────────────┘

┌─────────────┬─────────────┬─────────────┐
│ ✉️ Email    │ 📊 Content  │ 🔗 Social   │
│             │             │             │
│      0      │      2      │      0      │
│opportunities│opportunities│opportunities│
│             │             │             │
│ All clear!  │ [H] Decl... │ Coming Soon │
│             │ +1 more     │             │
└─────────────┴─────────────┴─────────────┘
```

Each card shows:
- **Total opportunity count** (big number)
- **Top 3 opportunities** with priority badges
- **"+X more"** if there are additional opportunities

---

## What Each Channel Shows

### 🔍 **SEO (15 opportunities)**
- Keywords losing rankings
- Search volume opportunities  
- Position drops that need fixing
- **Entity types:** `keyword`, `page` (declining)

### 📄 **Pages (8 opportunities)**
- Scale winners (high conversion, low traffic)
- Fix losers (high traffic, low conversion)
- Cross-channel gaps (organic success without paid)
- **Entity types:** `page`

### 📢 **Ads (5 opportunities)**
- Cost inefficiency (negative ROI campaigns)
- Underperforming campaigns
- Budget optimization
- **Entity types:** `campaign`

### ✉️ **Email (0 opportunities)**
- Email engagement drops
- Campaign performance issues
- **Entity types:** `email`
- **Status:** All clear! ✅

### 📊 **Content (2 opportunities)**
- Declining page traffic
- Content needing refresh
- **Entity types:** `page` (declining content)

### 🔗 **Social (0 opportunities)**
- Coming soon
- Will detect social media opportunities
- **Status:** Not yet implemented

---

## Current Data

**From BigQuery:**
- ✅ 90 opportunities detected
- ✅ All stored in `opsos-864a1.marketing_ai.opportunities`
- ✅ API working: `/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE`

**Sample opportunity:**
```json
{
  "title": "🔧 Fix Opportunity: page_mailbox",
  "category": "fix_loser",
  "priority": "high",
  "entity_type": "page",
  "potential_impact_score": 100,
  "confidence_score": 0.9,
  "description": "This page gets 26,544 sessions but 0% conversion...",
  "recommended_actions": [
    "A/B test different headlines and CTAs",
    "Improve page load speed",
    "Clarify value proposition",
    ...
  ]
}
```

---

## How to Use

### **1. View Top Priorities**
Click **"Top 10"** to see your 10 highest-impact opportunities sorted by:
1. Priority (High → Medium → Low)
2. Impact score (100 → 0)

### **2. Filter by Status**
- **New** - Fresh opportunities to address
- **All** - Everything (including completed/dismissed)

### **3. Review by Channel**
Scroll down to see opportunities grouped by:
- SEO (keyword/ranking issues)
- Pages (conversion opportunities)  
- Ads (spend optimization)
- Email (engagement)
- Content (traffic drops)

### **4. Take Action**
Click any opportunity to see:
- Full analysis & hypothesis
- Evidence & metrics
- Recommended actions (step-by-step)
- Estimated effort & timeline
- Confidence & impact scores

---

## Why You See "Nothing Populates"

**Issue:** You're not logged in.

**Solution:** 
1. Visit http://localhost:3000/login
2. Sign in with your Google account
3. Navigate to http://localhost:3000/ai/opportunities
4. You'll see all 90 opportunities loaded

**The dashboard requires authentication** to:
- Load your organization context
- Fetch opportunities for YOUR org ID
- Prevent unauthorized access to your data

---

## Quick Test (Without Login)

Test the API directly:

```bash
curl "http://localhost:3000/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE&status=new" | jq '.opportunities | length'
# Returns: 90

curl "http://localhost:3000/api/opportunities?organizationId=SBjucW1ztDyFYWBz7ZLE&status=new" | jq '.opportunities[0] | {title, priority, impact: .potential_impact_score}'
# Returns: { "title": "🔧 Fix Opportunity: page_mailbox", "priority": "high", "impact": 100 }
```

---

## Next Steps

1. **Log in** → http://localhost:3000/login
2. **View dashboard** → http://localhost:3000/ai/opportunities  
3. **Review top 10** → Click "Top 10" button
4. **Explore channels** → Check SEO, Pages, Ads cards
5. **Take action** → Start with highest impact items

---

## Troubleshooting

### "Nothing displays after login"
- Open browser console (F12)
- Look for API errors
- Check if `currentOrg` is loaded
- Verify organizationId matches your Firestore data

### "API returns empty array"
- Run Scout AI: Click "Run Scout AI" button
- Or manually: `curl -X POST http://localhost:3000/api/opportunities/run -H "Content-Type: application/json" -d '{"organizationId":"SBjucW1ztDyFYWBz7ZLE"}'`

### "Shows 0 in all channels"
- Check grouping logic in browser console
- Verify `entity_type` and `category` fields exist
- Check API response format

---

## Summary

✅ **System Status:** Fully operational
✅ **Data Available:** 90 opportunities in BigQuery  
✅ **API Working:** Returning correct data
⚠️ **Login Required:** Must authenticate to view dashboard
🎯 **Ready to Use:** Log in and start optimizing!

**The dashboard will work perfectly once you're logged in!** 🚀
