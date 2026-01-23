#!/bin/bash

# Deploy Marketing Intelligence Cloud Functions
# These functions will be accessible by your Vertex AI Agent without MCP policy issues

PROJECT_ID="opsos-864a1"
REGION="us-central1"

echo "🚀 Deploying Marketing Intelligence Cloud Functions..."
echo ""

# Function 1: Discover Marketing Events
echo "📦 Deploying marketing-discover-events..."
gcloud functions deploy marketing-discover-events \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=marketing-discover-events \
  --entry-point=discover_events \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID \
  --timeout=60s \
  --memory=512MB

if [ $? -eq 0 ]; then
  echo "✅ marketing-discover-events deployed successfully!"
else
  echo "❌ Failed to deploy marketing-discover-events"
  exit 1
fi

echo ""

# Function 2: Analyze Traffic Sources  
echo "📦 Deploying marketing-analyze-traffic..."
gcloud functions deploy marketing-analyze-traffic \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=marketing-analyze-traffic \
  --entry-point=analyze_traffic \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID \
  --timeout=60s \
  --memory=512MB

if [ $? -eq 0 ]; then
  echo "✅ marketing-analyze-traffic deployed successfully!"
else
  echo "❌ Failed to deploy marketing-analyze-traffic"
  exit 1
fi

echo ""
echo "🎉 All functions deployed!"
echo ""
echo "📋 Function URLs:"
gcloud functions describe marketing-discover-events --region=$REGION --project=$PROJECT_ID --gen2 --format="value(serviceConfig.uri)"
gcloud functions describe marketing-analyze-traffic --region=$REGION --project=$PROJECT_ID --gen2 --format="value(serviceConfig.uri)"
echo ""
echo "🔧 Next Steps:"
echo "1. Copy the function URLs above"
echo "2. Update your agent code to use these URLs instead of Vercel"
echo "3. Test the agent!"
