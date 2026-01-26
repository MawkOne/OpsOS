# Monthly Aggregates for Trend Detection

**Problem:** Daily metrics are noisy, trends get lost in fluctuations  
**Solution:** Monthly aggregates + trend analysis = clear pattern detection  
**Phase:** 2B - Data Enhancement

---

## 🎯 WHY MONTHLY AGGREGATES MATTER

### **Example: Detecting Accelerating Decline**

**Without Monthly Aggregates (Current):**
```
"Revenue last 30d: $45,000"
"Revenue previous 30d: $52,000"
"Decline: -13.5%"
```
**Insight:** Something's wrong, but when did it start?

**With Monthly Aggregates (Proposed):**
```
January:   $43,000  (-7.4% vs Dec)
December:  $46,400  (-8.9% vs Nov)
November:  $50,900  (-10.2% vs Oct)
October:   $56,700  (baseline)
```
**Insight:** **Accelerating decline!** -7% → -9% → -10% each month. Getting WORSE. URGENT!

---

## 📊 MONTHLY AGGREGATE SCHEMA

### **New Table: `monthly_entity_metrics`**

```sql
CREATE TABLE marketing_ai.monthly_entity_metrics (
  -- Identifiers
  organization_id         STRING NOT NULL,
  year_month             STRING NOT NULL,  -- "2025-10", "2025-11", etc.
  canonical_entity_id     STRING NOT NULL,
  entity_type            STRING NOT NULL,
  
  -- Traffic Metrics (monthly totals)
  impressions            INT64,
  clicks                 INT64,
  sessions               INT64,
  users                  INT64,
  pageviews              INT64,
  
  -- Engagement Metrics (monthly averages)
  avg_session_duration   FLOAT64,
  avg_bounce_rate        FLOAT64,
  avg_engagement_rate    FLOAT64,
  
  -- Conversion & Revenue (monthly totals)
  conversions            INT64,
  conversion_rate        FLOAT64,  -- Calculated: conversions / sessions
  revenue                FLOAT64,
  cost                   FLOAT64,
  profit                 FLOAT64,
  
  -- Performance Metrics (monthly averages)
  avg_ctr                FLOAT64,
  avg_cpc                FLOAT64,
  avg_cpa                FLOAT64,
  avg_roas               FLOAT64,
  avg_roi                FLOAT64,
  
  -- SEO Metrics (monthly averages)
  avg_position           FLOAT64,
  avg_search_volume      INT64,
  
  -- Email Metrics (monthly totals)
  sends                  INT64,
  opens                  INT64,
  open_rate              FLOAT64,
  click_through_rate     FLOAT64,
  
  -- Metadata
  days_in_month          INT64,  -- 28, 29, 30, or 31
  days_with_data         INT64,  -- How many days had metrics
  data_completeness      FLOAT64, -- days_with_data / days_in_month
  
  -- Trend Indicators (calculated)
  mom_change_pct         FLOAT64,  -- Month-over-month % change
  mom_change_abs         FLOAT64,  -- Absolute change
  is_best_month          BOOL,     -- Is this the best month ever for this entity?
  is_worst_month         BOOL,     -- Is this the worst month?
  
  created_at             TIMESTAMP,
  updated_at             TIMESTAMP,
  
  PRIMARY KEY (organization_id, year_month, canonical_entity_id, entity_type)
);
```

---

## 🔍 TREND DETECTION PATTERNS

### **1. Accelerating Decline**
```sql
-- Find entities declining faster each month
WITH monthly_trends AS (
  SELECT 
    canonical_entity_id,
    year_month,
    sessions,
    LAG(sessions, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as prev_month,
    LAG(sessions, 2) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as two_months_ago,
    
    -- Calculate month-over-month change
    (sessions - LAG(sessions, 1) OVER (...)) / LAG(sessions, 1) OVER (...) as mom_1,
    (LAG(sessions, 1) OVER (...) - LAG(sessions, 2) OVER (...)) / LAG(sessions, 2) OVER (...) as mom_2
  FROM monthly_entity_metrics
  WHERE year_month >= '2025-10'
)
SELECT *
FROM monthly_trends
WHERE mom_1 < mom_2  -- Decline is accelerating
  AND mom_1 < -0.05  -- At least 5% decline
ORDER BY ABS(mom_1 - mom_2) DESC
```

**Output:**
```
Entity: page_job30834
Oct: 5,200 sessions
Nov: 4,680 sessions (-10.0%)
Dec: 4,055 sessions (-13.4%)  ← Accelerating!
Jan: 3,324 sessions (-18.0%)  ← Getting WORSE!

Status: URGENT - Accelerating decline
```

