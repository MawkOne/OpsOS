# OpsOS Marketing Intelligence Agent

Local development agent using Google ADK (Agent Development Kit).

## Setup

### 1. Install ADK

```bash
pip3 install google-adk
```

### 2. Set Your API Key

Get your Gemini API key from: https://aistudio.google.com/apikey

Then create a `.env` file:

```bash
cd marketing_agent
echo 'GOOGLE_API_KEY="your-actual-key-here"' > .env
```

### 3. Run the Agent

**Command-line interface:**

```bash
export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:$PATH"
cd /Users/markhenderson/Cursor\ Projects/OpsOS
adk run marketing_agent
```

**Web interface:**

```bash
export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:$PATH"
cd /Users/markhenderson/Cursor\ Projects/OpsOS
adk web --port 8000
```

Then open: http://localhost:8000

---

## Test Queries

Try these queries in the agent:

### Query 1: Events Discovery
```
"What marketing events are we tracking?"
```

**Expected Response:**
- 80 total events
- Breakdown by category (Acquisition, Activation, Engagement, etc.)
- Top events by volume

### Query 2: Traffic Analysis
```
"Which traffic source should I focus on?"
```

**Expected Response:**
- Quality scores for all sources
- Top 3 best performing sources
- Actionable recommendations

### Query 3: Combined Analysis
```
"Why are my signups dropping?"
```

**Expected Response:**
- Agent calls both tools
- Correlates event data with traffic data
- Provides root cause hypothesis

---

## What the Agent Does

### Tools Available:

1. **discover_marketing_events()**
   - Categorizes 80+ tracked events
   - Shows trends (up/down/stable)
   - Breaks down by business function

2. **analyze_traffic_sources()**
   - Evaluates 11 traffic sources
   - Calculates quality scores (0-10)
   - Compares organic vs paid
   - Generates automated insights

### Data Sources:

Both tools connect to Cloud Functions that query BigQuery:
- `ga_events_raw_latest` (80 events, 49M total events)
- `ga_traffic_sources_raw_latest` (11 sources, 672K users)
- `ga_campaigns_raw_latest` (111 campaigns)
- `ga_pages_raw_latest` (111 pages)

---

## Architecture

```
ADK Agent (Local)
    ↓
Cloud Functions (GCP)
    ↓
BigQuery (firestore_export dataset)
    ↓
Firestore (ga_* collections)
    ↓
Google Analytics 4
```

---

## Next Steps

Once you verify the agent works locally:

1. **Deploy to Agent Engine** (production)
2. **Add more tools** (anomaly detection, causation analysis)
3. **Build UI** in OpsOS app
4. **Schedule automated runs** (daily insights)

---

## Files

- `agent.py` - Main agent code with tools
- `.env` - API keys (create from env.example)
- `__init__.py` - Python package marker
- `README.md` - This file
