# Multi-Timeframe Detector Architecture

**Problem:** Current detectors only look at ONE timeframe (mostly 30 days)  
**Solution:** Each detector analyzes MULTIPLE timeframes to find patterns at different scales  
**Aligned with:** Original ChatGPT spec (multiple lookback windows)

---

## 🎯 TIMEFRAME HIERARCHY

### **8 Standard Lookback Windows**

| Window | Period | Use Case | Data Requirement |
|--------|--------|----------|------------------|
| **Daily** | 1 day | Immediate anomalies, yesterday vs baseline | Have: 90 days ✅ |
| **Weekly** | 7 days | Short-term trends, day-of-week patterns | Have: 13 weeks ✅ |
| **Last 30** | 30 days | Monthly performance, current period | Have: 3 months ✅ |
| **Last 60** | 60 days | Two-month baseline, trend analysis | Have: 1.5 cycles ✅ |
| **Last 90** | 90 days | Quarterly performance | Have: exactly this ✅ |
| **Last 6mo** | 180 days | Seasonal patterns, half-year trends | Need: 90 more days ⚠️ |
| **Last 12mo** | 365 days | Year-over-year, full seasonality | Need: 275 more days ⚠️ |
| **All Time** | Lifetime | Historical benchmarks, best ever | Have: 90 days (start) ✅ |

---

## 🔍 DETECTOR LOGIC BY TIMEFRAME

### **Pattern Detection Matrix**

Each detector should check for opportunities across multiple timeframes:

| Detector Type | Daily | Weekly | 30d | 60d | 90d | 6mo | 12mo | All Time |
|---------------|-------|--------|-----|-----|-----|-----|------|----------|
| **Anomaly Detection** | ✅ | ✅ | ✅ | - | - | - | ✅ | - |
| **Revenue Anomalies** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| **Scale Winners** | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Fix Losers** | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Declining Performers** | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| **SEO Rank Changes** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| **Content Decay** | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Page Engagement** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | - |
| **Email Performance** | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Paid Efficiency** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |

---

## 📊 EXAMPLE: MULTI-TIMEFRAME REVENUE ANOMALY DETECTOR

### **Current (Single Timeframe)**
```sql
-- Only checks: Yesterday vs 7-day baseline
WHERE yesterday_revenue differs by 20% from avg_7d_revenue
```

### **New (Multi-Timeframe)**
```sql
WITH timeframes AS (
  SELECT 
    -- Actuals
    SUM(CASE WHEN date = CURRENT_DATE() - 1 THEN revenue END) as yesterday,
    
    -- Baselines (multiple comparison periods)
    AVG(CASE WHEN date BETWEEN CURRENT_DATE() - 8 AND CURRENT_DATE() - 2 
        THEN revenue END) as baseline_7d,
    AVG(CASE WHEN date BETWEEN CURRENT_DATE() - 31 AND CURRENT_DATE() - 2 
        THEN revenue END) as baseline_30d,
    AVG(CASE WHEN date BETWEEN CURRENT_DATE() - 61 AND CURRENT_DATE() - 2 
        THEN revenue END) as baseline_60d,
    AVG(CASE WHEN date BETWEEN CURRENT_DATE() - 91 AND CURRENT_DATE() - 2 
        THEN revenue END) as baseline_90d,
    
    -- Historical comparisons
    SUM(CASE WHEN date = CURRENT_DATE() - 8 THEN revenue END) as week_ago,
    SUM(CASE WHEN date = CURRENT_DATE() - 31 THEN revenue END) as month_ago,
    AVG(revenue) as all_time_avg,
    MAX(revenue) as all_time_peak
  FROM daily_entity_metrics
  WHERE date >= CURRENT_DATE() - 91
)
SELECT 
  -- Calculate deviations at each timeframe
  (yesterday - baseline_7d) / baseline_7d * 100 as dev_7d,
  (yesterday - baseline_30d) / baseline_30d * 100 as dev_30d,
  (yesterday - baseline_60d) / baseline_60d * 100 as dev_60d,
  (yesterday - baseline_90d) / baseline_90d * 100 as dev_90d,
  (yesterday - week_ago) / week_ago * 100 as wow_change,
  (yesterday - month_ago) / month_ago * 100 as mom_change,
  
  -- Flag anomalies at ANY timeframe
  CASE 
    WHEN ABS((yesterday - baseline_7d) / baseline_7d) > 0.20 THEN 'ALERT_7D'
    WHEN ABS((yesterday - baseline_30d) / baseline_30d) > 0.20 THEN 'ALERT_30D'
    WHEN ABS((yesterday - baseline_60d) / baseline_60d) > 0.15 THEN 'ALERT_60D'
    WHEN ABS((yesterday - baseline_90d) / baseline_90d) > 0.15 THEN 'ALERT_90D'
  END as anomaly_timeframe
```

