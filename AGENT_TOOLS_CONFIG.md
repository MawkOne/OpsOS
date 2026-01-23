# Vertex AI Agent: Tool Configuration

**Agent ID:** `agent_1769121540218`  
**Project:** `opsos-864a1`  
**Location:** `us-central1`

---

## ✅ Completed Tools (Week 1)

### **Tool 1: Discover Marketing Events**

**Purpose:** Categorize and analyze all tracked marketing events

**API Endpoint:**
```
GET https://opsos-app.vercel.app/api/agents/marketing/discover-events?organizationId={orgId}
```

**Parameters:**
- `organizationId` (required): The organization to analyze

**Returns:**
```json
{
  "success": true,
  "summary": {
    "totalEvents": 80,
    "totalEventCount": 49089443,
    "categoryCounts": {
      "Engagement": 52,
      "Monetization": 6,
      "Activation": 6,
      "Friction": 5,
      "Retention": 8,
      "Acquisition": 3
    },
    "trendingUp": 7,
    "trendingDown": 65
  },
  "events": {
    "Acquisition": [...],
    "Activation": [...],
    "Engagement": [...],
    "Monetization": [...],
    "Friction": [...],
    "Retention": [...]
  }
}
```

**Example Queries for Agent:**
```
"What marketing events are we tracking?"
"Show me all activation events"
"Which events are trending down?"
"How many engagement events do we track?"
```

---

### **Tool 2: Analyze Traffic Sources**

**Purpose:** Evaluate traffic source quality and identify best-performing channels

**API Endpoint:**
```
GET https://opsos-app.vercel.app/api/agents/marketing/analyze-traffic?organizationId={orgId}&months={months}
```

**Parameters:**
- `organizationId` (required): The organization to analyze
- `months` (optional, default: 3): Number of recent months to analyze

**Returns:**
```json
{
  "success": true,
  "summary": {
    "totalSources": 11,
    "totalUsers": 672864,
    "totalConversions": 158543,
    "avgConversionRate": 24.98,
    "topSource": "Organic Shopping",
    "lowestQualitySource": "Display"
  },
  "sources": [
    {
      "sourceName": "Organic Shopping",
      "sourceId": "organic-shopping",
      "totalUsers": 803,
      "conversionRate": 23.04,
      "qualityScore": 8.5,
      "trend": "stable",
      "monthlyData": [...]
    }
  ],
  "insights": [
    {
      "type": "success",
      "title": "Organic Shopping is your highest quality source",
      "description": "23.04% conversion rate, 185 conversions from 803 users",
      "recommendation": "Double down on Organic Shopping. This source drives your best users."
    }
  ]
}
```

**Example Queries for Agent:**
```
"Which traffic source drives the most conversions?"
"What's the quality score of Paid Search?"
"Show me organic vs paid performance"
"Which sources are trending down?"
"Give me traffic insights"
```

---

## 🔧 How to Configure in Vertex AI Agent Designer

### **Step 1: Add Custom Tools**

