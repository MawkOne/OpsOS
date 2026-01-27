# Marketing AI Agent: Implementation Plan

**Project:** OpsOS Marketing Intelligence Agent  
**Date:** January 22, 2026  
**Status:** Planning → Implementation

---

## 🧠 **First Thesis: How to Make a Marketing AI**

### **The Core Insight**

Most marketing "AI" tools are just dashboards with fancy charts. They show you **what happened** but don't tell you **why** or **what to do**.

**Our thesis:** A true Marketing AI should operate like a CMO who:
1. **Understands the full context** (product, users, market, competition)
2. **Identifies cause-and-effect relationships** (what actually drives outcomes)
3. **Prioritizes actionable insights** (focus on what you can control)
4. **Recommends specific tactics** (not vague advice like "improve SEO")
5. **Learns from outcomes** (tracks what worked and adjusts strategy)

### **Why This Matters for OpsOS**

You already have the **complete data ecosystem**:
- ✅ **GA4 Events:** 80+ tracked user actions (product usage, conversions, engagement)
- ✅ **Traffic Sources:** Where users come from (organic, paid, social, referral)
- ✅ **ActiveCampaign:** Email campaigns, contacts, automations, deals
- ✅ **DataForSEO:** SEO rankings and keyword data
- ✅ **Internal Context:** Initiatives, forecasts, priorities, people

**The problem:** All this data is disconnected. You can't easily answer:
- "Why did signups drop 20% last month?"
- "Which traffic source drives the highest-quality users?"
- "If I improve SEO rankings for keyword X, how many signups will that generate?"
- "What's the ROI of our email campaigns?"

**The solution:** An AI agent that connects all these data sources and reasons about causation, not just correlation.

---

## 🎯 **The Agent's Capabilities (6-Part Framework)**

### **1. Event Discovery & Classification**
**What it does:** Understands what events exist and categorizes them by business value.

**Data Source:** `ga_events_raw_latest` (80+ events)

**Classification Schema:**
```
🟢 ACQUISITION (Top of funnel)
   - page_view, first_visit, session_start
   - Traffic source: organic_search, paid_search, social, referral

🔵 ACTIVATION (Conversion events)
   - form_start, form_submit
   - company-signup, ads_conversion_Sign_Up
   - channel-verified

🟡 ENGAGEMENT (Product usage)
   - button-clicked, feed-scrolled
   - accessibility-shortcut-* (feature usage)
   - notification-seen, message-modal-shown

🟠 MONETIZATION (Revenue events)
   - add_to_cart, begin_checkout, purchase
   - paywall-* (friction points)

🔴 RETENTION (Continued usage)
   - Recurring page_views, feature re-use
   - Email opens/clicks from ActiveCampaign
```

**Output Example:**
```
We track 80 marketing events across 5 categories:
- 12 acquisition events (traffic generation)
- 8 activation events (signups & conversions)
- 45 engagement events (product usage)
- 7 monetization events (revenue generation)
- 8 retention events (user comeback)
```

---

### **2. KPI Hierarchy & Funnel Mapping**
**What it does:** Determines what matters most and builds the conversion funnel.

**Data Sources:**
- `ga_events_raw_latest` (event volumes)
- `ga_traffic_sources_raw_latest` (traffic data)
- `activecampaign_deals_raw_latest` (revenue)

**Funnel Construction:**
```
Stage 1: AWARENESS
├─ Traffic Sources (10 sources tracked)
├─ page_view events (track volume)
└─ first_visit events (new vs returning)

Stage 2: INTEREST
├─ Product page views (specific pages)
├─ feed-scrolled (engagement depth)
└─ feature interactions (interest signals)

Stage 3: CONSIDERATION
├─ form_start (intent to convert)
├─ Pricing page views (buying research)
└─ paywall-* events (friction points)

Stage 4: CONVERSION
├─ company-signup (primary KPI)
├─ ads_conversion_Sign_Up (paid)
└─ channel-verified (activation milestone)

Stage 5: MONETIZATION
├─ add_to_cart (purchase intent)
├─ begin_checkout (payment flow)
└─ purchase (revenue event)

Stage 6: RETENTION
├─ Email campaigns (ActiveCampaign)
├─ Notification engagement
└─ Recurring feature usage
```

