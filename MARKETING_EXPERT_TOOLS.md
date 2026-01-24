# Marketing Expert Tools Architecture

## Overview

This document defines the architecture for channel-specific marketing expert tools that provide deep analysis for each marketing channel. These tools are designed to be invoked by an orchestrator AI to get specialized insights.

**Key Principle:** Metrics are pre-calculated and stored in Firestore/BigQuery. The AI reads stored metrics rather than recalculating on every request.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Orchestrator AI                           │
│  - Cross-channel attribution and strategy                   │
│  - Goal prioritization ("What should I focus on?")          │
│  - Invokes expert tools based on user questions             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared Data Layer (BigQuery)                   │
│  - ai_data_catalog (metadata for AI discovery)              │
│  - Pre-calculated metrics tables                            │
│  - Raw data tables from integrations                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────┬─────────┬─────────┬─────────┬─────────┐
        ▼         ▼         ▼         ▼         ▼         ▼
    ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
    │ Email │ │  SEO  │ │  Ads  │ │Social │ │ Pages │ │Content│
    │Expert │ │Expert │ │Expert │ │Expert │ │Expert │ │Expert │
    └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘
```

## Data Flow

1. **Integrations sync raw data** → Firestore → BigQuery (via extensions)
2. **Scheduled jobs calculate metrics** → Store in `marketing_metrics_*` tables
3. **AI reads pre-calculated metrics** → Fast, consistent responses
4. **AI can request fresh calculation** → For real-time needs

---

## Expert Tool Specifications

### 1. 📧 Email Expert

**Industry Model:** Klaviyo, Mailchimp

**Data Sources:**
| Table | Description |
|-------|-------------|
| `activecampaign_campaigns_raw_latest` | Campaign send data |
| `activecampaign_contacts_raw_latest` | Subscriber data |
| `activecampaign_lists_raw_latest` | List membership |
| `activecampaign_automations_raw_latest` | Automation flows |

**Pre-Calculated Metrics (stored in `marketing_metrics_email`):**

| Metric | Formula | Benchmark | Update Frequency |
|--------|---------|-----------|------------------|
| `open_rate` | opens / delivered | 20-25% | After each campaign |
| `click_rate` | clicks / opens | 2-5% | After each campaign |
| `click_to_open_rate` | clicks / opens | 10-15% | After each campaign |
| `conversion_rate` | conversions / clicks | 1-5% | After each campaign |
| `bounce_rate` | bounces / sent | <2% | After each campaign |
| `unsubscribe_rate` | unsubscribes / delivered | <0.5% | After each campaign |
| `list_growth_rate` | (new - unsubs) / total | >0% | Daily |
| `revenue_per_recipient` | revenue / delivered | Varies | After each campaign |
| `automation_completion_rate` | completed / entered | >50% | Daily |

**Stored Aggregations:**
- Daily/weekly/monthly roll-ups
- Campaign-level metrics with historical comparison
- List health scores
- Automation funnel metrics

**Analysis Capabilities:**
1. Campaign performance vs benchmarks
2. Subject line effectiveness (open rate patterns)
3. Content effectiveness (click rate patterns)
4. List health assessment
5. Automation optimization opportunities
6. Best send time analysis

**Missing Data (Future):**
- A/B test results
- Revenue attribution
- Email client breakdown

---

### 2. 🔍 SEO Expert

**Industry Model:** Ahrefs, SEMrush

**Data Sources:**
| Table | Description |
|-------|-------------|
| `dataforseo_keywords_raw_latest` | Current keyword rankings |
| `dataforseo_rank_history_raw_latest` | 12-month ranking history |
| `dataforseo_backlinks_raw_latest` | Backlink profile |
| `dataforseo_referring_domains_raw_latest` | Referring domains |
| `dataforseo_pages_raw_latest` | Page health/technical SEO |

**Pre-Calculated Metrics (stored in `marketing_metrics_seo`):**

| Metric | Formula | Benchmark | Update Frequency |
|--------|---------|-----------|------------------|
| `organic_traffic_estimate` | Sum of organicEtv | Growth >0% | Weekly |
| `total_keywords` | Count of ranked keywords | Growth >0% | Weekly |
| `top_3_keywords` | Keywords in position 1-3 | More = better | Weekly |
| `top_10_keywords` | Keywords in position 1-10 | More = better | Weekly |
| `avg_position` | Mean position of all keywords | Lower = better | Weekly |
| `total_backlinks` | Count of backlinks | Growth >0% | Weekly |
| `referring_domains` | Unique domains linking | Growth >0% | Weekly |
| `domain_rank` | DataForSEO domain rank | Higher = better | Weekly |
| `avg_page_health` | Mean onpageScore | >80% | After crawl |
| `technical_issues` | Count of critical issues | 0 = ideal | After crawl |

**Stored Aggregations:**
- Weekly keyword movement summary (gained/lost/unchanged)
- Position distribution changes over time
- Backlink velocity (new links per week)
- Page health trends
- Keyword opportunity scores (high volume, position 11-20)

**Analysis Capabilities:**
1. Keyword performance trends
2. Position movement alerts (gains/losses)
3. Backlink profile health
4. Technical SEO issues
5. Content gap identification
6. Page optimization priorities

**Competitor Data (Future):**
- Competitor keyword overlap
- Competitor backlink sources
- Share of voice

---

### 3. 📢 Advertising Expert

**Industry Model:** Optmyzr, WordStream

**Data Sources:**
| Table | Description |
|-------|-------------|
| `ga4_TrafficAcquisition_301802672` | Campaign traffic & conversions |
| `ga4_EcommercePurchases_301802672` | Revenue from ads |

**Pre-Calculated Metrics (stored in `marketing_metrics_ads`):**

| Metric | Formula | Benchmark | Update Frequency |
|--------|---------|-----------|------------------|
| `sessions` | Total ad sessions | N/A | Daily |
| `conversions` | keyEvents from ads | N/A | Daily |
| `conversion_rate` | conversions / sessions | 2-5% | Daily |
| `revenue` | totalRevenue from ads | N/A | Daily |
| `avg_session_duration` | Mean engagement time | >2 min | Daily |

**⚠️ Missing Data (Requires Google Ads API):**
| Metric | Why Needed |
|--------|------------|
| `ad_spend` | Calculate ROAS, CPA |
| `impressions` | Calculate CTR |
| `cpc` | Cost efficiency |
| `quality_score` | Ad health |
| `impression_share` | Competitive visibility |

**Analysis Capabilities (Current):**
1. Campaign conversion performance
2. Traffic quality by campaign
3. Revenue attribution by campaign

**Analysis Capabilities (After Google Ads API):**
4. ROAS optimization
5. Wasted spend identification
6. Quality Score tracking
7. Bid optimization recommendations

---

### 4. 👥 Social Expert

**Industry Model:** Sprout Social, Hootsuite

**Data Sources:**
| Table | Description |
|-------|-------------|
| `ga4_TrafficAcquisition_301802672` | Social traffic to site |
| `ai_social_traffic` | Aggregated social view |

**Pre-Calculated Metrics (stored in `marketing_metrics_social`):**

| Metric | Formula | Benchmark | Update Frequency |
|--------|---------|-----------|------------------|
| `social_sessions` | Sessions from social sources | Growth >0% | Daily |
| `social_conversions` | keyEvents from social | Growth >0% | Daily |
| `social_conversion_rate` | conversions / sessions | 1-3% | Daily |
| `sessions_by_platform` | Breakdown by source | N/A | Daily |
| `conversion_by_platform` | Conversions by source | N/A | Daily |

**⚠️ Missing Data (Requires Platform APIs):**
| Metric | Source Needed |
|--------|---------------|
| `followers` | Twitter, LinkedIn, etc. |
| `engagement_rate` | Native platform APIs |
| `reach` | Native platform APIs |
| `shares` | Native platform APIs |
| `post_performance` | Native platform APIs |

**Analysis Capabilities (Current):**
1. Which platforms drive traffic
2. Which platforms drive conversions
3. Social traffic trends

**Analysis Capabilities (After Platform APIs):**
4. Engagement rate optimization
5. Best posting times
6. Content type performance
7. Audience growth tracking

---

### 5. 📄 Pages Expert

**Industry Model:** Hotjar, Crazy Egg

**Data Sources:**
| Table | Description |
|-------|-------------|
| `ga4_PagesAndScreens_301802672` | Page performance |
| `ga4_LandingPage_301802672` | Landing page metrics |
| `ga4_Events_301802672` | Events by page |

**Pre-Calculated Metrics (stored in `marketing_metrics_pages`):**

| Metric | Formula | Benchmark | Update Frequency |
|--------|---------|-----------|------------------|
| `pageviews` | Total screenPageViews | N/A | Daily |
| `unique_pageviews` | Total users per page | N/A | Daily |
| `avg_time_on_page` | Mean engagement time | >2 min | Daily |
| `bounce_rate` | Bounces / entries | <50% | Daily |
| `exit_rate` | Exits / pageviews | Varies | Daily |
| `conversion_rate` | Conversions / sessions | 2-5% | Daily |
| `engagement_rate` | Engaged sessions / total | >50% | Daily |

**Stored Aggregations:**
- Top 10 pages by traffic
- Bottom 10 pages by conversion rate
- Landing page performance comparison
- Page-level funnel analysis
- Week-over-week changes

**Analysis Capabilities:**
1. High-traffic, low-conversion pages (optimization targets)
2. Best performing landing pages
3. User flow analysis
4. Bounce rate optimization
5. Conversion funnel analysis

**Missing Data (Future - Hotjar Integration):**
- Heatmaps
- Session recordings
- Form analytics
- Scroll depth

---

### 6. 📝 Content Expert

**Industry Model:** Clearscope, MarketMuse + Ahrefs

**Data Sources:**
| Table | Description |
|-------|-------------|
| `ga4_PagesAndScreens_301802672` | Content page metrics (filter /blog/*) |
| `ga4_TrafficAcquisition_301802672` | Organic traffic to content |
| `dataforseo_keywords_raw_latest` | Keywords content ranks for |
| `dataforseo_backlinks_raw_latest` | Backlinks to content |

**Pre-Calculated Metrics (stored in `marketing_metrics_content`):**

| Metric | Formula | Benchmark | Update Frequency |
|--------|---------|-----------|------------------|
| `organic_sessions` | Sessions from organic to /blog/* | Growth >0% | Daily |
| `avg_time_on_content` | Mean engagement time | >3 min | Daily |
| `content_conversions` | keyEvents on content pages | N/A | Daily |
| `keywords_per_article` | Count of ranked keywords per URL | >5 | Weekly |
| `backlinks_per_article` | Backlinks per content URL | >0 | Weekly |
| `avg_position_per_article` | Mean keyword position | <20 | Weekly |

**Stored Aggregations:**
- Content performance ranking (traffic, conversions, backlinks)
- Content decay alerts (traffic/ranking drops)
- Top performing topics/categories
- Content gap opportunities

**Analysis Capabilities:**
1. Top performing content
2. Underperforming content (high effort, low results)
3. Content decay detection
4. Content-keyword alignment
5. Internal linking opportunities
6. Content ROI (if cost data available)

---

## Metrics Storage Schema

### Firestore Collections

```
marketing_metrics_email/{organizationId}
  ├── daily/{YYYY-MM-DD}
  │   ├── open_rate: number
  │   ├── click_rate: number
  │   ├── ...
  ├── campaigns/{campaignId}
  │   ├── metrics: {...}
  │   ├── historical: [{date, metrics}]
  └── summary
      ├── last_30_days: {...}
      ├── benchmarks: {...}
      └── alerts: [...]

