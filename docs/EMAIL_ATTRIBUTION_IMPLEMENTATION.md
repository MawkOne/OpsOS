# Email Attribution Pipeline - Implementation with Timeout Handling

## ActiveCampaign API Constraints

### Rate Limits
- **5 requests/second per account**
- Returns `429 Too Many Requests` with `Retry-After` header
- Must implement exponential backoff

### Pagination
- **Max 100 records per request**, default 20
- Use `limit` and `offset` parameters
- **Performance tip for Contacts:** Use `orders[id]=ASC` + `id_greater` instead of `offset`

### Cloud Function Limits
- **9-minute maximum timeout** for 2nd gen functions
- Must use incremental/delta syncs for large datasets
- Process in batches with state tracking

---

## Strategy: Incremental Sync Architecture

### Problem
- Millions of email activities (opens/clicks)
- Cannot fetch all data in single Cloud Function execution
- Must handle rate limits and timeouts

### Solution: Daily Delta Sync + Batch Processing

```
┌─────────────────────────────────────────────────────┐
│ Cloud Scheduler (Hourly)                            │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Cloud Function: email-activities-sync               │
│ • Fetches ONLY last 24-48 hours of data            │
│ • Processes one campaign at a time                  │
│ • Saves progress to Firestore                       │
│ • Rate limiting: 200ms between requests             │
│ • Timeout: Exits gracefully at 8 minutes            │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ BigQuery: email_activities (partitioned by date)    │
│ • MERGE/UPSERT to handle duplicates                │
│ • Partitioned by activity_date                      │
│ • Clustered by contact_email, campaign_id           │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Email Activities Sync (Incremental)

**New Cloud Function:** `email-activities-sync`

```python
import functions_framework
from google.cloud import bigquery, firestore
import requests
import time
from datetime import datetime, timedelta

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
ACTIVITIES_TABLE = "email_activities"

# Rate limiting
REQUEST_DELAY = 0.2  # 200ms = 5 req/sec
MAX_EXECUTION_TIME = 480  # 8 minutes (leave 1 min buffer)

def get_sync_state(organization_id):
    """Get last sync checkpoint from Firestore"""
    db = firestore.Client()
    doc_ref = db.collection('sync_state').document(f'email_activities_{organization_id}')
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {
        'last_sync_date': (datetime.utcnow() - timedelta(days=7)).isoformat(),
        'last_campaign_id': None,
        'campaigns_completed': []
    }

def save_sync_state(organization_id, state):
    """Save sync checkpoint"""
    db = firestore.Client()
    doc_ref = db.collection('sync_state').document(f'email_activities_{organization_id}')
    doc_ref.set(state)

