# Marketing AI System - Complete Implementation Plan

**Goal:** Build a production-ready Scout AI + Operator AI system that surfaces daily growth opportunities and executes safe, guardrailed actions across all marketing channels.

**Desired End State:**
1. Daily AI checks run automatically, detecting 40+ opportunity types
2. Opportunities displayed in UI with impact scores, confidence, and recommended actions
3. Operator AI executes low-risk actions automatically (with guardrails)
4. Full cross-channel attribution and causation analysis
5. Closed-loop learning (action → measurement → learning)

---

## 📊 LAYER 1: DATABASE SCHEMA

### Current State
- ✅ Firestore collections synced to BigQuery (via extension)
- ✅ GA4, Stripe, ActiveCampaign, DataForSEO, QuickBooks data
- ❌ **No canonical entity mapping**
- ❌ **No daily rollups** (only monthly aggregates)
- ❌ **No unified event stream**
- ❌ **No opportunities/actions storage**

### 1.1 CREATE: Canonical Entity Mapping

**BigQuery Tables to Create:**

```sql
-- Entity Map (THE MOST CRITICAL TABLE)
CREATE TABLE opsos-864a1.marketing_ai.entity_map (
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,  -- page, campaign, keyword, product, email, ad
  source STRING NOT NULL,        -- ga4, google_ads, dataforseo, stripe, activecampaign
  source_entity_id STRING NOT NULL,
  source_metadata JSON,          -- Original IDs, names, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (canonical_entity_id, source, source_entity_id) NOT ENFORCED
);

-- Example mappings needed:
-- | canonical_entity_id | entity_type | source | source_entity_id |
-- | page_pricing | page | ga4 | /pricing |
-- | page_pricing | page | google_ads | landing_page_123 |
-- | campaign_q1_brand | campaign | ga4 | Q1 Brand Campaign |
-- | campaign_q1_brand | campaign | google_ads | 987654321 |
-- | product_pro | product | stripe | prod_ABC123 |
-- | keyword_best_crm | keyword | dataforseo | best crm for saas |
```

**Firestore Collection:**
- Mirror as `entity_map` collection for real-time access in API routes

**Build Requirements:**
- [ ] SQL DDL for BigQuery table
- [ ] Firestore Cloud Function to sync bidirectionally
- [ ] API route `/api/entity-map` (GET, POST for mappings)
- [ ] Admin UI at `/sources/entity-map` to manage mappings
- [ ] Initial seeding script to map existing data

---

### 1.2 CREATE: Atomic Events Table

**BigQuery Table:**

```sql
-- Unified Event Stream
CREATE TABLE opsos-864a1.marketing_ai.events_all (
  event_id STRING NOT NULL,
  event_time TIMESTAMP NOT NULL,
  event_date DATE NOT NULL,
  
  source STRING NOT NULL,           -- ga4, google_ads, dataforseo, stripe, activecampaign
  channel STRING NOT NULL,          -- seo, paid_search, paid_social, email, direct
  event_name STRING NOT NULL,       -- impression, click, page_view, open, purchase, refund
  
  entity_type STRING,               -- page, keyword, ad, campaign, email, product
  entity_id STRING,                 -- Canonical entity ID
  
  actor_id STRING,                  -- user_id / contact_id / customer_id
  session_id STRING,
  
  value FLOAT64,                    -- Revenue, cost, quantity
  currency STRING DEFAULT 'USD',
  
  properties JSON,                  -- Source-specific fields
  
  organization_id STRING NOT NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY event_date
CLUSTER BY source, event_name, entity_id;
```

**Event Name Standards (enum to enforce):**
```typescript
// GA4 Events
'page_view', 'session_start', 'user_engagement', 
'form_submit', 'sign_up', 'trial_start', 'purchase'

// Google Ads Events
'ad_impression', 'ad_click', 'ad_conversion', 'ad_cost'

// DataForSEO Events
'serp_snapshot', 'keyword_rank', 'keyword_volume_change', 
'backlink_gained', 'backlink_lost', 'page_health_check'

// Stripe Events
'invoice_paid', 'invoice_created', 'subscription_created', 
'subscription_updated', 'subscription_canceled', 'refund', 
'payment_failed', 'trial_started'

// ActiveCampaign Events
'email_sent', 'email_opened', 'email_clicked', 'email_bounced', 
'email_unsubscribed', 'contact_added', 'automation_started'
```

**Build Requirements:**
- [ ] ETL Cloud Function to transform Firestore data → `events_all`
- [ ] Run hourly to batch new events
- [ ] Dedupe logic (event_id unique constraint)

---

### 1.3 CREATE: Daily Rollup Tables

**Daily Entity Metrics (Primary workhorse table):**

```sql
CREATE TABLE opsos-864a1.marketing_ai.daily_entity_metrics (
  date DATE NOT NULL,
  organization_id STRING NOT NULL,
  entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,
  channel STRING NOT NULL,
  
  -- Traffic
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  
  -- Engagement
  pageviews INT64 DEFAULT 0,
  avg_engagement_time_sec FLOAT64,
  bounce_rate FLOAT64,
  exit_rate FLOAT64,
  
  -- Conversions
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64,
  
  -- Financial
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  
  -- Email specific
  emails_sent INT64 DEFAULT 0,
  emails_opened INT64 DEFAULT 0,
  emails_clicked INT64 DEFAULT 0,
  
  -- SEO specific
  rank_avg FLOAT64,
  rank_change FLOAT64,
  search_volume INT64,
  
  -- Computed
  ctr FLOAT64,        -- clicks / impressions
  cpc FLOAT64,        -- cost / clicks
  cpa FLOAT64,        -- cost / conversions
  roas FLOAT64,       -- revenue / cost
  mer FLOAT64,        -- revenue / cost (blended)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, entity_id, channel;
```

**Daily Campaign Metrics:**

