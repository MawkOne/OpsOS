# ✅ Week 1, Day 1 COMPLETE: Entity Mapping Infrastructure

## What Was Built

### 1. BigQuery Table Schema
- `marketing_ai.entity_map` table
- Canonical entity IDs link entities across platforms
- Example: `/pricing` (GA4) + `landing_page_123` (Google Ads) both map to `page_pricing`

### 2. Cloud Function
- `entity-map-seeder` - Reads your existing Firestore and creates mappings
- Sources: ga_pages, ga_campaigns, dataforseo_keywords, stripe_products, activecampaign_campaigns
- Writes to both BigQuery (for Scout AI queries) and Firestore (for real-time API access)

### 3. API Routes
- `GET /api/entity-map` - List all mappings
- `POST /api/entity-map` - Create new mapping
- `DELETE /api/entity-map` - Delete mapping
- `POST /api/entity-map/seed` - Trigger seeding from Firestore

### 4. Admin UI
- `/sources/entity-map` page
- View all entity mappings
- Filter by type (pages, campaigns, keywords, etc.)
- Search functionality
- "Seed from Firestore" button

---

## 🚀 Deployment Instructions

### Step 1: Create BigQuery Dataset (One-Time)

```bash
# Create the marketing_ai dataset
bq mk --dataset opsos-864a1:marketing_ai
```

### Step 2: Create Entity Map Table

```bash
cd "/Users/markhenderson/Cursor Projects/OpsOS/cloud-functions/entity-map-seeder"

# Run the schema SQL
bq query --use_legacy_sql=false < schema.sql
```

### Step 3: Deploy Cloud Function

```bash
# Make sure you're in the right directory
cd "/Users/markhenderson/Cursor Projects/OpsOS/cloud-functions/entity-map-seeder"

# Deploy (takes ~2-3 minutes)
./deploy.sh
```

Expected output:
```
🚀 Deploying Entity Map Seeder...
Deploying function (may take a while - up to 2 minutes)...done.
✅ Deployment complete!
```

---

## 🧪 Testing

### Test 1: Check UI (Easiest)

1. Visit: http://localhost:3000/sources/entity-map
2. You should see the Entity Mapping page
3. Click **"Seed from Firestore"** button
4. Wait ~10-30 seconds
5. You should see a success message with counts like:
   ```
   ✅ Successfully created 142 entity mappings!
   
   Pages: 65
   Campaigns: 12
   Keywords: 48
   Products: 5
   Emails: 12
   ```

### Test 2: Query BigQuery

```bash
# Check how many mappings were created
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

### Test 3: Test API Direct

```bash
# Trigger seeding via API
curl -X POST http://localhost:3000/api/entity-map/seed \
  -H 'Content-Type: application/json' \
  -d '{"organizationId": "SBjucW1ztDyFYWBz7ZLE"}'

# List all mappings
curl "http://localhost:3000/api/entity-map?organizationId=SBjucW1ztDyFYWBz7ZLE" | jq '.total'
```

---

## 📊 What The Data Looks Like

### In BigQuery:

| canonical_entity_id | entity_type | source | source_entity_id | source_metadata |
|---|---|---|---|---|
| page_pricing | page | ga4 | /pricing | {"title": "Pricing"} |
| page_pricing | page | google_ads | landing_123 | {"campaign": "Q1"} |
| campaign_q1_brand | campaign | ga4 | Q1 Brand Campaign | {"name": "Q1 Brand"} |
| keyword_best_crm | keyword | dataforseo | best crm for saas | {"volume": 2400} |
| product_pro | product | stripe | prod_ABC123 | {"name": "Pro Plan"} |

### In Firestore:

```
entity_map/
  └─ page_pricing_ga4
      ├─ organizationId: "SBjucW1ztDyFYWBz7ZLE"
      ├─ canonical_entity_id: "page_pricing"
      ├─ entity_type: "page"
      ├─ source: "ga4"
      ├─ source_entity_id: "/pricing"
      └─ source_metadata: {"title": "Pricing"}
```

---

## 🎯 Why This Matters

Before entity mapping:
- ❌ Can't link GA4 page "/pricing" to Google Ads landing page
- ❌ Can't see which campaigns drive revenue to which products
- ❌ Can't track keyword performance across SEO + Paid
- ❌ Cross-channel analysis impossible

After entity mapping:
- ✅ Scout AI knows `page_pricing` = `/pricing` (GA4) = `landing_123` (Ads)
- ✅ Can calculate total revenue for pricing page across all channels
- ✅ Can detect if paid traffic performs differently than organic on same page
- ✅ Cross-channel opportunities like "SEO winner pages not supported by paid"

---

## 📋 Checklist Before Moving to Day 2

- [ ] BigQuery dataset `marketing_ai` created
- [ ] Table `entity_map` created (run schema.sql)
- [ ] Cloud Function deployed successfully
- [ ] Seeding completed (100+ mappings created)
- [ ] UI accessible at `/sources/entity-map`
- [ ] Can see mappings in BigQuery
- [ ] Can see mappings in UI

---

## 🐛 Troubleshooting

### "Dataset not found"
```bash
bq mk --dataset opsos-864a1:marketing_ai
```

### "Cloud Function deployment failed"
- Check you're in the right directory: `cd cloud-functions/entity-map-seeder`
- Check you have permissions: `gcloud auth list`
- Try: `gcloud config set project opsos-864a1`

### "Seeding returns 0 mappings"
- Check Firestore has data: Go to Firebase Console → Firestore
- Verify `organizationId` is correct: `SBjucW1ztDyFYWBz7ZLE`
- Check Cloud Function logs: `gcloud functions logs read entity-map-seeder --limit=50`

### "UI shows no mappings"
- Check Firestore `entity_map` collection exists
- Try refreshing: Click the refresh button in UI
- Check browser console for errors

---

## ✨ Next Steps

**Tomorrow: Week 1, Day 2**
- Create `daily_entity_metrics` table
- This is where Scout AI will read from to detect opportunities
- Will aggregate your existing monthly Firestore data into daily slices

**Ready?** Let me know if all tests pass and I'll start Day 2! 🚀
