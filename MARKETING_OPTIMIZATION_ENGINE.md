# Marketing Optimization Engine

## Core Philosophy

**Not Reactive (Anomaly Detection):**
```
"Signups dropped 35% → Something broke → Fix it"
```

**Proactive (Continuous Optimization):**
```
"Signups are at 4,200/mo → Could be 5,500/mo → Here's how"
```

---

## The Agent's Job

The Marketing Optimization Agent continuously identifies incremental improvements to leading indicators that drive the goal KPI.

### Example Output:

```
GOAL KPI: Signups (Target: 6,000/mo)
Current: 4,200/mo (70% of target)
Gap: 1,800 signups/mo to close

AGENT IDENTIFIES OPPORTUNITIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🎯 Paywall Optimization | Impact: +840 signups/mo (47% of gap)
   
   Current State:
   • Paywall shown to 60% of users
   • Paywall conversion: 5.2%
   • No-paywall conversion: 12.8%
   • Net effect: -15% on signups
   
   Opportunity:
   • Reduce paywall to high-intent users only (20% of traffic)
   • Expected conversion: 10.5% (weighted average)
   • Lift: +840 signups/mo
   
   Action: A/B test paywall frequency reduction
   Confidence: High (based on conversion data)
   Priority: #1 (highest impact/effort ratio)

2. 🎯 Email Engagement Boost | Impact: +520 signups/mo (29% of gap)
   
   Current State:
   • Email open rate: 35%
   • Industry benchmark: 42%
   • Your best campaigns: 48% (Welcome Series)
   • Email drives 28.5% of signups
   
   Opportunity:
   • Increase send frequency: 3/week → 5/week
   • Improve subject lines (A/B test)
   • Expected open rate: 42% (+7pp)
   • Lift: +520 signups/mo
   
   Action: Scale Welcome Series format to other campaigns
   Confidence: Medium (based on correlation)
   Priority: #2 (medium effort, high return)

3. 🎯 Video Engagement | Impact: +380 signups/mo (21% of gap)
   
   Current State:
   • Video viewers: 15% of traffic
   • Video viewer conversion: 12.3%
   • Non-video conversion: 8.1%
   • Uplift: +52% for video viewers
   
   Opportunity:
   • Increase video view rate: 15% → 25%
   • Add video to high-traffic pages
   • Expected lift: +380 signups/mo
   
   Action: Add explainer video to /jobs page hero
   Confidence: Medium (strong correlation, uncertain causation)
   Priority: #3 (low effort, medium return)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL OPPORTUNITY: 1,740 signups/mo (97% of gap to goal!)

RECOMMENDED ROADMAP:
• Week 1-2: Paywall A/B test (+840 signups)
• Week 3-4: Email optimization (+520 signups)  
• Month 2: Video expansion (+380 signups)

If all succeed: 4,200 → 5,940 signups/mo (99% of goal)
```

---

## Optimization Framework

### 1. Goal Hierarchy

```
NORTH STAR: Revenue ($50K MRR)
    ↓
GOAL KPI: Signups (6,000/mo needed for $50K)
    ↓
LEADING INDICATORS (Ranked by importance):
1. Page Views (42% driver)
2. Email Engagement (28% driver)
3. Organic Traffic (24% driver)
4. Search Usage (12% driver)
5. Video Views (8% driver)
    ↓
NEGATIVE FACTORS:
1. Paywall Friction (-15% drag)
2. Form Abandonment (-8% drag)
3. Mobile Experience (-4% drag)
```

### 2. Multi-Channel Driver Analysis

The agent analyzes data from all marketing channels to build a unified importance ranking:

#### Data Sources:
- **Google Analytics** (ga_events, ga_traffic_sources, ga_campaigns, ga_pages)
- **ActiveCampaign** (campaigns, automations, contacts)
- **DataForSEO** (pages, technical metrics)
- **Stripe** (revenue, purchases)
- **QuickBooks** (expenses, ROI)

#### Example: Hierarchical Driver Analysis