```sql
CREATE TABLE opsos-864a1.marketing_ai.daily_campaign_metrics (
  date DATE NOT NULL,
  organization_id STRING NOT NULL,
  campaign_id STRING NOT NULL,  -- Canonical campaign ID
  channel STRING NOT NULL,
  
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  
  ctr FLOAT64,
  cpc FLOAT64,
  cpa FLOAT64,
  roas FLOAT64,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, campaign_id;
```

**Daily Funnel Metrics:**

```sql
CREATE TABLE opsos-864a1.marketing_ai.daily_funnel_metrics (
  date DATE NOT NULL,
  organization_id STRING NOT NULL,
  source_channel STRING NOT NULL,
  
  visits INT64 DEFAULT 0,
  engaged_sessions INT64 DEFAULT 0,
  leads INT64 DEFAULT 0,
  trials INT64 DEFAULT 0,
  customers INT64 DEFAULT 0,
  revenue FLOAT64 DEFAULT 0,
  
  visit_to_lead_rate FLOAT64,
  lead_to_trial_rate FLOAT64,
  trial_to_customer_rate FLOAT64,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, source_channel;
```

**Build Requirements:**
- [ ] Cloud Function (or Cloud Run job) that runs daily at 2am UTC
- [ ] Aggregates from `events_all` → rollup tables
- [ ] Backfill script for historical data (last 90 days minimum)

---

### 1.4 CREATE: Metric Registry

**BigQuery Table:**

```sql
CREATE TABLE opsos-864a1.marketing_ai.metric_registry (
  metric_id STRING NOT NULL PRIMARY KEY NOT ENFORCED,
  metric_name STRING NOT NULL,
  description STRING,
  category STRING,  -- traffic, engagement, conversion, financial, email, seo
  
  type STRING NOT NULL,  -- ratio, sum, avg, count, percentile
  formula STRING NOT NULL,  -- SQL expression
  grain ARRAY<STRING>,  -- ['daily_entity', 'daily_campaign', 'daily_total']
  
  unit STRING,  -- percent, dollar, count, seconds
  format STRING,  -- For display: '0.00%', '$0,0.00', '0,0'
  
  benchmark_good FLOAT64,
  benchmark_excellent FLOAT64,
  inverse BOOLEAN DEFAULT FALSE,  -- True if lower is better
  
  owner STRING,
  version INT64 DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

**Seed Data (50+ metrics):**
```sql
-- Examples
INSERT INTO metric_registry VALUES
('m_ctr', 'Click-Through Rate', 'Clicks divided by impressions', 'traffic', 
 'ratio', 'clicks / NULLIF(impressions, 0)', ['daily_entity', 'daily_campaign'], 
 'percent', '0.00%', 0.02, 0.05, false, 'system', 1, CURRENT_TIMESTAMP()),

('m_cvr', 'Conversion Rate', 'Conversions divided by sessions', 'conversion',
 'ratio', 'conversions / NULLIF(sessions, 0)', ['daily_entity', 'daily_campaign'],
 'percent', '0.00%', 0.02, 0.05, false, 'system', 1, CURRENT_TIMESTAMP()),

('m_cac', 'Customer Acquisition Cost', 'Cost per conversion', 'financial',
 'ratio', 'cost / NULLIF(conversions, 0)', ['daily_campaign'],
 'dollar', '$0,0.00', 100, 50, true, 'system', 1, CURRENT_TIMESTAMP());
