#!/bin/bash

# Deploy Daily Rollup ETL Cloud Function

echo "🚀 Deploying Daily Rollup ETL..."

gcloud functions deploy daily-rollup-etl \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=run_daily_rollup \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB \
  --project=opsos-864a1

echo "✅ Deployment complete!"
echo ""
echo "Test with:"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