**Level 1: Channel-Level Attribution**
```
1. Email Marketing            28.5%  (ActiveCampaign)
2. Organic Search (SEO)       24.2%  (GA + DataForSEO)
3. Website Behavior           18.3%  (GA Events)
4. Paid Advertising           15.8%  (GA Campaigns)
5. Direct/Referral             9.2%  (GA Traffic Sources)
6. Negative Factors           -4.0%  (Friction)
```

**Level 2: Email Sub-Channel Drill-Down (28.5% total)**
```
1. Automated Nurture Sequences    42% of email impact
   └─ "Welcome Series"                 18.2% ★ TOP
   └─ "Retention Email"                12.4%
   └─ "Re-engagement Campaign"          8.1%

2. One-Time Broadcasts            35% of email impact
   └─ "Product Launch"                 14.3% ★ TOP
   └─ "Feature Announcement"            9.8%

3. Triggered Events               23% of email impact  
   └─ "Abandoned Cart"                 10.1% ★ TOP
```

**Level 3: Event-Level Granularity**
```
Website Behavior (18.3% total):

Positive Drivers:
• view_search_results      22.1% of behavior impact ★ TOP
• feed-scrolled            12.8%
• form_start               18.4%
• video_start               9.2%

Negative Drivers:
• paywall-on-talent-search -15.2% ⚠️ WORST
• badgeless-restriction     -8.4%
• form_abandonment          -6.8%
```

---

## The Continuous Optimization Loop

```
┌──────────────────────────────────────────────────┐
│ 1. MEASURE                                       │
│    • Goal KPI: 4,200 signups (target: 6,000)   │
│    • Leading indicators: Email 35%, Paywall -15%│
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ 2. ANALYZE DRIVERS                               │
│    • Run feature importance model                │
│    • Rank all events by impact on goal KPI      │
│    • Email has 28% importance                    │
│    • Paywall has -15% negative impact           │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ 3. IDENTIFY GAPS                                 │
│    • Compare to benchmarks:                      │
│      - Internal best (your top 10%)             │
│      - Historical best (your all-time high)     │
│      - Industry benchmark (external data)       │
│    • Email: 35% vs 42% benchmark (-17%)         │
│    • Paywall: -15% vs -5% target (3x worse)     │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ 4. ESTIMATE OPPORTUNITY                          │
│    • Gap × Importance = Expected Lift            │
│    • Close email gap: +520 signups              │
│    • Reduce paywall: +840 signups               │
│    • Increase video: +380 signups               │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ 5. PRIORITIZE (Impact / Effort)                 │
│    • Score by expected lift vs implementation    │
│    • #1: Paywall (High impact, low effort)      │
│    • #2: Email (High impact, medium effort)     │
│    • #3: Video (Medium impact, medium effort)   │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ 6. RECOMMEND ACTIONS                             │
│    • Create initiative "Optimize Paywall"       │
│    • Set up A/B test                            │
│    • Expected result: +840 signups in 4 weeks   │
│    • Link to OpsOS initiatives system           │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ 7. TRACK & ITERATE                               │
│    • Monitor initiative progress                │
│    • Measure actual vs expected lift            │
│    • Update driver importance model             │
│    • Find next opportunity                       │
└──────────────────────────────────────────────────┘
                       ↓
                   (Loop back to 1)
```

---

## Daily Agent Output

### What You See Every Morning:

