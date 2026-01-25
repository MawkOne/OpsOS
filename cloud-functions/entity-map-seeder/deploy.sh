#!/bin/bash

# Deploy Entity Map Seeder Cloud Function

echo "🚀 Deploying Entity Map Seeder..."

gcloud functions deploy entity-map-seeder \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=seed_entity_map \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB \
  --project=opsos-864a1

echo "✅ Deployment complete!"
echo ""
echo "Test with:"
echo "curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/entity-map-seeder \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"organizationId\": \"SBjucW1ztDyFYWBz7ZLE\"}'"