-- ... 50 more
```

**Build Requirements:**
- [ ] SQL seeding script with all 50+ core metrics
- [ ] API route `/api/metrics/registry` (GET list, POST new metric)
- [ ] Metric evaluation engine (takes metric_id + timeframe → computed values)

---

### 1.5 CREATE: Opportunities & Actions Storage

**Opportunities Table:**

```sql
CREATE TABLE opsos-864a1.marketing_ai.opportunities (
  opportunity_id STRING NOT NULL PRIMARY KEY NOT ENFORCED,
  organization_id STRING NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  detected_date DATE NOT NULL,
  
  type STRING NOT NULL,  -- From opportunity type enum
  channel STRING NOT NULL,
  
  entity JSON,  -- {entity_type, entity_id, platform_ids}
  
  evidence JSON NOT NULL,  -- {window_days, metrics{}, delta{}, comparison{}}
  hypothesis STRING NOT NULL,
  recommended_actions JSON NOT NULL,  -- [{action_type, params, guardrails}]
  
  estimated_uplift JSON,  -- {revenue_7d: 1500, conversions_7d: 25}
  confidence FLOAT64 NOT NULL,  -- 0-1
  effort STRING NOT NULL,  -- low, medium, high
  risk STRING NOT NULL,  -- low, medium, high
  score FLOAT64 NOT NULL,  -- impact * confidence / effort
  
  status STRING DEFAULT 'new',  -- new, reviewed, approved, executing, completed, dismissed
  reviewed_by STRING,
  reviewed_at TIMESTAMP,
  
  result JSON  -- After execution: {actual_uplift, success, notes}
)
PARTITION BY detected_date
CLUSTER BY organization_id, type, status;
```

**Actions Log Table:**

```sql
CREATE TABLE opsos-864a1.marketing_ai.actions_log (
  action_id STRING NOT NULL PRIMARY KEY NOT ENFORCED,
  opportunity_id STRING,
  organization_id STRING NOT NULL,
  
  action_type STRING NOT NULL,
  platform STRING NOT NULL,  -- google_ads, activecampaign, website, dataforseo
  
  payload JSON NOT NULL,  -- Action parameters
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  executed_by STRING,  -- 'operator_ai', 'user:email@example.com'
  
  status STRING NOT NULL,  -- pending, success, failed, rolled_back
  result JSON,  -- Platform response
  error_message STRING,
  
  rollback_plan JSON,
  rolled_back_at TIMESTAMP,
  
  measurement_checkpoints ARRAY<TIMESTAMP>  -- When to measure impact (+3d, +7d)
);
```

**Experiments Table:**

```sql
CREATE TABLE opsos-864a1.marketing_ai.experiments (
  experiment_id STRING NOT NULL PRIMARY KEY NOT ENFORCED,
  organization_id STRING NOT NULL,
  opportunity_id STRING,
  
  type STRING NOT NULL,  -- landing_page_ab, email_subject, ad_creative
  entity_id STRING NOT NULL,
  
  variants JSON NOT NULL,  -- ['control', 'variant_a', 'variant_b']
  primary_metric STRING NOT NULL,
  
  started_at TIMESTAMP,
  minimum_runtime_days INT64 DEFAULT 7,
  stop_rules JSON,  -- {min_effect: 0.05, min_confidence: 0.9}
  guardrails JSON,  -- {max_drop_revenue_pct: 5}
  
  status STRING DEFAULT 'draft',  -- draft, running, winner_declared, stopped
  winner STRING,
  
  results JSON  -- Per-variant metrics
);
```

**Build Requirements:**
- [ ] Firestore mirrors for real-time access
- [ ] API routes for CRUD operations
- [ ] UI pages to display/manage opportunities

---

## 🔧 LAYER 2: DATA INGESTION & ETL

### 2.1 ENHANCE: Google Ads Direct Integration

**Current:** Only cost data via GA4
**Missing:** Impressions, queries, ad-level performance

**New API Routes:**
```
POST /api/google-ads/auth          # OAuth flow
GET  /api/google-ads/callback      # OAuth callback
POST /api/google-ads/sync          # Full sync
GET  /api/google-ads/campaigns     # List campaigns
GET  /api/google-ads/search-terms  # Query mining
```

**New Firestore Collections:**
```
google_ads_campaigns     # Campaign-level metrics
google_ads_adgroups      # Ad group performance
google_ads_keywords      # Keyword bidding & performance
google_ads_search_terms  # Search query data
google_ads_ads           # Ad creative performance
```

**Build Requirements:**
- [ ] Google Ads API OAuth integration
- [ ] Sync job (daily at 3am)
- [ ] Store impressions, clicks, cost, conversions, search terms
- [ ] Map to canonical campaign IDs in entity_map

---

### 2.2 ENHANCE: ActiveCampaign Event-Level Data

**Current:** Campaign summaries only
**Missing:** Individual sends, opens, clicks with timestamps

**New API Routes:**
```
GET /api/activecampaign/events  # Fetch event stream
```

**New Firestore Collection:**
```
activecampaign_events
  - eventId
  - contactId
  - campaignId
  - eventType: 'sent' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed'
  - timestamp
  - properties: {linkUrl, device, geo}
```

**Build Requirements:**
- [ ] Fetch from ActiveCampaign Contact Activity API
- [ ] Store individual events (not just aggregates)
- [ ] Sync hourly for real-time analysis

---

### 2.3 ENHANCE: Stripe Additional Data

**Current:** Payments, subscriptions, invoices
**Missing:** Refunds, failed payments, trial conversions

**New Queries:**
```typescript
// Add to existing /api/stripe/sync
- stripe.refunds.list()
- stripe.charges.list({status: 'failed'})
- stripe.subscriptions.list({status: 'all'}) // Include canceled
```

**Add to Firestore:**
```
stripe_refunds
stripe_failed_payments
stripe_subscription_changes  # Upgrades, downgrades, cancellations
```

**Build Requirements:**
- [ ] Enhance existing sync to fetch refunds, failures
- [ ] Track subscription lifecycle events
- [ ] Calculate churn cohorts

---

### 2.4 CREATE: Daily ETL Pipeline

**Cloud Run Job (or Cloud Function on schedule):**

```python
# /cloud-functions/daily-etl-pipeline/main.py

def run_daily_etl():
    """Runs every day at 2am UTC"""
    
    # Step 1: Sync Firestore → events_all (atomic events)
    transform_firestore_to_events()
    
    # Step 2: Aggregate events → daily rollups
    aggregate_daily_entity_metrics()
    aggregate_daily_campaign_metrics()
    aggregate_daily_funnel_metrics()
    
    # Step 3: Data quality checks
    run_freshness_checks()
    run_mapping_health_checks()
    
    # Step 4: Trigger Scout AI (next layer)
    trigger_scout_analysis()
```

**Build Requirements:**
- [ ] Cloud Run job with BigQuery client
- [ ] Scheduled via Cloud Scheduler (daily 2am UTC)
- [ ] Error notifications to Slack/email
- [ ] Backfill script for historical data

---

## 🤖 LAYER 3: SCOUT AI (OPPORTUNITY DETECTION)

### 3.1 CREATE: Daily Opportunity Detectors

**Cloud Function (or Cloud Run):**
```
/cloud-functions/marketing-scout-ai/
  - main.py (orchestrator)
  - detectors/
    - preflight.py          # Data quality checks
    - funnel.py             # Revenue/conversion anomalies
    - paid_search.py        # Google Ads opportunities
    - seo.py                # DataForSEO opportunities
    - email.py              # ActiveCampaign opportunities
    - pages.py              # Landing page opportunities
    - content.py            # Content performance
    - social.py             # Social media
    - cross_channel.py      # Alignment gaps
  - scoring.py              # Impact scoring & ranking
  - output.py               # Write to opportunities table