**In Slack:**
```
🤖 Marketing Optimization Agent
Daily Report | Jan 23, 2026

GOAL: 6,000 signups/mo
CURRENT: 4,200 signups/mo (70% of goal)
GAP: 1,800 signups to close

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 DRIVER HEALTH REPORT

Leading Indicators:
1. Page Views:        2.1M/mo  (Target: 2.5M)   ⚠️ 16% below
2. Email Opens:       35%      (Target: 42%)    ⚠️ 17% below  
3. Organic Traffic:   110K/mo  (Target: 140K)   ⚠️ 21% below
4. Search Usage:      40%      (Target: 55%)    ⚠️ 27% below

Friction Points:
1. Paywall:          -15%     (Target: -5%)     🔴 3x too high
2. Form Abandon:     -8%      (Target: -3%)     🟡 2.7x too high

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TOP 3 OPPORTUNITIES THIS WEEK

1. PAYWALL OPTIMIZATION [URGENT]
   Impact: +840 signups/mo (47% of gap)
   Effort: Low (config change)
   Confidence: High
   
   Why: Paywall drag is 3x worse than it should be
   Action: Reduce frequency from 60% → 20% of users
   Test: A/B test over 2 weeks
   
   [Create Initiative] [Start A/B Test]

2. EMAIL SCALE-UP [HIGH PRIORITY]
   Impact: +520 signups/mo (29% of gap)
   Effort: Medium (content creation)
   Confidence: Medium
   
   Why: Open rate is 17% below benchmark
   Action: 
   - Increase frequency: 3/week → 5/week
   - Use Welcome Series format (48% open rate)
   - A/B test subject lines
   
   [Create Initiative] [Schedule Campaigns]

3. VIDEO EXPANSION [MEDIUM PRIORITY]
   Impact: +380 signups/mo (21% of gap)
   Effort: Medium (production + integration)
   Confidence: Medium
   
   Why: Video viewers convert 52% better
   Current: Only 15% of users see video
   Action: Add explainer video to /jobs page
   
   [Create Initiative] [Plan Production]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 TRACKING: Active Initiatives

1. "SEO Content Push" (Started 2 weeks ago)
   Goal: +150 signups/mo via organic traffic
   Status: On track
   Progress: Organic traffic +8% WoW
   
2. "Mobile Experience Improvement" (Started 1 month ago)
   Goal: +120 signups/mo via reduced friction
   Status: ✅ SUCCESS
   Result: Mobile conversion +15%, +140 signups/mo
   
   💡 Insight: Mobile friction is no longer in top 5
   Action: Mark as complete, remove from tracking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next analysis: Tomorrow 6am
```

**In OpsOS Dashboard:**
```
┌─────────────────────────────────────────────────┐
│  MARKETING OPTIMIZATION (Auto-Generated)        │
│  Last updated: Today 6:05am                     │
└─────────────────────────────────────────────────┘

🎯 GOAL PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signups: 4,200/mo → 6,000/mo (70%)
Gap: 1,800 signups to close

📊 DRIVER HEALTH (Top 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Email Marketing      28.5% ↓ Below benchmark
2. Organic Search       24.2% ↓ Declining
3. Website Behavior     18.3% → Stable
4. Paid Advertising     15.8% ↓ Declining
5. Paywall Friction    -15.0% 🔴 Critical issue

💡 TOP OPPORTUNITIES (3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Create Initiative] Optimize Paywall
   Impact: +840 signups/mo | Confidence: High
   
2. [Create Initiative] Scale Email Marketing
   Impact: +520 signups/mo | Confidence: Medium
   
3. [Create Initiative] Expand Video Content
   Impact: +380 signups/mo | Confidence: Medium
```

