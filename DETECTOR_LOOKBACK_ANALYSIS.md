# Detector Lookback Period Analysis

**Current Date:** January 26, 2026  
**Available Data:** 90 days (October 27, 2025 → January 25, 2026)

---

## 📊 CURRENT LOOKBACK WINDOWS BY DETECTOR

### **Original 7 Detectors**

| Detector | Lookback Window | Analysis Period | Data Used |
|----------|----------------|-----------------|-----------|
| **Scale Winners** | 30 days | Recent performance | 553k metrics → only using 33% |
| **Fix Losers** | 30 days | Recent performance | 553k metrics → only using 33% |
| **Declining Performers** | 60 days | Last 30d vs Previous 30d | Using 67% of available data |
| **Cross-Channel Gaps** | 30 days | Recent performance | Only using 33% |
| **Keyword Cannibalization** | 30 days | Recent performance | Only using 33% |
| **Cost Inefficiency** | 30 days | Recent spend analysis | Only using 33% |
| **Email Engagement Drop** | 60 days | Last 30d vs Previous 30d | Using 67% (but only 8 email metrics total!) |

---

### **Phase 2A New Detectors (9 added)**

| Detector | Lookback Window | Analysis Period | Data Used |
|----------|----------------|-----------------|-----------|
| **Revenue Anomaly** | 30 days | Yesterday vs 7d/28d baseline | Using 33% |
| **Metric Anomalies** | 15 days | Yesterday vs 7d baseline | Only using 17% |
| **High Traffic Low CVR** | 30 days | Recent performance | Only using 33% |
| **Page Engagement Decay** | 45 days | Last 14d vs 31d historical | Using 50% |
| **SEO Striking Distance** | 30 days | Recent rank positions | Only using 33% |
| **SEO Rank Drops** | 37 days | Last 7d vs 30d historical | Using 41% |
| **Paid Waste** | 30 days | Recent campaign spend | Only using 33% |
| **Email High Opens Low Clicks** | 30 days | Recent email performance | Only using 33% (8 metrics total!) |
| **Content Decay** | 90 days | Last 30d vs 60d historical | ✅ **Using 100% of data!** |

---

## 🔴 THE PROBLEM

### **Data Utilization**
- **Available:** 553,492 daily metrics across 90 days
- **Most detectors use:** Only 30 days (33% of data)
- **Result:** Missing opportunities hidden in historical patterns

### **Specific Issues**

#### 1. **Email Detectors (Critical Issue)**
**Current:**
- 8 total email metrics (4 campaigns, 2 days average)
- 30-day lookback finds 0 opportunities
- Not enough data for pattern detection

**Problem:** Looking at last 30 days when email only has 4 total campaigns!
- Email Engagement Drop: needs "last 30d vs previous 30d" but only has 8 data points total
- Email High Opens Low Clicks: needs 100+ sends minimum, only has 8

**Solution:** Extend to 90 days to get ALL available email data

---

#### 2. **SEO Rank Drops (Missing Signals)**
**Current:** 7-day recent vs 30-day historical (37 days total)
**Problem:** 7 days is too short to detect meaningful rank changes
- Keywords fluctuate daily
- Need longer comparison periods
- Have 90 days of rank data but only using 41%

**Solution:** Change to 30d vs 60d (use all 90 days)

---

#### 3. **Scale Winners & Fix Losers (Shallow Analysis)**
**Current:** 30 days
**Problem:** 
- Missing pages/campaigns that performed well 60-90 days ago
- Can't see long-term patterns
- Volatile metrics need longer baselines

**Solution:** Extend to 90 days for baseline, compare to most recent 30 days

---

#### 4. **Revenue Anomaly (Too Sensitive)**
**Current:** Yesterday vs 7-day baseline
**Problem:**
- 7 days is too volatile for baseline
- Weekend/weekday variations cause false positives
- Need more stable baseline

**Solution:** Change to yesterday vs 28-day baseline (or 90-day for even better signal)

---

## 📈 RECOMMENDED LOOKBACK CHANGES

### **Priority 1: Email Detectors (CRITICAL)**
Change from 30 days → **90 days** (use ALL email data)

**Impact:**
- Email Engagement Drop: 60d → **90d total** (last 45d vs previous 45d)
- Email High Opens Low Clicks: 30d → **90d**
- Will actually see the 4 campaigns we have!

---

### **Priority 2: SEO Detectors**
Change from short windows → **90 days**

**Changes:**
- SEO Rank Drops: 37d → **90d** (last 30d vs 60d historical)
- SEO Striking Distance: 30d → **90d** (more stable rank averages)

**Impact:**
- More stable rank calculations
- Better detection of true rank changes vs fluctuations
- More keywords will qualify

---

### **Priority 3: Core Performance Detectors**
Extend baselines to use full 90 days

**Changes:**
- Scale Winners: 30d → **90d baseline** (recent 30d vs 90d baseline)
- Fix Losers: 30d → **90d baseline**
- High Traffic Low CVR: 30d → **90d baseline**
- Cross-Channel Gaps: 30d → **90d**