def fetch_with_rate_limit(url, headers, params):
    """Fetch with rate limiting and retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        time.sleep(REQUEST_DELAY)
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 30))
            logger.warning(f"Rate limited, waiting {retry_after}s")
            time.sleep(retry_after)
            continue
        
        if response.ok:
            return response.json()
        
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)  # Exponential backoff
    
    raise Exception(f"Failed after {max_retries} attempts")

def sync_campaign_activities(api_url, api_key, campaign_id, cutoff_date, bq_client):
    """Sync activities for ONE campaign"""
    
    activities = []
    
    # Fetch opens (v1 API)
    opens = fetch_paginated_v1(api_url, api_key, 'campaign_report_open_list', 
                                campaign_id, cutoff_date)
    for record in opens:
        tstamp = record.get('tstamp', '')
        if not tstamp or tstamp < cutoff_date:
            continue
        
        activities.append({
            'campaign_id': campaign_id,
            'contact_email': record.get('email'),
            'contact_id': record.get('contactid'),
            'event_type': 'open',
            'activity_timestamp': tstamp,
            'activity_date': tstamp.split(' ')[0],
            'times': int(record.get('times', 1)),
        })
    
    # Fetch clicks
    clicks = fetch_paginated_v1(api_url, api_key, 'campaign_report_link_list', 
                                 campaign_id, cutoff_date)
    for record in clicks:
        tstamp = record.get('tstamp', '')
        if not tstamp or tstamp < cutoff_date:
            continue
        
        activities.append({
            'campaign_id': campaign_id,
            'contact_email': record.get('email'),
            'contact_id': record.get('contactid'),
            'event_type': 'click',
            'activity_timestamp': tstamp,
            'activity_date': tstamp.split(' ')[0],
            'times': int(record.get('times', 1)),
            'link_url': record.get('link'),
        })
    
    # MERGE into BigQuery (handles duplicates)
    if activities:
        merge_activities_to_bq(bq_client, activities)
    
    return len(activities)

def merge_activities_to_bq(bq_client, activities):
    """MERGE activities into BigQuery to avoid duplicates"""
    
    # Insert into temp table first
    temp_table = f"{PROJECT_ID}.{DATASET_ID}.email_activities_temp"
    
    # Create temp table
    bq_client.query(f"""
        CREATE OR REPLACE TABLE `{temp_table}` AS
        SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{ACTIVITIES_TABLE}` LIMIT 0
    """).result()
    
    # Insert new activities
    table = bq_client.get_table(temp_table)
    errors = bq_client.insert_rows_json(table, activities)
    
    if errors:
        raise Exception(f"BigQuery insert errors: {errors}")
    
    # MERGE temp into main (handles duplicates)
    bq_client.query(f"""
        MERGE `{PROJECT_ID}.{DATASET_ID}.{ACTIVITIES_TABLE}` T
        USING `{temp_table}` S
        ON T.campaign_id = S.campaign_id
           AND T.contact_email = S.contact_email
           AND T.event_type = S.event_type
           AND T.activity_timestamp = S.activity_timestamp
        WHEN NOT MATCHED THEN
          INSERT ROW
    """).result()
    
    # Drop temp table
    bq_client.delete_table(temp_table)

@functions_framework.http
def sync_email_activities(request):
    """Main sync function - processes incrementally"""
    
    start_time = time.time()
    organization_id = "SBjucW1ztDyFYWBz7ZLE"  # Your org ID
    
    # Get API credentials
    db = firestore.Client()
    creds = db.collection('activecampaign_connections').document(organization_id).get()
    api_url = creds.get('apiUrl')
    api_key = creds.get('apiKey')
    
    bq_client = bigquery.Client(project=PROJECT_ID)
    
    # Get sync state
    state = get_sync_state(organization_id)
    cutoff_date = state['last_sync_date']
    
    # Get campaigns to process
    campaigns_response = fetch_with_rate_limit(
        f"{api_url}/api/3/campaigns",
        {"Api-Token": api_key},
        {"limit": 100, "offset": 0}
    )
    
    all_campaigns = campaigns_response.get('campaigns', [])
    completed_campaigns = set(state.get('campaigns_completed', []))
    
    # Filter campaigns that need processing
    campaigns_to_process = [
        c for c in all_campaigns 
        if c['id'] not in completed_campaigns
    ]
    
    logger.info(f"Processing {len(campaigns_to_process)} campaigns since {cutoff_date}")
    
    activities_synced = 0
    campaigns_processed = []
    
    # Process campaigns until timeout
    for campaign in campaigns_to_process:
        # Check timeout (leave 60s buffer)
        elapsed = time.time() - start_time
        if elapsed > MAX_EXECUTION_TIME:
            logger.warning(f"Approaching timeout, stopping gracefully at {elapsed}s")
            break
        
        campaign_id = campaign['id']
        logger.info(f"Processing campaign {campaign_id}: {campaign.get('name', 'Unknown')}")
        
        try:
            count = sync_campaign_activities(
                api_url, api_key, campaign_id, cutoff_date, bq_client
            )
            activities_synced += count
            campaigns_processed.append(campaign_id)
            logger.info(f"  → {count} activities synced")
            
        except Exception as e:
            logger.error(f"Error processing campaign {campaign_id}: {e}")
            # Continue with next campaign
    
    # Update sync state
    new_completed = list(completed_campaigns) + campaigns_processed
    
    # If all campaigns done, reset for next day
    if len(new_completed) >= len(all_campaigns):
        new_state = {
            'last_sync_date': datetime.utcnow().isoformat(),
            'campaigns_completed': [],
            'last_run': datetime.utcnow().isoformat(),
        }
    else:
        new_state = {
            'last_sync_date': cutoff_date,
            'campaigns_completed': new_completed,
            'last_run': datetime.utcnow().isoformat(),
        }
    
    save_sync_state(organization_id, new_state)
    
    return {
        'status': 'success',
        'activities_synced': activities_synced,
        'campaigns_processed': len(campaigns_processed),
        'campaigns_remaining': len(all_campaigns) - len(new_completed),
        'elapsed_seconds': int(time.time() - start_time),
    }
```

### 2. Contacts Sync (Daily Full Sync)

**Contacts are smaller, use standard pagination:**

```python
def sync_contacts(api_url, api_key):
    """Sync all contacts using id_greater pagination"""
    
    last_id = 0
    all_contacts = []
    
    while True:
        time.sleep(REQUEST_DELAY)
        
        response = requests.get(
            f"{api_url}/api/3/contacts",
            headers={"Api-Token": api_key},
            params={
                "limit": 100,
                "orders[id]": "ASC",
                "id_greater": last_id  # Better performance than offset
            }
        )
        
        if response.status_code == 429:
            time.sleep(int(response.headers.get('Retry-After', 30)))
            continue
        
        data = response.json()
        contacts = data.get('contacts', [])
        
        if not contacts:
            break
        
        all_contacts.extend(contacts)
        last_id = contacts[-1]['id']
        
        # Check timeout
        if time.time() - start_time > MAX_EXECUTION_TIME:
            break
    
    return all_contacts
```