---

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────┐
│         SCHEDULED TRIGGER (Daily 6am)           │
│         Cloud Scheduler → Cloud Function        │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│              DATA COLLECTION                     │
│  • Query BigQuery (firestore_export dataset)   │
│  • Pull last 30-90 days of data                 │
│  • Aggregate by channel/event                   │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│          DRIVER ANALYSIS ENGINE                  │
│  • Feature importance (Random Forest)           │
│  • SHAP values for explainability              │
│  • Rank all events by impact on goal KPI       │
│  • Identify positive/negative drivers          │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│         OPPORTUNITY IDENTIFICATION               │
│  • Compare to benchmarks (internal/external)    │
│  • Calculate headroom for each driver           │
│  • Estimate lift: gap × importance × goal_kpi  │
│  • Filter for actionable opportunities          │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│       PRIORITIZATION ENGINE                      │
│  • Score by impact / effort ratio               │
│  • Assign confidence levels                     │
│  • Group by quick wins vs strategic bets        │
│  • Rank top 3-5 recommendations                 │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│            INSIGHT DELIVERY                      │
│  • Format as executive summary                  │
│  • Push to Slack/Email/Dashboard                │
│  • Create draft initiatives in OpsOS            │
│  • Store in Firestore for history               │
└─────────────────────────────────────────────────┘
```

### Core Algorithm: Opportunity Identification

```python
def find_opportunities(data, goal_kpi, target_value):
    """
    Identify ways to improve goal KPI by analyzing driver gaps
    
    Args:
        data: DataFrame with monthly aggregates
        goal_kpi: Target metric (e.g., 'signups')
        target_value: Goal value (e.g., 6000)
    
    Returns:
        List of opportunities ranked by expected impact
    """
    
    opportunities = []
    
    # Step 1: Calculate driver importance
    X = data[feature_cols]
    y = data[goal_kpi]
    
    model = RandomForestRegressor(n_estimators=500)
    model.fit(X, y)
    
    importance = dict(zip(feature_cols, model.feature_importances_))
    
    # Step 2: Analyze each driver for headroom
    for driver in feature_cols:
        
        # Current performance
        current_value = data[driver].mean()
        current_impact = importance[driver]
        
        # Calculate benchmarks
        benchmarks = {
            'internal_best': data[driver].quantile(0.9),  # Top 10%
            'historical_best': data[driver].max(),         # All-time high
            'industry': get_industry_benchmark(driver),    # External
        }
        
        # Find best achievable benchmark
        for benchmark_type, benchmark_value in benchmarks.items():
            
            if benchmark_value > current_value:
                
                # Calculate gap
                gap = benchmark_value - current_value
                gap_pct = gap / current_value
                
                # Estimate lift on goal KPI
                # Formula: gap% × importance × current_goal_value
                expected_lift = gap_pct * current_impact * data[goal_kpi].mean()
                
                # Calculate confidence based on correlation strength
                correlation = data[driver].corr(data[goal_kpi])
                confidence = 'high' if abs(correlation) > 0.7 else 'medium' if abs(correlation) > 0.4 else 'low'
                
                opportunities.append({
                    'driver': driver,
                    'type': 'improve_driver',
                    'current': current_value,
                    'benchmark': benchmark_value,
                    'benchmark_type': benchmark_type,
                    'gap': gap,
                    'gap_pct': gap_pct,
                    'importance': current_impact,
                    'expected_lift': expected_lift,
                    'confidence': confidence,
                    'correlation': correlation
                })
    
    # Step 3: Analyze negative factors (friction points)
    for friction in ['paywall_hits', 'form_abandonment', 'mobile_bounce']:
        
        if friction not in data.columns:
            continue
            
        # Calculate negative impact
        correlation = data[friction].corr(data[goal_kpi])
        
        if correlation < -0.3:  # Significant negative correlation
            
            current_drag = importance.get(friction, 0) * correlation
            
            # Estimate improvement if reduced by 50%
            expected_lift = abs(current_drag) * 0.5 * data[goal_kpi].mean()
            
            opportunities.append({
                'driver': friction,
                'type': 'remove_friction',
                'current_drag': current_drag,
                'expected_lift': expected_lift,
                'confidence': 'high',  # Removing friction is safer
                'action': f'Reduce {friction} by 50%'
            })
    
    # Step 4: Sort by expected lift and return top opportunities
    return sorted(opportunities, key=lambda x: x['expected_lift'], reverse=True)
```

### Key Functions

#### 1. Driver Analysis
```python
def analyze_drivers(data, goal_kpi):
    """
    Run feature importance to identify what drives goal KPI
    """
    from sklearn.ensemble import RandomForestRegressor
    import shap
    
    X = data.drop(goal_kpi, axis=1)
    y = data[goal_kpi]
    
    # Train model
    model = RandomForestRegressor(n_estimators=500, max_depth=10)
    model.fit(X, y)
    
    # Get SHAP values for explainability
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    
    # Calculate importance
    importance = {
        'features': X.columns.tolist(),
        'importance': model.feature_importances_.tolist(),
        'shap_values': shap_values.tolist(),
        'r_squared': model.score(X, y)
    }
    
    return importance
