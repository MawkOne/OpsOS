# Google Analytics 4 BigQuery Queries

## Overview

Your GA4 data is now synced to BigQuery in 4 tables:
- `ga_traffic_sources_raw_latest` - Traffic sources (Organic, Direct, Paid, etc.)
- `ga_campaigns_raw_latest` - Campaign performance
- `ga_events_raw_latest` - Event tracking (page_view, clicks, conversions)
- `ga_pages_raw_latest` - Page performance

---

## Table Structure

All tables have the same schema from the Firestore export extension:

```sql
document_name: STRING  -- Full Firestore document path
document_id: STRING    -- Document ID (organizationId_itemId)
timestamp: TIMESTAMP   -- When synced
operation: STRING      -- CREATE, UPDATE, IMPORT
data: STRING           -- JSON string of the document data
old_data: STRING       -- Previous state (for updates)
```

The `data` field contains JSON with your GA4 metrics.

---

## Query Examples

### 1. Traffic Sources - All Data

```sql
SELECT 
  JSON_VALUE(data, '$.sourceName') as source_name,
  JSON_VALUE(data, '$.sourceId') as source_id,
  data -- Full JSON with months
FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`
```

### 2. Traffic Sources - Extract Monthly Metrics

```sql
SELECT 
  JSON_VALUE(data, '$.sourceName') as source_name,
  month_key,
  CAST(JSON_VALUE(month_data, '$.users') AS INT64) as users,
  CAST(JSON_VALUE(month_data, '$.sessions') AS INT64) as sessions,
  CAST(JSON_VALUE(month_data, '$.conversions') AS INT64) as conversions,
  CAST(JSON_VALUE(month_data, '$.revenue') AS FLOAT64) as revenue
FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
  CROSS JOIN UNNEST([STRUCT(
    JSON_VALUE(month_entry, '$[0]') as month_key,
    JSON_QUERY(month_entry, '$[1]') as month_data
  )])
ORDER BY source_name, month_key DESC
```

### 3. Campaigns Performance

```sql
SELECT 
  JSON_VALUE(data, '$.campaignName') as campaign_name,
  month_key,
  CAST(JSON_VALUE(month_data, '$.users') AS INT64) as users,
  CAST(JSON_VALUE(month_data, '$.cost') AS FLOAT64) as cost,
  CAST(JSON_VALUE(month_data, '$.conversions') AS INT64) as conversions,
  CAST(JSON_VALUE(month_data, '$.revenue') AS FLOAT64) as revenue,
  -- Calculate ROI
  SAFE_DIVIDE(
    CAST(JSON_VALUE(month_data, '$.revenue') AS FLOAT64),
    CAST(JSON_VALUE(month_data, '$.cost') AS FLOAT64)
  ) as roi
FROM `opsos-864a1.firestore_export.ga_campaigns_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
  CROSS JOIN UNNEST([STRUCT(
    JSON_VALUE(month_entry, '$[0]') as month_key,
    JSON_QUERY(month_entry, '$[1]') as month_data
  )])
WHERE JSON_VALUE(month_data, '$.cost') IS NOT NULL
ORDER BY campaign_name, month_key DESC
```

### 4. Top Events by Month

```sql
SELECT 
  JSON_VALUE(data, '$.eventName') as event_name,
  month_key,
  CAST(JSON_VALUE(month_data, '$.eventCount') AS INT64) as event_count,
  CAST(JSON_VALUE(month_data, '$.users') AS INT64) as users
FROM `opsos-864a1.firestore_export.ga_events_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
  CROSS JOIN UNNEST([STRUCT(
    JSON_VALUE(month_entry, '$[0]') as month_key,
    JSON_QUERY(month_entry, '$[1]') as month_data
  )])
ORDER BY month_key DESC, event_count DESC
LIMIT 20
```

### 5. Top Pages by Engagement

```sql
SELECT 
  JSON_VALUE(data, '$.pageTitle') as page_title,
  JSON_VALUE(data, '$.pagePath') as page_path,
  month_key,
  CAST(JSON_VALUE(month_data, '$.views') AS INT64) as views,
  CAST(JSON_VALUE(month_data, '$.users') AS INT64) as users,
  CAST(JSON_VALUE(month_data, '$.avgEngagementTime') AS FLOAT64) as avg_engagement_seconds
FROM `opsos-864a1.firestore_export.ga_pages_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
  CROSS JOIN UNNEST([STRUCT(
    JSON_VALUE(month_entry, '$[0]') as month_key,
    JSON_QUERY(month_entry, '$[1]') as month_data
  )])
ORDER BY month_key DESC, views DESC
LIMIT 20
```

### 6. Organic Search Performance Over Time