```

**Detector Implementation (40+ types):**

From ChatGPT doc, implement these detectors:

**Preflight (2 detectors):**
- [ ] Data freshness & completeness
- [ ] Entity mapping health

**Funnel & Revenue (3 detectors):**
- [ ] Revenue anomalies
- [ ] Conversion rate drops
- [ ] Channel mix shifts

**Paid Search (8 detectors):**
- [ ] Scale winners (high ROAS campaigns)
- [ ] Waste detection (zero conversion spend)
- [ ] Search term mining (new keyword opportunities)
- [ ] Creative fatigue (declining CTR)
- [ ] Brand defense signals
- [ ] High clicks, low CVR (landing page mismatch)
- [ ] CPA spikes
- [ ] Impression share loss

**SEO (5 detectors):**
- [ ] Striking distance keywords (positions 4-15)
- [ ] Rank drops on money terms
- [ ] High impressions, low CTR
- [ ] Content gap from winners
- [ ] Content decay

**Email (5 detectors):**
- [ ] Scale winners (high revenue/recipient)
- [ ] Open rate drops
- [ ] High opens, low clicks
- [ ] High clicks, low conversions
- [ ] Lifecycle triggers (trial activation)

**Pages (5 detectors):**
- [ ] High traffic, low conversion
- [ ] Funnel step drop-offs
- [ ] Paid traffic mismatch
- [ ] Email landing page mismatch
- [ ] Engagement decay

**Content (5 detectors):**
- [ ] Content driving conversions (scale it)
- [ ] High rank, low conversion
- [ ] Content decay
- [ ] Striking distance expansion
- [ ] Content gap from paid/email

**Social (5 detectors):**
- [ ] High engagement unleveraged
- [ ] Traffic but no conversion
- [ ] Topic resonance signals
- [ ] Distribution decay
- [ ] Social proof amplification

**Cross-Channel (4 detectors):**
- [ ] SEO winners not supported by email
- [ ] Revenue pages with no paid coverage
- [ ] Paid landing on weak pages
- [ ] Email/page message mismatch

**Build Requirements:**
- [ ] Python Cloud Function with BigQuery client
- [ ] Each detector queries rollup tables + baselines
- [ ] Outputs opportunities to `opportunities` table
- [ ] Runs daily at 4am UTC (after ETL completes)
- [ ] Sends Slack summary

---

### 3.2 CREATE: Scout Output & Scoring

**Scoring Formula:**
```python
def calculate_opportunity_score(opportunity):
    # Impact in dollars (7-day estimate)
    impact = opportunity['estimated_uplift']['revenue_7d']
    
    # Confidence (0-1)
    confidence = opportunity['confidence']
    
    # Effort weight (low=1, medium=2, high=3)
    effort_map = {'low': 1, 'medium': 2, 'high': 3}
    effort = effort_map[opportunity['effort']]
    
    # Risk penalty (low=1, medium=0.7, high=0.4)
    risk_map = {'low': 1, 'medium': 0.7, 'high': 0.4}
    risk = risk_map[opportunity['risk']]
    
    # Score = (Impact * Confidence * Risk) / Effort
    score = (impact * confidence * risk) / effort
    
    return round(score, 2)
```

**Daily Outputs:**
```json
// daily_summary.json
{
  "date": "2026-01-25",
  "organization_id": "xxx",
  "total_opportunities": 23,
  "high_priority": 5,
  "estimated_total_impact_7d": 18500,
  "top_opportunities": ["opp_id_1", "opp_id_2", "opp_id_3"],
  "data_health": {
    "ga4": "ok",
    "google_ads": "ok",
    "stripe": "ok",
    "activecampaign": "warn",
    "dataforseo": "ok"
  }
}
```

**Build Requirements:**
- [ ] Scoring engine
- [ ] Daily summary generation
- [ ] Write to Firestore `daily_summaries` collection
- [ ] Slack notification with top 3 opportunities

---

## 🛠️ LAYER 4: OPERATOR AI (EXECUTION ENGINE)

### 4.1 CREATE: Action Execution Framework

**Cloud Function:**
```
/cloud-functions/marketing-operator-ai/
  - main.py (orchestrator)
  - actions/
    - google_ads.py      # Budget, bids, pause, new ads
    - activecampaign.py  # Email tests, segments, sends
    - website.py         # A/B tests (if CMS integrated)
    - content.py         # Generate briefs, internal links
  - guardrails.py        # Safety checks before execution
  - rollback.py          # Undo actions if needed
```

**Safe Actions (Auto-execute):**
- [ ] Pause ads with 0 conversions after $X spend
- [ ] Budget shifts within ±20% caps
- [ ] Email subject line A/B tests
- [ ] Content brief generation
- [ ] Internal link suggestions

**Approval-Required Actions:**
- [ ] Budget increases >20%
- [ ] New ad campaigns
- [ ] Landing page changes
- [ ] Brand campaign modifications

**Build Requirements:**
- [ ] Operator AI reads `opportunities` table (status='approved')
- [ ] Executes via platform APIs
- [ ] Logs all actions to `actions_log`
- [ ] Implements rollback for reversible actions
- [ ] Schedules measurement checkpoints

---

### 4.2 CREATE: Platform Connectors

**Google Ads Connector:**
```python
class GoogleAdsConnector:
    def increase_budget(campaign_id, pct_increase, cap):
        # Get current budget
        # Apply increase with cap
        # Log action
        
    def pause_campaign(campaign_id, reason):
        # Pause via API
        # Log action with rollback plan
        
    def create_ad_group(campaign_id, keywords, ads):
        # Create from search term mining
        # Log action
```

**ActiveCampaign Connector:**
```python
class ActiveCampaignConnector:
    def create_ab_test(campaign_id, variants):
        # Create test
        # Log experiment
        
    def trigger_automation(automation_id, contact_ids):
        # Trigger lifecycle sequence
        # Log action
