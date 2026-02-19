#!/bin/bash

# Deploy All Rollup ETL Cloud Functions
# This script deploys all 5 rollup ETLs in the aggregation hierarchy:
# daily → weekly → monthly → L12M → all-time

set -e  # Exit on any error

echo "=============================================="
echo "🚀 Deploying All Rollup ETLs"
echo "=============================================="
echo ""

# Change to the data-sync directory
cd "$(dirname "$0")"

echo "1/5 Deploying Daily Rollup ETL..."
echo "----------------------------------------------"
cd daily-rollup-etl
chmod +x deploy.sh
./deploy.sh
cd ..
echo ""

echo "2/5 Deploying Weekly Rollup ETL..."
echo "----------------------------------------------"
cd weekly-rollup-etl
chmod +x deploy.sh
./deploy.sh
cd ..
echo ""

echo "3/5 Deploying Monthly Rollup ETL..."
echo "----------------------------------------------"
cd monthly-rollup-etl
chmod +x deploy.sh
./deploy.sh
cd ..
echo ""

echo "4/5 Deploying L12M (Last 12 Months) Rollup ETL..."
echo "----------------------------------------------"
cd l12m-rollup-etl
chmod +x deploy.sh
./deploy.sh
cd ..
echo ""

echo "5/5 Deploying All-Time Rollup ETL..."
echo "----------------------------------------------"
cd alltime-rollup-etl
chmod +x deploy.sh
./deploy.sh
cd ..
echo ""

echo "=============================================="
echo "✅ All Rollup ETLs Deployed Successfully!"
echo "=============================================="
echo ""
echo "Aggregation Hierarchy:"
echo "  daily_entity_metrics (raw → daily)"
echo "      ↓"
echo "  weekly_entity_metrics (daily → weekly)"
echo "      ↓"
echo "  monthly_entity_metrics (daily → monthly)"
echo "      ↓"
echo "  l12m_entity_metrics (monthly → last 12 months)"
echo "      ↓"
echo "  alltime_entity_metrics (monthly → all time)"
echo ""
echo "To backfill all data for an organization, run:"
echo ""
echo "# 1. Backfill daily (if needed)"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"YOUR_ORG_ID\", \"backfill\": true}'"
echo ""
echo "# 2. Backfill weekly"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/weekly-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"YOUR_ORG_ID\", \"backfill\": true}'"
echo ""
echo "# 3. Backfill monthly"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/monthly-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"YOUR_ORG_ID\", \"backfill\": true}'"
echo ""
echo "# 4. Create L12M snapshot"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/l12m-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"YOUR_ORG_ID\"}'"
echo ""
echo "# 5. Create All-Time snapshot"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/alltime-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"YOUR_ORG_ID\"}'"