**Conversion Rate Tracking:**
```sql
-- Calculate funnel drop-off rates
Awareness → Interest: X% conversion
Interest → Consideration: Y% conversion
Consideration → Conversion: Z% conversion
Conversion → Monetization: W% conversion
```

**Output Example:**
```
Primary KPI: Company Signups
Current: 120/month (Target: 150/month, -20%)

Funnel Performance:
1. Awareness → Interest: 15% (Industry: 10-20%) ✅
2. Interest → Consideration: 8% (Industry: 5-12%) ✅
3. Consideration → Conversion: 2.4% (Industry: 3-5%) ⚠️ LOW
4. Conversion → Monetization: 12% (Industry: 8-15%) ✅

🎯 Bottleneck Identified: Consideration → Conversion stage
Focus Area: Optimize form_start → form_submit flow
```

---

### **3. Causation Analysis Engine**
**What it does:** Determines what ACTUALLY drives KPIs (not just what correlates).

**Analysis Methods:**

**A. Time-Lagged Correlation**
```sql
-- Does traffic source A predict signups 1-2 weeks later?
WITH traffic AS (
  SELECT month, source, users
  FROM ga_traffic_sources
),
signups AS (
  SELECT month, signup_count
  FROM ga_events WHERE event = 'company-signup'
)
SELECT 
  source,
  CORR(traffic.users, LAG(signups.count, 1) OVER (ORDER BY month)) as lag_1_week,
  CORR(traffic.users, LAG(signups.count, 2) OVER (ORDER BY month)) as lag_2_weeks
FROM traffic JOIN signups ON traffic.month = signups.month
```

**B. Event Sequence Analysis**
```sql
-- What events do users who convert typically do beforehand?
-- Pattern: page_view → feed-scrolled → form_start → form_submit → signup
-- vs
-- Pattern: page_view → paywall-shown → bounce (no conversion)
```

**C. Traffic Source Quality**
```sql
-- Which sources drive highest-quality users?
SELECT 
  source,
  conversion_rate,
  avg_session_duration,
  pages_per_session,
  monetization_rate
FROM traffic_analysis
ORDER BY quality_score DESC
```

**D. Content Performance**
```sql
-- Which pages drive conversions?
WITH page_sessions AS (
  SELECT user_id, page_path, timestamp
  FROM ga_pages
),
conversions AS (
  SELECT user_id, timestamp as conversion_time
  FROM ga_events WHERE event = 'company-signup'
)
SELECT 
  page_path,
  COUNT(DISTINCT c.user_id) as conversions_within_session,
  conversion_rate
FROM page_sessions p
LEFT JOIN conversions c 
  ON p.user_id = c.user_id 
  AND c.conversion_time BETWEEN p.timestamp AND p.timestamp + INTERVAL 1 HOUR
GROUP BY page_path
ORDER BY conversions_within_session DESC
```

**Output Example:**
```
🔍 Causation Analysis: What Drives Signups?

Top Drivers (6-month analysis):

1. 🔥 Organic Search Traffic (0.87 correlation, 2-week lag)
   - +100 organic users → +3.2 signups (3.2% conversion)
   - Top converting keywords: "freelance platform", "hire talent"
   - Landing pages: /find-talent (8% CR), /how-it-works (5% CR)

2. 🔥 Feed Engagement (0.79 correlation, same-week)
   - Users who scroll feed 3+ times: 6x signup rate
   - Indicates product-market fit signal

3. 📉 Paid Search (0.21 correlation)
   - Conversion rate: 0.8% (4x lower than organic)
   - Issue: Ad targeting mismatch or landing page problem

Key Insight: Organic search drives 65% of high-quality signups.
Recommendation: Double down on SEO content strategy.
```

---

### **4. Actionability Classification**
**What it does:** Categorizes events by how much control you have over them.

**Classification Framework:**

