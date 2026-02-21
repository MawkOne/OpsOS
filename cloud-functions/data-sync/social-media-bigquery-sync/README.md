# Social Media BigQuery Sync

Tracks YTJobs' social media channels and syncs metrics to BigQuery.

## Supported Platforms

| Platform | Public Metrics | OAuth Required For |
|----------|---------------|-------------------|
| LinkedIn | Followers, Posts | Messages, Analytics |
| Twitter/X | Followers, Posts, Engagement | Messages, Analytics |
| Instagram | Followers, Posts | Messages, Analytics |
| Facebook | Followers, Posts | Messages, Analytics |
| YouTube | Subscribers, Videos, Views | Analytics, Comments |
| TikTok | Followers, Videos | Messages, Analytics |
| Telegram | Posts | Subscribers, Messages |

## Setup

### 1. Configure Social Accounts in Firestore

Create a document in `social_media_connections/{organizationId}`:

```json
{
  "linkedin": {
    "enabled": true,
    "profile_url": "https://www.linkedin.com/company/ytjobs"
  },
  "twitter": {
    "enabled": true,
    "handle": "ytjobs"
  },
  "instagram": {
    "enabled": true,
    "handle": "ytjobs"
  },
  "youtube": {
    "enabled": true,
    "channel_id": "UC..."
  },
  "telegram": {
    "enabled": true,
    "channel_username": "ytjobs"
  }
}
```

### 2. (Optional) Connect OAuth for Advanced Metrics

For each platform, store OAuth credentials in:
`social_media_connections/{organizationId}/platforms/{platform}`

**LinkedIn Example:**
```json
{
  "access_token": "...",
  "organization_id": "12345678",
  "expires_at": "2026-03-01T00:00:00Z"
}
```

**Twitter Example:**
```json
{
  "bearer_token": "...",
  "user_id": "123456789"
}
```

### 3. Deploy Cloud Function

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

### 4. Add to Nightly Scheduler

The nightly sync scheduler will automatically pick up this function if you add the connection to Firestore.

## Manual Sync

```bash
curl -X POST "https://us-central1-opsos-864a1.cloudfunctions.net/social-media-bigquery-sync" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "ytjobs",
    "platforms": ["linkedin", "twitter", "instagram", "youtube"]
  }'
```

## Data Schema

Data is stored in `marketing_ai.daily_entity_metrics` with `entity_type = 'social_channel'`.

**Fields:**
- `users`: Follower/subscriber count
- `sessions`: Posts/videos in last 7 days
- `impressions`: Impressions (if OAuth connected)
- `engagement_rate`: Engagement rate % (if OAuth connected)
- `source_breakdown`: Full platform metrics JSON

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
  "engagement_rate": 3.2,
  "source_breakdown": {
    "platform": "linkedin",
    "platform_name": "LinkedIn",
    "followers": 15234,
    "posts_7d": 12,
    "impressions_7d": 45000,
    "engagement_rate": 3.2
  }
}
```

## Next Steps

1. **Configure accounts** - Add your social handles to Firestore
2. **Test sync** - Run manual sync to verify
3. **Connect OAuth** (optional) - For messages and detailed analytics
4. **View dashboard** - Data will appear in `/growth/social` page