```

**Build Requirements:**
- [ ] Python classes for each platform
- [ ] OAuth token management
- [ ] Rate limiting & retry logic
- [ ] Error handling & logging

---

## 🖥️ LAYER 5: API ROUTES (BACKEND)

### 5.1 ENHANCE: Existing Metrics Routes

**Current Routes:**
```
✅ /api/marketing/seo/metrics
✅ /api/marketing/email/metrics
✅ /api/marketing/ads/metrics
✅ /api/marketing/pages/metrics
✅ /api/marketing/content/metrics
✅ /api/marketing/social/metrics
✅ /api/marketing/analyze (comprehensive analysis)
```

**Enhancements Needed:**
- [ ] All routes should query daily rollup tables (not monthly Firestore aggregates)
- [ ] Add baseline comparisons (7d, 28d trailing)
- [ ] Return time-series data for charts (not just current values)
- [ ] Include opportunities count for each channel

---

### 5.2 CREATE: New API Routes

**Opportunities Management:**
```typescript
GET  /api/opportunities              # List all opportunities
GET  /api/opportunities/:id          # Get single opportunity details
POST /api/opportunities/:id/approve  # Approve for execution
POST /api/opportunities/:id/dismiss  # Dismiss opportunity
GET  /api/opportunities/daily-summary # Today's summary
```

**Actions Management:**
```typescript
GET  /api/actions                    # List all actions
GET  /api/actions/:id                # Action details & result
POST /api/actions/:id/rollback       # Rollback an action
GET  /api/actions/:id/impact         # Measured impact
```

**Experiments:**
```typescript
GET  /api/experiments                # List experiments
POST /api/experiments                # Create new experiment
GET  /api/experiments/:id/results    # Experiment results
POST /api/experiments/:id/declare-winner # Stop experiment
```

**Entity Mapping:**
```typescript
GET  /api/entity-map                 # List all mappings
POST /api/entity-map                 # Create mapping
PUT  /api/entity-map/:id             # Update mapping
GET  /api/entity-map/suggest         # AI-suggested mappings
```

**Scout Control:**
```typescript
POST /api/scout/run                  # Trigger manual Scout run
GET  /api/scout/status               # Check if running
GET  /api/scout/history              # Past Scout runs
```

**Build Requirements:**
- [ ] 15+ new API route files
- [ ] All routes query BigQuery rollup tables
- [ ] Proper error handling & validation
- [ ] Rate limiting on expensive queries

---

## 🎨 LAYER 6: FRONTEND UI

### 6.1 CREATE: Opportunities Dashboard

**New Page: `/ai/opportunities`**

**Features:**
- [ ] List view with filters (channel, type, priority)
- [ ] Sortable columns (score, impact, confidence)
- [ ] Detail modal for each opportunity
- [ ] Approve/dismiss actions
- [ ] Charts showing estimated impact
- [ ] Status indicators (new, approved, executing, completed)

**Components:**
```typescript
<OpportunityList />           # Main table
<OpportunityCard />           # Individual card
<OpportunityDetailModal />    # Expanded view
<ImpactChart />               # Visualize uplift estimate
<ActionPreview />             # Show what Operator will do
<ApprovalButtons />           # Approve/dismiss
```

---

### 6.2 CREATE: Actions & Experiments Pages

**New Page: `/ai/actions`**
- [ ] List of all executed actions
- [ ] Status tracking (pending, success, failed)
- [ ] Rollback button for reversible actions
- [ ] Impact measurement after +3d, +7d
- [ ] Link to related opportunity

**New Page: `/ai/experiments`**
- [ ] Active experiments dashboard
- [ ] Winner declaration interface
- [ ] Results visualization
- [ ] Statistical significance indicators

---

### 6.3 CREATE: Entity Mapping Admin

**New Page: `/sources/entity-map`**
- [ ] Visual mapping interface
- [ ] Drag-and-drop to create mappings
- [ ] Auto-suggest similar entities
- [ ] Bulk import via CSV
- [ ] Preview impact on attribution

---

### 6.4 ENHANCE: Marketing Insights Pages

**Current Pages:**
```
✅ /ai/marketing-insights (overview)
✅ /ai/marketing-insights/seo
✅ /ai/marketing-insights/email
✅ /ai/marketing-insights/ads
✅ /ai/marketing-insights/pages
✅ /ai/marketing-insights/content
✅ /ai/marketing-insights/social
```

**Enhancements Needed (ALL pages):**
- [ ] Replace monthly charts with daily/weekly time-series
- [ ] Add "Opportunities" section showing relevant opportunities from Scout
- [ ] Add trend indicators (↑↓) with % change vs baseline
- [ ] Add benchmark comparisons (your performance vs industry)
- [ ] Add quick actions ("Approve Top 3 Opportunities")

**Example Enhanced Section:**
```typescript
// Add to all Marketing Insights pages
<Card title="AI Opportunities">
  <p className="text-sm mb-4">
    Scout AI detected {opportunitiesCount} opportunities in the last 24 hours
  </p>
  {opportunities.slice(0, 3).map(opp => (
    <OpportunityCard 
      key={opp.id}
      opportunity={opp}
      onApprove={() => handleApprove(opp.id)}
    />
  ))}
  <Link href="/ai/opportunities?channel=seo">
    View All {opportunitiesCount} Opportunities →
  </Link>
</Card>
```

---

### 6.5 CREATE: Scout AI Status Widget

**Add to Sidebar or Header:**
```typescript
<ScoutStatusWidget>
  {/* Shows:
    - Last run time
    - Next scheduled run
    - Opportunities detected today
    - Manual trigger button
  */}
</ScoutStatusWidget>
```

---

## 🧪 LAYER 7: AGENT CODE (AI LOGIC)

### 7.1 ENHANCE: Marketing Analysis Library

**Current:** `/app/src/lib/marketingAnalysis.ts`
- ✅ Trend analysis
- ✅ Seasonality detection
- ✅ Anomaly detection
- ✅ Causation analysis
- ✅ Forecasting

**Missing:**
- [ ] **Daily baseline calculation** (7d, 28d, same-day-prior-weeks)
- [ ] **Confidence scoring** (data quality × sample size × stability)
- [ ] **Impact estimation** (opportunity → expected revenue lift)
- [ ] **Cross-channel attribution** (multi-touch models)

**New Functions to Add:**
```typescript
// Calculate baselines for anomaly detection
export function calculateBaselines(
  timeSeries: TimeSeriesPoint[],
  date: string
): {
  trailing7d: number;
  trailing28d: number;
  sameDayPriorWeeks: number;
}

