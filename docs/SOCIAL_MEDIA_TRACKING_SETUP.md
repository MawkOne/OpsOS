# Social Media Tracking Setup

## Overview

Created infrastructure to track YTJobs' own social media channels (followers, engagement, posts) across all major platforms.

## What Was Built

### 1. Cloud Function: `social-media-bigquery-sync`
**Location:** `cloud-functions/data-sync/social-media-bigquery-sync/`

**Supported Platforms:**
- ✅ LinkedIn (company page)
- ✅ Twitter/X
- ✅ Instagram
- ✅ Facebook
- ✅ YouTube
- ✅ TikTok
- ✅ Telegram

**Metrics Tracked:**
- Follower/subscriber counts
- Post counts (last 7 days)
- Engagement rates
- Impressions (with OAuth)
- Message/DM counts (with OAuth)

**Data Strategy:**
- **Public metrics**: Follower counts, post counts (no OAuth needed)
- **Advanced metrics**: Messages, detailed analytics (requires OAuth)

### 2. Nightly Sync Integration
Updated `nightly-sync-scheduler` to automatically sync social media data daily at midnight.

### 3. Setup Script
**Location:** `scripts/setup-social-media.py`

Configures YTJobs' social handles in Firestore for automated tracking.

## Current Status

**Created (Not Deployed):**
- ✅ Cloud Function code
- ✅ Nightly scheduler integration
- ✅ Setup script
- ❌ Not yet deployed to GCP
- ❌ Not yet configured in Firestore
- ❌ No dashboard page yet

## Next Steps

### Step 1: Gather YTJobs Social Info

**What I need from you:**

1. **LinkedIn**
   - Company page URL: `https://www.linkedin.com/company/???`
   
2. **Twitter/X**
   - Handle: `@???`
   
3. **Instagram**
   - Handle: `@???`
   
4. **Facebook**
   - Page URL: `https://facebook.com/???`
   
5. **YouTube**
   - Channel URL or Channel ID: `???`
   
6. **Telegram**
   - Channel username: `@???` (I saw UTM params suggesting you have a Telegram channel)
   
7. **TikTok**
   - Do you have a TikTok account? Handle: `???`

### Step 2: Deploy Cloud Function

```bash
cd cloud-functions/data-sync/social-media-bigquery-sync

gcloud functions deploy social-media-bigquery-sync \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=sync_social_media_to_bigquery \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=120s \
  --memory=512MB \
  --project=opsos-864a1
```

### Step 3: Configure Firestore

Run the setup script (after updating with your social handles):

```bash
python3 scripts/setup-social-media.py
```

### Step 4: Test Sync

```bash
curl -X POST "https://us-central1-opsos-864a1.cloudfunctions.net/social-media-bigquery-sync" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "ytjobs"}'
```

### Step 5: Build Dashboard

Create `/growth/social` page showing:
- Follower growth charts
- Engagement rates by platform
- Top performing posts
- Platform comparison
- Message/DM volume (if OAuth connected)

## OAuth Setup (Optional - For Advanced Metrics)

To get messages, detailed analytics, and real-time data:

### LinkedIn
1. Create LinkedIn Developer App
2. Get Organization ID
3. OAuth 2.0 flow for access token
4. Store in Firestore: `social_media_connections/ytjobs/platforms/linkedin`

### Twitter/X
1. Apply for Twitter Developer account
2. Get Bearer Token
3. Store in Firestore: `social_media_connections/ytjobs/platforms/twitter`

### Instagram/Facebook
1. Create Facebook App
2. Connect Business Account
3. Get access token via Facebook Login
4. Store in Firestore: `social_media_connections/ytjobs/platforms/instagram`

### YouTube
1. Create Google Cloud project (or use existing)
2. Enable YouTube Data API v3
3. Get API key (for public metrics) OR OAuth (for analytics)
4. Store in Firestore or environment variable

### Telegram
1. Create Telegram Bot via @BotFather
2. Get Bot Token
3. Add bot as admin to your channel
4. Store in Firestore: `social_media_connections/ytjobs/platforms/telegram`

## Data Schema

Data is stored in `marketing_ai.daily_entity_metrics`:

```sql
SELECT 
  date,
  entity_name,
  users as followers,
  sessions as posts_7d,
  impressions,
  engagement_rate,
  JSON_EXTRACT(source_breakdown, '$.platform') as platform
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE entity_type = 'social_channel'
  AND organization_id = 'ytjobs'
ORDER BY date DESC, users DESC
```

**Example Row:**
```json
{
  "date": "2026-02-21",
  "canonical_entity_id": "social_linkedin_2026-02-21",
  "entity_type": "social_channel",
  "entity_name": "LinkedIn - ytjobs",
  "users": 15234,
  "sessions": 12,
  "impressions": 45000,
  "engagement_rate": 3.2
}
```

## Benefits

**Immediate (Public Metrics):**
- ✅ Track follower growth across all platforms
- ✅ Monitor post frequency
- ✅ Compare platform performance
- ✅ Historical trending (once data starts accumulating)

**With OAuth (Advanced Metrics):**
- ✅ Message/DM volume tracking
- ✅ Detailed engagement analytics
- ✅ Impression/reach data
- ✅ Audience demographics
- ✅ Best posting times

## Cost Estimate

**Without OAuth (Public APIs):**
- $0 - Most platform public APIs are free

**With OAuth:**
- Most platform APIs are free for standard use
- Only cost is Cloud Function execution (~$0.10/day for 7 platforms)

**Total:** ~$3/month

## Questions?

1. **Do you want public metrics only, or full OAuth setup?**
   - Public = Free, basic metrics (followers, posts)
   - OAuth = Free, detailed analytics (messages, engagement, demographics)

2. **Which platforms are priority?**
   - I can deploy with LinkedIn/Twitter/YouTube first, add others later

3. **Do you want the dashboard built now, or after we have data?**
   - Can build mockup now, populate with real data later
