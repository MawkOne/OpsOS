#!/bin/bash

# Scout AI - Master Deployment Script
# This script deploys the complete Scout AI system to Google Cloud

set -e  # Exit on any error

echo "🚀 SCOUT AI DEPLOYMENT"
echo "====================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="opsos-864a1"
DATASET_ID="marketing_ai"
REGION="us-central1"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Dataset ID: $DATASET_ID"
echo "  Region: $REGION"
echo ""

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

if ! command -v bq &> /dev/null; then
    echo -e "${RED}❌ bq CLI not found. Please install Google Cloud SDK.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"
echo ""

# Set active project
echo -e "${BLUE}🔧 Setting active project...${NC}"
gcloud config set project $PROJECT_ID
echo ""

# Step 1: Create BigQuery Dataset
echo -e "${BLUE}📊 STEP 1: Creating BigQuery dataset...${NC}"
if bq ls -d | grep -q $DATASET_ID; then
    echo -e "${YELLOW}⚠️  Dataset '$DATASET_ID' already exists, skipping...${NC}"
else
    bq mk --dataset --location=US $PROJECT_ID:$DATASET_ID
    echo -e "${GREEN}✅ Dataset created${NC}"
fi
echo ""

# Step 2: Create Entity Map Table
echo -e "${BLUE}📊 STEP 2: Creating entity_map table...${NC}"
cd cloud-functions/entity-map-seeder
bq query --use_legacy_sql=false < schema.sql
echo -e "${GREEN}✅ entity_map table created${NC}"
echo ""

# Step 3: Deploy Entity Map Seeder
echo -e "${BLUE}☁️  STEP 3: Deploying entity-map-seeder Cloud Function...${NC}"
echo "  (This takes ~2-3 minutes...)"
gcloud functions deploy entity-map-seeder \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=seed_entity_map \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB \
  --project=$PROJECT_ID
echo -e "${GREEN}✅ entity-map-seeder deployed${NC}"
echo ""

# Step 4: Create Daily Metrics Table
echo -e "${BLUE}📊 STEP 4: Creating daily_entity_metrics table...${NC}"
cd ../daily-rollup-etl
bq query --use_legacy_sql=false < schema.sql
echo -e "${GREEN}✅ daily_entity_metrics table created${NC}"
echo ""

# Step 5: Deploy Daily Rollup ETL
echo -e "${BLUE}☁️  STEP 5: Deploying daily-rollup-etl Cloud Function...${NC}"
echo "  (This takes ~2-3 minutes...)"
gcloud functions deploy daily-rollup-etl \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=run_daily_rollup \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB \
  --project=$PROJECT_ID
echo -e "${GREEN}✅ daily-rollup-etl deployed${NC}"
echo ""

# Step 6: Create Opportunities Tables
echo -e "${BLUE}📊 STEP 6: Creating opportunities & metric_registry tables...${NC}"
cd ../scout-ai-engine
bq query --use_legacy_sql=false < schema.sql
echo -e "${GREEN}✅ opportunities & metric_registry tables created${NC}"
echo ""

# Step 7: Deploy Scout AI Engine
echo -e "${BLUE}☁️  STEP 7: Deploying scout-ai-engine Cloud Function...${NC}"
echo "  (This takes ~2-3 minutes...)"
gcloud functions deploy scout-ai-engine \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=run_scout_ai \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB \
  --project=$PROJECT_ID
echo -e "${GREEN}✅ scout-ai-engine deployed${NC}"
echo ""

# Success Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📋 What was deployed:${NC}"
echo "  ✅ BigQuery dataset: $PROJECT_ID:$DATASET_ID"
echo "  ✅ Table: entity_map"
echo "  ✅ Table: daily_entity_metrics"
echo "  ✅ Table: opportunities"
echo "  ✅ Table: metric_registry (pre-seeded with 8 metrics)"
echo "  ✅ Cloud Function: entity-map-seeder"
echo "  ✅ Cloud Function: daily-rollup-etl"
echo "  ✅ Cloud Function: scout-ai-engine"
echo ""

# Next Steps
echo -e "${BLUE}📝 Next Steps:${NC}"
echo ""
echo "1️⃣  Seed Entity Mappings:"
echo "   curl -X POST http://localhost:3000/api/entity-map/seed \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
echo ""
echo "2️⃣  Backfill Daily Metrics (90 days):"
echo "   curl -X POST http://localhost:3000/api/daily-metrics/sync \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
echo ""
echo "3️⃣  Run Scout AI First Time:"
echo "   curl -X POST http://localhost:3000/api/opportunities/run \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
echo ""
echo "4️⃣  View Opportunities:"
echo "   http://localhost:3000/ai/opportunities"
echo ""
echo -e "${BLUE}📊 Verify Deployment:${NC}"
echo "   BigQuery: https://console.cloud.google.com/bigquery?project=$PROJECT_ID"
echo "   Functions: https://console.cloud.google.com/functions/list?project=$PROJECT_ID"
echo ""
echo -e "${GREEN}✨ Scout AI is ready to detect opportunities!${NC}"
echo ""