**🎯 DIRECT CONTROL (We decide)**
```javascript
{
  event: "form_submit",
  levers: [
    "Remove/add form fields",
    "Change button text/color",
    "Add social login",
    "Adjust validation rules"
  ],
  owner: "Product Team",
  effort: "Low (2-3 days)",
  impact: "High"
}
```

**🎨 INFLUENCED (We can affect)**
```javascript
{
  event: "organic_search_visit",
  levers: [
    "Publish SEO-optimized content",
    "Improve page rankings",
    "Target specific keywords"
  ],
  owner: "Marketing Team",
  effort: "Medium (2-4 weeks)",
  impact: "High"
}
```

**📊 EXTERNAL (Observe only)**
```javascript
{
  event: "referral_visit",
  levers: [
    "Build partnerships (indirect)",
    "Create shareable content",
    "Improve product quality"
  ],
  owner: "BD/Product",
  effort: "High (months)",
  impact: "Medium"
}
```

**Output Example:**
```
Event Actionability Report:

🎯 High-Impact, Directly Controllable (5 events):
1. form_submit (45% abandonment rate) → Optimize form
2. paywall-on-talent-search (70% bounce) → Adjust paywall timing
3. button-clicked (8% CTR) → Improve CTA text
4. begin_checkout (30% abandonment) → Simplify checkout
5. email campaigns (22% open rate) → A/B test subject lines

🎨 High-Impact, Influenced (7 events):
1. organic_search_visit → SEO content strategy
2. page_view on key pages → Improve content quality
3. feed-scrolled → Improve feed algorithm

📊 External / Long-term (3 events):
1. referral_visit → Partnership strategy
2. direct_visit → Brand awareness campaigns
3. social_visit → Community building
```

---

### **5. Tactical Recommendation Engine**
**What it does:** Generates specific, implementable tactics prioritized by impact.

**Prioritization Formula:**
```
Priority Score = (Expected Impact × Confidence) / (Effort × Risk)

Where:
- Expected Impact: % improvement to primary KPI
- Confidence: Based on historical data / experiments
- Effort: Dev days or hours required
- Risk: Probability of negative side effects
```

**Recommendation Structure:**
```javascript
{
  id: "rec_001",
  title: "Optimize Sign-Up Form",
  priority: "HIGH",
  expectedImpact: {
    metric: "company-signup",
    current: 120,
    expected: 140,
    lift: "+16%"
  },
  confidence: "85%",
  reasoning: [
    "Form abandonment rate is 45% (industry avg: 25%)",
    "A/B test on similar forms showed 15-20% lift",
    "Primary friction: 'Company Size' field (68% drop-off)"
  ],
  actions: [
    {
      step: 1,
      task: "Remove 'Company Size' field from form",
      owner: "Product Team",
      effort: "2 hours",
      code: "app/src/components/SignUpForm.tsx"
    },
    {
      step: 2,
      task: "Add 'Continue with Google' social login",
      owner: "Product Team",
      effort: "4 hours",
      code: "app/src/lib/auth.ts"
    },
    {
      step: 3,
      task: "Implement form progress indicator",
      owner: "Product Team",
      effort: "3 hours",
      code: "app/src/components/SignUpForm.tsx"
    }
  ],
  totalEffort: "1 day",
  timeline: "Ship this week",
  trackingMetric: "form_start → form_submit conversion rate"
}
```

**Output Example:**
```
🎯 Top 5 Recommended Tactics (January 2026)

1. **Optimize Sign-Up Form** (Priority: HIGH)
   Expected Impact: +20 signups/month (+16%)
   Effort: 1 day
   Confidence: 85%
   
   Actions:
   ✅ Remove "Company Size" field (2hr)
   ✅ Add Google social login (4hr)
   ✅ Add progress indicator (3hr)
   
   Track: form_start → form_submit conversion

2. **Boost Organic Search Content** (Priority: HIGH)
   Expected Impact: +15 signups/month (+12%)
   Effort: 8 hours writing
   Confidence: 75%
   
   Actions:
   ✅ Publish "How to hire freelance developers" article
   ✅ Optimize /find-talent page for "freelance platform"
   ✅ Build 3 internal links from blog to signup
   
   Track: organic_search_visit → company-signup

3. **Delay Paywall on Talent Search** (Priority: MEDIUM)
   Expected Impact: +8 signups/month (+6%)
   Effort: 4 hours
   Confidence: 60%
   
   Actions:
   ✅ Change paywall trigger: 3 views → 5 views
   ✅ A/B test with 50% traffic
   ✅ Track bounce rate change
   
   Track: paywall-on-talent-search bounce rate

[... continues with recommendations 4-5 ...]
```

