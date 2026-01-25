#!/bin/bash

# Deploy Scout AI Engine Cloud Function

echo "🚀 Deploying Scout AI Engine..."

gcloud functions deploy scout-ai-engine \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=run_scout_ai \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=1GB \
  --project=opsos-864a1

echo "✅ Deployment complete!"
echo ""
echo "Test with:"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/scout-ai-engine \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
