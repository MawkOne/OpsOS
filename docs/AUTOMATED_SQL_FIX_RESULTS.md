# Automated SQL Fix Results

**Date:** 2026-01-28  
**Script:** `fix_sql_errors.py`  
**Deployment:** scout-ai-engine-00035

---

## 📊 Results Summary

### Metrics
- **Files Modified:** 119 detector files
- **Before:** 41 opportunities (12-15 working detectors)
- **After:** 46 opportunities (~15-18 working detectors)
- **Improvement:** +5 opportunities (+12%)

### Category Breakdown
| Category | Before | After | Change |
|----------|--------|-------|--------|
| SEO | 20 | 20 | +0 |
| Content | 0 | 20 | **+20** ✅ |
| Revenue | 0 | 1 | +1 |
| Email | 0 | 0 | +0 |
| Pages | 0 | 0 | +0 |
| Traffic | 0 | 0 | +0 |
| Advertising | 0 | 0 | +0 |

---

## ✅ What Worked

### Major Success: Content Detectors (11 detectors working)
The automation script successfully fixed the content category detectors:
- All 11 content detectors now working
- 20 new opportunities discovered
- SQL queries properly cleaned

### Partial Success: General Cleanup
- Removed most entity_map JOINs
- Eliminated orphaned table alias references
- Cleaned up is_active filters

---

## ❌ What Broke

### New Errors Introduced by Script

**1. Window Function PARTITION BY Broken (most common - 20+ detectors)**
```sql
-- The script removed table aliases from PARTITION BY clauses:
LAG(open_rate, 1) OVER (PARTITION BY canonical_entity_id ORDER BY year_month)
--                                   ^ Missing table alias broke this!

-- Error: "Expected ')' but got '=' at [X:76]"
```

**Impact:** Email, Pages, Traffic, Revenue detectors affected

**2. CURRENT Keyword Still Present (5 multitimeframe detectors)**
```sql
-- Script didn't properly handle CURRENT keyword usage:
CURRENT AS current_period  -- Still causing syntax errors
```

**Impact:** All multitimeframe detectors still failing

**3. CTE/Subquery Alias Removal (keyword_cannibalization)**
```sql
-- Script removed ALL aliases, including legitimate CTE references:
FROM daily_entity_metrics dm1
JOIN daily_entity_metrics dm2
-- Script removed dm1 and dm2, causing "Duplicate table alias" error
```

**Impact:** keyword_cannibalization detector broken

**4. Missing Database Columns (revenue detectors)**
```sql
-- Many revenue detectors reference columns that don't exist:
- cart_abandonment_rate
- payment_failure_rate
- first_time_customers
- refund_rate
- average_order_value
```

**Impact:** 8 revenue detectors can't work (data doesn't exist)

---

## 🔍 Error Breakdown

### By Error Type:
1. **Window Function Partition** (~25 detectors): `Expected ")" but got "="`
2. **Missing Columns** (~10 detectors): `Unrecognized name: X`
3. **CURRENT Keyword** (5 detectors): `Unexpected keyword CURRENT`
4. **Duplicate Aliases** (1 detector): `Duplicate table alias`
5. **Complex SQL** (~10 detectors): Various syntax errors

### By Category:
- **Email:** 13 detectors - window function errors
- **Pages:** 18 detectors - window function + missing columns
- **Traffic:** 17 detectors - window function + source keyword issues
- **Revenue:** 12 detectors - missing columns + window functions
- **Advertising:** 14 detectors - various SQL errors
- **SEO:** 12 detectors - mostly working (1-2 failures)

---

## 🎯 Why Only Partial Success?

The automation script was **too aggressive** in removing table aliases:

### What It Should Have Done:
- Remove aliases only from base table references
- Keep aliases in CTEs and subqueries
- Keep aliases in PARTITION BY clauses
- Keep aliases in JOIN conditions

### What It Actually Did:
- Removed **ALL** single-letter aliases globally
- Broke window functions (PARTITION BY, ORDER BY)
- Broke self-joins
- Broke CTE references

---

## 🛠️ How To Fix

### Option 1: Smarter Script (4-6 hours)
1. Rewrite script with SQL parser (e.g., sqlparse)
2. Only remove aliases from FROM/JOIN declarations
3. Keep aliases in all other contexts
4. Test on sample files first

**Expected Result:** 50-70 working detectors

### Option 2: Manual Fixes (8-12 hours)
1. Fix 25 window function errors (add back PARTITION BY aliases)
2. Fix 5 multitimeframe CURRENT keywords
3. Fix 1 keyword cannibalization duplicate alias
4. Skip 10 revenue detectors (missing data)

**Expected Result:** 40-50 working detectors

### Option 3: Selective Rollback + Manual (6-8 hours)
1. Git revert automated fixes
2. Manually fix top 20 highest-impact detectors
3. Test each one individually

**Expected Result:** 30-40 working detectors

---

## 📈 Progress So Far

### Overall Journey:
- **Start:** 9 detectors working
- **After manual fixes:** 12-15 detectors working (32→41 opportunities)
- **After automation:** 15-18 detectors working (41→46 opportunities)

### Categories Fixed:
- ✅ SEO: 11 working
- ✅ Content: 11 working
- ⚠️ Revenue: 1 working
- ❌ Email: 0 working (window function errors)
- ❌ Pages: 0 working (window function errors)
- ❌ Traffic: 0 working (window function errors)
- ❌ Advertising: 0 working (various errors)

---

## 🎓 Lessons Learned

1. **Regex-based SQL fixing is dangerous** - SQL is complex, needs proper parsing
2. **Window functions are fragile** - Can't remove aliases from PARTITION BY
3. **Test incrementally** - Should have tested on 5 files first
4. **Data availability matters** - 10 detectors can't work without new columns

---

## 🚀 Recommended Next Step

**Focused Manual Fix Approach:**
1. Fix the 11 email detectors (highest impact, window functions)
2. Fix the 5 most important pages detectors
3. Fix the 5 most important traffic detectors
4. Skip revenue detectors (need new data)
5. Skip advertising detectors (low priority)

**Expected Time:** 3-4 hours  
**Expected Result:** 35-40 working detectors, 80-120 opportunities

**Alternatives:**
- Accept current state (46 opportunities, 22 detectors working)
- Focus on improving the working 22 detectors instead
- Build better data pipeline for revenue/advertising first