---

### **6. Context Understanding & Integration**
**What it does:** Connects all data sources to understand the complete marketing ecosystem.

**Data Sources to Integrate:**

**A. Product Code Context**
```javascript
// Analyze codebase to understand:
- User journey flows (what pages lead where)
- Conversion points (forms, buttons, CTAs)
- Feature flags (what's being tested)
- Recent changes (what might have caused metric shifts)

Example:
"Sign-up conversion dropped 15% on Jan 15th"
→ Agent checks git history
→ Finds: "Added email verification step" on Jan 14th
→ Hypothesis: New friction point causing drop
```

**B. Website & Marketing Copy**
```javascript
// Crawl public site to analyze:
- Headlines, value propositions
- CTA button text and placement
- Social proof (testimonials, logos)
- Page load times and performance

Example:
"Pricing page has 8% conversion to trial"
→ Agent analyzes competitors (using web scraping)
→ Finds: Competitors use benefit-driven headlines
→ Recommendation: Change "Pricing Plans" → "Start Free, Scale Fast"
```

**C. SEO Performance** (DataForSEO integration)
```javascript
// Track rankings and opportunities:
- Current keyword rankings (track movement)
- Search volume and competition
- Content gaps (keywords competitors rank for, you don't)
- Backlink opportunities

Example:
"Organic traffic flat for 3 months"
→ Agent checks DataForSEO
→ Finds: Ranking #11-15 for high-volume keywords (page 2)
→ Insight: Small improvements could move to page 1 (2x traffic)
→ Recommendation: Improve content for "freelance marketplace" keyword
```

**D. Email Marketing** (ActiveCampaign integration)
```javascript
// Analyze email performance:
- Campaign open rates, click rates
- Automation trigger effectiveness
- Segment performance (which audiences convert)
- Email → Signup attribution

Example:
"Which email campaigns drive signups?"
→ Agent correlates ActiveCampaign data with GA4
→ Finds: "Welcome series" has 4% signup rate
→ Finds: "Feature announcement" has 0.2% signup rate
→ Recommendation: Shift resources to welcome series
```

**E. Social Media** (Future integration)
```javascript
// Track social presence:
- Mentions, engagement, reach
- Sentiment analysis
- Influencer impact
- Social → Traffic → Signup attribution
```

**Unified Context Query Example:**
```
User: "Why did signups drop last week?"

Agent reasoning:
1. Checks ga_events → company-signup down 20%
2. Checks ga_traffic_sources → Organic search down 15%
3. Checks dataforseo_pages → Rankings dropped for "freelance platform"
4. Checks code changes → No product changes
5. Checks competitor research → Competitor launched new feature
6. Checks Google Search Console → Indexed pages unchanged

Conclusion:
"Signups dropped 20% due to 15% decrease in organic traffic.
Root cause: Google algorithm update on Jan 18th affected rankings.
Your 'freelance platform' keyword dropped from #7 → #12.

Recommended actions:
1. Publish 2 high-quality articles targeting this keyword
2. Build 5 quality backlinks to homepage
3. Update homepage meta description (low CTR)

Expected recovery: 2-3 weeks"
```

---

## 🏗️ **Implementation Plan: Granular Tasks**

### **Phase 1: Foundation (Week 1)**

**Goal:** Get the agent reading BigQuery data and answering basic questions.

