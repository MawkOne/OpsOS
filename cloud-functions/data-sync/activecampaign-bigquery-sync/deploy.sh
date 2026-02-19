#!/bin/bash
# Deploy ActiveCampaign BigQuery Sync Cloud Function

set -e

FUNCTION_NAME="activecampaign-bigquery-sync"
REGION="us-central1"
PROJECT_ID="opsos-864a1"

echo "🚀 Deploying $FUNCTION_NAME..."

gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=sync_activecampaign_to_bigquery \
  --trigger-http \
  --allow-unauthenticated \
  --memory=2GB \
  --timeout=540s \
  --project=$PROJECT_ID

echo "✅ Deployed $FUNCTION_NAME"
echo "URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/$FUNCTION_NAME"
