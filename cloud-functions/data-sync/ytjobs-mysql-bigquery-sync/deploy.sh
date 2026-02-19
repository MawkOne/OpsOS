#!/bin/bash

# Deploy YTJobs MySQL to BigQuery Sync Cloud Function
# NOTE: This requires SSH_PRIVATE_KEY_B64 to be set (base64 encoded SSH private key)

echo "Deploying ytjobs-mysql-bigquery-sync..."

# Encode the SSH key if it exists locally
if [ -f ~/.ssh/id_rsa ]; then
    SSH_KEY_B64=$(cat ~/.ssh/id_rsa | base64 | tr -d '\n')
else
    echo "WARNING: ~/.ssh/id_rsa not found. You'll need to set SSH_PRIVATE_KEY_B64 manually."
    SSH_KEY_B64=""
fi

gcloud functions deploy ytjobs-mysql-bigquery-sync \
  --project=opsos-864a1 \
  --gen2 \
  --runtime=python312 \
  --region=us-central1 \
  --source=. \
  --entry-point=sync_ytjobs_to_bigquery \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=540s \
  --set-env-vars="MYSQL_HOST=ytjobs-read.cra3jxfluerj.us-east-1.rds.amazonaws.com,MYSQL_PORT=3306,MYSQL_DATABASE=ytjobs,MYSQL_USER=mark,MYSQL_PASSWORD=HZXlTeyLmY+JM9XXMetYZv2G1Y69iT4Utz8wFybl,SSH_HOST=34.199.212.144,SSH_PORT=22,SSH_USER=developer" \
  --set-env-vars="SSH_PRIVATE_KEY_B64=$SSH_KEY_B64"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Test commands:"
echo ""
echo "# Update last 7 days:"
echo 'curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"organizationId": "ytjobs", "mode": "update", "daysBack": 7}'\'''
echo ""
echo "# Full sync (365 days):"
echo 'curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"organizationId": "ytjobs", "mode": "full", "daysBack": 365}'\'''
echo ""
echo "# Specific date range:"
echo 'curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"organizationId": "ytjobs", "mode": "full", "startDate": "2025-01-01", "endDate": "2025-12-31"}'\'''