#### **Task 1.1: Connect Vertex AI Agent to BigQuery**
- [ ] Open Vertex AI Agent Designer
- [ ] Add BigQuery data source
- [ ] Grant permissions: `bigquery.dataViewer` role
- [ ] Test connection with simple query

**Test Query:**
```
"List all the tables we have in BigQuery"
```

**Expected Response:**
```
You have 40 tables in firestore_export dataset:
- GA4 data: ga_events, ga_campaigns, ga_pages, ga_traffic_sources
- ActiveCampaign: contacts, campaigns, automations, deals
- SEO: dataforseo_pages
- Internal: initiatives, forecasts, metrics
```

---

#### **Task 1.2: Create Event Discovery Tool**
**Tool Name:** `discover_marketing_events`

**BigQuery Function:**
```sql
CREATE OR REPLACE FUNCTION `opsos-864a1.marketing_ai.get_event_list`()
RETURNS ARRAY<STRUCT<event_name STRING, category STRING, total_count INT64>>
AS (
  SELECT ARRAY_AGG(STRUCT(
    JSON_VALUE(data, '$.eventName') as event_name,
    CASE 
      WHEN JSON_VALUE(data, '$.eventName') IN ('page_view', 'first_visit', 'session_start') THEN 'Acquisition'
      WHEN JSON_VALUE(data, '$.eventName') IN ('company-signup', 'ads_conversion_Sign_Up', 'channel-verified') THEN 'Activation'
      WHEN JSON_VALUE(data, '$.eventName') IN ('add_to_cart', 'begin_checkout', 'purchase') THEN 'Monetization'
      ELSE 'Engagement'
    END as category,
    CAST(JSON_VALUE(data, '$.totalCount') AS INT64) as total_count
  ))
  FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
);
```

**Test Query:**
```
"What marketing events are we tracking?"
```

**Expected Response:**
```
We track 80 events across 4 categories:

🟢 Acquisition (3 events):
- page_view: 1.2M events
- session_start: 450K events
- first_visit: 180K events

🔵 Activation (8 events):
- company-signup: 2.3K events
- ads_conversion_Sign_Up: 890 events
- channel-verified: 1.5K events
[... continues ...]
```

---

#### **Task 1.3: Create Traffic Source Analysis Tool**
**Tool Name:** `analyze_traffic_sources`

**BigQuery Function:**
```sql
CREATE OR REPLACE FUNCTION `opsos-864a1.marketing_ai.get_traffic_quality`()
RETURNS ARRAY<STRUCT<
  source STRING, 
  users INT64, 
  conversion_rate FLOAT64,
  quality_score FLOAT64
>>
AS (
  -- Join traffic sources with signup events to calculate conversion rates
  -- Return ordered by quality score
);
```

**Test Query:**
```
"Which traffic sources drive the most signups?"
```

**Expected Response:**
```
Traffic Source Performance (last 3 months):

1. Organic Search
   - Users: 25,000
   - Signups: 800
   - Conversion Rate: 3.2%
   - Quality Score: 9.5/10

2. Direct
   - Users: 15,000
   - Signups: 300
   - Conversion Rate: 2.0%
   - Quality Score: 7.8/10

3. Paid Search
   - Users: 8,000
   - Signups: 64
   - Conversion Rate: 0.8%
   - Quality Score: 4.2/10 ⚠️

Insight: Organic search drives 3x better conversion rate than paid.
Recommendation: Increase SEO investment.
```

---

### **Phase 2: Intelligence (Week 2)**

**Goal:** Agent can identify causation and anomalies.

#### **Task 2.1: Build Anomaly Detection**
**Tool Name:** `detect_anomalies`

**Logic:**
```python
def detect_anomaly(current_value, historical_values):
    baseline = mean(historical_values)
    std_dev = std(historical_values)
    
    z_score = (current_value - baseline) / std_dev
    
    if z_score > 2:
        return {"type": "spike", "severity": "high", "percent_change": (current_value - baseline) / baseline}
    elif z_score < -2:
        return {"type": "drop", "severity": "high", "percent_change": (current_value - baseline) / baseline}
    else:
        return {"type": "normal"}
```

