# Scout AI Implementation Plan
## Marketing Opportunity Detection System

**Goal:** Build a production-ready Scout AI that automatically detects 40+ types of marketing opportunities daily and surfaces them in the UI for human review and action.

**Scope:** Scout AI ONLY (no automated execution)
**Timeline:** 6 weeks (vs 12 weeks for full system)
**End State:**
- Daily AI checks run automatically at 4am UTC
- 40+ opportunity types detected across all channels
- Opportunities displayed in beautiful UI with impact scores
- Users review and manually act on recommendations
- Scout learns from what works (feedback loop)

---

## 🎯 WHAT SCOUT AI DOES

### Daily Morning Routine (Automated):
1. **4:00am UTC** - Wake up, check data freshness
2. **4:05am** - Analyze yesterday's performance vs baselines
3. **4:10am** - Run 40+ opportunity detectors across all channels
4. **4:15am** - Score and rank opportunities by impact
5. **4:20am** - Write to `opportunities` table in Firestore/BigQuery
6. **9:00am Local** - Send Slack summary: "23 opportunities detected, $18.5K potential impact"

### What Users See:
- `/ai/opportunities` dashboard with cards for each opportunity
- Evidence, hypothesis, recommended action clearly explained
- Impact estimate (revenue, conversions, timeline)
- Approve (mark as "will do") or Dismiss buttons
- Filter by channel, sort by impact/confidence

### What Users Do:
- Review top opportunities over morning coffee
- Click "approve" on ones they'll act on
- Manually execute in Google Ads, ActiveCampaign, etc.
- Mark as "completed" when done
- Scout tracks success rate and learns

---

## 📊 LAYER 1: DATABASE (Simplified for Scout Only)

### What We're Building:

**1.1 Entity Mapping Table** (CRITICAL)
```sql
CREATE TABLE opsos-864a1.marketing_ai.entity_map (
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,  -- page, campaign, keyword, product, email
  source STRING NOT NULL,        -- ga4, google_ads, dataforseo, stripe, activecampaign
  source_entity_id STRING NOT NULL,
  source_metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

**1.2 Daily Rollup Table** (Primary data source for Scout)
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
  search_volume INT64,
  
  -- Computed KPIs
  ctr FLOAT64,
  cpc FLOAT64,
  cpa FLOAT64,
  roas FLOAT64,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, entity_id, channel;
```

**1.3 Opportunities Table**
```sql
CREATE TABLE opsos-864a1.marketing_ai.opportunities (
  opportunity_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  detected_date DATE NOT NULL,
  
  type STRING NOT NULL,
  channel STRING NOT NULL,
  
  entity JSON,
  evidence JSON NOT NULL,
  hypothesis STRING NOT NULL,
  recommended_actions JSON NOT NULL,
  
  estimated_uplift JSON,
  confidence FLOAT64 NOT NULL,
  effort STRING NOT NULL,
  risk STRING NOT NULL,
  score FLOAT64 NOT NULL,
  
  status STRING DEFAULT 'new',  -- new, approved, dismissed, completed
  reviewed_by STRING,
  reviewed_at TIMESTAMP,
  completed_at TIMESTAMP,
  user_notes STRING,
  
  -- Learning feedback
  user_rating INT64,  -- 1-5 stars after completion
  actual_result STRING  -- User reports what happened
)
PARTITION BY detected_date
CLUSTER BY organization_id, type, status;
```

**1.4 Metric Registry Table**
```sql
CREATE TABLE opsos-864a1.marketing_ai.metric_registry (
  metric_id STRING NOT NULL,
  metric_name STRING NOT NULL,
  description STRING,
  category STRING,
  
  formula STRING NOT NULL,
  unit STRING,
  format STRING,
  
  benchmark_good FLOAT64,
  benchmark_excellent FLOAT64,
  inverse BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

### What We're NOT Building (Operator AI):
- ❌ Actions log table
- ❌ Experiments table
- ❌ Atomic events table (use existing Firestore data)
- ❌ Campaign/funnel rollup tables (use entity metrics only)

---

## 🔄 LAYER 2: DATA PIPELINE (Simplified)

### 2.1 Daily Rollup ETL (Cloud Function)

**File:** `/cloud-functions/daily-rollup-etl/main.py`

```python
def run_daily_rollup(request):
    """
    Runs daily at 3am UTC (1 hour before Scout)
    Aggregates Firestore data → BigQuery daily_entity_metrics
    """
    
    organization_id = "SBjucW1ztDyFYWBz7ZLE"
    yesterday = (datetime.now() - timedelta(days=1)).date()
    
    # Aggregate from existing Firestore collections
    aggregate_ga_data(organization_id, yesterday)
    aggregate_campaign_data(organization_id, yesterday)
    aggregate_dataforseo_data(organization_id, yesterday)
    aggregate_activecampaign_data(organization_id, yesterday)
    aggregate_stripe_data(organization_id, yesterday)
    
    # Write to BigQuery
    write_to_bigquery(daily_metrics)
    
    return {"status": "success", "rows_written": len(daily_metrics)}