---

### **2. Seasonal Patterns**
```sql
-- Compare this month to same month last year (when we have 12+ months)
WITH seasonal_comparison AS (
  SELECT 
    canonical_entity_id,
    EXTRACT(MONTH FROM PARSE_DATE('%Y-%m', year_month)) as month_num,
    year_month,
    sessions,
    LAG(sessions, 12) OVER (PARTITION BY canonical_entity_id, month_num ORDER BY year_month) as same_month_last_year
  FROM monthly_entity_metrics
)
SELECT 
  canonical_entity_id,
  year_month,
  sessions,
  same_month_last_year,
  (sessions - same_month_last_year) / same_month_last_year * 100 as yoy_change
FROM seasonal_comparison
WHERE same_month_last_year IS NOT NULL
  AND ABS((sessions - same_month_last_year) / same_month_last_year) > 0.20
```

---

### **3. Consistency vs Volatility**
```sql
-- Find stable performers (low volatility) vs erratic ones
WITH volatility_analysis AS (
  SELECT 
    canonical_entity_id,
    STDDEV(sessions) / AVG(sessions) as coefficient_of_variation,
    AVG(sessions) as avg_sessions,
    MIN(sessions) as min_sessions,
    MAX(sessions) as max_sessions,
    COUNT(*) as months_of_data
  FROM monthly_entity_metrics
  WHERE year_month >= '2025-10'
  GROUP BY canonical_entity_id
  HAVING COUNT(*) >= 3
)
SELECT 
  canonical_entity_id,
  coefficient_of_variation,
  CASE 
    WHEN coefficient_of_variation < 0.15 THEN 'Stable'
    WHEN coefficient_of_variation < 0.30 THEN 'Moderate'
    ELSE 'Volatile'
  END as volatility_category
FROM volatility_analysis
```

**Why this matters:**
- **Stable entities** = Reliable for scaling, predictable ROI
- **Volatile entities** = Risky, need investigation before scaling

---

### **4. Momentum Detection**
```sql
-- Find entities with positive momentum (improving each month)
WITH momentum AS (
  SELECT 
    canonical_entity_id,
    year_month,
    sessions,
    
    -- 3-month trend
    sessions > LAG(sessions, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as up_vs_last_month,
    LAG(sessions, 1) OVER (...) > LAG(sessions, 2) OVER (...) as up_previous_month,
    LAG(sessions, 2) OVER (...) > LAG(sessions, 3) OVER (...) as up_two_months_ago
  FROM monthly_entity_metrics
)
SELECT 
  canonical_entity_id,
  year_month,
  sessions,
  CASE 
    WHEN up_vs_last_month AND up_previous_month AND up_two_months_ago THEN 'Strong Momentum'
    WHEN up_vs_last_month AND up_previous_month THEN 'Building Momentum'
    WHEN up_vs_last_month THEN 'Possible Turnaround'
    ELSE 'No Momentum'
  END as momentum_status
FROM momentum
WHERE up_vs_last_month = true
```

---

## 🤖 DETECTOR ENHANCEMENTS WITH MONTHLY TRENDS

### **Example: Enhanced Scale Winner Detector**

**Current Logic:**
```
Find entities with:
- High CVR (last 30 days)
- Low traffic (last 30 days)
```

**New Logic with Monthly Trends:**
```sql
WITH recent_performance AS (
  -- Last 30 days daily metrics
  SELECT canonical_entity_id, AVG(conversion_rate) as current_cvr, SUM(sessions) as current_sessions
  FROM daily_entity_metrics WHERE date >= CURRENT_DATE() - 30
  GROUP BY canonical_entity_id
),
monthly_trends AS (
  -- Monthly trend analysis
  SELECT 
    canonical_entity_id,
    
    -- Get last 3 months
    MAX(CASE WHEN year_month = FORMAT_DATE('%Y-%m', CURRENT_DATE()) THEN conversion_rate END) as cvr_this_month,
    MAX(CASE WHEN year_month = FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) THEN conversion_rate END) as cvr_last_month,
    MAX(CASE WHEN year_month = FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH)) THEN conversion_rate END) as cvr_2_months_ago,
    
    -- Calculate trend
    AVG(conversion_rate) as avg_cvr_3mo,
    STDDEV(conversion_rate) / AVG(conversion_rate) as cvr_volatility
    
  FROM monthly_entity_metrics
  WHERE year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
  GROUP BY canonical_entity_id
)
SELECT 
  r.canonical_entity_id,
  r.current_cvr,
  r.current_sessions,
  
  -- Monthly trend context
  m.cvr_this_month,
  m.cvr_last_month,
  m.cvr_2_months_ago,
  m.cvr_volatility,
  
  -- Trend classification
  CASE 
    WHEN m.cvr_this_month > m.cvr_last_month AND m.cvr_last_month > m.cvr_2_months_ago THEN 'Improving Monthly'
    WHEN m.cvr_volatility < 0.15 THEN 'Stable Monthly'
    ELSE 'Volatile Monthly'
  END as trend_type
  
FROM recent_performance r
JOIN monthly_trends m ON r.canonical_entity_id = m.canonical_entity_id
WHERE r.current_cvr > (SELECT PERCENTILE_CONT(current_cvr, 0.7) FROM recent_performance)
  AND r.current_sessions < (SELECT PERCENTILE_CONT(current_sessions, 0.3) FROM recent_performance)
ORDER BY 
  CASE 
    WHEN trend_type = 'Improving Monthly' THEN 1  -- Prioritize improving trends
    WHEN trend_type = 'Stable Monthly' THEN 2
    ELSE 3
  END,
  r.current_cvr DESC
```