**Test Query:**
```
"Are there any unusual changes in our metrics this month?"
```

**Expected Response:**
```
🚨 Anomalies Detected (January 2026):

1. ⚠️ company-signup (HIGH SEVERITY DROP)
   - Current: 95 signups
   - Expected: 120 signups (based on 6-month avg)
   - Change: -20.8%
   - Started: Jan 15th

2. ✅ page_view (POSITIVE SPIKE)
   - Current: 85K views
   - Expected: 65K views
   - Change: +30.8%
   - Started: Jan 10th

Analysis: Traffic is up but conversions are down.
Hypothesis: Traffic quality issue or conversion funnel problem.
```

---

#### **Task 2.2: Build Causation Analysis**
**Tool Name:** `analyze_causation`

**Test Query:**
```
"Why did signups drop on January 15th?"
```

**Expected Response:**
```
🔍 Root Cause Analysis: Signup Drop on Jan 15th

Timeline Analysis:
- Jan 15th: company-signup dropped from 8/day → 5/day (-37%)

Potential Causes Investigated:

1. ❌ Traffic Volume: No change (stable at 2.8K/day)
2. ❌ Traffic Quality: Source mix unchanged
3. ✅ FORM ABANDONMENT: Increased from 42% → 58% (+16pp)
4. ✅ form_start events: Stable (users reaching form)
5. ✅ form_submit events: Dropped 38%

Root Cause Found:
- Code deployment on Jan 14th at 3:42 PM
- Change: Added email verification step to signup flow
- File: app/src/components/SignUpForm.tsx (commit abc123)

Evidence:
- Form completion time increased from 45s → 2m 15s
- New step has 35% abandonment rate

Recommendation:
- Make email verification optional (verify after signup)
- Or: Reduce verification to 4-digit code instead of email link
- Expected recovery: +15 signups/month
```

---

### **Phase 3: Recommendations (Week 3)**

**Goal:** Agent generates actionable tactical recommendations.

#### **Task 3.1: Build Recommendation Engine**
**Tool Name:** `generate_recommendations`

**Test Query:**
```
"What should I do this week to increase signups?"
```

**Expected Response:**
```
🎯 Recommended Actions (Week of Jan 22, 2026)

Priority: HIGH (Do This Week)

1. **Revert Email Verification Change**
   Impact: +25 signups/month (+26%)
   Effort: 1 hour
   Confidence: 95%
   
   Why: Verification step is causing 35% abandonment.
   Action: Move verification to post-signup (non-blocking).
   Code: app/src/components/SignUpForm.tsx, line 145
   Track: form_submit conversion rate
   
   ⏰ DO TODAY

2. **Publish SEO Content**
   Impact: +12 signups/month (+12%)
   Effort: 6 hours writing
   Confidence: 70%
   
   Why: Ranking #11 for "freelance marketplace" (page 2).
   Small improvement → page 1 → 2x traffic.
   
   Action: Write article "Ultimate Guide to Freelance Marketplaces in 2026"
   Keywords: "freelance marketplace", "hire freelancers", "talent platform"
   Target length: 2,500 words
   Track: Organic traffic from this keyword
   
   ⏰ SHIP BY FRIDAY

Priority: MEDIUM (This Sprint)

3. **A/B Test Paywall Timing**
   Impact: +8 signups/month (+8%)
   Effort: 4 hours
   Confidence: 60%
   
   Why: 70% of users bounce at paywall on talent search.
   
   Action: Test showing paywall after 5 views instead of 3.
   Code: app/src/components/Paywall.tsx
   Traffic split: 50/50
   Duration: 2 weeks
   Track: paywall-on-talent-search bounce rate
```

---

### **Phase 4: Context Integration (Week 4)**

**Goal:** Agent understands product, website, and market context.

#### **Task 4.1: Integrate Codebase Context**
**Tool:** Cursor's codebase search API

**Test Query:**
```
"What code changes might have affected signups last week?"
```