marketing_metrics_seo/{organizationId}
  ├── weekly/{YYYY-WW}
  │   ├── total_keywords: number
  │   ├── top_10_keywords: number
  │   ├── organic_traffic: number
  │   ├── ...
  ├── keywords/{keywordHash}
  │   ├── current_position: number
  │   ├── position_history: [{date, position}]
  └── summary
      ├── health_score: number
      ├── opportunities: [...]
      └── alerts: [...]
```

### BigQuery Tables

```sql
-- Pre-calculated metrics tables (synced from Firestore)
marketing_metrics_email_raw_latest
marketing_metrics_seo_raw_latest
marketing_metrics_ads_raw_latest
marketing_metrics_social_raw_latest
marketing_metrics_pages_raw_latest
marketing_metrics_content_raw_latest

-- Each table contains:
-- - organizationId
-- - period (daily/weekly/monthly)
-- - date
-- - All calculated metrics for that channel
-- - calculatedAt timestamp
```

---

## API Endpoints

Each expert tool exposes:

### Calculate Metrics
```
POST /api/marketing/{channel}/calculate
Body: { organizationId, startDate?, endDate? }
Response: { success, metricsCalculated, storedAt }
```

### Get Metrics
```
GET /api/marketing/{channel}/metrics
Query: { organizationId, period, startDate?, endDate? }
Response: { metrics, benchmarks, alerts }
```

### Get Analysis
```
POST /api/marketing/{channel}/analyze
Body: { organizationId, question? }
Response: { analysis, recommendations, data }
```

---

## Scheduled Jobs

| Job | Frequency | Channels |
|-----|-----------|----------|
| Daily metrics calculation | 6 AM UTC | Pages, Ads, Social |
| Weekly metrics calculation | Monday 6 AM | SEO, Content |
| Campaign metrics | After each send | Email |
| Benchmark updates | Monthly | All |

---

## Implementation Priority

1. **Phase 1 - Strong Data Channels**
   - [x] SEO data integration (DataForSEO)
   - [ ] SEO metrics calculation & storage
   - [ ] Email metrics calculation & storage
   - [ ] Pages metrics calculation & storage
   - [ ] Content metrics calculation & storage

2. **Phase 2 - Add Missing Integrations**
   - [ ] Google Ads API connection
   - [ ] Ads metrics with spend data

3. **Phase 3 - Social Expansion**
   - [ ] Twitter API connection
   - [ ] LinkedIn API connection
   - [ ] Native social metrics

---

## AI Tool Interface

Each expert tool is callable by the orchestrator AI with this interface:

```typescript
interface ExpertToolRequest {
  channel: 'email' | 'seo' | 'ads' | 'social' | 'pages' | 'content';
  organizationId: string;
  action: 'get_summary' | 'get_trends' | 'get_alerts' | 'analyze';
  timeframe?: '7d' | '30d' | '90d' | '12m';
  question?: string; // For analyze action
}

interface ExpertToolResponse {
  channel: string;
  summary: {
    primaryKPIs: Record<string, number>;
    trends: Record<string, 'up' | 'down' | 'stable'>;
    healthScore: number;
  };
  alerts: Alert[];
  opportunities: Opportunity[];
  recommendations: string[];
  rawData?: any; // For deeper analysis
}
```

---

## Benchmarks Reference

### Email Benchmarks (by industry)
| Metric | B2B | B2C | Ecommerce |
|--------|-----|-----|-----------|
| Open Rate | 20% | 25% | 18% |
| Click Rate | 3% | 4% | 2.5% |
| Unsubscribe | 0.3% | 0.4% | 0.2% |

### SEO Benchmarks
| Metric | Good | Excellent |
|--------|------|-----------|
| Page Health Score | >70 | >85 |
| Month-over-month traffic growth | >5% | >15% |
| Top 10 keyword growth | >10% | >25% |

### Page Benchmarks
| Metric | Good | Excellent |
|--------|------|-----------|
| Bounce Rate | <50% | <35% |
| Conversion Rate | >2% | >5% |
| Engagement Rate | >50% | >70% |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-24 | Initial specification |
