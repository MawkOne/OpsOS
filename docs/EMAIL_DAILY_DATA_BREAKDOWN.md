# Daily Email Data Available After Implementation

## Raw Event-Level Data (Most Granular)

### 1. Individual Email Activities (`email_activities` table)
**Every single open/click event with timestamp**

```sql
SELECT * FROM `opsos-864a1.marketing_ai.email_activities`
WHERE activity_date = '2026-02-20'
LIMIT 5;
```

**Example rows:**
```
campaign_id: 2799
campaign_name: "Monthly Performance Update"
contact_email: "john@example.com"
contact_id: "12345"
event_type: "open"
activity_timestamp: 2026-02-20 09:15:23
times: 1

campaign_id: 2799
contact_email: "john@example.com"
event_type: "click"
activity_timestamp: 2026-02-20 09:17:45
link_url: "https://yoursite.com/profile"
times: 1

campaign_id: 614
contact_email: "sarah@example.com"
event_type: "open"
activity_timestamp: 2026-02-20 14:32:11
times: 2  (opened twice)
```

**What you can do:**
- See EVERY individual open/click
- Know EXACTLY when someone opened
- Track which links were clicked
- Identify power users (multiple opens)
- Time-of-day engagement analysis
- Individual contact engagement history

**Volume:** ~500K events/day

---

## Contact-Level Daily Data

### 2. Daily User Email Metrics (`daily_user_email_metrics` table)
**Aggregated by user per day**

```sql
SELECT * FROM `opsos-864a1.reporting.daily_user_email_metrics`
WHERE date = '2026-02-20'
ORDER BY emails_opened DESC
LIMIT 10;
```

**Example rows:**
```
date: 2026-02-20
user_id: "talent_abc123"
user_type: "talent"
user_email: "john@example.com"
emails_received: 3
emails_opened: 5  (opened some multiple times)
unique_opens: 2  (opened 2 different emails)
emails_clicked: 2
unique_clicks: 1
campaigns_engaged: ["2799", "614"]
campaigns_count: 2
avg_opens_per_email: 1.67
open_rate: 0.67  (opened 2 out of 3 emails)
click_rate: 0.33  (clicked 1 out of 3 emails)
first_open_time: 09:15:23
last_open_time: 14:32:11
```

**What you can do:**
- Daily engagement per user
- Which users opened/clicked today
- User engagement trends over time
- Cohort analysis (users who signed up in Jan)
- Re-engagement campaigns (users who stopped opening)
- Power user identification

**Volume:** ~10-20K users/day (only active users)

---

## Campaign-Level Daily Data

### 3. Campaign Performance by User Segment (`campaign_user_metrics` table)
**Daily performance per campaign per user type**

```sql
SELECT * FROM `opsos-864a1.reporting.campaign_user_metrics`
WHERE activity_date = '2026-02-20'
ORDER BY campaigns DESC;
```

**Example rows:**
```
campaign_id: "2799"
campaign_name: "Monthly Performance Update"
activity_date: 2026-02-20
user_type: "talent"
unique_recipients: 15432
unique_openers: 4876
unique_clickers: 1234
total_opens: 6543  (some opened multiple times)
total_clicks: 1456
open_rate: 0.316  (31.6%)
click_rate: 0.080  (8.0%)

campaign_id: "2799"
campaign_name: "Monthly Performance Update"
activity_date: 2026-02-20
user_type: "company"
unique_recipients: 8234
unique_openers: 2145
unique_clickers: 567
total_opens: 2890
total_clicks: 645
open_rate: 0.260  (26.0%)
click_rate: 0.069  (6.9%)
```

**What you can do:**
- Which campaigns work best for talent vs companies
- Daily campaign performance
- A/B test results by segment
- Identify best-performing campaigns
- Campaign engagement by user type

**Volume:** ~50-100 rows/day (campaigns × user_types)

---

## Contact Profile Data

### 4. Individual Contacts (`contacts` table)
**Full contact records updated daily**

```sql
SELECT * FROM `opsos-864a1.marketing_ai.contacts`
WHERE email = 'john@example.com';
```

**Example row:**
```
contact_id: "12345"
email: "john@example.com"
first_name: "John"
last_name: "Smith"
phone: "+1-555-1234"
created_date: 2024-05-15
updated_date: 2026-02-20
tags: ["talent", "active", "premium"]
lists: ["All Contacts", "Script Writers Active"]
status: "active"
```