**Opportunity Output:**
```json
{
  "title": "🚀 Scale Winner: page_talentprofile51217",
  "description": "High CVR (8.2%) but low traffic. CVR improving monthly: Oct 6.8% → Nov 7.4% → Dec 8.2%. Stable upward trend = HIGH confidence scale opportunity.",
  
  "monthly_trend": {
    "october": {"cvr": 6.8, "sessions": 145},
    "november": {"cvr": 7.4, "sessions": 162},
    "december": {"cvr": 8.2, "sessions": 151},
    "january_mtd": {"cvr": 8.5, "sessions": 48},
    
    "trend": "Improving Monthly",
    "momentum": "Strong",
    "volatility": "Low (0.12)",
    "confidence": 0.92
  },
  
  "recommended_actions": [
    "PRIORITY: CVR has improved 3 months in a row - proven performer",
    "Scale with confidence - low volatility + improving trend",
    "Start with 50% traffic increase (low risk given stability)",
    "Monitor monthly CVR to ensure trend continues"
  ]
}
```

---

## 📊 ETL PROCESS FOR MONTHLY AGGREGATES

### **New Cloud Function: `monthly-rollup-etl`**

```python
def create_monthly_aggregates(organization_id: str, year_month: str):
    """
    Aggregate daily_entity_metrics into monthly_entity_metrics
    Run: End of each month, or on-demand for historical months
    """
    
    # Parse year_month (e.g., "2025-10")
    year, month = year_month.split('-')
    days_in_month = calendar.monthrange(int(year), int(month))[1]
    
    query = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
    
    WITH daily_data AS (
      SELECT 
        organization_id,
        canonical_entity_id,
        entity_type,
        date,
        
        -- Daily metrics
        impressions, clicks, sessions, users, pageviews,
        avg_session_duration, bounce_rate, engagement_rate,
        conversions, conversion_rate, revenue, cost, profit,
        ctr, cpc, cpa, roas, roi,
        position, search_volume,
        sends, opens, open_rate, click_through_rate
        
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND FORMAT_DATE('%Y-%m', date) = @year_month
    ),
    
    monthly_agg AS (
      SELECT 
        organization_id,
        @year_month as year_month,
        canonical_entity_id,
        entity_type,
        
        -- Traffic totals
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(sessions) as sessions,
        SUM(users) as users,
        SUM(pageviews) as pageviews,
        
        -- Engagement averages (weighted by sessions)
        SUM(avg_session_duration * sessions) / NULLIF(SUM(sessions), 0) as avg_session_duration,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(engagement_rate) as avg_engagement_rate,
        
        -- Conversion & revenue totals
        SUM(conversions) as conversions,
        SUM(conversions) / NULLIF(SUM(sessions), 0) * 100 as conversion_rate,
        SUM(revenue) as revenue,
        SUM(cost) as cost,
        SUM(revenue) - SUM(cost) as profit,
        
        -- Performance averages
        AVG(ctr) as avg_ctr,
        AVG(cpc) as avg_cpc,
        AVG(cpa) as avg_cpa,
        AVG(roas) as avg_roas,
        AVG(roi) as avg_roi,
        
        -- SEO averages
        AVG(position) as avg_position,
        AVG(search_volume) as avg_search_volume,
        
        -- Email totals
        SUM(sends) as sends,
        SUM(opens) as opens,
        SUM(opens) / NULLIF(SUM(sends), 0) * 100 as open_rate,
        SUM(clicks) / NULLIF(SUM(sends), 0) * 100 as click_through_rate,
        
        -- Metadata
        @days_in_month as days_in_month,
        COUNT(DISTINCT date) as days_with_data,
        COUNT(DISTINCT date) / @days_in_month as data_completeness,
        
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
        
      FROM daily_data
      GROUP BY organization_id, canonical_entity_id, entity_type
    ),
    
    with_trends AS (
      SELECT 
        m.*,
        
        -- Calculate MoM change
        LAG(m.sessions, 1) OVER (PARTITION BY m.canonical_entity_id ORDER BY m.year_month) as prev_month_sessions,
        (m.sessions - LAG(m.sessions, 1) OVER (...)) / NULLIF(LAG(m.sessions, 1) OVER (...), 0) * 100 as mom_change_pct,
        m.sessions - LAG(m.sessions, 1) OVER (...) as mom_change_abs,
        
        -- Is best/worst month?
        m.sessions = MAX(m.sessions) OVER (PARTITION BY m.canonical_entity_id) as is_best_month,
        m.sessions = MIN(m.sessions) OVER (PARTITION BY m.canonical_entity_id) as is_worst_month
        
      FROM monthly_agg m
    )
    
    SELECT * FROM with_trends
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id),
            bigquery.ScalarQueryParameter("year_month", "STRING", year_month),
            bigquery.ScalarQueryParameter("days_in_month", "INT64", days_in_month)
        ]
    )
    
    bq_client.query(query, job_config=job_config).result()
    logger.info(f"✅ Created monthly aggregates for {year_month}")
```

