# Adding is_active Filter to All Detectors

## 🎯 **What to Add**

Add this JOIN clause to every detector query:

```sql
JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
  ON m.canonical_entity_id = e.canonical_entity_id
  AND e.is_active = TRUE
```

---

## 📝 **TEMPLATE**

### **BEFORE:**
```sql
SELECT 
  m.canonical_entity_id,
  ... other fields ...
FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
WHERE m.organization_id = @org_id
  AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

### **AFTER:**
```sql
SELECT 
  m.canonical_entity_id,
  ... other fields ...
FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
  ON m.canonical_entity_id = e.canonical_entity_id
  AND e.is_active = TRUE
WHERE m.organization_id = @org_id
  AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

---

## 🔧 **FILES TO UPDATE**

### **1. detectors.py** (9 functions to update)
- `detect_cross_channel_gaps()`
- `detect_revenue_anomaly()`
- `detect_metric_anomalies()`
- `detect_high_traffic_low_conversion_pages()`
- `detect_page_engagement_decay()`
- `detect_seo_striking_distance()`
- `detect_seo_rank_drops()`
- `detect_paid_waste()`
- `detect_email_high_opens_low_clicks()`

### **2. monthly_trend_detectors.py** (7 functions to update)
- `detect_content_decay_multitimeframe()`
- `detect_revenue_trends_multitimeframe()`
- `detect_email_trends_multitimeframe()`
- `detect_seo_rank_trends_multitimeframe()`
- `detect_scale_winners_multitimeframe()`
- `detect_declining_performers_multitimeframe()`
- `detect_paid_campaigns_multitimeframe()`

### **3. main.py** (7 original detectors)
Located in `main.py` inline:
- `scale_winners`
- `fix_losers`
- `declining_performers`
- `cost_inefficiency`
- `email_engagement_drop`
- `content_decay`
- And any others inline

---

## ✅ **VERIFICATION**

After updating, run this to verify:

```bash
cd /Users/markhenderson/Cursor\ Projects/OpsOS/cloud-functions/scout-ai-engine
grep -n "daily_entity_metrics\|monthly_entity_metrics" *.py | grep -v "entity_map"
```

If any lines appear without `entity_map`, they still need updating.

---

## 🚀 **Quick Deploy**

After updating:

```bash
cd /Users/markhenderson/Cursor\ Projects/OpsOS/cloud-functions/scout-ai-engine
gcloud functions deploy scout-ai-engine \
  --gen2 \
  --runtime=python312 \
  --region=us-central1 \
  --source=. \
  --entry-point=run_scout_ai \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB
```