---

## BigQuery Table Schemas

### email_activities
```sql
CREATE TABLE `opsos-864a1.marketing_ai.email_activities` (
  organization_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  contact_email STRING,
  contact_id STRING,
  
  event_type STRING,  -- 'open', 'click', 'bounce', 'unsubscribe'
  activity_timestamp TIMESTAMP,
  activity_date DATE,
  
  times INT64,
  link_url STRING,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY activity_date
CLUSTER BY contact_email, campaign_id, event_type
OPTIONS(
  partition_expiration_days=730  -- 2 years
);

-- Add deduplication constraint (pseudo)
CREATE OR REPLACE TABLE `opsos-864a1.marketing_ai.email_activities` AS
SELECT * FROM `opsos-864a1.marketing_ai.email_activities`
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY campaign_id, contact_email, event_type, activity_timestamp 
  ORDER BY created_at DESC
) = 1;
```

### contacts
```sql
CREATE TABLE `opsos-864a1.marketing_ai.contacts` (
  organization_id STRING,
  contact_id STRING,
  
  email STRING,
  first_name STRING,
  last_name STRING,
  phone STRING,
  
  created_date DATE,
  updated_date DATE,
  
  tags ARRAY<STRING>,
  lists ARRAY<STRING>,
  
  status STRING,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Upsert on sync
MERGE `opsos-864a1.marketing_ai.contacts` T
USING temp_contacts S
ON T.contact_id = S.contact_id
WHEN MATCHED THEN
  UPDATE SET
    email = S.email,
    first_name = S.first_name,
    last_name = S.last_name,
    updated_date = S.updated_date,
    tags = S.tags,
    lists = S.lists,
    updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT ROW;
```

---

## Deployment

### 1. Create Tables
```bash
bq mk --table \
  opsos-864a1:marketing_ai.email_activities \
  schema_email_activities.json

bq mk --table \
  opsos-864a1:marketing_ai.contacts \
  schema_contacts.json
```

### 2. Deploy Cloud Function
```bash
gcloud functions deploy email-activities-sync \
  --gen2 \
  --region=us-central1 \
  --runtime=python311 \
  --source=. \
  --entry-point=sync_email_activities \
  --timeout=540s \
  --memory=1024MB \
  --max-instances=1 \
  --service-account=cloud-functions@opsos-864a1.iam.gserviceaccount.com
```

### 3. Schedule with Cloud Scheduler
```bash
gcloud scheduler jobs create http email-activities-sync-job \
  --schedule="0 */6 * * *" \
  --uri="https://us-central1-opsos-864a1.cloudfunctions.net/email-activities-sync" \
  --http-method=POST \
  --time-zone="America/Chicago" \
  --location=us-central1
```

---

## Timeline & Estimates

### Initial Backfill
- **7 days of email activities:** ~3-5M events
- **Processing time:** ~10-15 function invocations (every 6 hours = 2-3 days)
- **Ongoing:** 1 invocation every 6 hours handles daily delta

### Storage
- **email_activities:** ~500K events/day = ~200MB/month compressed
- **contacts:** ~50K contacts = ~10MB

### Cost (Rough)
- **BigQuery:** ~$1-2/month (storage + queries)
- **Cloud Functions:** ~$5/month (invocations + compute)
- **Total:** <$10/month

---

## Monitoring

### Firestore State Document
```json
{
  "last_sync_date": "2026-02-20T00:00:00Z",
  "campaigns_completed": ["249", "614", "2799"],
  "last_run": "2026-02-20T12:00:00Z",
  "activities_synced_today": 45230
}
```

### BigQuery Monitoring Query
```sql
-- Check sync progress
SELECT 
  activity_date,
  event_type,
  COUNT(*) as events,
  COUNT(DISTINCT contact_email) as unique_contacts,
  COUNT(DISTINCT campaign_id) as campaigns
FROM `opsos-864a1.marketing_ai.email_activities`
WHERE activity_date >= CURRENT_DATE() - 7
GROUP BY activity_date, event_type
ORDER BY activity_date DESC, event_type;
```

---

## Next Steps

1. **Create BigQuery tables** with schemas above
2. **Deploy email-activities-sync function** with incremental logic
3. **Deploy contacts-sync function** (daily full sync)
4. **Set up Cloud Scheduler** for automated runs
5. **Monitor Firestore state** to verify progress
6. **Build user mapping** once contacts are syncing
7. **Create aggregation views** for reporting

This approach handles millions of events without timeouts!