---

## 🎯 DETECTOR UPDATES WITH MONTHLY TRENDS

### **1. Content Decay - Monthly Trend Analysis**

**New Detection:**
```sql
WITH monthly_sessions AS (
  SELECT 
    canonical_entity_id,
    year_month,
    sessions,
    LAG(sessions, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as prev_month,
    LAG(sessions, 2) OVER (...) as two_months_ago,
    LAG(sessions, 3) OVER (...) as three_months_ago
  FROM monthly_entity_metrics
  WHERE year_month >= '2025-10'
    AND entity_type = 'page'
)
SELECT 
  canonical_entity_id,
  year_month,
  sessions,
  
  -- Calculate monthly decline rate
  (sessions - prev_month) / prev_month * 100 as mom_decline,
  (prev_month - two_months_ago) / two_months_ago * 100 as prev_mom_decline,
  
  -- Detect acceleration
  CASE 
    WHEN (sessions - prev_month) / prev_month < (prev_month - two_months_ago) / two_months_ago THEN 'Accelerating Decay'
    WHEN (sessions - prev_month) / prev_month > (prev_month - two_months_ago) / two_months_ago THEN 'Decelerating Decay'
    ELSE 'Steady Decay'
  END as decay_type,
  
  -- Count consecutive declining months
  CASE 
    WHEN sessions < prev_month 
     AND prev_month < two_months_ago 
     AND two_months_ago < three_months_ago THEN 3
    WHEN sessions < prev_month 
     AND prev_month < two_months_ago THEN 2
    WHEN sessions < prev_month THEN 1
    ELSE 0
  END as consecutive_declining_months

FROM monthly_sessions
WHERE sessions < prev_month * 0.85  -- 15%+ decline
ORDER BY consecutive_declining_months DESC, mom_decline ASC
```

**Output:**
```json
{
  "title": "📉 Content Decay (Accelerating): page_job30834",
  "monthly_trend": [
    {"month": "Oct", "sessions": 5200, "mom": "baseline"},
    {"month": "Nov", "sessions": 4680, "mom": "-10.0%"},
    {"month": "Dec", "sessions": 4055, "mom": "-13.4%"},
    {"month": "Jan", "sessions": 3324, "mom": "-18.0%"}
  ],
  "pattern": "Accelerating Decay - Getting WORSE each month",
  "consecutive_declining_months": 3,
  "priority": "URGENT",
  "description": "Traffic declining 3 months in a row, AND rate of decline is accelerating (-10% → -13% → -18%). Needs immediate intervention."
}
```

---

### **2. SEO Rank Changes - Monthly Position Trends**

```sql
WITH monthly_ranks AS (
  SELECT 
    canonical_entity_id,
    year_month,
    avg_position,
    LAG(avg_position, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as prev_month_position,
    LAG(avg_position, 2) OVER (...) as two_months_ago_position
  FROM monthly_entity_metrics
  WHERE entity_type = 'keyword'
    AND avg_position IS NOT NULL
)
SELECT 
  canonical_entity_id,
  year_month,
  avg_position,
  avg_position - prev_month_position as position_change_mom,
  
  -- Trend classification
  CASE 
    WHEN avg_position > prev_month_position 
     AND prev_month_position > two_months_ago_position THEN 'Declining Monthly'
    WHEN avg_position < prev_month_position 
     AND prev_month_position < two_months_ago_position THEN 'Improving Monthly'
    ELSE 'Mixed'
  END as trend_direction
  
FROM monthly_ranks
WHERE ABS(avg_position - prev_month_position) > 3  -- 3+ position change
ORDER BY ABS(position_change_mom) DESC
```