// Estimate revenue impact of opportunity
export function estimateImpact(
  opportunity: OpportunityInput,
  historicalData: TimeSeriesPoint[]
): {
  revenue7d: number;
  revenue30d: number;
  conversions7d: number;
  confidence: number;
}

// Multi-touch attribution
export function attributeConversion(
  userJourney: Event[],
  conversionEvent: Event
): AttributionResult[]
```

---

### 7.2 CREATE: Opportunity Type Enum & Schemas

**File:** `/app/src/types/opportunities.ts`

```typescript
export type OpportunityType = 
  // Preflight
  | 'data_quality_issue'
  | 'mapping_gap'
  // Funnel
  | 'revenue_anomaly'
  | 'cvr_drop'
  | 'channel_mix_shift'
  // Paid Search
  | 'paid_scale_winner'
  | 'paid_waste'
  | 'paid_query_mining_expand'
  | 'paid_creative_refresh'
  | 'paid_brand_defense'
  | 'paid_clicks_low_cvr'
  | 'paid_cpa_spike'
  // SEO
  | 'seo_striking_distance'
  | 'seo_rank_drop_urgent'
  | 'seo_ctr_opportunity'
  | 'seo_content_expand'
  | 'seo_content_decay'
  // Email
  | 'email_scale_winner'
  | 'email_open_drop'
  | 'email_click_leak'
  | 'email_to_lp_mismatch'
  | 'email_lifecycle_activation_gap'
  // Pages
  | 'page_cvr_opportunity'
  | 'page_funnel_dropoff'
  | 'paid_to_page_mismatch'
  | 'email_landing_page_mismatch'
  | 'page_engagement_decay'
  // Content
  | 'content_scale_winner'
  | 'content_conversion_gap'
  | 'content_decay'
  | 'content_striking_distance'
  | 'content_gap_from_demand'
  // Social
  | 'social_engagement_unleveraged'
  | 'social_to_page_mismatch'
  | 'social_topic_signal'
  | 'social_distribution_decay'
  | 'social_proof_amplify'
  // Cross-channel
  | 'channel_gap_email_support'
  | 'channel_gap_paid_support'
  | 'landing_page_routing_fix'
  | 'message_match_alignment';

export interface Opportunity {
  opportunity_id: string;
  organization_id: string;
  created_at: string;
  detected_date: string;
  
  type: OpportunityType;
  channel: 'seo' | 'email' | 'ads' | 'pages' | 'content' | 'social' | 'cross_channel';
  
  entity: {
    entity_type: string;
    entity_id: string;
    platform_ids?: Record<string, string>;
  };
  
  evidence: {
    window_days: number;
    metrics: Record<string, number>;
    delta: Record<string, number>;
    comparison: {
      baseline_7d?: number;
      baseline_28d?: number;
      site_avg?: number;
      peer_avg?: number;
    };
  };
  
  hypothesis: string;
  
  recommended_actions: Array<{
    action_type: string;
    platform: string;
    params: Record<string, any>;
    success_metric: string;
    guardrails: Record<string, any>;
  }>;
  
  estimated_uplift: {
    revenue_7d?: number;
    revenue_30d?: number;
    conversions_7d?: number;
    conversions_30d?: number;
  };
  
  confidence: number; // 0-1
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  score: number;
  
  status: 'new' | 'reviewed' | 'approved' | 'executing' | 'completed' | 'dismissed';
  reviewed_by?: string;
  reviewed_at?: string;
  
  result?: {
    actual_uplift: Record<string, number>;
    success: boolean;
    notes: string;
  };
}
```

---

### 7.3 CREATE: Action Type Enum & Schemas

**File:** `/app/src/types/actions.ts`

```typescript
export type ActionType =
  // Google Ads
  | 'increase_budget'
  | 'decrease_budget'
  | 'pause_campaign'
  | 'resume_campaign'
  | 'adjust_bid'
  | 'add_negative_keyword'
  | 'create_ad_group'
  | 'create_rsa'
  // ActiveCampaign
  | 'create_ab_test'
  | 'trigger_automation'
  | 'adjust_send_time'
  | 'create_segment'
  // Website / CMS
  | 'launch_ab_test'
  | 'update_page_copy'
  | 'add_internal_link'
  // Content
  | 'generate_content_brief'
  | 'refresh_content'
  // Generic
  | 'manual_review_required';

export interface Action {
  action_id: string;
  opportunity_id?: string;
  organization_id: string;
  
  action_type: ActionType;
  platform: string;
  
  payload: Record<string, any>;
  executed_at: string;
  executed_by: string; // 'operator_ai' | 'user:email@example.com'
  
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  result?: Record<string, any>;
  error_message?: string;
  
  rollback_plan?: Record<string, any>;
  rolled_back_at?: string;
  