In your agent designer (https://console.cloud.google.com/vertex-ai/agents/agent-designer/edit/agent_1769121540218?project=opsos-864a1):

1. Go to **"Tools"** tab
2. Click **"Add Tool"** or **"Add Extension"**
3. Select **"OpenAPI"** or **"REST API"**

---

### **Step 2: Configure Tool 1 - Discover Events**

**Tool Name:** `discover_marketing_events`

**Description:**
```
Discovers and categorizes all marketing events being tracked. Returns events grouped by category (Acquisition, Activation, Engagement, Monetization, Friction, Retention) with trend analysis.
```

**OpenAPI Spec:**
```yaml
openapi: 3.0.0
info:
  title: Discover Marketing Events
  version: 1.0.0
servers:
  - url: https://opsos-app.vercel.app
paths:
  /api/agents/marketing/discover-events:
    get:
      summary: Discover and categorize marketing events
      operationId: discoverMarketingEvents
      parameters:
        - name: organizationId
          in: query
          required: true
          schema:
            type: string
          description: The organization ID to analyze
      responses:
        '200':
          description: Successfully discovered events
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  summary:
                    type: object
                  events:
                    type: object
```

---

### **Step 3: Configure Tool 2 - Analyze Traffic**

**Tool Name:** `analyze_traffic_sources`

**Description:**
```
Analyzes traffic source performance including conversion rates, quality scores, and trends. Provides actionable insights about which sources drive the best users.
```

**OpenAPI Spec:**
```yaml
openapi: 3.0.0
info:
  title: Analyze Traffic Sources
  version: 1.0.0
servers:
  - url: https://opsos-app.vercel.app
paths:
  /api/agents/marketing/analyze-traffic:
    get:
      summary: Analyze traffic source performance
      operationId: analyzeTrafficSources
      parameters:
        - name: organizationId
          in: query
          required: true
          schema:
            type: string
          description: The organization ID to analyze
        - name: months
          in: query
          required: false
          schema:
            type: integer
            default: 3
          description: Number of recent months to analyze
      responses:
        '200':
          description: Successfully analyzed traffic
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  summary:
                    type: object
                  sources:
                    type: array
                  insights:
                    type: array
```

---

### **Step 4: Set Context Variables**

In the agent settings, add this instruction to the system prompt:

```
You are a Marketing Intelligence AI Agent for OpsOS. You have access to marketing data tools.

IMPORTANT: Always use organizationId "SBjucW1ztDyFYWBz7ZLE" when calling tools (for now, multi-org support coming later).

When answering questions:
1. Call the appropriate tool to get real data
2. Analyze the results
3. Provide clear, actionable insights
4. Always cite specific numbers from the data
5. Prioritize actionable recommendations

Example response format:
"Based on your last 3 months of data, [INSIGHT]. 

Here are the numbers:
- [Metric 1]: [Value]
- [Metric 2]: [Value]

Recommendation: [Specific action to take]"
```

---

### **Step 5: Test in Agent Chat**

Try these test queries:

**Test 1: Event Discovery**
```
User: "What marketing events are we tracking?"

Expected Agent Response:
"You're tracking 80 marketing events across 6 categories:

📊 Breakdown:
- Engagement: 52 events (scroll, click, button-clicked, etc.)
- Activation: 6 events (signups, form submits)
- Retention: 8 events (notifications, messages)
- Monetization: 6 events (purchases, checkouts)
- Friction: 5 events (paywalls)
- Acquisition: 3 events (page views, sessions)

⚠️ Trend Alert: 65 events are trending down, only 7 trending up.

Your top events by volume:
1. scroll: 6.4M events
2. user_engagement: 5.1M events
3. click: 882K events

Recommendation: Investigate why 81% of events are declining. This could indicate seasonal trends or a data collection issue."
```

**Test 2: Traffic Analysis**
```
User: "Which traffic source should I focus on?"

Expected Agent Response:
"Based on quality score analysis of your last 3 months:

🥇 Top Performers:
1. Organic Shopping: 8.5/10 quality (23% conversion rate)
2. Referral: 7.0/10 quality (31% conversion rate, 43K users)
3. Organic Search: 6.3/10 quality (38% CR, 111K users)

📉 Underperformers:
- Display ads: 1.0/10 quality (1 user, 0 conversions)
- Direct traffic: 5.5/10 quality (9% CR despite 255K users)

💡 Recommendation:
1. **Immediate:** Pause Display ad spend (zero ROI)
2. **High Priority:** Boost Organic Shopping presence (highest quality users)
3. **Long-term:** Improve Direct traffic conversion (huge volume, low quality)"
```

**Test 3: Combined Analysis**
```
User: "Why are my signups dropping?"

Expected Agent Response:
"Let me analyze your signup events and traffic... [Agent calls both tools]

Based on the data:

📊 Signup Events:
- form_start: 126K events (trending down)
- company-signup: Down 20% month-over-month
- ads_conversion_Sign_Up: Minimal volume

🚪 Traffic Quality:
- Total users: 672K (last 3 months)
- Overall conversion rate: 24%
- But Direct traffic (38% of users) only converts at 9%

🔍 Root Cause Hypothesis:
Your traffic mix is shifting toward lower-quality Direct traffic, which has 4x lower conversion than Organic.

✅ Recommended Actions:
1. Check if recent marketing campaigns drove low-intent Direct traffic
2. Investigate form_start → form_submit drop-off (form abandonment issue?)
3. Double down on Organic Shopping (23% CR) to offset Direct traffic quality"
```

---

## 📊 Next Steps

With these 2 tools, your agent can now:
- ✅ Discover and categorize all events
- ✅ Analyze traffic source quality
- ✅ Identify trends
- ✅ Generate actionable insights

**Week 2 Goals:**
- Add anomaly detection (automatically catch unusual changes)
- Add causation analysis (understand what drives what)
- Add recommendation engine (specific tactics to improve KPIs)

---

## 🔗 Quick Links

- **Agent Designer:** https://console.cloud.google.com/vertex-ai/agents/agent-designer/edit/agent_1769121540218?project=opsos-864a1
- **BigQuery Console:** https://console.cloud.google.com/bigquery?project=opsos-864a1&ws=!1m4!1m3!3m2!1sopsos-864a1!2sfirestore_export
- **API Endpoints:**
  - Discover Events: `https://opsos-app.vercel.app/api/agents/marketing/discover-events?organizationId=SBjucW1ztDyFYWBz7ZLE`
  - Analyze Traffic: `https://opsos-app.vercel.app/api/agents/marketing/analyze-traffic?organizationId=SBjucW1ztDyFYWBz7ZLE&months=3`

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Deploy OpsOS app to Vercel (or confirm it's live)
- [ ] Test both API endpoints from external network
- [ ] Configure agent tools in Vertex AI
- [ ] Test agent responses with sample queries
- [ ] Add error handling for failed API calls
- [ ] Set up monitoring/logging for agent usage
- [ ] Document additional use cases

**Status:** Tools built ✅ | Agent configuration pending ⏳