```

#### 2. Benchmark Comparison
```python
def calculate_benchmarks(data, driver):
    """
    Calculate internal and external benchmarks
    """
    return {
        'internal_best': data[driver].quantile(0.9),
        'historical_best': data[driver].max(),
        'internal_avg': data[driver].mean(),
        'recent_trend': (data[driver].iloc[-3:].mean() / 
                        data[driver].iloc[-6:-3].mean() - 1),
        'industry': get_industry_benchmark(driver)  # External API
    }
```

#### 3. Impact Estimation
```python
def estimate_impact(driver, gap_pct, importance, current_goal_value):
    """
    Estimate lift on goal KPI from improving a driver
    
    Formula: gap% × driver_importance × current_goal_value
    
    Example:
    - Email open rate gap: 20% below benchmark (gap_pct = 0.20)
    - Email importance: 28.5% of signups
    - Current signups: 4,200/mo
    - Expected lift: 0.20 × 0.285 × 4200 = 239 signups/mo
    """
    return gap_pct * importance * current_goal_value
```

#### 4. Prioritization
```python
def prioritize_opportunities(opportunities):
    """
    Rank by impact/effort ratio with confidence weighting
    """
    effort_estimates = {
        'paywall': 1,      # Config change
        'email': 3,        # Content + scheduling
        'video': 5,        # Production
        'seo': 8,          # Long-term
    }
    
    for opp in opportunities:
        effort = estimate_effort(opp)
        impact = opp['expected_lift']
        confidence_multiplier = {'high': 1.0, 'medium': 0.7, 'low': 0.4}
        
        opp['score'] = (impact / effort) * confidence_multiplier[opp['confidence']]
    
    return sorted(opportunities, key=lambda x: x['score'], reverse=True)
```

---

## Data Requirements

### Monthly Aggregate Tables Required:

1. **GA Events** (`ga_events_raw_latest`)
   - 80 events with monthly totals
   - Used for: behavior analysis, friction detection

2. **GA Traffic Sources** (`ga_traffic_sources_raw_latest`)
   - 11 sources with conversions, users, sessions
   - Used for: channel attribution

3. **GA Campaigns** (`ga_campaigns_raw_latest`)
   - 111 campaigns with performance metrics
   - Used for: paid marketing ROI

4. **GA Pages** (`ga_pages_raw_latest`)
   - 111 pages with engagement metrics
   - Used for: content performance

5. **ActiveCampaign Campaigns** (`activecampaign_campaigns_raw_latest`)
   - 17K campaigns with opens, clicks, sends
   - Used for: email marketing optimization

6. **ActiveCampaign Automations** (`activecampaign_automations_raw_latest`)
   - 261 automations with entered/exited counts
   - Used for: funnel analysis

7. **DataForSEO Pages** (`dataforseo_pages_raw_latest`)
   - Technical SEO metrics
   - Used for: technical optimization opportunities

8. **Stripe/Revenue Data** (optional)
   - For ROI calculations
   - Used for: full-funnel attribution

---

## Output Formats

### 1. Slack Notification
```json
{
  "text": "🤖 Marketing Optimization Agent - Daily Report",
  "blocks": [
    {
      "type": "section",
      "text": "GOAL: 6,000 signups/mo\nCURRENT: 4,200 (70%)\nGAP: 1,800 to close"
    },
    {
      "type": "section",
      "text": "🎯 TOP OPPORTUNITY\nPaywall Optimization\nImpact: +840 signups/mo\nEffort: Low | Confidence: High"
    },
    {
      "type": "actions",
      "elements": [
        {"type": "button", "text": "Create Initiative"},
        {"type": "button", "text": "View Details"}
      ]
    }
  ]
}
```

### 2. OpsOS Dashboard (Firestore)
```json
{
  "timestamp": "2026-01-23T06:05:00Z",
  "period": "last_30_days",
  "goal_kpi": {
    "name": "signups",
    "current": 4200,
    "target": 6000,
    "progress": 0.70,
    "gap": 1800
  },
  "drivers": [
    {
      "name": "Email Marketing",
      "importance": 0.285,
      "current_value": 0.35,
      "benchmark": 0.42,
      "trend": "declining",
      "status": "below_benchmark"
    }
  ],
  "opportunities": [
    {
      "id": "opp_paywall_001",
      "driver": "paywall_friction",
      "title": "Optimize Paywall Frequency",
      "impact": 840,
      "effort": "low",
      "confidence": "high",
      "action": "Reduce paywall from 60% to 20% of users",
      "priority": 1
    }
  ],
  "active_initiatives": [
    {
      "id": "init_seo_001",
      "title": "SEO Content Push",
      "status": "on_track",
      "progress": 0.45,
      "expected_lift": 150,
      "actual_lift": 68
    }
  ]
}
```

### 3. Email Summary (HTML)
```html
<h2>🤖 Marketing Optimization Report</h2>
<p>Week of Jan 20-26, 2026</p>