**Impact:**
- More stable performance baselines
- Less noise from short-term fluctuations
- Better identification of true outliers

---

### **Priority 4: Anomaly Detectors**
Strengthen baselines

**Changes:**
- Revenue Anomaly: 7d baseline → **28d or 90d baseline**
- Metric Anomalies: 7d baseline → **28d baseline**

**Impact:**
- Fewer false positives
- More meaningful alerts
- Better weekend/weekday normalization

---

## 🎯 EXPECTED IMPACT OF CHANGES

### **Before (Current State)**
```
Email opportunities found: 0
  → Only 8 email metrics, looking at 30 days
  → Not enough data!

SEO opportunities found: 6
  → Only using 33% of rank data
  → Missing historical patterns

Scale Winners found: 13
  → 30-day baseline is noisy
  → Missing longer-term winners
```

### **After (Recommended Changes)**
```
Email opportunities found: 3-5 expected
  → Using all 90 days = all 4 campaigns visible
  → Can detect patterns in limited data

SEO opportunities found: 15-20 expected
  → Using full 90 days of rank history
  → More stable rank averages
  → Better drop detection

Scale Winners found: 20-25 expected
  → 90-day baseline = more stable
  → Better outlier detection
  → Less noise
```

---

## 📋 SPECIFIC SQL CHANGES NEEDED

### **1. Email Engagement Drop**
```sql
-- CURRENT (60 days total)
last_30_days: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
previous_30_days: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) 
                  AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)

-- RECOMMENDED (90 days total)
last_45_days: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
previous_45_days: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY) 
                  AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
```

### **2. SEO Rank Drops**
```sql
-- CURRENT (37 days total)
recent_ranks: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
historical_ranks: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY)
                  AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)

-- RECOMMENDED (90 days total)
recent_ranks: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
historical_ranks: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
                  AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

### **3. Scale Winners**
```sql
-- CURRENT (30 days)
recent_metrics: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)

-- RECOMMENDED (90 days with recent comparison)
baseline_metrics: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
recent_metrics: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
-- Compare recent 30d performance vs 90d baseline
```

### **4. Revenue Anomaly**
```sql
-- CURRENT
yesterday: date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
baseline_7d: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
             AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)

-- RECOMMENDED
yesterday: date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
baseline_28d: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY)
              AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
baseline_90d: date >= DATE_SUB(CURRENT_DATE(), INTERVAL 91 DAY)
              AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
```

---

## 🔧 IMPLEMENTATION PRIORITY

### **Phase 1: Critical Fixes (Do First)**
1. ✅ **Email detectors** → 90 days (will unlock email opportunities)
2. ✅ **SEO Rank Drops** → 90 days (better drop detection)
3. ✅ **Revenue Anomaly baseline** → 28 days (reduce noise)

**Estimated Impact:** +5-10 opportunities  
**Effort:** 1-2 hours  

---

### **Phase 2: Performance Improvements**
4. ✅ **Scale Winners** → 90-day baseline
5. ✅ **Fix Losers** → 90-day baseline
6. ✅ **Cross-Channel Gaps** → 90 days
7. ✅ **SEO Striking Distance** → 90 days

**Estimated Impact:** +10-15 opportunities  
**Effort:** 2-3 hours  

---

### **Phase 3: Fine-tuning**
8. ✅ **Cost Inefficiency** → 90 days (more spend history)
9. ✅ **Metric Anomalies** → 28-day baseline
10. ✅ **Paid Waste** → 90 days (full campaign history)

**Estimated Impact:** +5-8 opportunities  
**Effort:** 1-2 hours  

---

## 📊 DATA AVAILABILITY CHECK

| Entity Type | Total Metrics (90d) | Daily Average | Sufficient for 90d Lookback? |
|-------------|--------------------:|---------------:|------------------------------|
| **Keywords** | 369,460 | 4,060 | ✅ Excellent |
| **Pages** | 139,740 | 1,536 | ✅ Excellent |
| **Campaigns** | 44,160 | 485 | ✅ Good |
| **Products** | 124 | 1.4 | ⚠️ Low volume but OK |
| **Email** | 8 | 0.09 | ❌ **NEED 90d to see all data!** |

---

## ✅ RECOMMENDATION

**Extend ALL detectors to 90-day lookback windows** to:

1. **Use all available data** (currently wasting 67% of it!)
2. **Reduce noise** (longer baselines = more stable)
3. **Find hidden patterns** (especially for low-volume sources like email)
4. **Better outlier detection** (30d is too volatile)
5. **More opportunities** (expect +20-30 total opportunities)

**Exception:** Keep daily/yesterday comparisons for anomaly detection, but use longer baselines (28d or 90d)

---

## 🚀 NEXT STEPS

**Option 1: Quick Fix (2-3 hours)**
- Change email detectors to 90 days
- Change SEO rank drops to 90 days
- Deploy and test

**Option 2: Complete Overhaul (4-6 hours)**
- Extend all detectors to 90 days
- Update baselines for anomaly detection
- Deploy and test
- Expect 120-130 total opportunities (vs current 100)

**Recommended:** Option 2 (complete overhaul) - maximize value from existing data!
