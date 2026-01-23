#!/bin/bash

# Marketing Optimization Engine - Deployment Script
# Deploys Cloud Function to GCP

set -e

PROJECT_ID="opsos-864a1"
FUNCTION_NAME="marketing-optimization-engine"
REGION="us-central1"
RUNTIME="python311"
ENTRY_POINT="marketing_optimization_engine"
MEMORY="2GB"
TIMEOUT="540s"  # 9 minutes
MIN_INSTANCES="0"
MAX_INSTANCES="10"

echo "🚀 Deploying Marketing Optimization Engine to GCP..."
echo "Project: $PROJECT_ID"
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""

# Deploy the function
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --region=$REGION \
  --runtime=$RUNTIME \
  --source=. \
  --entry-point=$ENTRY_POINT \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --min-instances=$MIN_INSTANCES \
  --max-instances=$MAX_INSTANCES \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT=$PROJECT_ID" \
  --project=$PROJECT_ID

echo ""
echo "✅ Function deployed successfully!"
echo ""

# Get the function URL
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --gen2 \
  --format="value(serviceConfig.uri)")

echo "Function URL: $FUNCTION_URL"
echo ""
echo "Test with:"
echo "curl \"$FUNCTION_URL?organizationId=SBjucW1ztDyFYWBz7ZLE&goalKpi=signups&targetValue=6000\""
echo ""

# Create Cloud Scheduler job (daily at 6am PT)
echo "📅 Setting up Cloud Scheduler (daily at 6am PT)..."
echo ""

SCHEDULER_JOB_NAME="marketing-optimization-daily"
SCHEDULE="0 6 * * *"  # Every day at 6:00 AM
TIMEZONE="America/Los_Angeles"

# Check if job already exists
if gcloud scheduler jobs describe $SCHEDULER_JOB_NAME --location=$REGION --project=$PROJECT_ID &>/dev/null; then
  echo "Updating existing scheduler job..."
  gcloud scheduler jobs update http $SCHEDULER_JOB_NAME \
    --location=$REGION \
    --schedule="$SCHEDULE" \
    --uri="$FUNCTION_URL?organizationId=SBjucW1ztDyFYWBz7ZLE&goalKpi=signups&targetValue=6000" \
    --http-method=GET \
    --time-zone="$TIMEZONE" \
    --project=$PROJECT_ID
else
  echo "Creating new scheduler job..."
  gcloud scheduler jobs create http $SCHEDULER_JOB_NAME \
    --location=$REGION \
    --schedule="$SCHEDULE" \
    --uri="$FUNCTION_URL?organizationId=SBjucW1ztDyFYWBz7ZLE&goalKpi=signups&targetValue=6000" \
    --http-method=GET \
    --time-zone="$TIMEZONE" \
    --project=$PROJECT_ID
fi

echo ""
echo "✅ Scheduler configured!"
echo ""
echo "Scheduler will run daily at 6:00 AM PT"
echo ""
echo "Manual trigger:"
echo "gcloud scheduler jobs run $SCHEDULER_JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "🎉 Deployment complete!"
