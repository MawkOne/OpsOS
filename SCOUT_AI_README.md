# 🤖 Scout AI - Marketing Opportunity Detection System

## What Is Scout AI?

Scout AI is an **automated marketing intelligence system** that continuously analyzes your cross-channel data to detect opportunities for:
- 🚀 **Scaling winners** (high-performing, under-resourced)
- 🔧 **Fixing losers** (high-traffic, poor conversion)
- 📉 **Preventing declines** (early warning system)
- 🎯 **Cross-channel optimization** (organic vs paid gaps)
- ⚠️ **SEO issues** (keyword cannibalization)
- 💸 **Cost savings** (poor ROI campaigns)
- 📧 **Email health** (engagement drops)

**Think of it as:** A data analyst + growth marketer who never sleeps, constantly monitoring your metrics and surfacing actionable insights.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR MARKETING DATA                          │
│  Firestore: ga_pages, ga_campaigns, dataforseo_keywords, etc.  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ENTITY MAPPING LAYER                            │
│  Links entities across platforms                                │
│  /pricing (GA4) ←→ page_pricing ←→ landing_123 (Ads)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DAILY ROLLUP ETL                                │
│  Aggregates monthly Firestore data into daily entity metrics    │
│  BigQuery: daily_entity_metrics (partitioned, clustered)        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SCOUT AI ENGINE                                 │
│  7 Detectors run daily:                                          │
│  - Scale Winners        - Cross-Channel Gaps                    │
│  - Fix Losers           - Keyword Cannibalization               │
│  - Declining Performers - Cost Inefficiency                     │
│  - Email Engagement Drop                                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                ▼                        ▼
    ┌───────────────────┐    ┌──────────────────┐
    │   BigQuery        │    │   Firestore      │
    │   opportunities   │    │   opportunities  │
    └─────────┬─────────┘    └────────┬─────────┘
              │                       │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │   OPPORTUNITIES UI    │
              │   /ai/opportunities   │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Slack Notifications │
              │   (Daily Summaries)   │
              └───────────────────────┘