**What you can do:**
- Look up any contact's full profile
- See their tags and lists
- Track when they joined
- Segmentation by tags/lists
- Contact enrichment data

**Volume:** ~50K total contacts (full snapshot)

---

## Attribution Data

### 5. Contact → User Mapping (`contact_user_mapping` table)
**Links email contacts to OpsOS users**

```sql
SELECT * FROM `opsos-864a1.marketing_ai.contact_user_mapping`
WHERE contact_email = 'john@example.com';
```

**Example row:**
```
contact_email: "john@example.com"
contact_id: "12345"
user_id: "talent_abc123"
user_type: "talent"
user_status: "active"
match_method: "exact_email"
confidence: 1.0
```

**What you can do:**
- Link email activity to app users
- Cross-reference email engagement with app usage
- Identify which users engage with email vs don't
- User lifecycle analysis (email → signup → active)

**Volume:** ~40-50K mappings (matched contacts)

---

## Dashboard Views You Can Build

### User Engagement Dashboard
```sql
-- Daily: Top 10 most engaged users
SELECT 
  u.user_email,
  u.user_type,
  u.emails_opened,
  u.unique_clicks,
  u.campaigns_engaged,
  u.open_rate,
  u.click_rate
FROM `opsos-864a1.reporting.daily_user_email_metrics` u
WHERE u.date = CURRENT_DATE() - 1
ORDER BY u.emails_opened DESC
LIMIT 10;
```

### Campaign Performance by Segment
```sql
-- Daily: How each campaign performed with talents vs companies
SELECT 
  campaign_name,
  user_type,
  unique_recipients,
  unique_openers,
  open_rate,
  click_rate
FROM `opsos-864a1.reporting.campaign_user_metrics`
WHERE activity_date = CURRENT_DATE() - 1
ORDER BY unique_recipients DESC;
```

### Individual User Email History
```sql
-- All email activity for one user
SELECT 
  e.activity_timestamp,
  e.campaign_name,
  e.event_type,
  e.link_url
FROM `opsos-864a1.marketing_ai.email_activities` e
JOIN `opsos-864a1.marketing_ai.contact_user_mapping` m
  ON e.contact_email = m.contact_email
WHERE m.user_id = 'talent_abc123'
  AND e.activity_date >= CURRENT_DATE() - 30
ORDER BY e.activity_timestamp DESC;
```

### List Growth Daily
```sql
-- Daily new contacts, by tag/list
SELECT 
  created_date,
  COUNT(*) as new_contacts,
  COUNTIF('talent' IN UNNEST(tags)) as new_talents,
  COUNTIF('company' IN UNNEST(tags)) as new_companies
FROM `opsos-864a1.marketing_ai.contacts`
WHERE created_date >= CURRENT_DATE() - 30
GROUP BY created_date
ORDER BY created_date DESC;
```

### Engagement Time Heatmap
```sql
-- What time of day do users engage most?
SELECT 
  EXTRACT(HOUR FROM activity_timestamp) as hour_of_day,
  event_type,
  COUNT(*) as events
FROM `opsos-864a1.marketing_ai.email_activities`
WHERE activity_date >= CURRENT_DATE() - 7
GROUP BY hour_of_day, event_type
ORDER BY hour_of_day;
```

---

## Summary

### Raw Data (Event-Level)
✅ **Every email open** - who, when, which campaign
✅ **Every email click** - who, when, which link
✅ **Every contact** - email, name, tags, lists
✅ **Every user mapping** - contact → user attribution

### Aggregated Daily Data
✅ **Per user per day** - opens, clicks, engagement rates
✅ **Per campaign per day per segment** - talent vs company performance
✅ **Per list per day** - growth, churn, active subscribers

### Time Granularity
✅ **Timestamp precision** - Know exact second of opens/clicks
✅ **Daily aggregations** - Rolled up by user, campaign, segment
✅ **Weekly/Monthly rollups** - Built from daily data

---

## Key Insight

With this data, you can answer questions like:
- "Show me all emails john@example.com opened last week"
- "Which automation has the best click rate with talent users?"
- "What time of day do companies engage most with emails?"
- "Which users haven't opened an email in 30 days?" (re-engagement)
- "How many new contacts tagged 'talent' joined this week?"
- "Which campaign drove the most traffic to the site?" (link clicks)

**This is FULL GRANULARITY email attribution!**
