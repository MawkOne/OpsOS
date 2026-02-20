# Email Attribution Pipeline: Events → Contacts → Users

## Goal
Attribute all email activity to users for proper daily/weekly/monthly reporting with contact-level granularity.

## Data Flow
```
ActiveCampaign Email Activities (opens, clicks)
    ↓
ActiveCampaign Contacts (email, name, tags)
    ↓
OpsOS Users (via email matching)
    ↓
Daily/Weekly/Monthly Aggregations
```

---

## Phase 1: Raw Data Ingestion

### 1.1 Email Activities (Individual Events)
**Table:** `email_activities`
**Schema:**
```sql
CREATE TABLE `opsos-864a1.marketing_ai.email_activities` (
  organization_id STRING,
  activity_date DATE,
  activity_timestamp TIMESTAMP,
  
  -- Email identifiers
  campaign_id STRING,
  campaign_name STRING,
  contact_email STRING,
  contact_id STRING,
  
  -- Activity details
  event_type STRING,  -- 'open', 'click', 'bounce', 'unsubscribe'
  link_url STRING,    -- For clicks
  times INT64,        -- Number of times (opens can be multiple)
  
  -- Metadata
  user_agent STRING,
  ip_address STRING,
  
  -- Attribution (added later)
  user_id STRING,     -- Mapped from contacts
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITION BY activity_date
CLUSTER BY contact_email, campaign_id;
```

**Source:** ActiveCampaign v1 API
- `campaign_report_open_list` → Opens
- `campaign_report_link_list` → Clicks
- `campaign_report_bounce_list` → Bounces
- `campaign_report_unsubscription_list` → Unsubscribes

### 1.2 Individual Contacts
**Table:** `contacts`
**Schema:**
```sql
CREATE TABLE `opsos-864a1.marketing_ai.contacts` (
  organization_id STRING,
  contact_id STRING,      -- ActiveCampaign contact ID
  
  -- Identity
  email STRING,
  first_name STRING,
  last_name STRING,
  phone STRING,
  
  -- Timestamps
  created_date DATE,
  updated_date DATE,
  last_activity_date DATE,
  
  -- Segmentation
  tags ARRAY<STRING>,
  lists ARRAY<STRING>,
  
  -- Custom fields (JSON)
  custom_fields JSON,
  
  -- Attribution
  user_id STRING,         -- Mapped to OpsOS user
  
  -- Status
  status STRING,          -- 'active', 'unsubscribed', 'bounced'
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  PRIMARY KEY NOT ENFORCED (contact_id)
);
```

**Source:** ActiveCampaign v3 API `/api/3/contacts`

---

## Phase 2: Contact → User Mapping

### 2.1 User Mapping Table
**Table:** `contact_user_mapping`
**Schema:**
```sql
CREATE TABLE `opsos-864a1.marketing_ai.contact_user_mapping` (
  organization_id STRING,
  contact_email STRING,
  contact_id STRING,
  
  -- OpsOS user info
  user_id STRING,
  user_type STRING,       -- 'talent', 'company', 'admin'
  user_status STRING,     -- 'active', 'inactive'
  
  -- Mapping metadata
  match_method STRING,    -- 'exact_email', 'fuzzy', 'manual'
  confidence FLOAT64,     -- 0.0 to 1.0
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  PRIMARY KEY NOT ENFORCED (contact_id)
);
```

### 2.2 Mapping Logic
```sql
-- Match contacts to users by email
INSERT INTO `opsos-864a1.marketing_ai.contact_user_mapping`
SELECT 
  c.organization_id,
  c.email as contact_email,
  c.contact_id,
  
  -- Match to Firebase users (you'll need to provide this mapping)
  u.user_id,
  u.user_type,
  u.status as user_status,
  
  'exact_email' as match_method,
  1.0 as confidence,
  
  CURRENT_TIMESTAMP() as created_at,
  CURRENT_TIMESTAMP() as updated_at
FROM `opsos-864a1.marketing_ai.contacts` c
LEFT JOIN `opsos-864a1.users.user_profiles` u  -- Your user table
  ON LOWER(c.email) = LOWER(u.email)
WHERE u.user_id IS NOT NULL;
```

---

