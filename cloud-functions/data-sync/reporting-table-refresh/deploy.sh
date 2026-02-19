#!/bin/bash
# Deploy Reporting Table Refresh Cloud Function

set -e

FUNCTION_NAME="reporting-table-refresh"
REGION="us-central1"
PROJECT_ID="opsos-864a1"

echo "🚀 Deploying $FUNCTION_NAME..."

gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=refresh_reporting_tables \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=540s \
  --project=$PROJECT_ID

echo "✅ Deployed $FUNCTION_NAME"
echo "URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/$FUNCTION_NAME"
