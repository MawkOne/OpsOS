# Priority Pages Integration

## Overview

Priority Pages allows users to mark specific pages (or URL patterns) for deeper analysis in the OpsOS system. This ensures detectors and syncs always gather and analyze data on the most important pages.

## Architecture

### 1. **Storage Layers**

#### Firestore (`dataforseo_connections` collection)
- **Purpose**: User configuration, real-time UI
- **Fields**:
  - `priorityUrls`: Array of full URLs (e.g., `["https://ytjobs.co/mailbox", "https://ytjobs.co/login"]`)
  - `priorityPrefixes`: Array of URL prefixes (e.g., `["/blog", "/hire-"]`)
- **Access**: Frontend UI, DataForSEO sync

#### BigQuery (`daily_entity_metrics` table)
- **Purpose**: Historical data, detector queries
- **New Columns**:
  - `is_priority_page` (BOOLEAN): Whether this page is marked as priority
  - `priority_added_at` (TIMESTAMP): When page was first marked as priority
- **Access**: All detectors, analytics queries

### 2. **Data Flow**

```
User marks priority pages in UI
         ↓
Saved to Firestore (dataforseo_connections)
         ↓
DataForSEO sync reads priority config
         ↓
Marks matching pages in BigQuery with is_priority_page = TRUE
         ↓
Detectors can filter/prioritize these pages
```

## Setup

### 1. Run SQL Migration

Execute the SQL migration to add priority page columns:

```bash
cd cloud-functions/scout-ai-engine
bq query --use_legacy_sql=false < add_priority_pages_column.sql
```

This creates:
- New columns `is_priority_page` and `priority_added_at`
- View `priority_pages_metrics` for easy querying
- View `priority_pages_latest` for latest metrics

### 2. Deploy Updated Cloud Function

Deploy the updated `dataforseo-bigquery-sync` function:

```bash
cd cloud-functions/dataforseo-bigquery-sync
gcloud functions deploy dataforseo-bigquery-sync \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=sync_dataforseo_to_bigquery \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB
```

### 3. Verify Integration

Check that priority pages are being marked:

```sql
SELECT 
  canonical_entity_id,
  is_priority_page,
  priority_added_at,
  onpage_score,
  sessions
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'YOUR_ORG_ID'
  AND entity_type = 'page'
  AND is_priority_page = TRUE
ORDER BY date DESC
LIMIT 10;
```

## Usage in Detectors

### Method 1: Add Optional Priority Filter

Update detector function signature:

```python
from utils.priority_pages import get_priority_pages_only_clause

def detect_something(organization_id: str, priority_pages_only: bool = False) -> list:
    priority_filter = ""
    if priority_pages_only:
        priority_filter = f"AND {get_priority_pages_only_clause()}"
    
    query = f"""
    SELECT *
    FROM `project.dataset.daily_entity_metrics`
    WHERE organization_id = @org_id
      AND entity_type = 'page'
      {priority_filter}
    """
```

### Method 2: Use Helper Functions

```python
from utils.priority_pages import (
    get_priority_pages_only_clause,
    get_priority_pages_query,
    should_focus_on_priority_pages
)

# Get complete query for priority pages
query = get_priority_pages_query(organization_id)

# Decide dynamically based on page count
if should_focus_on_priority_pages(total_page_count):
    # Focus on priority pages
    query += f" AND {get_priority_pages_only_clause()}"
```

### Method 3: Prioritize but Include All

Order results to show priority pages first:

```python
query = f"""
SELECT *
FROM `project.dataset.daily_entity_metrics`
WHERE organization_id = @org_id
  AND entity_type = 'page'
ORDER BY 
  is_priority_page DESC,  -- Priority pages first
  sessions DESC           -- Then by traffic
"""
```

## Example: Updated Detector