  measurement_checkpoints: string[]; // ISO timestamps
}
```

---

## 📱 LAYER 8: NOTIFICATIONS & ALERTS

### 8.1 CREATE: Slack Integration

**Webhook Configuration:**
```typescript
// /app/src/lib/slack.ts
export async function sendSlackNotification(message: SlackMessage) {
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
}
```

**Daily Scout Summary:**
```typescript
// Sent every morning at 9am local time
{
  "text": "🤖 Scout AI Daily Summary - Jan 25, 2026",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*23 opportunities detected* with estimated *$18.5K revenue impact* (7-day)"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Top Opportunity:*\nScale winner: Q1 Brand Campaign (+$4.2K)"},
        {"type": "mrkdwn", "text": "*Confidence:* 87%"}
      ]
    },
    {
      "type": "actions",
      "elements": [
        {"type": "button", "text": {"type": "plain_text", "text": "View All"}, "url": "https://app.opsos.io/ai/opportunities"}
      ]
    }
  ]
}
```

**High-Priority Alerts:**
```typescript
// Sent immediately for high-impact opportunities
- Revenue drops >20%
- Conversion rate drops >30%
- Paid spend with 0 conversions >$500
- SEO rank drops on top 10 keywords
```

---

### 8.2 CREATE: Email Digests

**Weekly Summary Email:**
- Sent every Monday 8am
- Top 10 opportunities from past week
- Actions executed and their results
- Key metric trends

---

## 🔐 LAYER 9: GUARDRAILS & SAFETY

### 9.1 CREATE: Guardrail Rules Engine

**File:** `/cloud-functions/marketing-operator-ai/guardrails.py`

```python
class Guardrails:
    """Safety checks before executing actions"""
    
    def check_budget_increase(self, campaign_id, current, new, cap):
        # Never increase by >20% in one day
        if (new - current) / current > 0.20:
            return False, "Exceeds 20% daily increase limit"
        
        # Never exceed cap
        if new > cap:
            return False, f"Exceeds cap of ${cap}"
        
        # Never increase if MER < threshold
        mer = self.get_campaign_mer(campaign_id)
        if mer < self.min_mer_threshold:
            return False, f"MER ({mer}) below threshold"
        
        return True, "OK"
    
    def check_pause_campaign(self, campaign_id):
        # Never pause brand campaigns
        if self.is_brand_campaign(campaign_id):
            return False, "Cannot auto-pause brand campaigns"
        
        # Only pause if 0 conversions after $X spend
        spend = self.get_campaign_spend_since_last_conversion(campaign_id)
        if spend < self.min_spend_before_pause:
            return False, f"Spend (${spend}) below pause threshold"
        
        return True, "OK"
```

**Hard Rules:**
- [ ] No budget increase >20% per day
- [ ] No brand campaign pauses
- [ ] No landing page changes without A/B test
- [ ] No spend without conversion tracking
- [ ] All actions must be reversible or have rollback plan

---

## 📊 LAYER 10: MONITORING & OBSERVABILITY

### 10.1 CREATE: System Health Dashboard

**New Page:** `/admin/marketing-ai-health`

**Metrics to Track:**
- [ ] ETL pipeline status (last run, duration, errors)
- [ ] Scout AI runs (success rate, opportunities detected per run)
- [ ] Operator AI actions (success rate, rollback rate)
- [ ] Data freshness (hours since last sync per source)
- [ ] Entity mapping coverage (% of events mapped)
- [ ] BigQuery costs (daily spend on queries)

---

### 10.2 CREATE: Performance Tracking

**Opportunity Success Rate:**
```sql
-- How accurate are Scout's predictions?
SELECT
  opportunity_type,
  AVG(CASE WHEN result.success THEN 1 ELSE 0 END) as success_rate,
  AVG(result.actual_uplift.revenue_7d / estimated_uplift.revenue_7d) as accuracy_ratio,
  COUNT(*) as total_opportunities
FROM marketing_ai.opportunities
WHERE status = 'completed'
GROUP BY opportunity_type
ORDER BY accuracy_ratio DESC;
```

**Action Execution Stats:**
```sql
-- Which actions succeed most often?
SELECT
  action_type,
  status,
  COUNT(*) as count,
  AVG(TIMESTAMP_DIFF(executed_at, created_at, SECOND)) as avg_execution_time_sec