<h3>Goal Progress</h3>
<div class="progress-bar">
  <div style="width: 70%">4,200 / 6,000 signups</div>
</div>

<h3>Top 3 Opportunities</h3>
<ol>
  <li><strong>Paywall Optimization</strong> - +840 signups/mo</li>
  <li><strong>Email Scale-Up</strong> - +520 signups/mo</li>
  <li><strong>Video Expansion</strong> - +380 signups/mo</li>
</ol>

<a href="https://opsos.app/insights">View Full Report</a>
```

---

## Key Questions the Agent Answers Daily

1. **Where are we vs goal?**
   - Current: 4,200 signups/mo
   - Target: 6,000 signups/mo
   - Gap: 1,800 signups to close

2. **Which drivers matter most?**
   - Email: 28.5% importance
   - Organic: 24.2% importance
   - Paywall: -15% negative impact

3. **Where's the headroom?**
   - Email: 35% vs 42% benchmark (17% below)
   - Paywall: -15% vs -5% target (3x worse)
   - Video: 15% usage vs 25% potential

4. **What's the biggest opportunity?**
   - Fix paywall: +840 signups/mo
   - Scale email: +520 signups/mo
   - Expand video: +380 signups/mo

5. **What should we do this week?**
   - Priority #1: A/B test paywall reduction
   - Priority #2: Increase email frequency
   - Priority #3: Add video to /jobs page

6. **Are current initiatives working?**
   - SEO Content Push: On track (+8% organic)
   - Mobile Experience: ✅ Complete (+15% mobile conversion)

---

## Success Metrics

The agent's effectiveness is measured by:

1. **Recommendation Accuracy**
   - Did the predicted lift match actual results?
   - Track: expected_lift vs actual_lift

2. **Initiative Success Rate**
   - What % of recommended initiatives succeed?
   - Target: >70% success rate

3. **Goal Progress**
   - Are we closing the gap to goal KPI?
   - Track: weekly progress toward 6,000 signups

4. **Time to Action**
   - How quickly do recommendations get implemented?
   - Target: <7 days from recommendation to test launch

5. **Incremental Lift**
   - Total signups gained from agent recommendations
   - Track: sum of all successful initiative lifts

---

## Future Enhancements

### Phase 2 Features:
1. **Predictive Modeling**
   - Forecast goal KPI 30/60/90 days out
   - Predict impact of multiple initiatives combined

2. **A/B Test Management**
   - Auto-create A/B tests for recommendations
   - Monitor results and auto-conclude tests

3. **Multi-Goal Optimization**
   - Optimize for signups AND revenue simultaneously
   - Balance short-term vs long-term goals

4. **Competitive Intelligence**
   - Track competitor performance
   - Identify market share opportunities

5. **Resource Allocation**
   - Recommend budget shifts between channels
   - Optimize marketing spend for ROI

6. **Initiative Auto-Creation**
   - Auto-create OpsOS initiatives from recommendations
   - Link to forecasting system for impact tracking

### Phase 3 Features:
1. **Causal Inference** (requires user-level data)
   - Propensity score matching
   - Difference-in-differences
   - Causal forests for personalization

2. **Real-Time Optimization**
   - Move from daily to hourly analysis
   - React to intra-day trends

3. **Cross-Journey Attribution**
   - Full customer journey mapping
   - Multi-touch attribution modeling

---

## Deployment Plan

### Week 1: MVP
- [ ] Build driver analysis function
- [ ] Build opportunity identification function
- [ ] Build prioritization logic
- [ ] Deploy Cloud Function
- [ ] Set up Cloud Scheduler (daily 6am)
- [ ] Test with historical data

### Week 2: Delivery
- [ ] Build Slack integration
- [ ] Build OpsOS dashboard integration
- [ ] Create email template
- [ ] Test end-to-end flow

### Week 3: Validation
- [ ] Run for 7 days
- [ ] Validate recommendations
- [ ] Collect user feedback
- [ ] Refine prioritization

### Week 4: Scale
- [ ] Add more data sources
- [ ] Improve benchmarking
- [ ] Add initiative tracking
- [ ] Launch to full organization

---

## Appendix: Example Data Queries

### Query 1: Build Monthly Feature Matrix
```sql
WITH monthly_features AS (
  -- GA Events
  SELECT 
    DATE_TRUNC(timestamp, MONTH) as month,
    JSON_VALUE(data, '$.organizationId') as org_id,
    SUM(CASE WHEN JSON_VALUE(data, '$.eventName') = 'page_view' 
        THEN CAST(JSON_VALUE(data, '$.months."2026-01".events') AS INT64) END) as page_views,
    SUM(CASE WHEN JSON_VALUE(data, '$.eventName') LIKE 'paywall-%' 
        THEN CAST(JSON_VALUE(data, '$.months."2026-01".events') AS INT64) END) as paywall_hits,
    SUM(CASE WHEN JSON_VALUE(data, '$.eventName') = 'talent-signup' 
        THEN CAST(JSON_VALUE(data, '$.months."2026-01".events') AS INT64) END) as signups
  FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
  GROUP BY month, org_id
),

