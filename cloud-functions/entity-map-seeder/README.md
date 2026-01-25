# Entity Map Seeder

Reads existing Firestore data and creates canonical entity mappings for cross-channel analysis.

## What It Does

- Reads your existing `ga_pages`, `ga_campaigns`, `dataforseo_keywords`, `stripe_products`, and `activecampaign_campaigns` collections
- Creates canonical IDs (e.g., `/pricing` → `page_pricing`)
- Writes mappings to BigQuery `marketing_ai.entity_map` table
- Also mirrors to Firestore `entity_map` collection for real-time API access

## Setup

### 1. Create BigQuery Dataset

```bash
bq mk --dataset opsos-864a1:marketing_ai
```

### 2. Create Table

```bash
bq query --use_legacy_sql=false < schema.sql
```

### 3. Deploy Cloud Function

```bash
./deploy.sh
```

## Usage

### From UI

Visit: https://v0-ops-ai.vercel.app/sources/entity-map

Click **"Seed from Firestore"** button

### From API

```bash
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/entity-map-seeder \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

### From Next.js App

```bash
curl -X POST http://localhost:3000/api/entity-map/seed \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'
```

## Expected Output

```json
{
  "success": true,
  "organization_id": "SBjucW1ztDyFYWBz7ZLE",
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

## Query Mappings

### BigQuery

```sql
-- Get all mappings for a canonical entity
SELECT * FROM `opsos-864a1.marketing_ai.entity_map`
WHERE canonical_entity_id = 'page_pricing';

-- Get canonical ID from source
SELECT canonical_entity_id FROM `opsos-864a1.marketing_ai.entity_map`
WHERE source = 'ga4' AND source_entity_id = '/pricing';

-- Count by entity type
SELECT entity_type, COUNT(*) as count
FROM `opsos-864a1.marketing_ai.entity_map`
GROUP BY entity_type;
```

### Firestore (via API)

```bash
curl "http://localhost:3000/api/entity-map?organizationId=SBjucW1ztDyFYWBz7ZLE"
```

## Canonical ID Format

- **Pages**: `page_` + cleaned path (e.g., `page_pricing`, `page_blog_post_title`)
- **Campaigns**: `campaign_` + cleaned name (e.g., `campaign_q1_brand_campaign`)
- **Keywords**: `keyword_` + cleaned keyword (e.g., `keyword_best_crm_for_saas`)
- **Products**: `product_` + cleaned name (e.g., `product_pro_plan`)
- **Emails**: `email_` + cleaned name (e.g., `email_welcome_series`)

## Next Steps

Once entity mappings are seeded:
1. ✅ Week 1 Day 2: Create daily rollup tables
2. ✅ Week 1 Day 3: Create opportunities table
3. ✅ Week 2: Start building Scout AI detectors