---

### **3. Email Performance - Monthly Trend**

```sql
WITH email_monthly AS (
  SELECT 
    canonical_entity_id,
    year_month,
    sends,
    opens,
    open_rate,
    click_through_rate,
    
    LAG(open_rate, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month) as prev_month_open_rate,
    LAG(open_rate, 2) OVER (...) as two_months_ago_open_rate
  FROM monthly_entity_metrics
  WHERE entity_type = 'email'
    AND sends > 100  -- Meaningful volume
)
SELECT 
  canonical_entity_id,
  year_month,
  open_rate,
  open_rate - prev_month_open_rate as mom_change,
  
  -- 3-month trend
  CASE 
    WHEN open_rate < prev_month_open_rate 
     AND prev_month_open_rate < two_months_ago_open_rate THEN 'Declining 3 Months'
    WHEN open_rate > prev_month_open_rate 
     AND prev_month_open_rate > two_months_ago_open_rate THEN 'Improving 3 Months'
    ELSE 'Mixed'
  END as trend
  
FROM email_monthly
WHERE open_rate < prev_month_open_rate * 0.90  -- 10%+ decline
```

---

## 🚀 IMPLEMENTATION PLAN

### **Phase 2B: Monthly Aggregates (1-2 weeks)**

#### **Step 1: Create Monthly Rollup ETL (2-3 days)**
- Build `monthly-rollup-etl` Cloud Function
- Create `monthly_entity_metrics` BigQuery table
- Backfill October, November, December, January data
- Schedule to run monthly (Cloud Scheduler)

#### **Step 2: Update All Detectors with Monthly Trends (3-4 days)**
Update 16 detectors to include monthly trend analysis:
- Scale Winners: Add monthly momentum detection
- Fix Losers: Add monthly consistency check
- Declining Performers: Add acceleration/deceleration detection
- Content Decay: Add consecutive declining months tracking
- SEO Rank Drops: Add monthly rank trend analysis
- Email Performance: Add monthly open rate trends
- Revenue Anomaly: Add monthly revenue trends

#### **Step 3: Enhanced Opportunity Schema (1 day)**
Add monthly trend data to every opportunity:
```json
{
  "monthly_trend": [...],
  "trend_classification": "Accelerating/Steady/Decelerating",
  "consecutive_months_declining": 3,
  "volatility": "Low/Medium/High",
  "momentum": "Positive/Negative/Neutral"
}
```

#### **Step 4: Testing & Deployment (1-2 days)**
- Test monthly rollup generation
- Verify trend calculations
- Deploy updated detectors
- Run full Scout AI with monthly context

---

## 📈 EXPECTED RESULTS

### **Current State (Daily Only)**
```
100 opportunities
Context: "Down 20% vs 30 days ago"
Action: "Unclear if this is a trend or noise"
```

### **After Multi-Timeframe (Daily + Weekly + 30/60/90d)**
```
130-150 opportunities
Context: "Down 20% vs 30d, 15% vs 60d, 10% vs 90d"
Action: "Clear declining trend"
```

### **After Monthly Aggregates (Phase 2B)**
```
150-180 opportunities
Context: "Oct: 5200, Nov: 4680 (-10%), Dec: 4055 (-13%), Jan: 3324 (-18%)"
Action: "URGENT - Accelerating decline. Needs immediate intervention."
Confidence: 0.95 (3 consecutive declining months)
```

---

## ✅ NEXT STEPS

**Should I build this now?**

**Option 1: Multi-Timeframe First (6-8 hours)**
- Add Daily/Weekly/30d/60d/90d/All-Time analysis
- Expected: 130-150 opportunities

**Option 2: Multi-Timeframe + Monthly Aggregates (1.5-2 weeks)**
- Multi-timeframe analysis PLUS
- Monthly rollup ETL
- Monthly trend detection in all detectors
- Expected: 150-180 opportunities with rich trend context

**Recommended: Option 2** - The monthly trends are what unlock true intelligence. You'll see:
- Accelerating vs decelerating patterns
- Consecutive declining months (3, 4, 5+ months)
- Momentum detection (improving 3 months in a row)
- Volatility analysis (stable vs erratic performers)

**Ready to build this?** 🚀
