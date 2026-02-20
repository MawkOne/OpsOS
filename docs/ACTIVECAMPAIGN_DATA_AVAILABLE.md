# ActiveCampaign Low-Level Data Available

## Currently Ingesting (✓ = Active, ⚠️ = Partial, ❌ = Not Collected)

### ✓ **Campaign Data** (Aggregated Daily)
**Table:** `daily_entity_metrics` (entity_type = 'email_campaign')
**Columns:**
- Campaign ID, Name
- Sends, Opens, Clicks
- Open Rate, CTR, Bounce Rate
- Campaign Status (1=automation, 5=marketing)
- Automation ID (if applicable)

**Raw JSON stored in:** `raw_activecampaign` (data_type = 'campaign')

**Sample fields available in raw JSON:**
```json
{
  "id": "4448",
  "name": "Discover & Hire Automated",
  "status": "1",
  "automation": "132",
  "send_amt": "1236",
  "opens": "1389",
  "uniqueopens": "594",
  "verified_opens": "1016",
  "verified_unique_opens": "469",
  "linkclicks": "85",
  "uniquelinkclicks": "70",
  "subscriberclicks": "68",
  "hardbounces": "3",
  "softbounces": "1",
  "unsubscribes": "5",
  "forwards": "0",
  "replies": "0",
  "socialshares": "0"
}
```

### ⚠️ **Email Activities** (Individual Opens/Clicks)
**Status:** CODE EXISTS but not actively running (requires `fetch_activities=true`)
**API Used:** ActiveCampaign v1 API
- `campaign_report_open_list` - Individual open events
- `campaign_report_link_list` - Individual click events

**What we could get:**
- Contact email
- Timestamp of open/click
- Number of times opened/clicked
- Link URL (for clicks)

**Current aggregation:**
- Daily totals by date
- Unique openers/clickers counts

### ✓ **Lists Data**
**Table:** `daily_entity_metrics` (entity_type = 'email_list')
**Columns:**
- List ID, Name
- Subscriber count

**Raw JSON stored in:** `raw_activecampaign` (data_type = 'list')

### ⚠️ **Contacts** (Summary Only)
**Table:** `daily_entity_metrics` (entity_type = 'contact_summary')
**Current:** Total contact count only
**NOT storing:** Individual contact records

**API Endpoint:** `/api/3/contacts`
**Available fields per contact:**
- Email, First Name, Last Name
- Created date, Updated date
- Phone, IP
- Tags
- Custom fields
- Lists they're subscribed to
- Deals associated
- Organization

### ⚠️ **Deals** (Summary Only)
**Table:** `daily_entity_metrics` (entity_type = 'deal_summary')
**Current:** Total deal count only
**NOT storing:** Individual deal records

**API Endpoint:** `/api/3/deals`
**Available fields per deal:**
- Deal title, description
- Value, currency
- Owner (user ID)
- Stage, Pipeline
- Created/Updated dates
- Contact association
- Custom fields

---

## ❌ NOT Currently Ingesting (Available via API)

### **Automations**
**API Endpoint:** `/api/3/automations`
**Data available:**
- Automation ID, Name
- Status (active/paused)
- Entry/Exit counts
- Created date
- Triggers
- Action steps

### **Forms**
**API Endpoint:** `/api/3/forms`
**Data available:**
- Form ID, Name
- Submission count
- Fields
- Created date
- URL

### **Tags**
**API Endpoint:** `/api/3/tags`
**Data available:**
- Tag ID, Name
- Contact count
- Created date

### **Custom Fields**
**API Endpoint:** `/api/3/fields`
**Data available:**
- Field ID, Title
- Type (text, date, dropdown, etc.)
- Options (for dropdown)

### **Contact Activities/Events**
**API Endpoint:** `/api/3/contactActivities` or `/api/3/events`
**Data available:**
- Activity type (email open, click, page view, etc.)
- Timestamp
- Contact ID
- Campaign/Page/Link associated
- IP address, User agent

### **Email Messages**
**API Endpoint:** `/api/3/messages`
**Data available:**
- Message ID
- Subject line
- HTML/Text content
- Created/Updated dates
- Campaign association

### **Segments**
**API Endpoint:** `/api/3/segments`
**Data available:**
- Segment ID, Name
- Logic/conditions
- Contact count

### **Site Tracking**
**API Endpoint:** `/api/3/siteTrackingDomains`, `/api/3/siteTrackingEvents`
**Data available:**
- Domain tracking settings
- Page visits
- Events triggered
- Contact association

---

## Recommendations for Low-Level Data Ingestion

### **Priority 1: Individual Contact Records**
**Why:** Enable segmentation analysis, cohort tracking, list growth trends
**Storage:** New table `contacts` or expand `daily_entity_metrics`
**Fields to capture:**
- email, firstName, lastName
- cdate (created), udate (updated)
- tags[], lists[]
- Custom fields (company, role, etc.)

### **Priority 2: Individual Deal Records**
**Why:** Revenue pipeline analysis, sales funnel metrics
**Storage:** New table `deals` or expand `daily_entity_metrics`
**Fields to capture:**
- title, value, currency
- stage, pipeline
- owner, contact
- cdate, mdate
- Custom fields

### **Priority 3: Email Activities (Open/Click Events)**
**Why:** Engagement scoring, re-engagement campaigns, behavioral analysis
**Storage:** New table `email_activities` (already defined but not used)
**Fields to capture:**
- contactEmail, campaignId
- eventType (open/click)
- timestamp
- link (for clicks)
- userAgent, ip

### **Priority 4: Automations Metadata**
**Why:** Understand automation performance, entry/exit rates
**Storage:** New table `automations`
**Fields to capture:**
- id, name, status
- entryCount, exitCount
- steps[] (action sequence)
- created, updated

### **Priority 5: Tags**
**Why:** Segmentation analysis, tagging trends
**Storage:** New table `tags` + junction table `contact_tags`
**Fields to capture:**
- id, name
- contactCount
- created

---

## Implementation Notes

1. **Individual records** would require:
   - New BigQuery tables (contacts, deals, automations, etc.)
   - Modified sync function to store individual records
   - Pagination handling (ActiveCampaign returns 100 records/page)

2. **Email activities** code already exists but is disabled:
   - Set `fetch_activities=true` in Cloud Function invocation
   - Very API-intensive (paginated per campaign)
   - Consider rate limiting strategy

3. **Storage considerations:**
   - Individual contacts: ~tens of thousands of rows
   - Individual deals: ~hundreds to thousands
   - Email activities: ~millions of rows (opens/clicks)
   - Consider partitioning by date for large tables

4. **Update frequency:**
   - Full contacts/deals sync: Daily
   - Email activities: Daily (last 7 days rolling)
   - Campaigns/Lists: Hourly (current)