### **Opportunity Output**
```json
{
  "title": "📉 Revenue Drop: Multi-Timeframe Anomaly Detected",
  "timeframe_analysis": {
    "daily": {
      "value": 12500,
      "vs_yesterday": "+2.3%",
      "status": "normal"
    },
    "weekly": {
      "vs_7d_avg": "-18.4%",
      "status": "warning",
      "triggered": true
    },
    "monthly": {
      "vs_30d_avg": "-12.1%",
      "status": "warning"
    },
    "quarterly": {
      "vs_90d_avg": "-8.5%",
      "status": "monitor"
    },
    "all_time": {
      "vs_all_time_avg": "-5.2%",
      "percentile": "32nd"
    }
  },
  "primary_signal": "7d_baseline",
  "confidence": 0.87,
  "description": "Revenue dropped 18.4% vs 7-day average but only 8.5% vs 90-day. This suggests a recent sharp decline rather than gradual decay."
}
```

---

## 🎯 IMPLEMENTATION APPROACH

### **Phase 1: Add Multi-Timeframe to Existing Detectors (Current 90-day data)**

Update each detector to analyze:
1. **Daily:** Yesterday vs baselines
2. **Weekly:** Last 7d vs multiple baselines
3. **30/60/90d:** Current period vs historical periods
4. **All Time:** Current vs lifetime best/avg

**Detectors to Update:**
1. ✅ Revenue Anomaly (daily + weekly + 30/60/90d)
2. ✅ Metric Anomalies (daily + weekly + 30/60/90d)
3. ✅ Scale Winners (30/60/90d + all-time best)
4. ✅ Fix Losers (30/60/90d + all-time)
5. ✅ Declining Performers (weekly + 30/60/90d)
6. ✅ SEO Rank Drops (daily + weekly + 30/60/90d)
7. ✅ Content Decay (30/60/90d + all-time)
8. ✅ Email Performance (weekly + 30/60/90d + all-time)
9. ✅ Page Engagement (daily + weekly + 30/60/90d)

**Estimated Effort:** 6-8 hours  
**Expected Impact:** +30-50 opportunities (100 → 130-150)

---

### **Phase 2: Add 6mo/12mo When Data Available**

Once we have 6+ months of data:
- Add seasonal comparisons (Q1 vs Q2 vs Q3 vs Q4)
- Year-over-year analysis
- Holiday/event pattern detection

**Timeline:** Need 90+ more days for 6mo, 275+ days for 12mo

---

## 📋 SPECIFIC DETECTOR REDESIGNS

### **1. Scale Winners (Multi-Timeframe)**

**Current Logic:**
```
Find entities with:
- Top 30% CVR in last 30 days
- Bottom 30% traffic in last 30 days
```

**New Logic:**
```
Find entities that are winners at ANY timeframe:

Recent Winner (30d):
- Top 30% CVR in last 30d
- Bottom 30% traffic in last 30d

Consistent Winner (90d):
- Top 20% CVR across all 90d
- Bottom 40% traffic across all 90d
- Stable CVR (not spiking)

All-Time Winner:
- CVR in top 10% historically
- Current traffic below historical peak by 50%+

New Winner (weekly):
- CVR jumped to top 30% in last 7d
- Was not a winner before
- Emerging opportunity
```

**Why:** Catches different opportunities:
- Recent winners = immediate scale opportunities
- Consistent winners = proven performers
- All-time winners = proven track record
- New winners = emerging trends

---

### **2. SEO Rank Drops (Multi-Timeframe)**

