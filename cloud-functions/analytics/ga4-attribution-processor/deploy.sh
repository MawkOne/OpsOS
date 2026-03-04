#!/bin/bash

echo "Deploying ga4-attribution-processor..."

gcloud functions deploy ga4-attribution-processor \
  --gen2 \
  --runtime=python312 \
  --region=us-central1 \
  --source=. \
  --entry-point=process_ga4_attribution \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB \
  --max-instances=10

echo "✅ Deployment complete!"
echo ""
echo "Test with:"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ga4-attribution-processor \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"daysBack\": 7}'"
