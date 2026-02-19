#!/bin/bash

# Deploy L12M (Last 12 Months) Rollup ETL Cloud Function

echo "🚀 Deploying L12M Rollup ETL..."

gcloud functions deploy l12m-rollup-etl \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=run_l12m_rollup \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB \
  --project=opsos-864a1

echo "✅ Deployment complete!"
echo ""
echo "Test with:"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/l12m-rollup-etl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
