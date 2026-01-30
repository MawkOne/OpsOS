#!/bin/bash
# Cleanup Script: Remove Unused Firebase Extensions
# These extensions sync Firestore to BigQuery firestore_export dataset
# which is COMPLETELY UNUSED - nothing queries that dataset
# 
# SAVINGS: ~$50-100/month in compute + storage costs
#
# Run this script to uninstall the extensions from Firebase

set -e

echo "🧹 Removing unused Firebase BigQuery Export extensions..."
echo "   These extensions sync to firestore_export dataset which is unused."
echo ""

PROJECT_ID="opsos-864a1"

# List of extensions to uninstall
EXTENSIONS=(
  "firestore-bigquery-export"
  "firestore-bigquery-export-y0fm"
  "firestore-bigquery-export-dfs-keywords"
  "firestore-bigquery-export-dfs-rank-history"
  "firestore-bigquery-export-dfs-backlinks"
  "firestore-bigquery-export-dfs-refdoms"
)

echo "Extensions to remove:"
for ext in "${EXTENSIONS[@]}"; do
  echo "  - $ext"
done
echo ""

read -p "Continue with uninstallation? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Uninstall each extension
for ext in "${EXTENSIONS[@]}"; do
  echo "📦 Uninstalling $ext..."
  firebase ext:uninstall $ext --project=$PROJECT_ID --force || echo "  ⚠️  Extension may not exist or already removed"
done

echo ""
echo "✅ Extensions removed!"
echo ""
echo "Next step: Delete the unused BigQuery dataset"
echo "Run: bq rm -r -f $PROJECT_ID:firestore_export"
echo ""
echo "Also delete the .env files in /extensions folder (already removed from firebase.json)"