## Phase 3: Daily/Weekly/Monthly Aggregations

### 3.1 Daily Email Metrics by User
**Table:** `daily_user_email_metrics`
**Schema:**
```sql
CREATE TABLE `opsos-864a1.reporting.daily_user_email_metrics` (
  organization_id STRING,
  date DATE,
  
  -- User attribution
  user_id STRING,
  user_type STRING,
  user_email STRING,
  
  -- Email activity
  emails_received INT64,
  emails_opened INT64,
  unique_opens INT64,
  emails_clicked INT64,
  unique_clicks INT64,
  
  -- Campaigns engaged with
  campaigns_engaged ARRAY<STRING>,
  campaigns_count INT64,
  
  -- Engagement metrics
  avg_opens_per_email FLOAT64,
  avg_clicks_per_email FLOAT64,
  open_rate FLOAT64,
  click_rate FLOAT64,
  
  -- Time-based
  first_open_time TIME,
  last_open_time TIME,
  
  created_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY user_id, user_type;
```

**Source Query:**
```sql
-- Aggregate email activities by user per day
INSERT INTO `opsos-864a1.reporting.daily_user_email_metrics`
SELECT 
  e.organization_id,
  e.activity_date as date,
  
  m.user_id,
  m.user_type,
  e.contact_email as user_email,
  
  COUNT(DISTINCT CASE WHEN e.event_type = 'send' THEN e.campaign_id END) as emails_received,
  SUM(CASE WHEN e.event_type = 'open' THEN e.times ELSE 0 END) as emails_opened,
  COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN e.campaign_id END) as unique_opens,
  SUM(CASE WHEN e.event_type = 'click' THEN e.times ELSE 0 END) as emails_clicked,
  COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN e.campaign_id END) as unique_clicks,
  
  ARRAY_AGG(DISTINCT e.campaign_id IGNORE NULLS) as campaigns_engaged,
  COUNT(DISTINCT e.campaign_id) as campaigns_count,
  
  SAFE_DIVIDE(SUM(CASE WHEN e.event_type = 'open' THEN e.times ELSE 0 END), 
              COUNT(DISTINCT CASE WHEN e.event_type = 'send' THEN e.campaign_id END)) as avg_opens_per_email,
  SAFE_DIVIDE(SUM(CASE WHEN e.event_type = 'click' THEN e.times ELSE 0 END), 
              COUNT(DISTINCT CASE WHEN e.event_type = 'send' THEN e.campaign_id END)) as avg_clicks_per_email,
  SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN e.campaign_id END), 
              COUNT(DISTINCT CASE WHEN e.event_type = 'send' THEN e.campaign_id END)) as open_rate,
  SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN e.campaign_id END), 
              COUNT(DISTINCT CASE WHEN e.event_type = 'send' THEN e.campaign_id END)) as click_rate,
  
  MIN(CASE WHEN e.event_type = 'open' THEN TIME(e.activity_timestamp) END) as first_open_time,
  MAX(CASE WHEN e.event_type = 'open' THEN TIME(e.activity_timestamp) END) as last_open_time,
  
  CURRENT_TIMESTAMP() as created_at
FROM `opsos-864a1.marketing_ai.email_activities` e
LEFT JOIN `opsos-864a1.marketing_ai.contact_user_mapping` m
  ON e.contact_email = m.contact_email
WHERE e.activity_date = CURRENT_DATE() - 1  -- Yesterday's data
  AND m.user_id IS NOT NULL  -- Only mapped users
GROUP BY 
  e.organization_id,
  e.activity_date,
  m.user_id,
  m.user_type,
  e.contact_email;
```

### 3.2 Weekly Aggregation
```sql
CREATE TABLE `opsos-864a1.reporting.weekly_user_email_metrics` AS
SELECT 
  organization_id,
  DATE_TRUNC(date, WEEK(MONDAY)) as week_start,
  user_id,
  user_type,
  
  SUM(emails_received) as emails_received,
  SUM(emails_opened) as emails_opened,
  SUM(unique_opens) as unique_opens,
  SUM(emails_clicked) as emails_clicked,
  SUM(unique_clicks) as unique_clicks,
  
  AVG(open_rate) as avg_open_rate,
  AVG(click_rate) as avg_click_rate,
  
  COUNT(DISTINCT date) as active_days,
  
  CURRENT_TIMESTAMP() as created_at
FROM `opsos-864a1.reporting.daily_user_email_metrics`
GROUP BY organization_id, week_start, user_id, user_type;
```

