# BigQuery Queries for OpsOS

Access your data at: https://console.cloud.google.com/bigquery?project=opsos-864a1

## 📊 Useful Queries

### 1. View All Initiatives
```sql
SELECT 
  document_id,
  JSON_EXTRACT_SCALAR(data, '$.name') as name,
  JSON_EXTRACT_SCALAR(data, '$.status') as status,
  JSON_EXTRACT_SCALAR(data, '$.priority') as priority,
  CAST(JSON_EXTRACT_SCALAR(data, '$.expectedRevenue') AS FLOAT64) as expected_revenue,
  timestamp
FROM `opsos-864a1.firestore_export.initiatives_raw_latest`
ORDER BY timestamp DESC
```

### 2. Total Revenue by Month (Stripe)
```sql
SELECT 
  FORMAT_TIMESTAMP('%Y-%m', TIMESTAMP_SECONDS(CAST(JSON_EXTRACT_SCALAR(data, '$.created') AS INT64))) as month,
  COUNT(*) as payment_count,
  SUM(CAST(JSON_EXTRACT_SCALAR(data, '$.amount') AS FLOAT64) / 100) as total_revenue
FROM `opsos-864a1.firestore_export.stripe_payments_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.status') = 'succeeded'
GROUP BY month
ORDER BY month DESC
```

### 3. Top Customers by Revenue
```sql
SELECT 
  JSON_EXTRACT_SCALAR(data, '$.customer') as customer_id,
  COUNT(*) as payment_count,
  SUM(CAST(JSON_EXTRACT_SCALAR(data, '$.amount') AS FLOAT64) / 100) as total_spent
FROM `opsos-864a1.firestore_export.stripe_payments_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.status') = 'succeeded'
GROUP BY customer_id
ORDER BY total_spent DESC
LIMIT 20
```

### 4. Email Campaign Performance
```sql
SELECT 
  JSON_EXTRACT_SCALAR(data, '$.name') as campaign_name,
  CAST(JSON_EXTRACT_SCALAR(data, '$.send_amt') AS INT64) as emails_sent,
  CAST(JSON_EXTRACT_SCALAR(data, '$.opens') AS INT64) as opens,
  CAST(JSON_EXTRACT_SCALAR(data, '$.uniqueopens') AS INT64) as unique_opens,
  CAST(JSON_EXTRACT_SCALAR(data, '$.clicks') AS INT64) as clicks,
  ROUND(CAST(JSON_EXTRACT_SCALAR(data, '$.uniqueopens') AS FLOAT64) / NULLIF(CAST(JSON_EXTRACT_SCALAR(data, '$.send_amt') AS FLOAT64), 0) * 100, 2) as open_rate
FROM `opsos-864a1.firestore_export.activecampaign_campaigns_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.send_amt') IS NOT NULL
  AND CAST(JSON_EXTRACT_SCALAR(data, '$.send_amt') AS INT64) > 0
ORDER BY emails_sent DESC
LIMIT 20
```

### 5. People by Role
```sql
SELECT 
  JSON_EXTRACT_SCALAR(data, '$.role') as role,
  COUNT(*) as count
FROM `opsos-864a1.firestore_export.people_raw_latest`
GROUP BY role
ORDER BY count DESC
```

### 6. Monthly Expenses (QuickBooks)
```sql
SELECT 
  FORMAT_TIMESTAMP('%Y-%m', TIMESTAMP_SECONDS(CAST(JSON_EXTRACT_SCALAR(data, '$.timestamp._seconds') AS INT64))) as month,
  COUNT(*) as expense_count,
  SUM(CAST(JSON_EXTRACT_SCALAR(data, '$.amount') AS FLOAT64)) as total_expenses
FROM `opsos-864a1.firestore_export.quickbooks_expenses_raw_latest`
GROUP BY month
ORDER BY month DESC
```

### 7. Active Subscriptions
```sql
SELECT 
  JSON_EXTRACT_SCALAR(data, '$.customer') as customer_id,
  JSON_EXTRACT_SCALAR(data, '$.plan.nickname') as plan_name,
  CAST(JSON_EXTRACT_SCALAR(data, '$.plan.amount') AS FLOAT64) / 100 as monthly_amount,
  JSON_EXTRACT_SCALAR(data, '$.status') as status,
  TIMESTAMP_SECONDS(CAST(JSON_EXTRACT_SCALAR(data, '$.current_period_start') AS INT64)) as period_start
FROM `opsos-864a1.firestore_export.stripe_subscriptions_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.status') IN ('active', 'trialing')
ORDER BY monthly_amount DESC
```

### 8. Initiative Revenue Impact
```sql
SELECT 
  JSON_EXTRACT_SCALAR(data, '$.name') as initiative,
  JSON_EXTRACT_SCALAR(data, '$.status') as status,
  CAST(JSON_EXTRACT_SCALAR(data, '$.expectedRevenue') AS FLOAT64) as expected_revenue,
  CAST(JSON_EXTRACT_SCALAR(data, '$.expectedSavings') AS FLOAT64) as expected_savings,
  JSON_EXTRACT_SCALAR(data, '$.forecast.initiativeImpact') as impact_percentage
FROM `opsos-864a1.firestore_export.initiatives_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.expectedRevenue') IS NOT NULL
ORDER BY expected_revenue DESC
```

## 🔄 Understanding the Table Structure

Each collection has TWO tables:

1. **`{collection}_raw_changelog`** - Full history of all changes
   - Contains ALL operations (CREATE, UPDATE, DELETE)
   - Multiple rows per document (one for each change)
   - Use for audit trails and historical analysis

2. **`{collection}_raw_latest`** - Current state only
   - Contains only the LATEST version of each document
   - One row per document
   - Use for current state queries (most common)

## 📝 Data Extraction Tips

Since Firestore data is stored as JSON in the `data` column:

- Use `JSON_EXTRACT_SCALAR()` to get string/number values
- Use `JSON_EXTRACT()` for nested objects/arrays
- Cast numbers: `CAST(JSON_EXTRACT_SCALAR(data, '$.amount') AS FLOAT64)`
- Cast timestamps: `TIMESTAMP_SECONDS(CAST(JSON_EXTRACT_SCALAR(data, '$.created') AS INT64))`

## 🚀 Next Steps

1. **Create Dashboards**: Use Google Data Studio/Looker
2. **Schedule Reports**: Use BigQuery scheduled queries
3. **Export Data**: Download as CSV or integrate with Excel/Sheets
4. **Build BI Tools**: Connect Tableau, PowerBI, etc.