```

---

## Key Features

### 🎯 Intelligent Detection

**Scale Winners:**
- Finds high-conversion, low-traffic entities
- Example: "Pricing page has 5% conversion but only 100 sessions. Increase traffic to 1000 sessions = 10x revenue."

**Fix Losers:**
- Identifies high-traffic, poor-performing entities
- Example: "Homepage gets 5000 sessions but only 0.3% conversion. Even a 1% improvement = $10k/month."

**Declining Performers:**
- Early warning for traffic/revenue drops
- Example: "Blog traffic down 35% month-over-month. Check for SEO ranking loss."

**Cross-Channel Gaps:**
- Finds organic winners without paid support
- Example: "This page converts well organically but has $0 ad spend. Supporting with paid could scale."

**Keyword Cannibalization:**
- Detects multiple pages competing for same keywords
- Example: "3 pages targeting 'best CRM' are diluting authority. Consolidate."

**Cost Inefficiency:**
- Flags campaigns losing money
- Example: "Campaign spent $500 but generated $300 revenue. Pause or optimize."

**Email Engagement Drop:**
- Alerts on declining email performance
- Example: "Open rate dropped from 35% to 18%. List fatigue or deliverability issue."

### 📊 Scoring & Prioritization

Each opportunity gets 3 scores:
1. **Confidence** (0-100%): How sure we are this is real
2. **Impact** (0-100): Potential revenue/improvement
3. **Urgency** (0-100): How time-sensitive

Opportunities are ranked by: `Impact × Confidence × Urgency`

### 🎨 Beautiful UI

- **Dashboard view**: All opportunities at a glance
- **Filtering**: By status, priority, category
- **Expandable cards**: Full analysis + recommendations
- **Action tracking**: Acknowledge → In Progress → Complete
- **Stats**: High/medium/low priority counts, avg impact

### 🔔 Slack Integration

Daily summaries include:
- Total opportunity count
- Priority breakdown
- Top 3 high-priority items
- Direct link to dashboard

---

## Components

### 1. Entity Map Seeder (`entity-map-seeder`)

**Purpose:** Create canonical IDs linking entities across platforms

**Input:** Firestore collections (ga_pages, ga_campaigns, etc.)

**Output:** 
- BigQuery `entity_map` table
- Firestore `entity_map` collection

**Example:**
```
/pricing (GA4) → page_pricing
landing_page_123 (Ads) → page_pricing
prod_ABC (Stripe) → product_pro
```

### 2. Daily Rollup ETL (`daily-rollup-etl`)

**Purpose:** Transform monthly Firestore data into daily entity metrics

**Input:** 
- Firestore monthly data (ga_pages, ga_campaigns, etc.)
- Entity mappings

**Output:** BigQuery `daily_entity_metrics` table

**Metrics per entity per day:**
- Traffic: impressions, clicks, sessions, users, pageviews
- Engagement: bounce_rate, avg_session_duration, engagement_rate
- Conversion: conversions, conversion_rate
- Revenue: revenue, cost, profit, roas, roi
- SEO: position, search_volume
- Email: opens, open_rate, click_through_rate

### 3. Scout AI Engine (`scout-ai-engine`)

**Purpose:** Run detectors to find opportunities

**Input:** BigQuery `daily_entity_metrics`

**Output:**
- BigQuery `opportunities` table
- Firestore `opportunities` collection
- Slack notifications (optional)

**Runs:** 7 detectors (see Key Features above)

### 4. Opportunities UI (`/ai/opportunities`)

**Purpose:** Display and manage opportunities

**Features:**
- List all opportunities
- Filter by status/priority/category
- Expand for full details
- Take actions (acknowledge, start, complete, dismiss)
- "Run Scout AI" button for manual runs

### 5. API Routes

**`/api/entity-map`**
- `GET`: List entity mappings
- `POST`: Create mapping
- `DELETE`: Delete mapping

**`/api/entity-map/seed`**
- `POST`: Trigger entity mapping from Firestore

**`/api/daily-metrics/sync`**
- `POST`: Trigger daily rollup ETL

**`/api/opportunities`**
- `GET`: List opportunities
- `PATCH`: Update opportunity status

**`/api/opportunities/run`**
- `POST`: Trigger Scout AI detection

---

## Data Flow

### Daily (Automated)

```
2:00 AM - Daily Rollup ETL runs
  ↓
  Reads yesterday's Firestore data
  ↓
  Writes to daily_entity_metrics
  ↓
6:00 AM - Scout AI Engine runs
  ↓
  Queries daily_entity_metrics
  ↓
  Runs 7 detectors
  ↓
  Writes opportunities to BigQuery + Firestore
  ↓
  Sends Slack notification
  ↓
8:00 AM - User opens dashboard
  ↓
  Sees new opportunities
  ↓
  Takes action
```

### On-Demand (Manual)

```
User clicks "Run Scout AI"
  ↓
  API calls /api/opportunities/run
  ↓
  Triggers scout-ai-engine Cloud Function
  ↓
  Detects opportunities
  ↓
  Returns results to UI
```

---

## Technology Stack

**Backend:**
- **Cloud Functions** (Python 3.11): Serverless compute
- **BigQuery**: Data warehouse + analytics
- **Firestore**: Real-time database + mirrors

**Frontend:**
- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling

**Integrations:**
- **Slack**: Notifications via webhooks
- **Cloud Scheduler**: Daily automation

---

## Deployment

See **[SCOUT_AI_DEPLOYMENT_GUIDE.md](./SCOUT_AI_DEPLOYMENT_GUIDE.md)** for complete step-by-step instructions.

**Quick Start:**
```bash
# 1. Create BigQuery dataset
bq mk --dataset opsos-864a1:marketing_ai