**Current Logic:**
```
Recent 7d vs Historical 30d
If dropped 5+ positions → Alert
```

**New Logic:**
```
Compare across multiple timeframes:

Daily Volatility:
- Yesterday vs day before (>3 positions = check)
- If stable for weeks, then sudden drop = HIGH priority

Weekly Trend:
- Last 7d avg vs previous 7d avg
- Catches steady declines

Monthly Comparison:
- Last 30d vs previous 30d
- More stable, filters noise

Quarterly Comparison:
- Last 90d vs first 90d available
- Long-term trajectory

All-Time:
- Current rank vs best rank ever
- "You used to rank #2, now #12" = HIGH priority
```

**Why:** Different alerts for different patterns:
- Daily: Immediate emergencies (algorithm update?)
- Weekly: Short-term issues (competitor surge?)
- Monthly: Sustained problems (content decay?)
- All-time: Lost ground (recover former glory)

---

### **3. Content Decay (Multi-Timeframe)**

**Current Logic:**
```
Last 30d vs 31-60d historical
If traffic dropped 30%+ → Alert
```

**New Logic:**
```
Decay Stage Detection:

Early Decay (Weekly):
- Last 7d vs previous 7d
- 15%+ drop = early warning
- Catch it before it gets worse

Recent Decay (Monthly):
- Last 30d vs 31-60d
- 20%+ drop = active decay

Advanced Decay (Quarterly):
- Last 90d vs first 90d available
- 30%+ drop = significant decay

Catastrophic Decay (All-Time):
- Current traffic < 50% of all-time peak
- Lost more than half of peak traffic
- HIGH priority recovery
```

**Why:** 
- Early warning at 7d catches problems fast
- Monthly confirms it's not a fluke
- Quarterly shows long-term trend
- All-time shows what's been lost (potential upside)

---

### **4. Declining Performers (Multi-Timeframe)**

**New Enhancement:**
```
Rate of Decline Analysis:

Accelerating Decline:
- 7d decline faster than 30d decline
- Getting worse quickly = URGENT

Steady Decline:
- Similar decline rate across 7d/30d/60d
- Consistent problem = investigate cause

Decelerating Decline:
- 90d shows big drop but stabilizing recently
- Already recovering = LOWER priority

New Decline:
- Fine in 60d/90d, but dropped in last 30d
- Recent issue = investigate recent changes
```

---

## 🎛️ CONFIGURATION SYSTEM

### **Timeframe-Specific Thresholds**

Different thresholds for different timeframes:

```python
ANOMALY_THRESHOLDS = {
    'daily': {
        'revenue': 0.30,  # 30% deviation = daily alert (higher threshold, more noise)
        'sessions': 0.40,  # 40% deviation
        'conversions': 0.35
    },
    'weekly': {
        'revenue': 0.20,  # 20% deviation = weekly alert
        'sessions': 0.30,
        'conversions': 0.25
    },
    '30d': {
        'revenue': 0.15,  # 15% deviation = 30d alert (lower threshold, cleaner signal)
        'sessions': 0.20,
        'conversions': 0.15
    },
    '90d': {
        'revenue': 0.10,  # 10% deviation = 90d alert (very stable baseline)
        'sessions': 0.15,
        'conversions': 0.12
    }
}
```

**Logic:** Shorter timeframes need higher thresholds (more noise), longer timeframes can use lower thresholds (cleaner signal)

---

## 📊 OPPORTUNITY SCHEMA ENHANCEMENT

### **Add Timeframe Context to Every Opportunity**

