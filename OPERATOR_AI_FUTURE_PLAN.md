# Operator AI Implementation Plan
## Automated Marketing Execution (Future Project)

**Status:** Not Started - Build AFTER Scout AI is complete
**Prerequisites:** Scout AI must be running successfully for 1-2 months
**Timeline:** 6 weeks after Scout AI launch
**Goal:** Automate safe, guardrailed execution of approved opportunities

---

## Why Wait?

**Operator AI should come second because:**
1. **Scout provides value immediately** - Insights are useful without automation
2. **Need to validate Scout accuracy** - Operator should only act on reliable recommendations
3. **Build trust gradually** - Users need to trust AI recommendations before automation
4. **Safety first** - Automated actions require extensive testing and guardrails
5. **Learn from Scout** - Understand which opportunity types succeed before automating

**Success Criteria Before Building Operator:**
- ✅ Scout running for 60+ days
- ✅ Scout accuracy >75% (opportunities that work when manually actioned)
- ✅ 100+ opportunities manually actioned successfully
- ✅ User trust established
- ✅ Clear patterns of which actions are safe to automate

---

## What Operator AI Will Do

### Safe Actions (Auto-Execute):
1. **Google Ads:**
   - Pause campaigns with 0 conversions after $500 spend
   - Budget shifts ≤20% within caps
   - Add negative keywords (high spend, 0 conversions)
   - Increase bids on high-ROAS keywords (≤20%)

2. **ActiveCampaign:**
   - Create A/B tests for subject lines
   - Adjust send times based on open patterns
   - Trigger lifecycle automations (trial activation, winback)
   - Pause underperforming campaigns

3. **Content:**
   - Generate content briefs
   - Suggest internal link additions
   - Flag content for refresh

### Approval-Required Actions:
1. **Google Ads:**
   - Budget increases >20%
   - New campaigns
   - Brand campaign changes
   - Bid strategy changes

2. **ActiveCampaign:**
   - New automations
   - Segment changes
   - List modifications

3. **Website/CMS:**
   - Landing page changes
   - A/B tests that affect revenue
   - Copy changes

---

## Architecture Overview

### Components to Build:

**1. Operator Engine (Cloud Function)**
```
/cloud-functions/marketing-operator-ai/
  - main.py (orchestrator)
  - actions/
    - google_ads.py
    - activecampaign.py
    - content.py
  - guardrails.py
  - rollback.py
```

**2. Platform Connectors**
- Google Ads API client
- ActiveCampaign API client
- OAuth token management
- Rate limiting

**3. Guardrails System**
- Hard limits enforcement
- Safety checks before execution
- Rollback capabilities
- Emergency stop mechanism

**4. Actions Log**
- Firestore/BigQuery table
- Every action logged with full context
- Result tracking
- Impact measurement

**5. Rollback System**
- Undo recent actions
- Restore previous state
- Manual override capability

---

## Database Schema

### Actions Log Table:
```sql
CREATE TABLE marketing_ai.actions_log (
  action_id STRING NOT NULL,
  opportunity_id STRING,
  organization_id STRING NOT NULL,
  
  action_type STRING NOT NULL,
  platform STRING NOT NULL,
  
  payload JSON NOT NULL,
  executed_at TIMESTAMP,
  executed_by STRING,
  
  status STRING NOT NULL,
  result JSON,
  error_message STRING,
  
  rollback_plan JSON,
  rolled_back_at TIMESTAMP,
  
  measurement_checkpoints ARRAY<TIMESTAMP>
);
```

### Experiments Table:
```sql
CREATE TABLE marketing_ai.experiments (
  experiment_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  opportunity_id STRING,
  
  type STRING NOT NULL,
  entity_id STRING NOT NULL,
  
  variants JSON NOT NULL,
  primary_metric STRING NOT NULL,
  
  started_at TIMESTAMP,
  minimum_runtime_days INT64,
  stop_rules JSON,
  guardrails JSON,
  
  status STRING,
  winner STRING,
  results JSON
);
```

---

## Guardrails (Critical Safety Layer)

### Hard Rules:
```python
class Guardrails:
    # Budget Rules
    MAX_DAILY_BUDGET_INCREASE_PCT = 0.20  # Never >20%
    MIN_MER_FOR_INCREASE = 2.0  # Must maintain 2x ROAS
    MAX_DAILY_SPEND_CAP = 5000  # Never exceed $5K/day
    
    # Pause Rules
    MIN_SPEND_BEFORE_PAUSE = 500  # Must spend $500 before auto-pause
    BRAND_CAMPAIGNS_NO_AUTO_PAUSE = True
    
    # Conversion Rules
    MIN_CONVERSIONS_FOR_SCALE = 5  # Need 5+ conversions before scaling
    
    # Emergency Stop
    MAX_ACTIONS_PER_HOUR = 10  # Rate limit
    ENABLE_EMERGENCY_STOP = True  # Kill switch
```

