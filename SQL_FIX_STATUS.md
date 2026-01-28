# SQL Fix Status Report

**Date:** 2026-01-28  
**Deployment:** scout-ai-engine-00034

---

## Results

### ✅ Partial Success

**Before:** 32 opportunities (9 detectors working)  
**After:** 41 opportunities (estimated 12-15 detectors working)  
**Improvement:** +9 opportunities (+28%)

---

## What Worked

### ✅ Successfully Fixed (estimated 5-10 detectors)
The batch sed fixes successfully removed:
- Most entity_map JOINs
- Most is_active filters  
- Some table aliases

These detectors likely working now:
- Some email detectors (for rows that exist)
- Some page detectors  
- Some traffic detectors

---

## What Still Needs Fixing

### ❌ Remaining Issues in ~20 Detectors

**1. SELECT Clause References (multiple detectors)**
```sql
SELECT 
  e.canonical_entity_id,  -- ❌ Still references 'e'
  m.organization_id       -- ❌ Still references 'm'
FROM `daily_entity_metrics`
```

**2. WHERE Clause in CTEs (multiple detectors)**
```sql
FROM `daily_entity_metrics`
WHERE m.organization_id = @org_id  -- ❌ Still references 'm'
  AND e.entity_type = 'keyword'    -- ❌ Still references 'e'
```

**3. Missing JOIN ON Clauses (SEO detectors)**
```sql
FROM recent_ranks r
INNER JOIN historical_ranks h   -- ❌ Missing ON clause!
WHERE (r.avg_position_recent - h.avg_position_historical) > 5
```

**4. CURRENT Keyword Still Present (multitimeframe detectors)**
- `detect_paid_campaigns_multitimeframe`
- `detect_seo_rank_trends_multitimeframe`
- `detect_declining_performers_multitimeframe`

**5. Aggregation of Aggregations**
- `detect_keyword_cannibalization` - complex nested aggregation

---

## Files That Need Manual Fixes

### Priority 1: SEO Detectors (3 files)
1. `/detectors/seo/detect_seo_rank_drops.py`
   - Line 34: `e.canonical_entity_id` → `canonical_entity_id`
   - Lines 38-40: `m.organization_id`, `m.date`, `e.entity_type`
   - Line 63: Missing `ON r.canonical_entity_id = h.canonical_entity_id`

2. `/detectors/seo/detect_keyword_cannibalization.py`
   - Aggregation of aggregations error
   - Needs query rewrite

3. `/detectors/seo/detect_seo_rank_trends_multitimeframe.py`
   - CURRENT keyword syntax error

### Priority 2: Content Detectors (2 files)
1. `/detectors/content/detect_content_decay.py`
   - Line 8: `m.` reference
   
2. `/detectors/content/detect_content_decay_multitimeframe.py`
   - Line 14: `e.` reference

### Priority 3: Traffic Detectors (6 files)
- All have "Unrecognized name: m" errors
- Need comprehensive m. → direct column replacements

### Priority 4: Pages Detectors (2 files)
1. `/detectors/pages/detect_scale_winners_multitimeframe.py`
   - Line 18: `e.` reference

---

## Recommended Approach

### Option A: Manual Fixes (2-3 hours)
1. Fix the top 10 detectors manually with careful SQL review
2. Test each one individually  
3. Deploy incrementally

**Expected result:** 25-30 working detectors

### Option B: Better Automation (1 hour setup, 30 min execution)
1. Write Python script to parse SQL and fix all references
2. Handle edge cases (SELECT, WHERE in CTEs, JOINs)
3. Batch fix all at once

**Expected result:** 30-40 working detectors

### Option C: Accept Current State
- 41 opportunities is better than 32
- Focus on improving the 12-15 working detectors
- Disable the rest for now

---

## Next Steps

**Immediate:**
1. Update DETECTOR_TEST_RESULTS.md with new counts
2. Mark ~15 detectors as "working"
3. Document which 25+ still need fixes

**Short-term:**
1. Choose Option A or B above
2. Fix remaining SQL errors
3. Test to reach 40+ working detectors

**Long-term:**
1. Add SQL linting to detector development
2. Create detector testing framework
3. Prevent these issues in new detectors