```python
def detect_core_web_vitals_failing(
    organization_id: str, 
    priority_pages_only: bool = False
) -> list:
    """Detect pages with failing Core Web Vitals"""
    
    # Build priority filter if requested
    priority_filter = ""
    if priority_pages_only:
        priority_filter = f"AND {get_priority_pages_only_clause()}"
    
    query = f"""
    SELECT 
      canonical_entity_id,
      core_web_vitals_lcp,
      core_web_vitals_fid,
      pageviews
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
    WHERE organization_id = @org_id
      AND entity_type = 'page'
      AND core_web_vitals_lcp > 2500  -- Failing LCP
      {priority_filter}
    """
    
    # ... process results ...
```

## Benefits

### 1. **Focused Analysis**
- Detectors can focus on pages that matter most
- Reduces noise for sites with thousands of pages
- Ensures critical pages are always monitored

### 2. **Better Resource Allocation**
- DataForSEO credits used on important pages
- BigQuery queries can filter to priority pages
- Faster detector execution

### 3. **Flexible Configuration**
- Users control which pages are priority
- Supports both individual URLs and prefixes
- Can add/remove pages anytime via UI

### 4. **Historical Tracking**
- `priority_added_at` tracks when page became priority
- Can analyze before/after priority designation
- Supports trend analysis over time

## Queries

### Get All Priority Pages

```sql
SELECT * 
FROM `opsos-864a1.marketing_ai.priority_pages_latest`
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY sessions DESC;
```

### Compare Priority vs Non-Priority

```sql
SELECT 
  is_priority_page,
  COUNT(*) as page_count,
  AVG(onpage_score) as avg_score,
  SUM(sessions) as total_sessions
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'YOUR_ORG_ID'
  AND entity_type = 'page'
  AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY is_priority_page;
```

### Priority Page Performance Trend

```sql
SELECT 
  DATE(date) as date,
  COUNT(*) as priority_pages,
  AVG(onpage_score) as avg_score,
  AVG(core_web_vitals_lcp) as avg_lcp
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE organization_id = 'YOUR_ORG_ID'
  AND is_priority_page = TRUE
  AND entity_type = 'page'
  AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY date
ORDER BY date DESC;
```

## Next Steps

### Phase 1: Core Integration (✅ Done)
- [x] Add BigQuery columns
- [x] Update DataForSEO sync
- [x] Create utility functions
- [x] Example detector integration

### Phase 2: Detector Updates (In Progress)
- [ ] Update all SEO detectors to support priority_pages_only
- [ ] Update content detectors
- [ ] Update traffic detectors

### Phase 3: Advanced Features
- [ ] Priority page analytics dashboard
- [ ] Automatic priority recommendations based on traffic/value
- [ ] Priority page health score
- [ ] Alerts specific to priority pages
- [ ] Priority page comparison reports

## Troubleshooting

### Priority pages not being marked?

1. Check Firestore data:
```python
# In Python
from google.cloud import firestore
db = firestore.Client()
doc = db.collection('dataforseo_connections').document('ORG_ID').get()
print(doc.to_dict().get('priorityUrls'))
print(doc.to_dict().get('priorityPrefixes'))
```

2. Check Cloud Function logs:
```bash
gcloud functions logs read dataforseo-bigquery-sync --limit=50
```

3. Verify BigQuery column exists:
```sql
SELECT column_name, data_type 
FROM `opsos-864a1.marketing_ai.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'daily_entity_metrics' 
  AND column_name LIKE '%priority%';
```

### Pages matched by prefix not being marked?

The `is_priority_page()` function checks if the prefix is **in** the URL (not just starts with). For example:
- Prefix: `/blog`
- Matches: `https://example.com/blog/article-1`, `https://example.com/blog`
- Also matches: `https://example.com/en/blog/article-1` (prefix is in URL)

This is intentional for flexibility. If you need exact prefix matching, update the function in `main.py`.

## Support

Questions? Check:
1. This documentation
2. Cloud Function logs
3. BigQuery views for data validation
4. Frontend console logs for priority page selection