def aggregate_ga_data(org_id, date):
    """Pull from ga_pages, ga_traffic_sources collections"""
    # Group by page/source
    # Sum pageviews, sessions, conversions
    # Calculate bounce_rate, conversion_rate
    
def aggregate_campaign_data(org_id, date):
    """Pull from ga_campaigns collection"""
    # Group by campaign
    # Sum cost, clicks, conversions, revenue
    # Calculate ROAS, CPA
    
# etc.
```

**What This Does:**
- Reads your existing Firestore data (which is already aggregated monthly)
- Extracts daily slices from the monthly data
- Writes to BigQuery for fast querying
- NO changes to existing ingestion (GA4, Stripe, etc.)

**Build Tasks:**
- [ ] Cloud Function deployment
- [ ] Cloud Scheduler trigger (daily 3am UTC)
- [ ] Backfill script (last 90 days)
- [ ] Test with real data

---

### 2.2 Entity Mapping Seeding

**Manual One-Time Setup:**

```sql
-- Seed top pages
INSERT INTO entity_map VALUES
('page_home', 'page', 'ga4', '/', '{"title": "Home"}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
('page_pricing', 'page', 'ga4', '/pricing', '{"title": "Pricing"}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
('page_signup', 'page', 'ga4', '/signup', '{"title": "Sign Up"}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

-- Seed campaigns
INSERT INTO entity_map VALUES
('campaign_q1_brand', 'campaign', 'ga4', 'Q1 Brand Campaign', '{}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
('campaign_q1_brand', 'campaign', 'google_ads', '12345678', '{}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

-- Seed products
INSERT INTO entity_map VALUES
('product_pro', 'product', 'stripe', 'prod_ABC123', '{"name": "Pro Plan"}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

-- Seed keywords (DataForSEO)
INSERT INTO entity_map VALUES
('keyword_best_crm', 'keyword', 'dataforseo', 'best crm for saas', '{}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
```

**Build Tasks:**
- [ ] Seed top 50 pages
- [ ] Seed top 20 campaigns
- [ ] Seed top 10 products
- [ ] Seed top 50 keywords
- [ ] Admin UI to add/edit mappings (`/sources/entity-map`)

---

### 2.3 Metric Registry Seeding

**Seed 50 Core Metrics:**

```sql
INSERT INTO metric_registry VALUES
-- Traffic
('m_impressions', 'Impressions', 'Number of times shown', 'traffic', 
 'SUM(impressions)', 'count', '0,0', NULL, NULL, false, CURRENT_TIMESTAMP()),

('m_clicks', 'Clicks', 'Number of clicks', 'traffic',
 'SUM(clicks)', 'count', '0,0', NULL, NULL, false, CURRENT_TIMESTAMP()),

('m_ctr', 'Click-Through Rate', 'Clicks divided by impressions', 'traffic',
 'SUM(clicks) / NULLIF(SUM(impressions), 0)', 'percent', '0.00%', 0.02, 0.05, false, CURRENT_TIMESTAMP()),

-- Conversion
('m_conversions', 'Conversions', 'Number of conversions', 'conversion',
 'SUM(conversions)', 'count', '0,0', NULL, NULL, false, CURRENT_TIMESTAMP()),

('m_cvr', 'Conversion Rate', 'Conversions divided by sessions', 'conversion',
 'SUM(conversions) / NULLIF(SUM(sessions), 0)', 'percent', '0.00%', 0.02, 0.05, false, CURRENT_TIMESTAMP()),

-- Financial
('m_revenue', 'Revenue', 'Total revenue', 'financial',
 'SUM(revenue)', 'dollar', '$0,0.00', NULL, NULL, false, CURRENT_TIMESTAMP()),

('m_cost', 'Cost', 'Total cost', 'financial',
 'SUM(cost)', 'dollar', '$0,0.00', NULL, NULL, true, CURRENT_TIMESTAMP()),

('m_roas', 'Return on Ad Spend', 'Revenue divided by cost', 'financial',
 'SUM(revenue) / NULLIF(SUM(cost), 0)', 'ratio', '0.00x', 2, 5, false, CURRENT_TIMESTAMP()),

('m_cpa', 'Cost Per Acquisition', 'Cost per conversion', 'financial',
 'SUM(cost) / NULLIF(SUM(conversions), 0)', 'dollar', '$0,0.00', 100, 50, true, CURRENT_TIMESTAMP()),

-- Email
('m_email_open_rate', 'Email Open Rate', 'Opens divided by sends', 'email',
 'SUM(emails_opened) / NULLIF(SUM(emails_sent), 0)', 'percent', '0.00%', 0.20, 0.30, false, CURRENT_TIMESTAMP()),

('m_email_click_rate', 'Email Click Rate', 'Clicks divided by sends', 'email',
 'SUM(emails_clicked) / NULLIF(SUM(emails_sent), 0)', 'percent', '0.00%', 0.03, 0.05, false, CURRENT_TIMESTAMP());

-- Continue for all 50 metrics...
```

**Build Tasks:**
- [ ] SQL script with 50+ metrics
- [ ] API route to fetch metrics by category
- [ ] Metric evaluation function

---

## 🤖 LAYER 3: SCOUT AI ENGINE

### 3.1 Scout Orchestrator

**File:** `/cloud-functions/marketing-scout-ai/main.py`

```python
import logging
from datetime import datetime, timedelta
from detectors import (
    preflight, funnel, paid_search, seo, 
    email, pages, content, social, cross_channel
)
from scoring import calculate_score, rank_opportunities
from google.cloud import bigquery, firestore
import requests

logger = logging.getLogger(__name__)

def run_scout_ai(request):
    """
    Main Scout AI entrypoint
    Triggered daily at 4am UTC by Cloud Scheduler
    """
    
    organization_id = "SBjucW1ztDyFYWBz7ZLE"
    today = datetime.now().date()
    
    logger.info(f"🔍 Scout AI starting for {organization_id} on {today}")
    
    # Step 1: Preflight checks
    data_health = preflight.check_data_health(organization_id)
    mapping_health = preflight.check_mapping_health(organization_id)
    
    if not data_health['all_sources_fresh']:
        logger.warning("⚠️ Some data sources are stale")
        # Still continue, but flag in output
    
    # Step 2: Run all detectors
    all_opportunities = []
    
    # Funnel & Revenue (3 detectors)
    all_opportunities.extend(funnel.detect_revenue_anomalies(organization_id))
    all_opportunities.extend(funnel.detect_conversion_drops(organization_id))
    all_opportunities.extend(funnel.detect_channel_mix_shifts(organization_id))
    
    # Paid Search (8 detectors)
    all_opportunities.extend(paid_search.detect_scale_winners(organization_id))
    all_opportunities.extend(paid_search.detect_waste(organization_id))
    all_opportunities.extend(paid_search.detect_query_mining(organization_id))
    all_opportunities.extend(paid_search.detect_creative_fatigue(organization_id))
    all_opportunities.extend(paid_search.detect_brand_defense(organization_id))
    all_opportunities.extend(paid_search.detect_landing_mismatch(organization_id))
    all_opportunities.extend(paid_search.detect_cpa_spikes(organization_id))
    all_opportunities.extend(paid_search.detect_impression_loss(organization_id))
    
    # SEO (5 detectors)
    all_opportunities.extend(seo.detect_striking_distance(organization_id))
    all_opportunities.extend(seo.detect_rank_drops(organization_id))
    all_opportunities.extend(seo.detect_ctr_opportunities(organization_id))
    all_opportunities.extend(seo.detect_content_expansion(organization_id))
    all_opportunities.extend(seo.detect_content_decay(organization_id))
    
    # Email (5 detectors)
    all_opportunities.extend(email.detect_scale_winners(organization_id))
    all_opportunities.extend(email.detect_open_drops(organization_id))
    all_opportunities.extend(email.detect_click_leaks(organization_id))
    all_opportunities.extend(email.detect_landing_mismatch(organization_id))
    all_opportunities.extend(email.detect_lifecycle_gaps(organization_id))
    
    # Pages (5 detectors)
    all_opportunities.extend(pages.detect_cvr_opportunities(organization_id))
    all_opportunities.extend(pages.detect_funnel_dropoffs(organization_id))
    all_opportunities.extend(pages.detect_paid_mismatch(organization_id))
    all_opportunities.extend(pages.detect_email_mismatch(organization_id))
    all_opportunities.extend(pages.detect_engagement_decay(organization_id))
    
    # Content (5 detectors)
    all_opportunities.extend(content.detect_scale_winners(organization_id))
    all_opportunities.extend(content.detect_conversion_gaps(organization_id))
    all_opportunities.extend(content.detect_decay(organization_id))
    all_opportunities.extend(content.detect_striking_distance(organization_id))
    all_opportunities.extend(content.detect_gaps_from_demand(organization_id))
    
    # Social (5 detectors)
    all_opportunities.extend(social.detect_engagement_unleveraged(organization_id))
    all_opportunities.extend(social.detect_page_mismatch(organization_id))
    all_opportunities.extend(social.detect_topic_signals(organization_id))
    all_opportunities.extend(social.detect_distribution_decay(organization_id))
    all_opportunities.extend(social.detect_social_proof(organization_id))
    
    # Cross-channel (4 detectors)
    all_opportunities.extend(cross_channel.detect_email_support_gaps(organization_id))
    all_opportunities.extend(cross_channel.detect_paid_support_gaps(organization_id))
    all_opportunities.extend(cross_channel.detect_landing_routing(organization_id))
    all_opportunities.extend(cross_channel.detect_message_alignment(organization_id))
    
    logger.info(f"✅ Detected {len(all_opportunities)} raw opportunities")
    
    # Step 3: Score and rank
    for opp in all_opportunities:
        opp['score'] = calculate_score(opp)
    
    ranked_opportunities = rank_opportunities(all_opportunities)
    
    # Step 4: Write to database
    write_opportunities_to_firestore(organization_id, ranked_opportunities)
    write_opportunities_to_bigquery(organization_id, ranked_opportunities)
    
    # Step 5: Create daily summary
    summary = create_daily_summary(organization_id, ranked_opportunities, data_health)
    
    # Step 6: Send notifications
    send_slack_notification(summary)
    
    logger.info(f"🎉 Scout AI completed. {len(ranked_opportunities)} opportunities ranked.")
    
    return {
        "status": "success",
        "opportunities_detected": len(ranked_opportunities),
        "total_estimated_impact_7d": sum(o.get('estimated_uplift', {}).get('revenue_7d', 0) for o in ranked_opportunities),
        "data_health": data_health
    }
```

---

### 3.2 Example Detector Implementation

**File:** `/cloud-functions/marketing-scout-ai/detectors/paid_search.py`

```python
from google.cloud import bigquery
from datetime import datetime, timedelta

def detect_scale_winners(organization_id):
    """
    Detector: Paid Search - Scale Winners
    
    Finds campaigns with ROAS above baseline that are stable
    and recommend budget increases.
    """
    
    client = bigquery.Client()
    yesterday = (datetime.now() - timedelta(days=1)).date()
    
    # Query last 7 days + 28 day baseline
    query = f"""
    WITH last_7d AS (
      SELECT
        entity_id,
        SUM(cost) as cost_7d,
        SUM(revenue) as revenue_7d,
        SUM(conversions) as conversions_7d,
        SUM(revenue) / NULLIF(SUM(cost), 0) as roas_7d
      FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
      WHERE organization_id = '{organization_id}'
        AND channel = 'paid_search'
        AND date BETWEEN DATE_SUB('{yesterday}', INTERVAL 7 DAY) AND '{yesterday}'
      GROUP BY entity_id
    ),
    baseline_28d AS (
      SELECT
        entity_id,
        SUM(revenue) / NULLIF(SUM(cost), 0) as roas_28d
      FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
      WHERE organization_id = '{organization_id}'
        AND channel = 'paid_search'
        AND date BETWEEN DATE_SUB('{yesterday}', INTERVAL 35 DAY) AND DATE_SUB('{yesterday}', INTERVAL 8 DAY)
      GROUP BY entity_id
    )
    SELECT
      l.entity_id,
      l.cost_7d,
      l.revenue_7d,
      l.roas_7d,
      b.roas_28d,
      (l.roas_7d - b.roas_28d) / b.roas_28d * 100 as roas_improvement_pct
    FROM last_7d l
    JOIN baseline_28d b ON l.entity_id = b.entity_id
    WHERE l.roas_7d > b.roas_28d * 1.2  -- 20% better than baseline
      AND l.cost_7d >= 100  -- Minimum spend threshold
      AND l.conversions_7d >= 3  -- Minimum conversions
    ORDER BY (l.roas_7d - b.roas_28d) * l.revenue_7d DESC
    LIMIT 10;
    """
    
    results = client.query(query).result()
    
    opportunities = []
    for row in results:
        # Get entity name from entity_map
        entity_name = get_entity_name(row.entity_id)
        
        opportunity = {
            "opportunity_id": f"opp_{organization_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{row.entity_id}",
            "organization_id": organization_id,
            "created_at": datetime.now().isoformat(),
            "detected_date": yesterday.isoformat(),
            
            "type": "paid_scale_winner",
            "channel": "paid_search",
            
            "entity": {
                "entity_type": "campaign",
                "entity_id": row.entity_id,
                "name": entity_name
            },
            
            "evidence": {
                "window_days": 7,
                "metrics": {
                    "cost_7d": float(row.cost_7d),
                    "revenue_7d": float(row.revenue_7d),
                    "roas_7d": float(row.roas_7d)
                },
                "delta": {
                    "roas_improvement_pct": float(row.roas_improvement_pct)
                },
                "comparison": {
                    "baseline_28d": float(row.roas_28d)
                }
            },
            
            "hypothesis": f"Campaign '{entity_name}' is outperforming baseline by {row.roas_improvement_pct:.0f}%. Additional budget will likely maintain ROAS and scale revenue.",
            
            "recommended_actions": [
                {
                    "action_type": "increase_budget",
                    "platform": "google_ads",
                    "params": {
                        "pct_increase": 20,
                        "max_daily_budget": float(row.cost_7d / 7 * 1.5)  # 1.5x current daily
                    },
                    "manual_steps": [
                        f"1. Go to Google Ads → Campaigns",
                        f"2. Find campaign: {entity_name}",
                        f"3. Increase daily budget by 20%",
                        f"4. Monitor ROAS daily for next 7 days"
                    ]
                }
            ],
            
            "estimated_uplift": {
                "revenue_7d": float(row.revenue_7d * 0.20),  # 20% budget increase = ~20% revenue increase
                "conversions_7d": int(row.conversions_7d * 0.20)
            },
            
            "confidence": 0.78,  # Based on data stability + sample size
            "effort": "low",
            "risk": "low",
            "score": 0  # Will be calculated by scoring engine
        }
        
        opportunities.append(opportunity)
    
    return opportunities

def get_entity_name(entity_id):
    """Lookup entity name from entity_map"""
    # Query entity_map for display name
    # Return entity_id if not found
    return entity_id  # Simplified
```

**Build Tasks for Each Detector:**
- [ ] Write SQL query for baseline comparison
- [ ] Define thresholds (what triggers this opportunity?)
- [ ] Calculate confidence based on data quality
- [ ] Estimate impact (revenue/conversion uplift)
- [ ] Write clear hypothesis and manual steps
- [ ] Unit test with sample data

---

### 3.3 Scoring Engine

**File:** `/cloud-functions/marketing-scout-ai/scoring.py`

```python
def calculate_score(opportunity):
    """
    Score = (Impact * Confidence * Risk) / Effort
    
    Returns a number 0-1000+ where higher = more important
    """
    
    # Impact (revenue estimate in dollars)
    impact = opportunity.get('estimated_uplift', {}).get('revenue_7d', 0)
    
    # Confidence (0-1)
    confidence = opportunity.get('confidence', 0.5)
    
    # Effort weight
    effort_map = {'low': 1, 'medium': 2, 'high': 3}
    effort = effort_map[opportunity.get('effort', 'medium')]
    
    # Risk penalty
    risk_map = {'low': 1.0, 'medium': 0.7, 'high': 0.4}
    risk = risk_map[opportunity.get('risk', 'medium')]
    
    # Calculate
    score = (impact * confidence * risk) / effort
    
    return round(score, 2)

def rank_opportunities(opportunities):
    """Sort by score descending"""
    return sorted(opportunities, key=lambda x: x['score'], reverse=True)
```

---

## 🔌 LAYER 4: API ROUTES

### 4.1 Opportunities API

**New Routes to Build:**

```typescript
// GET /api/opportunities - List all opportunities
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const channel = searchParams.get("channel"); // optional filter
  const status = searchParams.get("status"); // optional filter
  
  // Query Firestore opportunities collection
  let q = query(
    collection(db, "opportunities"),
    where("organization_id", "==", organizationId),
    orderBy("score", "desc")
  );
  
  if (channel) {
    q = query(q, where("channel", "==", channel));
  }
  
  if (status) {
    q = query(q, where("status", "==", status));
  }
  
  const snapshot = await getDocs(q);
  const opportunities = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  return NextResponse.json({ opportunities });
}

// POST /api/opportunities/:id/approve
export async function POST(request: NextRequest) {
  const opportunityId = request.nextUrl.pathname.split('/')[3];
  const { userId } = await request.json();
  
  await updateDoc(doc(db, "opportunities", opportunityId), {
    status: "approved",
    reviewed_by: userId,
    reviewed_at: Timestamp.now()
  });
  
  return NextResponse.json({ success: true });
}

// POST /api/opportunities/:id/dismiss
// POST /api/opportunities/:id/complete
// GET /api/opportunities/daily-summary
```

**Build Tasks:**
- [ ] 6 API route files
- [ ] Query Firestore with filters
- [ ] Status update endpoints
- [ ] Daily summary endpoint

---

### 4.2 Scout Control API

```typescript
// POST /api/scout/run - Manual trigger
export async function POST(request: NextRequest) {
  const { organizationId } = await request.json();
  
  // Trigger Cloud Function
  const response = await fetch(
    'https://us-central1-opsos-864a1.cloudfunctions.net/marketing-scout-ai',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId })
    }
  );
  
  const result = await response.json();
  
  return NextResponse.json(result);
}

// GET /api/scout/status
// GET /api/scout/history
```

---

## 🎨 LAYER 5: FRONTEND UI

### 5.1 Opportunities Dashboard

**New Page:** `/app/src/app/ai/opportunities/page.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { TrendingUp, Filter, RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface Opportunity {
  id: string;
  type: string;
  channel: string;
  entity: { entity_type: string; entity_id: string; name: string };
  hypothesis: string;
  estimated_uplift: { revenue_7d: number; conversions_7d: number };
  confidence: number;
  effort: string;
  risk: string;
  score: number;
  status: string;
  created_at: string;
}

export default function OpportunitiesPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ channel: "all", status: "new" });
  
  useEffect(() => {
    if (currentOrg) {
      fetchOpportunities();
    }
  }, [currentOrg, filter]);
  
  const fetchOpportunities = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      organizationId: currentOrg!.id,
      ...(filter.channel !== "all" && { channel: filter.channel }),
      ...(filter.status !== "all" && { status: filter.status })
    });
    
    const response = await fetch(`/api/opportunities?${params}`);
    const data = await response.json();
    setOpportunities(data.opportunities);
    setLoading(false);
  };
  
  const handleApprove = async (opportunityId: string) => {
    await fetch(`/api/opportunities/${opportunityId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "current_user_id" })
    });
    fetchOpportunities();
  };
  
  const handleDismiss = async (opportunityId: string) => {
    await fetch(`/api/opportunities/${opportunityId}/dismiss`, {
      method: "POST"
    });
    fetchOpportunities();
  };
  
  return (
    <AppLayout title="Opportunities" subtitle="AI-detected growth opportunities">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Opportunities</p>
                <p className="text-3xl font-bold">{opportunities.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          
          <Card>
            <p className="text-sm text-gray-600">Estimated Impact (7d)</p>
            <p className="text-3xl font-bold text-green-600">
              ${opportunities.reduce((sum, o) => sum + (o.estimated_uplift?.revenue_7d || 0), 0).toLocaleString()}
            </p>
          </Card>
          
          <Card>
            <p className="text-sm text-gray-600">Avg Confidence</p>
            <p className="text-3xl font-bold">
              {(opportunities.reduce((sum, o) => sum + o.confidence, 0) / opportunities.length * 100).toFixed(0)}%
            </p>
          </Card>
          
          <Card>
            <p className="text-sm text-gray-600">Approved Today</p>
            <p className="text-3xl font-bold">
              {opportunities.filter(o => o.status === 'approved').length}
            </p>
          </Card>
        </div>
        
        {/* Filters */}
        <Card>
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5" />
            <select 
              value={filter.channel}
              onChange={(e) => setFilter({...filter, channel: e.target.value})}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Channels</option>
              <option value="paid_search">Paid Search</option>
              <option value="seo">SEO</option>
              <option value="email">Email</option>
              <option value="pages">Pages</option>
              <option value="content">Content</option>
              <option value="social">Social</option>
            </select>
            
            <select
              value={filter.status}
              onChange={(e) => setFilter({...filter, status: e.target.value})}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="dismissed">Dismissed</option>
            </select>
            
            <button onClick={fetchOpportunities} className="ml-auto px-4 py-2 bg-blue-500 text-white rounded">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </Card>
        
        {/* Opportunities List */}
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <Card key={opp.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Channel Badge */}
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {opp.channel}
                  </span>
                  
                  {/* Entity */}
                  <h3 className="text-lg font-semibold mt-2">
                    {opp.entity.name || opp.entity.entity_id}
                  </h3>
                  
                  {/* Hypothesis */}
                  <p className="text-gray-700 mt-2">{opp.hypothesis}</p>
                  
                  {/* Evidence */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-600">Estimated Impact</p>
                      <p className="text-xl font-bold text-green-600">
                        +${opp.estimated_uplift?.revenue_7d?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-gray-500">7-day revenue</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Confidence</p>
                      <p className="text-xl font-bold">
                        {(opp.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Effort</p>
                      <span className={`px-2 py-1 rounded text-xs ${
                        opp.effort === 'low' ? 'bg-green-100 text-green-700' :
                        opp.effort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {opp.effort}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                {opp.status === 'new' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(opp.id)}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleDismiss(opp.id)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
```

**Build Tasks:**
- [ ] Opportunities page with filters
- [ ] Opportunity card component
- [ ] Detail modal with full evidence
- [ ] Approve/dismiss buttons
- [ ] Status indicators
- [ ] Add link to Sidebar

---

### 5.2 Enhance Marketing Insights Pages

**Add to ALL 6 Marketing Insights pages:**

```typescript
// Add this section to seo/page.tsx, email/page.tsx, ads/page.tsx, etc.

{/* Scout AI Opportunities Section */}
{opportunities.length > 0 && (
  <Card>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        AI Opportunities ({opportunities.length})
      </h2>
      <Link href={`/ai/opportunities?channel=${channel}`} className="text-blue-500 text-sm">
        View All →
      </Link>
    </div>
    
    <div className="space-y-3">
      {opportunities.slice(0, 3).map(opp => (
        <div key={opp.id} className="p-3 bg-blue-50 rounded">
          <p className="font-medium">{opp.hypothesis}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-600">
              +${opp.estimated_uplift.revenue_7d?.toLocaleString()} potential
            </span>
            <button
              onClick={() => handleApprove(opp.id)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              Review
            </button>
          </div>
        </div>
      ))}
    </div>
  </Card>
)}
```

**Build Tasks:**
- [ ] Fetch opportunities by channel
- [ ] Display top 3 on each page
- [ ] Quick action buttons
- [ ] Link to full opportunities page

---

## 📱 LAYER 6: NOTIFICATIONS

### 6.1 Slack Integration

**File:** `/cloud-functions/marketing-scout-ai/notifications.py`

```python
import requests
import os

def send_slack_notification(summary):
    """
    Send daily summary to Slack
    Triggered after Scout completes at 4:20am
    """
    
    webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
    
    top_3 = summary['top_opportunities'][:3]
    
    message = {
        "text": f"🤖 Scout AI Daily Summary - {summary['date']}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{summary['total_opportunities']} opportunities detected* with estimated *${summary['estimated_impact_7d']:,} revenue impact* (7-day)"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Top Opportunities:*"
                }
            }
        ]
    }
    
    # Add top 3 opportunities
    for i, opp in enumerate(top_3, 1):
        message["blocks"].append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{i}. *{opp['entity']['name']}* ({opp['channel']})\n{opp['hypothesis']}\n💰 +${opp['estimated_uplift']['revenue_7d']:,} | 📊 {opp['confidence']*100:.0f}% confidence"
            }
        })
    
    # Add action button
    message["blocks"].append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "View All Opportunities"
                },
                "url": "https://app.opsos.io/ai/opportunities",
                "style": "primary"
            }
        ]
    })
    
    response = requests.post(webhook_url, json=message)
    return response.status_code == 200
