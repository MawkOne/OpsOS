# OpsOS - Operations Operating System

**Marketing AI & Analytics Platform**

---

## 📚 Core Documentation

### Main Specifications
- **[SCOUT_AI_COMPLETE_SPEC.md](./SCOUT_AI_COMPLETE_SPEC.md)** - Complete Scout AI detector specification (50+ detectors)
- **[MARKETING_OPTIMIZATION_ENGINE.md](./MARKETING_OPTIMIZATION_ENGINE.md)** - Marketing optimization engine architecture
- **[initiavites.md](./initiavites.md)** - Business initiatives and planning

### Technical Reference
- **[AGENT_TOOLS_CONFIG.md](./AGENT_TOOLS_CONFIG.md)** - AI agent tools configuration
- **[BIGQUERY_GA4_QUERIES.md](./BIGQUERY_GA4_QUERIES.md)** - GA4 BigQuery queries
- **[BIGQUERY_QUERIES.md](./BIGQUERY_QUERIES.md)** - General BigQuery queries

### Implementation Details
All implementation documentation, historical context, and technical deep-dives are in **[`docs/`](./docs/)**.

---

## 🚀 Quick Start

### Frontend (Next.js)
```bash
cd app
npm install
npm run dev
```

### Cloud Functions
```bash
cd cloud-functions/scout-ai-engine
./deploy.sh
```

### Marketing Agent
```bash
cd marketing_agent
./run.sh
```

---

## 🏗️ Architecture

### Scout AI Engine
**Location:** `cloud-functions/scout-ai-engine/`
- 55 active detectors across 7 marketing areas
- Detects opportunities, anomalies, and optimization potential
- Runs scheduled analysis on marketing data

### Marketing Optimization Engine
**Location:** `cloud-functions/marketing-optimization-engine/`
- ML-powered driver analysis (Random Forest)
- AI recommendations via Gemini 3 Flash
- Identifies highest-impact optimization opportunities

### Frontend Dashboard
**Location:** `app/`
- Next.js + TypeScript + Tailwind
- Real-time marketing insights
- Initiative planning & forecasting

---

## 📊 Data Sources

- **Google Analytics 4** - Web traffic, events, conversions
- **ActiveCampaign** - Email campaigns and automation
- **DataForSEO** - SEO rankings and technical metrics
- **Stripe** - Revenue and transactions
- **QuickBooks** - Expenses and P&L

---

## 🔍 Key Features

### Scout AI (Detection)
- Real-time anomaly detection
- 55 opportunity detectors across:
  - Email Marketing (6 detectors)
  - SEO (9 detectors)
  - Advertising (9 detectors)
  - Pages (9 detectors)
  - Content (4 detectors)
  - Traffic (9 detectors)
  - Revenue (9 detectors)

### Marketing Optimization (ML Analysis)
- Feature importance ranking
- Gap-to-benchmark analysis
- AI-powered recommendations
- Impact estimation (lift predictions)
- Priority scoring (impact/effort)

---

## 📂 Project Structure

```
OpsOS/
├── app/                        # Next.js frontend
│   ├── src/app/               # App routes
│   ├── src/components/        # React components
│   └── src/lib/              # Utilities
│
├── cloud-functions/           # GCP Cloud Functions
│   ├── scout-ai-engine/      # Opportunity detection
│   │   ├── detectors/        # 23 core detectors
│   │   └── expansion_*.py    # 32 expansion detectors
│   ├── marketing-optimization-engine/  # ML analysis
│   └── daily-rollup-etl/     # Data ETL
│
├── marketing_agent/          # AI marketing agent
├── docs/                     # Implementation docs
└── [Core docs in root]      # Main specifications
```

---

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Python 3.12+
- GCP account with BigQuery & Cloud Functions
- Firebase project

### Environment Variables
See `app/.env.example` and `marketing_agent/env.example`

---

## 📖 Documentation Index

**Root Documentation (Start Here):**
- Core specifications and architecture

**`docs/` Folder:**
- Implementation details
- Historical context
- Technical deep-dives
- Migration summaries
- Comparison analyses

---

## 🤝 Contributing

Implementation documentation and technical notes should go in the `docs/` folder to keep the root clean.

---

## 📝 License

Proprietary - All rights reserved