FROM marketing_ai.actions_log
GROUP BY action_type, status;
```

---

## 📅 IMPLEMENTATION TIMELINE

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Build data infrastructure

- [x] Day 1-2: Create entity_map table + API + UI
- [ ] Day 3-4: Create events_all table + ETL pipeline
- [ ] Day 5-6: Create daily rollup tables
- [ ] Day 7-8: Create metric_registry + seeding
- [ ] Day 9-10: Backfill historical data (90 days)
- [ ] Day 11-12: Create opportunities + actions tables
- [ ] Day 13-14: Testing & validation

**Deliverables:**
- All 7 core BigQuery tables operational
- Entity mapping for top 100 pages/campaigns
- Daily rollups running automatically

---

### Phase 2: Enhanced Ingestion (Weeks 3-4)
**Goal:** Get missing data

- [ ] Day 1-3: Google Ads direct integration
- [ ] Day 4-5: ActiveCampaign event-level data
- [ ] Day 6-7: Stripe refunds & failed payments
- [ ] Day 8-10: Daily ETL pipeline (Cloud Run job)
- [ ] Day 11-14: Testing & validation

**Deliverables:**
- Google Ads impressions + search terms
- ActiveCampaign individual sends/opens/clicks
- Complete daily data pipeline

---

### Phase 3: Scout AI (Weeks 5-7)
**Goal:** Opportunity detection

- [ ] Week 5: Detectors (Preflight + Funnel + Paid Search)
- [ ] Week 6: Detectors (SEO + Email + Pages)
- [ ] Week 7: Detectors (Content + Social + Cross-channel)
- [ ] Day 1-2: Scoring & ranking engine
- [ ] Day 3-4: Daily Scout orchestrator
- [ ] Day 5-7: Testing with real data

**Deliverables:**
- 40+ opportunity detectors operational
- Daily Scout runs producing opportunities
- Slack notifications working

---

### Phase 4: API & UI (Weeks 8-9)
**Goal:** Surface opportunities to users

- [ ] Week 8: API routes (opportunities, actions, experiments)
- [ ] Week 9 Day 1-3: Opportunities dashboard UI
- [ ] Week 9 Day 4-5: Actions & experiments pages
- [ ] Week 9 Day 6-7: Enhance Marketing Insights pages

**Deliverables:**
- Full opportunities dashboard
- Users can approve/dismiss opportunities
- All Marketing Insights pages show Scout opportunities

---

### Phase 5: Operator AI (Weeks 10-11)
**Goal:** Automate safe actions

- [ ] Week 10: Platform connectors (Google Ads, ActiveCampaign)
- [ ] Week 11 Day 1-3: Operator orchestrator + guardrails
- [ ] Week 11 Day 4-5: Rollback logic
- [ ] Week 11 Day 6-7: Testing in sandbox mode

**Deliverables:**
- Operator AI executes 10+ safe action types
- All actions logged with rollback plans
- Guardrails prevent unsafe changes

---

### Phase 6: Polish & Launch (Week 12)
**Goal:** Production ready

- [ ] Day 1-2: Performance optimization
- [ ] Day 3-4: Error handling & monitoring
- [ ] Day 5-6: Documentation & training
- [ ] Day 7: Launch 🚀

**Deliverables:**
- System running in production
- Daily Scout + Operator AI active
- Monitoring dashboard operational

---

## 🎯 SUCCESS METRICS

### Week 4 (After Phase 2):
- ✅ 100% of events flowing into events_all
- ✅ Entity mapping coverage >80%
- ✅ Daily rollups refreshing automatically

### Week 8 (After Phase 3):
- ✅ Scout detecting 15-30 opportunities per day
- ✅ 10+ different opportunity types represented
- ✅ Opportunity accuracy >60% (measured on test data)

### Week 10 (After Phase 4):
- ✅ Users viewing opportunities in UI
- ✅ 5+ opportunities approved per week
- ✅ Time-series charts on all Marketing Insights pages

### Week 12 (Launch):
- ✅ Operator executing 3-5 safe actions per week
- ✅ 0 rollbacks due to errors (safety working)
- ✅ At least one measurable win (action → positive result)

### Month 3:
- ✅ Scout accuracy >75%
- ✅ 20+ actions executed with measurable impact
- ✅ $10K+ in identified revenue opportunities

---

## 🚨 CRITICAL PATH DEPENDENCIES

```
1. Entity Mapping → MUST complete before ANY cross-channel analysis
2. Daily Rollups → MUST complete before Scout AI
3. Scout AI → MUST complete before Operator AI
4. Opportunities Table → MUST complete before UI
5. Google Ads Direct → MUST complete before Paid Search detectors
```

---

## 💰 ESTIMATED RESOURCES

**Development Time:**
- Senior Full-Stack Engineer: 12 weeks full-time
- OR: 2 engineers × 6 weeks
- OR: 3 engineers × 4 weeks

**Infrastructure Costs (monthly):**
- BigQuery: ~$200-500 (query + storage)
- Cloud Functions/Run: ~$50-100
- Firestore: ~$50 (existing)
- External APIs: ~$200 (DataForSEO, etc.)
- **Total: ~$500-850/month**

**ROI Calculation:**
If Scout AI identifies just **$5K/month in revenue opportunities** with 50% success rate, that's **$2.5K/month** = **$30K/year** revenue lift.

**Break-even: Month 1**

---

## 📋 CHECKLIST SUMMARY

**Database (Layer 1):** 7 new tables
- [ ] entity_map
- [ ] events_all
- [ ] daily_entity_metrics
- [ ] daily_campaign_metrics
- [ ] daily_funnel_metrics
- [ ] metric_registry (seeded with 50+ metrics)
- [ ] opportunities
- [ ] actions_log
- [ ] experiments

**Data Ingestion (Layer 2):** 4 enhancements
- [ ] Google Ads direct integration
- [ ] ActiveCampaign event-level data
- [ ] Stripe refunds + failures
- [ ] Daily ETL pipeline

**Scout AI (Layer 3):** 40+ detectors
- [ ] Preflight (2)
- [ ] Funnel (3)
- [ ] Paid Search (8)
- [ ] SEO (5)
- [ ] Email (5)
- [ ] Pages (5)
- [ ] Content (5)
- [ ] Social (5)
- [ ] Cross-channel (4)
- [ ] Scoring & ranking engine

**Operator AI (Layer 4):** 10+ action types
- [ ] Google Ads connector
- [ ] ActiveCampaign connector
- [ ] Guardrails engine
- [ ] Rollback logic

**API Routes (Layer 5):** 15+ new routes
- [ ] Opportunities CRUD
- [ ] Actions CRUD
- [ ] Experiments CRUD
- [ ] Entity mapping CRUD
- [ ] Scout control

**Frontend (Layer 6):** 4 new pages
- [ ] /ai/opportunities
- [ ] /ai/actions
- [ ] /ai/experiments
- [ ] /sources/entity-map
- [ ] Enhance all Marketing Insights pages (7 pages)

**Agent Code (Layer 7):** Library enhancements
- [ ] Daily baseline calculations
- [ ] Impact estimation
- [ ] Cross-channel attribution
- [ ] Opportunity/Action type definitions

**Notifications (Layer 8):** 2 integrations
- [ ] Slack daily summary
- [ ] Email weekly digest

**Guardrails (Layer 9):** Safety system
- [ ] Guardrails engine
- [ ] Hard limits enforcement
- [ ] Rollback capabilities

**Monitoring (Layer 10):** Health dashboard
- [ ] System health page
- [ ] Performance tracking queries
- [ ] Cost monitoring

---

## 🎬 NEXT IMMEDIATE STEPS

1. **Create this implementation plan as a Markdown file in your repo**
2. **Choose starting point:** I recommend Phase 1, Day 1-2 (entity_map)
3. **Set up project tracking:** Create GitHub issues for each phase
4. **Assign resources:** Decide who's building what
5. **Schedule kickoff:** Review plan with team

**Would you like me to start building Phase 1, Day 1-2 (Entity Mapping) right now?**