**Expected Response:**
```
📝 Recent Code Changes (Jan 15-22):

Potentially Impactful Changes:

1. SignUpForm.tsx (Jan 14, 3:42 PM)
   - Added email verification step
   - Line 145: await verifyEmail(email)
   - Impact: HIGH (blocks signup completion)

2. PricingPage.tsx (Jan 16, 11:20 AM)
   - Updated pricing table layout
   - Changed CTA button text
   - Impact: MEDIUM (affects consideration stage)

3. PaywallModal.tsx (Jan 18, 2:15 PM)
   - Adjusted trigger logic
   - Changed from 3 views → 2 views
   - Impact: HIGH (more friction)

Recommendation: Investigate #1 and #3 as primary suspects.
```

---

#### **Task 4.2: Integrate Website Context**
**Tool:** Web scraping + GPT-4 Vision

**Test Query:**
```
"Analyze our pricing page and suggest improvements"
```

**Expected Response:**
```
🔍 Pricing Page Analysis (https://yoursite.com/pricing)

Current State:
- Traffic: 850 visits/month (12% of total traffic)
- Bounce Rate: 45%
- Time on Page: 1m 32s
- Conversion to Trial: 8%

Visual Analysis (GPT-4 Vision):
- Layout: 3-column pricing table ✅
- Headline: "Pricing Plans" (generic)
- Social Proof: Missing
- CTA Buttons: Blue (low contrast)
- Comparison: Feature list present ✅

Competitor Analysis (3 top competitors):
- All use benefit-driven headlines
- 100% have customer logos/testimonials
- All emphasize "Free Trial" prominently

Recommendations:

1. **Change Headline** (Effort: 5 min)
   - Current: "Pricing Plans"
   - New: "Start Free. Grow Without Limits."
   - Why: Emphasizes free trial + scalability

2. **Add Social Proof** (Effort: 30 min)
   - Add 4-5 recognizable customer logos
   - Add 1 testimonial quote
   - Place above pricing table

3. **Improve CTA Buttons** (Effort: 10 min)
   - Change color: Blue → Green (your green CTAs convert 1.8x better)
   - Change text: "Get Started" → "Start Free Trial"
   - Why: More specific and action-oriented

Expected Impact: +3-5 signups/month from pricing page alone.
```

---

### **Phase 5: Automation (Week 5)**

**Goal:** Agent runs automatically and proactively alerts you.

#### **Task 5.1: Build Daily Agent Run**
**Trigger:** Scheduled Cloud Function (runs daily at 9am)

**What it does:**
1. Check for anomalies in last 24 hours
2. Run causation analysis on any anomalies
3. Generate recommendations
4. Store insights in `agent_insights` Firestore collection
5. Send summary to Slack/Email (optional)

---

#### **Task 5.2: Build Agent UI in OpsOS**
**Location:** `/app/src/app/marketing/insights/page.tsx`

**Features:**
- Display latest agent insights
- Show priority recommendations
- Track recommendation status (Implemented, In Progress, Dismissed)
- Chat interface to ask custom questions

---

## 📊 **Success Metrics**

**Agent Performance:**
- Response accuracy: >90%
- Recommendation acceptance rate: >50%
- Time to insight: <5 seconds per query
- Context relevance: >80%

**Business Impact:**
- Signups increase: +20% in 90 days
- Recommendation implementation rate: >60%
- Time saved on analysis: 10+ hours/month
- Marketing ROI improvement: +30%

---

## 🚀 **Getting Started**

**This Week (Jan 22-26):**
1. Connect Vertex AI agent to BigQuery ✅ (You're here)
2. Build Event Discovery tool (Task 1.2)
3. Test with simple queries
4. Document what works

**Next Week:**
- Build Traffic Analysis tool
- Add Anomaly Detection
- Start generating insights

**The key:** Start small, test constantly, iterate quickly.

---

## 📝 **Notes & Learnings**

(This section will be updated as we build)

- **Jan 22, 2026:** Created plan, identified 80+ tracked events
- **Insight:** We have incredibly rich event tracking already
- **Opportunity:** Most events are product usage (engagement), perfect for causation analysis