### 3.3 Monthly Aggregation
```sql
CREATE TABLE `opsos-864a1.reporting.monthly_user_email_metrics` AS
SELECT 
  organization_id,
  DATE_TRUNC(date, MONTH) as month_start,
  user_id,
  user_type,
  
  SUM(emails_received) as emails_received,
  SUM(emails_opened) as emails_opened,
  SUM(unique_opens) as unique_opens,
  SUM(emails_clicked) as emails_clicked,
  SUM(unique_clicks) as unique_clicks,
  
  AVG(open_rate) as avg_open_rate,
  AVG(click_rate) as avg_click_rate,
  
  COUNT(DISTINCT date) as active_days,
  
  CURRENT_TIMESTAMP() as created_at
FROM `opsos-864a1.reporting.daily_user_email_metrics`
GROUP BY organization_id, month_start, user_id, user_type;
```

---

## Phase 4: Campaign-Level Attribution

### 4.1 Campaign Performance by User Segment
```sql
CREATE TABLE `opsos-864a1.reporting.campaign_user_metrics` AS
SELECT 
  e.campaign_id,
  e.campaign_name,
  e.activity_date,
  
  m.user_type,
  
  COUNT(DISTINCT e.contact_email) as unique_recipients,
  COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN e.contact_email END) as unique_openers,
  COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN e.contact_email END) as unique_clickers,
  
  SUM(CASE WHEN e.event_type = 'open' THEN e.times ELSE 0 END) as total_opens,
  SUM(CASE WHEN e.event_type = 'click' THEN e.times ELSE 0 END) as total_clicks,
  
  SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN e.contact_email END), 
              COUNT(DISTINCT e.contact_email)) as open_rate,
  SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN e.contact_email END), 
              COUNT(DISTINCT e.contact_email)) as click_rate
FROM `opsos-864a1.marketing_ai.email_activities` e
LEFT JOIN `opsos-864a1.marketing_ai.contact_user_mapping` m
  ON e.contact_email = m.contact_email
WHERE m.user_id IS NOT NULL
GROUP BY 
  e.campaign_id,
  e.campaign_name,
  e.activity_date,
  m.user_type;
```

---

## Implementation Plan

### **Step 1: Enable Email Activities Ingestion** (1-2 days)
- Modify `activecampaign-bigquery-sync` Cloud Function
- Create `email_activities` table
- Enable `fetch_activities=true`
- Test with last 7 days of data

### **Step 2: Ingest Contact Records** (1 day)
- Create `contacts` table
- Add contact sync to Cloud Function
- Store email, name, tags, lists
- Initial full sync, then daily incremental

### **Step 3: Build Contact → User Mapping** (1 day)
- Create `contact_user_mapping` table
- Write SQL to match contacts to users by email
- Schedule daily refresh
- Add mapping validation/monitoring

### **Step 4: Create User Email Metrics Tables** (1 day)
- Create daily/weekly/monthly aggregation tables
- Write aggregation queries
- Create Cloud Function for daily ETL
- Backfill historical data

### **Step 5: Update Dashboard** (1 day)
- Create new API endpoints for user-level metrics
- Add "Engagement by User Type" section
- Add "Top Engaged Users" leaderboard
- Add individual user email history view

---

## Database Size Estimates

**email_activities:**
- ~500K opens/day × 365 days = 182M rows/year
- With partitioning: ~500MB/month

**contacts:**
- ~50K contacts
- ~10MB total

**daily_user_email_metrics:**
- ~10K active users/day × 365 days = 3.6M rows/year
- ~100MB/year

**Total additional storage:** ~6-7GB/year

---

## Next Steps

1. **Confirm user table location**: Where are your OpsOS users stored?
   - Firestore collection name?
   - BigQuery table?
   - User ID field name?

2. **Define user types**: What user types do you have?
   - Talent vs Company?
   - Other segments?

3. **Approve implementation**: Ready to proceed with Phase 1?
