# Filter Bug Root Cause Analysis

## User Report
> "okay, i think the duplication is an issue. We have opportunities in bigquery and in firebase. Confirm the system actualy created exactly another 44 after the filter was applied"
>
> "please look at the actual opportunities to confirm they are following the filtesr"

## Investigation Timeline

### 1. Duplication Issue (FIXED ✅)
**Problem:** BigQuery had 154 opportunities (not 44)
- Scout AI was using `WRITE_APPEND` without DELETE
- Every run added 44 more opportunities
- Result: 44 + 44 + 44 = 154 accumulation

**Fix:** Added DELETE before APPEND in `write_opportunities_to_bigquery()`
```python
# Delete old opportunities for this organization first
DELETE FROM opportunities WHERE organization_id = @org_id
# Then append new ones
```

### 2. Filter Verification (BUG FOUND ❌)
**Problem:** Opportunities still contain filtered product pages

**Filtered Pages Still Appearing:**
- `page_job31529`, `page_job32134` (job pages)
- `page_talentprofile51217` (talent page)
- `page_mailbox` (product page)
- `page_youtubechannel389428` (YouTube channel page)

**Verification:**
- ✅ entity_map: All these pages have `is_active = FALSE`
- ✅ Monthly ETL: No monthly metrics generated for filtered pages
- ✅ Multi-timeframe detectors: JOIN filters working correctly
- ❌ **OLD DETECTORS: No `is_active` filter!**

## ROOT CAUSE

Scout AI calls 23 detectors in 3 groups:

### Group 1: Old Detectors (7) - ❌ NO FILTER
```python
# main.py lines 643-649
detect_scale_winners(organization_id)
detect_fix_losers(organization_id)
detect_declining_performers(organization_id)  # ← NO is_active filter!
detect_cross_channel_gaps(organization_id)
detect_keyword_cannibalization(organization_id)
detect_cost_inefficiency(organization_id)
detect_email_engagement_drop(organization_id)
```

**Example from `detect_declining_performers` (line 300):**
```sql
FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
WHERE organization_id = @org_id
  AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
-- NO JOIN with entity_map!
-- NO is_active filter!
```

### Group 2: Phase 2A Detectors (9) - ❌ NO FILTER
```python
# main.py lines 652-660
detect_revenue_anomaly(organization_id)
detect_metric_anomalies(organization_id)
detect_high_traffic_low_conversion_pages(organization_id)
detect_page_engagement_decay(organization_id)
detect_seo_striking_distance(organization_id)
detect_seo_rank_drops(organization_id)
detect_paid_waste(organization_id)
detect_email_high_opens_low_clicks(organization_id)
detect_content_decay(organization_id)
```

### Group 3: Multi-Timeframe Detectors (7) - ✅ HAS FILTER
```python
# main.py lines 663-669
detect_content_decay_multitimeframe(organization_id)
detect_revenue_trends_multitimeframe(organization_id)
detect_email_trends_multitimeframe(organization_id)
detect_seo_rank_trends_multitimeframe(organization_id)
detect_scale_winners_multitimeframe(organization_id)
detect_declining_performers_multitimeframe(organization_id)
detect_paid_campaigns_multitimeframe(organization_id)
```

**Example from multi-timeframe detector (line 40-42):**
```sql
FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics` m
JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
  ON m.canonical_entity_id = e.canonical_entity_id
  AND e.is_active = TRUE  -- ← Filter present!
```

## Current State

### What's Working ✅
1. **entity_map filtering:** 58 active pages, 4,019 filtered pages (98.6%)
2. **Monthly ETL:** Respects is_active filter
3. **Deduplication:** Fixed WRITE_APPEND issue
4. **Multi-timeframe detectors:** Have correct is_active JOIN
5. **Firestore cleanup:** Delete old before writing new

### What's Broken ❌
1. **Old detectors (7):** Query daily_entity_metrics directly, no is_active filter
2. **Phase 2A detectors (9):** Query daily/monthly metrics, no is_active filter
3. **Result:** 30 opportunities still include filtered product pages

## Impact

**Latest Scout AI Run:**
- Total opportunities: 30
- Estimated breakdown:
  - ~10-15 from old detectors (UNFILTERED)
  - ~5-10 from Phase 2A detectors (UNFILTERED)
  - ~5-10 from multi-timeframe detectors (FILTERED)

**Pages Analyzed:**
- Should analyze: 58 marketing pages
- Actually analyzing: 58 marketing + ~100 product pages (via old detectors)

## Solution Options

### Option 1: Add is_active Filter to ALL Detectors
**Pros:**
- Comprehensive fix
- All detectors work correctly
- No functionality loss

**Cons:**
- Need to update 16 detector functions
- Time-consuming

**SQL Pattern to Add:**
```sql
FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
JOIN `{PROJECT_ID}.{DATASET_ID}.entity_map` e
  ON m.canonical_entity_id = e.canonical_entity_id
  AND e.is_active = TRUE
WHERE m.organization_id = @org_id
```

### Option 2: Disable Old Detectors (Quick Fix)
**Pros:**
- Immediate fix
- Multi-timeframe detectors already work correctly
- Less code to maintain

**Cons:**
- Loses some detector logic
- May reduce opportunity count

**Code Change:**
```python
# Comment out old detector calls
# all_opportunities.extend(detect_declining_performers(organization_id))
```

### Option 3: Consolidate Detectors
**Pros:**
- Best long-term solution
- Single source of truth
- Reduced duplication

**Cons:**
- Most time-intensive
- Requires careful testing

## Recommended Action

**IMMEDIATE:** Option 2 (disable old detectors)
- Quick fix to stop analyzing product pages
- Multi-timeframe detectors provide better analysis anyway
- Can re-enable specific old detectors later if needed

**LONG-TERM:** Option 3 (consolidate)
- Merge old + multi-timeframe detector logic
- Single detector per analysis type
- All with proper is_active filtering

## Filter Rules Summary

**Comprehensive Product Page Filters (38 rules):**
```sql
-- ID-based pages
^/job/[0-9]+
^/talent/[0-9]+
^/channel/[0-9]+
/[0-9]+$

-- Product features (broad)
/job
/talent
/mailbox
/outreach
/redirect
/review
/stats
/placements
/recent

-- Product features (specific)
/@, /user, /profile, /account, /dashboard, /settings
/login, /logout, /auth
/channel/, /watch, /video, /playlist, /feed, /forum
/docs, /help, /support, /faq
/legal, /terms, /privacy, /cookie
/admin, /api
/deletion-initiated

-- Short links
^/[a-z]{2}/[A-Za-z0-9]{5}$
```

## Files Modified

1. `scout-ai-engine/main.py`
   - Fixed: `write_opportunities_to_bigquery()` duplication
   - Needs fix: Old detector calls (lines 643-660)

2. `entity_filter_rules` (BigQuery)
   - Added: 38 comprehensive filter rules
   - Status: ✅ Working

3. `entity_map` (BigQuery)
   - Updated: 4,019 pages marked `is_active = FALSE`
   - Status: ✅ Working

4. `monthly_trend_detectors.py`
   - Status: ✅ Has is_active filters

## Next Steps

1. **Decide on solution approach** (Option 1, 2, or 3)
2. **Implement fix** to old detectors
3. **Test with Scout AI run**
4. **Verify all 30 opportunities are marketing-only**
5. **Document final state**
6. **Update user dashboard** to show clean data