```sql
SELECT 
  month_key,
  CAST(JSON_VALUE(month_data, '$.users') AS INT64) as users,
  CAST(JSON_VALUE(month_data, '$.sessions') AS INT64) as sessions,
  CAST(JSON_VALUE(month_data, '$.conversions') AS INT64) as conversions,
  CAST(JSON_VALUE(month_data, '$.conversionRate') AS FLOAT64) as conversion_rate
FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
  CROSS JOIN UNNEST([STRUCT(
    JSON_VALUE(month_entry, '$[0]') as month_key,
    JSON_QUERY(month_entry, '$[1]') as month_data
  )])
WHERE JSON_VALUE(data, '$.sourceId') = 'organic-search'
ORDER BY month_key DESC
```

### 7. Causation Analysis - What Drives Signups?

```sql
-- Assuming 'sign_up' is your conversion event
WITH signups_by_month AS (
  SELECT 
    month_key,
    CAST(JSON_VALUE(month_data, '$.eventCount') AS INT64) as signups
  FROM `opsos-864a1.firestore_export.ga_events_raw_latest`,
    UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
    CROSS JOIN UNNEST([STRUCT(
      JSON_VALUE(month_entry, '$[0]') as month_key,
      JSON_QUERY(month_entry, '$[1]') as month_data
    )])
  WHERE JSON_VALUE(data, '$.eventName') = 'sign_up'
),
traffic_by_month AS (
  SELECT 
    JSON_VALUE(data, '$.sourceName') as source,
    month_key,
    CAST(JSON_VALUE(month_data, '$.users') AS INT64) as users,
    CAST(JSON_VALUE(month_data, '$.conversions') AS INT64) as conversions
  FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`,
    UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
    CROSS JOIN UNNEST([STRUCT(
      JSON_VALUE(month_entry, '$[0]') as month_key,
      JSON_QUERY(month_entry, '$[1]') as month_data
    )])
)
SELECT 
  t.month_key,
  t.source,
  t.users,
  t.conversions,
  s.signups,
  SAFE_DIVIDE(t.conversions, t.users) * 100 as conversion_rate,
  SAFE_DIVIDE(t.conversions, s.signups) * 100 as percent_of_signups
FROM traffic_by_month t
LEFT JOIN signups_by_month s ON t.month_key = s.month_key
WHERE s.signups > 0
ORDER BY t.month_key DESC, percent_of_signups DESC
```

### 8. Campaign ROI Analysis

```sql
SELECT 
  JSON_VALUE(data, '$.campaignName') as campaign,
  SUM(CAST(JSON_VALUE(month_data, '$.users') AS INT64)) as total_users,
  SUM(CAST(JSON_VALUE(month_data, '$.cost') AS FLOAT64)) as total_cost,
  SUM(CAST(JSON_VALUE(month_data, '$.conversions') AS INT64)) as total_conversions,
  SUM(CAST(JSON_VALUE(month_data, '$.revenue') AS FLOAT64)) as total_revenue,
  SAFE_DIVIDE(
    SUM(CAST(JSON_VALUE(month_data, '$.revenue') AS FLOAT64)),
    SUM(CAST(JSON_VALUE(month_data, '$.cost') AS FLOAT64))
  ) as overall_roi,
  SAFE_DIVIDE(
    SUM(CAST(JSON_VALUE(month_data, '$.cost') AS FLOAT64)),
    SUM(CAST(JSON_VALUE(month_data, '$.conversions') AS INT64))
  ) as cost_per_conversion
FROM `opsos-864a1.firestore_export.ga_campaigns_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.months')) as month_entry WITH OFFSET pos
  CROSS JOIN UNNEST([STRUCT(
    JSON_VALUE(month_entry, '$[0]') as month_key,
    JSON_QUERY(month_entry, '$[1]') as month_data
  )])
WHERE JSON_VALUE(month_data, '$.cost') IS NOT NULL
GROUP BY campaign
HAVING total_cost > 0
ORDER BY overall_roi DESC
```

---

## Data Freshness

- **Current data:** 12 months of historical GA4 data synced
- **Updates:** Run the sync button on `/sources/google-analytics` anytime to refresh
- **Automatic sync:** The extension will automatically sync new data as it's written to Firestore

---

## Next Steps: Enable GA4 Native BigQuery Export

For **true causation analysis** with raw event-level data:

1. Go to GA4 Admin → BigQuery Links
2. Link to project `opsos-864a1`
3. Enable daily export
4. Get individual user journeys, event parameters, timestamps

This will create tables like:
- `analytics_301802672.events_20250121` (one per day)
- Every event, every user, full detail

**Current aggregated data is great for overview analysis. Native export is needed for deep causation.**