```

**Build Tasks:**
- [ ] Set up Slack webhook
- [ ] Daily summary format
- [ ] High-priority alert format (revenue drops >20%, etc.)
- [ ] Test notifications

---

## 📅 IMPLEMENTATION TIMELINE (6 Weeks)

### Week 1: Foundation
**Goal:** Database infrastructure

- **Day 1-2:** Create BigQuery tables (entity_map, daily_entity_metrics, opportunities, metric_registry)
- **Day 3:** Seed entity_map with top 50 pages, 20 campaigns, 10 products, 50 keywords
- **Day 4:** Seed metric_registry with 50 core metrics
- **Day 5:** Build daily rollup ETL Cloud Function
- **Day 6:** Backfill 90 days of daily metrics
- **Day 7:** Test & validate data pipeline

**Deliverables:**
- ✅ All 4 BigQuery tables created
- ✅ Entity mapping for top entities
- ✅ 90 days of daily rollups
- ✅ ETL running on schedule

---

### Week 2: Scout Detectors (Funnel + Paid + SEO)
**Goal:** Build first 16 detectors

- **Day 1:** Scout orchestrator framework
- **Day 2:** Preflight + Funnel detectors (5 total)
- **Day 3-4:** Paid Search detectors (8 total)
- **Day 5-6:** SEO detectors (5 total)
- **Day 7:** Scoring engine + testing

**Deliverables:**
- ✅ 16 detectors operational
- ✅ Opportunities written to Firestore
- ✅ Scout runs manually

---

### Week 3: Scout Detectors (Email + Pages + Content)
**Goal:** Build next 15 detectors

- **Day 1-2:** Email detectors (5 total)
- **Day 3-4:** Pages detectors (5 total)
- **Day 5-6:** Content detectors (5 total)
- **Day 7:** Testing with real data

**Deliverables:**
- ✅ 31 detectors operational
- ✅ All channels covered

---

### Week 4: Scout Detectors (Social + Cross-Channel)
**Goal:** Complete all 40 detectors

- **Day 1-2:** Social detectors (5 total)
- **Day 3-4:** Cross-channel detectors (4 total)
- **Day 5:** Daily scheduling setup (Cloud Scheduler)
- **Day 6:** Slack notifications
- **Day 7:** End-to-end testing

**Deliverables:**
- ✅ 40 detectors operational
- ✅ Scout runs automatically daily 4am UTC
- ✅ Slack summaries working

---

### Week 5: API Routes
**Goal:** Backend for UI

- **Day 1-2:** Opportunities API (list, get, approve, dismiss, complete)
- **Day 3:** Scout control API (run, status, history)
- **Day 4:** Daily summary API
- **Day 5:** Entity map API (for admin UI)
- **Day 6-7:** Testing & documentation

**Deliverables:**
- ✅ 10 API endpoints working
- ✅ All CRUD operations for opportunities
- ✅ API documentation

---

### Week 6: Frontend UI
**Goal:** User interface

- **Day 1-2:** Opportunities dashboard page (`/ai/opportunities`)
- **Day 3:** Opportunity detail modal
- **Day 4:** Enhance Marketing Insights pages (add opportunities section)
- **Day 5:** Scout status widget in sidebar
- **Day 6:** Entity mapping admin page (`/sources/entity-map`)
- **Day 7:** Polish, testing, launch 🚀

**Deliverables:**
- ✅ Beautiful opportunities UI
- ✅ Users can approve/dismiss opportunities
- ✅ All Marketing Insights pages enhanced
- ✅ Production ready

---

## 🎯 SUCCESS METRICS

### Week 2 Checkpoint:
- ✅ 16 detectors running
- ✅ Scout detects 5-10 opportunities per run
- ✅ Data pipeline stable

### Week 4 Checkpoint:
- ✅ 40 detectors running
- ✅ Scout detects 15-25 opportunities daily
- ✅ Slack notifications working
- ✅ Opportunities stored correctly

### Week 6 Launch:
- ✅ UI live in production
- ✅ Users reviewing opportunities
- ✅ Scout runs automatically
- ✅ At least 1 opportunity approved and actioned

### Month 2:
- ✅ Scout accuracy >70% (opportunities that work when actioned)
- ✅ 50+ opportunities actioned
- ✅ $5K+ identified revenue opportunities

---

## 💰 COSTS

**Development:** 6 weeks full-time engineer

**Infrastructure (monthly):**
- BigQuery: ~$100-200 (daily queries + storage)
- Cloud Functions: ~$30-50 (daily Scout runs)
- Firestore: ~$50 (existing)
- **Total: ~$180-300/month**

**ROI:**
If Scout identifies just **$3K/month** in opportunities with 50% success rate = **$1.5K/month** = **$18K/year** revenue lift.

**Break-even: Month 1**

---

## 📋 BUILD CHECKLIST

### Database (Week 1)
- [ ] entity_map table
- [ ] daily_entity_metrics table
- [ ] opportunities table
- [ ] metric_registry table (seeded)
- [ ] Daily ETL Cloud Function
- [ ] Backfill 90 days

### Scout AI (Weeks 2-4)
- [ ] Orchestrator framework
- [ ] Preflight (2 detectors)
- [ ] Funnel (3 detectors)
- [ ] Paid Search (8 detectors)
- [ ] SEO (5 detectors)
- [ ] Email (5 detectors)
- [ ] Pages (5 detectors)
- [ ] Content (5 detectors)
- [ ] Social (5 detectors)
- [ ] Cross-channel (4 detectors)
- [ ] Scoring engine
- [ ] Cloud Scheduler setup
- [ ] Slack notifications

### API Routes (Week 5)
- [ ] GET /api/opportunities
- [ ] POST /api/opportunities/:id/approve
- [ ] POST /api/opportunities/:id/dismiss
- [ ] POST /api/opportunities/:id/complete
- [ ] GET /api/opportunities/daily-summary
- [ ] POST /api/scout/run
- [ ] GET /api/scout/status
- [ ] GET /api/scout/history
- [ ] GET /api/entity-map
- [ ] POST /api/entity-map

### Frontend (Week 6)
- [ ] /ai/opportunities page
- [ ] Opportunity card component
- [ ] Detail modal
- [ ] Approve/dismiss buttons
- [ ] Filters (channel, status)
- [ ] Add to all Marketing Insights pages
- [ ] Scout status widget in sidebar
- [ ] /sources/entity-map admin page

### Testing & Launch
- [ ] End-to-end test with real data
- [ ] Error handling & edge cases
- [ ] Performance optimization
- [ ] Documentation
- [ ] Production deployment
- [ ] User training

---

## 🚀 NEXT STEPS

**Ready to start Week 1, Day 1?** I can begin building:

1. **BigQuery table schemas**
2. **Entity mapping seed data**
3. **Daily rollup ETL Cloud Function**

Just say "let's start" and I'll begin implementing! 🎯