# 2. Deploy all Cloud Functions
cd cloud-functions/entity-map-seeder && ./deploy.sh
cd cloud-functions/daily-rollup-etl && ./deploy.sh
cd cloud-functions/scout-ai-engine && ./deploy.sh

# 3. Seed data
curl -X POST http://localhost:3000/api/entity-map/seed -d '{"organizationId":"YOUR_ORG_ID"}'
curl -X POST http://localhost:3000/api/daily-metrics/sync -d '{"organizationId":"YOUR_ORG_ID"}'

# 4. Run Scout AI
curl -X POST http://localhost:3000/api/opportunities/run -d '{"organizationId":"YOUR_ORG_ID"}'

# 5. View in UI
open http://localhost:3000/ai/opportunities
```

---

## Customization

### Add New Detector

1. Create detector function in `cloud-functions/scout-ai-engine/detectors.py`:

```python
def detect_my_custom_opportunity(organization_id: str) -> list:
    """Detect custom opportunity"""
    opportunities = []
    
    # Your BigQuery query
    query = f"""
    SELECT ...
    FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
    WHERE organization_id = @org_id
    """
    
    # Process results and create opportunities
    for row in results:
        opportunities.append({
            'id': str(uuid.uuid4()),
            'organization_id': organization_id,
            'category': 'my_category',
            'type': 'my_type',
            'priority': 'high',
            'title': 'My Opportunity',
            'description': 'Description here',
            # ... other fields
        })
    
    return opportunities
```

2. Add to orchestrator in `main.py`:

```python
from detectors import detect_my_custom_opportunity

# In run_scout_ai function:
all_opportunities.extend(detect_my_custom_opportunity(organization_id))
```

3. Redeploy:

```bash
cd cloud-functions/scout-ai-engine && ./deploy.sh
```

### Adjust Thresholds

Edit detector queries to change sensitivity:

```python
# In detect_scale_winners:
WHERE conversion_percentile > 0.7  # Change from 0.7 to 0.8 for stricter
  AND traffic_percentile < 0.3     # Change from 0.3 to 0.2 for stricter
```

### Add Slack Formatting

Edit `send_slack_notification()` in `main.py` to customize message format.

---

## Performance

### Query Optimization

- **Partitioning**: Tables partitioned by date
- **Clustering**: Clustered by organization_id, entity_id
- **Date filters**: Always include date ranges to limit scans

### Cost Optimization

**BigQuery:**
- Partitioned tables reduce scan costs by 90%
- Typical query scans < 100 MB
- Expected cost: < $1/day

**Cloud Functions:**
- Run times: 30s - 3 minutes
- Memory: 512 MB - 1 GB
- Expected cost: < $5/month

### Scale

- **Handles:** 100k+ entities, millions of daily metrics
- **Query time:** < 5 seconds per detector
- **Total Scout AI run:** < 2 minutes for all detectors

---

## Future Enhancements

1. **More Detectors:**
   - Budget allocation optimizer
   - Content gap analysis
   - Competitive monitoring
   - Seasonal trend detector

2. **Machine Learning:**
   - Predictive opportunity scoring
   - Automated action recommendations
   - Impact forecasting

3. **Advanced UI:**
   - Opportunity trends over time
   - Action history and results tracking
   - ROI measurement for completed opportunities

4. **Integrations:**
   - Microsoft Teams notifications
   - Email digests
   - Jira ticket creation
   - Direct integration with ad platforms

---

## Support

**Documentation:**
- [Deployment Guide](./SCOUT_AI_DEPLOYMENT_GUIDE.md)
- [Implementation Plan](./SCOUT_AI_IMPLEMENTATION_PLAN.md)
- [Code](./cloud-functions/)

**Troubleshooting:**
See "Troubleshooting" section in SCOUT_AI_DEPLOYMENT_GUIDE.md

---

## License

Proprietary - OpsOS Internal Project

---

**Built with ❤️ by the OpsOS team**