email_metrics AS (
  -- ActiveCampaign
  SELECT
    DATE_TRUNC(TIMESTAMP_SECONDS(CAST(JSON_VALUE(data, '$.sentAt._seconds') AS INT64)), MONTH) as month,
    JSON_VALUE(data, '$.organizationId') as org_id,
    COUNT(*) as campaigns_sent,
    AVG(SAFE_DIVIDE(
      CAST(JSON_VALUE(data, '$.uniqueOpens') AS INT64),
      CAST(JSON_VALUE(data, '$.sendAmt') AS INT64)
    )) as avg_open_rate,
    AVG(SAFE_DIVIDE(
      CAST(JSON_VALUE(data, '$.uniqueLinkClicks') AS INT64),
      CAST(JSON_VALUE(data, '$.uniqueOpens') AS INT64)
    )) as avg_ctr
  FROM `opsos-864a1.firestore_export.activecampaign_campaigns_raw_latest`
  GROUP BY month, org_id
)

SELECT 
  f.*,
  e.campaigns_sent,
  e.avg_open_rate,
  e.avg_ctr
FROM monthly_features f
LEFT JOIN email_metrics e USING(month, org_id)
WHERE f.month >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
ORDER BY f.month DESC
```

### Query 2: Calculate Driver Importance Changes
```sql
-- Compare driver importance this month vs last month
WITH current_month AS (
  SELECT driver, importance
  FROM ml_model_results
  WHERE month = CURRENT_DATE()
),
previous_month AS (
  SELECT driver, importance
  FROM ml_model_results
  WHERE month = DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)
)

SELECT 
  c.driver,
  c.importance as current_importance,
  p.importance as previous_importance,
  c.importance - p.importance as change,
  SAFE_DIVIDE(c.importance - p.importance, p.importance) as change_pct
FROM current_month c
LEFT JOIN previous_month p USING(driver)
ORDER BY ABS(c.importance - p.importance) DESC
LIMIT 10
```

---

## Contact & Support

For questions about this system:
- Documentation: `/MARKETING_OPTIMIZATION_ENGINE.md`
- Related docs: `/MARKETING_AI_PLAN.md`
- Agent tools: `/AGENT_TOOLS_CONFIG.md`
- BigQuery queries: `/BIGQUERY_GA4_QUERIES.md`