```json
{
  "id": "opp_123",
  "category": "declining_performer",
  "type": "accelerating_decline",
  
  // NEW: Timeframe analysis
  "timeframe_analysis": {
    "primary_timeframe": "weekly",  // Which window triggered this?
    "secondary_signals": ["30d", "60d"],  // Confirming timeframes
    
    "daily": {
      "metric_value": 1250,
      "vs_baseline": "+2.3%",
      "status": "normal"
    },
    "weekly": {
      "metric_value_avg": 1180,
      "vs_baseline": "-18.4%",
      "status": "alert",
      "triggered": true
    },
    "30d": {
      "metric_value_avg": 1290,
      "vs_baseline": "-12.1%",
      "status": "warning"
    },
    "60d": {
      "metric_value_avg": 1350,
      "vs_baseline": "-8.5%",
      "status": "monitor"
    },
    "90d": {
      "metric_value_avg": 1400,
      "vs_baseline": "-5.2%",
      "status": "monitor"
    },
    "all_time": {
      "metric_value_avg": 1420,
      "best_value": 2100,
      "percentile": "42nd",
      "vs_peak": "-40.5%"
    }
  },
  
  // Enhanced description with timeframe context
  "description": "Sessions declined 18.4% week-over-week (7d), confirmed by 12.1% drop vs 30d baseline. Accelerating decline suggests recent issue.",
  
  // Timeframe-specific actions
  "recommended_actions_by_timeframe": {
    "immediate": ["Check yesterday's changes", "Review analytics for spikes"],
    "short_term": ["Investigate weekly patterns", "Compare to previous weeks"],
    "long_term": ["Analyze 90-day trend", "Compare to historical peaks"]
  }
}
```

---

## 🚀 ROLLOUT PLAN

### **Step 1: Multi-Timeframe SQL Queries (2-3 hours)**
Update all detector queries to calculate metrics across 8 timeframes

### **Step 2: Threshold Logic (1-2 hours)**
Implement timeframe-specific thresholds and anomaly detection

### **Step 3: Opportunity Enrichment (2 hours)**
Add timeframe analysis to opportunity output

### **Step 4: Testing (1-2 hours)**
Run detectors and verify multi-timeframe detection

### **Step 5: Dashboard Enhancement (Optional, 2-3 hours)**
Add timeframe filter to UI:
- "Show opportunities from: Daily / Weekly / 30d / 60d / 90d / All"
- Timeframe breakdown in opportunity details

---

## 📈 EXPECTED RESULTS

### **Current State (Single Timeframe)**
- 100 opportunities
- Many patterns missed (only looking at 30d)
- No context on rate of change

### **After Multi-Timeframe (8 Windows)**
- **130-150 opportunities** (+30-50%)
- Catches patterns at different scales
- Better prioritization (accelerating vs stable declines)
- Rich context (see performance across all timeframes)

### **Examples of New Opportunities:**

**Will NOW detect:**
1. ✅ "Page rank dropped 8 positions this week (was stable for 12 weeks)" ← Weekly alert
2. ✅ "Revenue is 5% below 90d avg but 20% below all-time peak" ← All-time context
3. ✅ "Email opens declining 10% weekly for 4 consecutive weeks" ← Weekly trend
4. ✅ "Content traffic down 15% this month, 25% this quarter, 40% vs peak" ← Multi-timeframe decay stages
5. ✅ "Campaign CVR is top 20% this week but wasn't last week" ← Emerging winner

---

## 💡 KEY INSIGHTS

### **Why Multiple Timeframes Matter:**

1. **Different patterns at different scales:**
   - Daily: Catch immediate issues
   - Weekly: See short-term trends
   - Monthly: Filter noise, confirm patterns
   - Quarterly: Long-term trajectory
   - All-time: Historical context

2. **Better confidence scoring:**
   - Alert confirmed across multiple timeframes = HIGH confidence
   - Alert only at one timeframe = investigate but lower confidence

3. **Actionability:**
   - Daily alert = act NOW
   - Weekly alert = act this week
   - Monthly alert = plan intervention
   - Quarterly alert = strategic adjustment

4. **Context is king:**
   - "Down 20% vs 7d" = might be noise
   - "Down 20% vs 7d, 15% vs 30d, 10% vs 90d, 30% vs all-time peak" = CLEAR TREND

---

## ✅ NEXT STEPS

**I can implement this multi-timeframe architecture now!**

**Phase 1 (6-8 hours):**
- Update all 16 detectors with 5 timeframes (daily, weekly, 30d, 60d, 90d, all-time)
- Add timeframe analysis to opportunities
- Deploy and test
- Expected: 130-150 opportunities (vs current 100)

**Phase 2 (when data available):**
- Add 6-month and 12-month comparisons
- Add seasonal pattern detection
- Add year-over-year analysis

**Should I start implementing the multi-timeframe architecture?**
