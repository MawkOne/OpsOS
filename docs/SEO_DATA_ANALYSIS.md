# SEO Data Analysis & Gap Report

**Date:** 2026-02-21  
**Status:** Data exists but not displayed on dashboard

## ✅ What You Have (In BigQuery)

### 1. **Keyword Rankings** - FULL DATA ✅
**Table:** `marketing_ai.daily_entity_metrics` (entity_type = 'keyword')
- **1,600 rows** across 102 unique keywords
- **Date range:** Feb 6 - Feb 20, 2026 (15 days)
- **Columns populated:**
  - `seo_position`: Current ranking (2-109)
  - `seo_search_volume`: Monthly searches (4,400 - 5M)
  - `seo_position_change`: Daily position changes
  - `canonical_entity_id`: Keyword text
  - `source_breakdown`: JSON with CPC, competition, monthly trends

**Example Keywords:**
- "video job", "employment editor", "filmmaker freelance"
- "writer jobs", "video editing vacancy"
- CPC data: $0.02 - $3.68
- Competition: 0-0.2

### 2. **Backlinks** - LIMITED DATA ⚠️
**Table:** `marketing_ai.daily_entity_metrics` (entity_type = 'backlinks')
- **Only 3 rows** (Feb 6-8)
- **Columns populated:**
  - `backlinks_total`: 8,686 - 8,740 backlinks
  - `domain_rank`: Domain authority score

**Status:** Very limited, needs more frequent syncing

### 3. **Organic Traffic** - FULL DATA ✅
**Table:** `reporting.daily_metrics`
- `organic_sessions`: Daily organic traffic
- `organic_pct`: Percentage of total traffic
- `organic_engaged_sessions`: Engaged sessions
- `organic_engagement_rate`: Engagement rate

## ❌ What's Missing (Not on Dashboard)

### 1. **SEO Page Doesn't Show Keyword Data**
**Current page:** `/growth/seo`
**Shows:**
- ✅ Organic sessions (traffic)
- ✅ Organic %
- ✅ Direct/referral sessions

**Missing:**
- ❌ Top ranking keywords
- ❌ Keyword positions (#1, #2, #3, etc.)
- ❌ Search volumes
- ❌ Position changes (up/down arrows)
- ❌ "Striking distance" keywords (positions 11-20)
- ❌ Ranking drops/gains
- ❌ Backlink count/trend

### 2. **Master View Doesn't Include SEO Metrics**
**View:** `v_master_daily_metrics`
**Has:** Only `organic_sessions`, `organic_pct`, `organic_engagement_rate`
**Missing:** No keyword-level aggregations (top 10 keywords, avg position, etc.)

### 3. **Reporting Tables Don't Include SEO**
**Tables:** `reporting.daily_metrics`, `weekly_metrics`, `monthly_metrics`
**Missing:** 
- Average keyword position
- Total keywords ranking
- Keywords in top 10
- Backlink totals

## 🎯 Recommended Dashboard Additions

### Option A: Simple Aggregations (Easiest)
Add to `v_master_daily_metrics`:
```sql
seo_daily_agg AS (
  SELECT
    date,
    COUNT(*) as total_keywords_tracked,
    COUNT(CASE WHEN seo_position <= 3 THEN 1 END) as keywords_top_3,
    COUNT(CASE WHEN seo_position <= 10 THEN 1 END) as keywords_top_10,
    COUNT(CASE WHEN seo_position BETWEEN 11 AND 20 THEN 1 END) as keywords_striking_distance,
    AVG(seo_position) as avg_keyword_position,
    SUM(seo_search_volume) as total_search_volume,
    MAX(backlinks_total) as backlinks_total
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE entity_type IN ('keyword', 'backlinks')
  GROUP BY date
)
```

**Dashboard metrics:**
- Keywords in top 3
- Keywords in top 10
- Average position
- Total search volume captured
- Backlinks count

### Option B: Keyword Table (Better UX)
Create a separate section on SEO page showing:

**Top Ranking Keywords Table:**
| Keyword | Position | Change | Monthly Searches | URL |
|---------|----------|--------|------------------|-----|
| video editing jobs | #2 | ↑ +3 | 22,200 | /jobs |
| freelance writer | #5 | → 0 | 14,800 | /writer-jobs |
| remote video editor | #8 | ↓ -2 | 9,900 | /remote-jobs |

**Striking Distance Keywords:**
| Keyword | Position | Searches | Action |
|---------|----------|----------|--------|
| animator jobs | #12 | 18,100 | 🎯 Optimize |
| video job | #15 | 8,100 | 🎯 Optimize |

### Option C: Full SEO Dashboard (Most Comprehensive)
**Sections:**
1. **Overview KPIs**
   - Total keywords tracked
   - Keywords in top 10
   - Average position
   - Backlinks

2. **Top Rankings** (positions 1-10)
3. **Striking Distance** (positions 11-20)
4. **Biggest Movers** (largest position changes)
5. **High Volume Keywords** (most search volume)
6. **Traffic Contribution** (which keywords drive most traffic)

## 📊 Data Quality Assessment

### Keyword Data Quality: ✅ GOOD
- 15 days of history
- 102 keywords tracked
- Position data complete
- Search volume data complete

### Backlink Data Quality: ⚠️ NEEDS IMPROVEMENT
- Only 3 days of data
- Last sync: Feb 8
- **Action:** Run DataForSEO backlink sync more frequently

### Traffic Attribution: ✅ GOOD
- Organic sessions tracked daily
- Engagement metrics available
- **Gap:** Not attributed to specific keywords (would need GSC integration)

## 🔄 Next Steps (in order of complexity)

### 1. **Quick Win - Add Aggregate Metrics** (30 mins)
- Update `v_master_daily_metrics` view with SEO aggregations
- Add metrics to SEO page: keywords_top_10, avg_position, backlinks
- Rebuild reporting tables

### 2. **Medium - Add Keyword Table** (1-2 hours)
- Create `/api/bigquery/seo-keywords` endpoint
- Add keyword table component to SEO page
- Show top 20 keywords with positions, changes, search volumes

### 3. **Advanced - Full SEO Dashboard** (3-4 hours)
- Multiple sections (top rankings, striking distance, movers)
- Position change charts
- Search volume trends
- Backlink history chart

### 4. **Maintenance - More Frequent Syncing**
- Schedule DataForSEO backlink sync (weekly)
- Consider adding more keywords to track
- Set up ranking alert thresholds

## 🎓 Key Insights

1. **You have 102 keywords ranking** (positions 2-109)
2. **Search volume potential:** 4,400 - 5M monthly searches per keyword
3. **Backlinks:** ~8,700 total (decent authority)
4. **Data frequency:** Keyword data updated daily, backlinks only 3 times

### Most Valuable Quick Wins:
1. Show "keywords in top 10" metric
2. Show "striking distance" keywords (11-20) - easy optimization targets
3. Alert on ranking drops > 5 positions
4. Show total search volume for ranked keywords

## 💡 Comparison: What You Have vs Competitors

**Your Data (DataForSEO):**
- ✅ Keyword positions (1-100+)
- ✅ Search volumes
- ✅ CPC data
- ✅ Competition metrics
- ✅ Backlink counts
- ❌ Traffic per keyword (need GSC)
- ❌ Click-through rates (need GSC)

**Typical SEO Tools (Ahrefs/Semrush):**
- Same position tracking
- Same search volume data
- Additional: Traffic estimates per keyword
- Additional: SERP features (featured snippets, PAA)

**You're 90% there!** Just need to display it on the dashboard.