### Pre-Execution Checks:
```python
def check_before_execution(action):
    # 1. Verify guardrails pass
    if not guardrails_pass(action):
        return False, "Guardrails failed"
    
    # 2. Verify opportunity still valid
    if opportunity_expired(action.opportunity_id):
        return False, "Opportunity expired"
    
    # 3. Verify user hasn't dismissed
    if opportunity_dismissed(action.opportunity_id):
        return False, "User dismissed"
    
    # 4. Verify platform credentials valid
    if not platform_connected(action.platform):
        return False, "Platform not connected"
    
    # 5. Verify similar action hasn't failed recently
    if recent_similar_failure(action):
        return False, "Similar action failed recently"
    
    return True, "OK"
```

---

## Implementation Timeline (6 Weeks)

### Week 1: Platform Connectors
- Google Ads API integration
- ActiveCampaign API integration
- OAuth token management
- Rate limiting & retry logic

### Week 2: Guardrails System
- Hard limits implementation
- Pre-execution safety checks
- Emergency stop mechanism
- Testing with sandbox accounts

### Week 3: Operator Engine
- Orchestrator framework
- Action execution logic
- Error handling
- Rollback system

### Week 4: Actions Implementation
- Google Ads actions (5 types)
- ActiveCampaign actions (4 types)
- Content actions (3 types)
- Testing each action type

### Week 5: Logging & Measurement
- Actions log table
- Impact measurement
- Success rate tracking
- Experiments framework

### Week 6: UI & Launch
- Actions dashboard UI
- Rollback interface
- Settings/controls
- Sandbox testing → Production

---

## Success Metrics

### Week 2 (After Guardrails):
- ✅ All safety checks pass in tests
- ✅ Emergency stop works
- ✅ No unsafe actions possible

### Week 4 (After Actions):
- ✅ 12 action types implemented
- ✅ All actions tested in sandbox
- ✅ Rollback works for all actions

### Week 6 (Launch):
- ✅ Operator executes 1-2 safe actions per week
- ✅ 0 rollbacks needed due to errors
- ✅ 100% of actions logged

### Month 2:
- ✅ 20+ actions executed successfully
- ✅ Operator success rate >90%
- ✅ At least 1 measurable win

---

## Costs

**Development:** 6 weeks full-time engineer

**Infrastructure (additional monthly):**
- Cloud Functions: +$20-30 (execution)
- API costs: +$50 (Google Ads, etc.)
- **Total: +$70-80/month on top of Scout**

---

## Risk Mitigation

### What Could Go Wrong:
1. **Operator makes bad decisions** → Guardrails prevent unsafe actions
2. **API errors cause failed actions** → Rollback system + retry logic
3. **User loses trust** → Manual approval for high-risk actions
4. **Budget overspend** → Hard caps + daily limits
5. **Platform account issues** → Emergency stop + notifications

### How We Prevent:
- Start with only 3-5 safest action types
- Require manual approval for first month
- Monitor every action closely
- Easy rollback for everything
- Kill switch accessible 24/7

---

## Launch Strategy

### Phase 1: Sandbox Mode (Week 6-7)
- Operator runs but doesn't execute
- Shows what it *would* do
- Users approve each mock action
- Build confidence

### Phase 2: Safe Actions Only (Week 8-9)
- Execute only 3 safest actions:
  1. Pause $500+ spend campaigns with 0 conversions
  2. Add negative keywords (proven waste)
  3. Create email A/B tests
- Manual approval still available
- Monitor closely

### Phase 3: Gradual Expansion (Month 3)
- Add budget shift actions (±20%)
- Add lifecycle automation triggers
- Still requires patterns of success

### Phase 4: Full Automation (Month 4+)
- All 12 action types
- Approval only for high-risk
- Operator becomes trusted co-pilot

---

## When NOT to Build Operator

**Don't build Operator AI if:**
- Scout accuracy is <70%
- Users don't trust Scout recommendations
- <50 opportunities manually actioned
- Frequent data quality issues
- Unstable platform integrations
- Budget constraints

**Operator requires:**
- Rock-solid data pipeline
- Trusted Scout AI
- Stable platform APIs
- Clear ROI from Scout alone
- User demand for automation

---

## Decision Point

**Before starting Operator AI, ask:**
1. Has Scout been running successfully for 60+ days?
2. Is Scout accuracy >75%?
3. Have we actioned 100+ opportunities manually?
4. Do users trust the recommendations?
5. Are we seeing clear ROI from Scout alone?
6. Do we have eng bandwidth for 6 weeks?
7. Do we have budget for additional infrastructure?

**If yes to all 7 → Build Operator**
**If no to any → Keep using Scout, revisit in 30 days**

---

## Next Steps (When Ready)

1. Review this plan
2. Confirm Scout success metrics met
3. Get user feedback on automation appetite
4. Allocate engineering resources
5. Start with Week 1: Platform Connectors

---

**For now: Focus 100% on Scout AI** 🎯
