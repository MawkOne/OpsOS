#!/bin/bash
# =============================================================================
# OpsOS Cloud Functions - Unified Deployment Script
# =============================================================================
# This script deploys all Cloud Functions to Google Cloud Functions (Gen2)
# 
# Usage:
#   ./deploy-all.sh              # Deploy all functions
#   ./deploy-all.sh scout-ai     # Deploy specific function
#   ./deploy-all.sh --list       # List all functions
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Project set: gcloud config set project opsos-864a1
# =============================================================================

set -e

PROJECT_ID="opsos-864a1"
REGION="us-central1"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function definitions: name -> (directory, entry_point, memory, timeout)
declare -A FUNCTIONS
FUNCTIONS=(
    # ETL Functions
    ["daily-rollup-etl"]="daily-rollup-etl:run_daily_rollup:512MB:540s"
    ["monthly-rollup-etl"]="monthly-rollup-etl:run_monthly_rollup:512MB:540s"
    ["dataforseo-bigquery-sync"]="dataforseo-bigquery-sync:sync_dataforseo_to_bigquery:512MB:540s"
    
    # NEW: Financial Data Sync Functions
    ["stripe-bigquery-sync"]="stripe-bigquery-sync:sync_stripe_to_bigquery:512MB:540s"
    ["quickbooks-bigquery-sync"]="quickbooks-bigquery-sync:sync_quickbooks_to_bigquery:512MB:540s"
    ["google-ads-bigquery-sync"]="google-ads-bigquery-sync:sync_google_ads_to_bigquery:512MB:540s"
    
    # Scout AI Engine
    ["scout-ai-engine"]="scout-ai-engine:run_scout_ai:2048MB:540s"
    
    # Marketing AI Functions
    ["marketing-analyze-traffic"]="marketing-analyze-traffic:analyze_traffic:512MB:300s"
    ["marketing-discover-events"]="marketing-discover-events:discover_events:512MB:300s"
    ["marketing-optimization-engine"]="marketing-optimization-engine:run_optimization:1024MB:540s"
    
    # Entity Map Seeder
    ["entity-map-seeder"]="entity-map-seeder:seed_entity_map:512MB:300s"
)

# Helper function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# List all available functions
list_functions() {
    echo ""
    echo "Available Cloud Functions:"
    echo "=========================="
    for func in "${!FUNCTIONS[@]}"; do
        IFS=':' read -r dir entry memory timeout <<< "${FUNCTIONS[$func]}"
        echo "  - $func (${dir})"
    done
    echo ""
    echo "Usage: ./deploy-all.sh [function-name]"
    echo "       ./deploy-all.sh              # Deploy all"
    echo "       ./deploy-all.sh scout-ai     # Deploy specific (partial match)"
    echo ""
}

# Deploy a single function
deploy_function() {
    local func_name=$1
    local func_config=${FUNCTIONS[$func_name]}
    
    if [ -z "$func_config" ]; then
        print_error "Unknown function: $func_name"
        return 1
    fi
    
    IFS=':' read -r dir entry_point memory timeout <<< "$func_config"
    
    local source_dir="$(dirname "$0")/$dir"
    
    if [ ! -d "$source_dir" ]; then
        print_error "Directory not found: $source_dir"
        return 1
    fi
    
    print_status "Deploying $func_name..."
    print_status "  Directory: $dir"
    print_status "  Entry point: $entry_point"
    print_status "  Memory: $memory"
    print_status "  Timeout: $timeout"
    
    gcloud functions deploy "$func_name" \
        --gen2 \
        --runtime=python311 \
        --region="$REGION" \
        --source="$source_dir" \
        --entry-point="$entry_point" \
        --trigger-http \
        --allow-unauthenticated \
        --memory="$memory" \
        --timeout="$timeout" \
        --project="$PROJECT_ID" \
        --quiet
    
    if [ $? -eq 0 ]; then
        print_success "Deployed $func_name"
        echo "  URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/$func_name"
    else
        print_error "Failed to deploy $func_name"
        return 1
    fi
    
    echo ""
}

# Main execution
main() {
    echo ""
    echo "=============================================="
    echo "  OpsOS Cloud Functions Deployment"
    echo "=============================================="
    echo "  Project: $PROJECT_ID"
    echo "  Region: $REGION"
    echo "=============================================="
    echo ""
    
    # Handle command line arguments
    if [ "$1" == "--list" ] || [ "$1" == "-l" ]; then
        list_functions
        exit 0
    fi
    
    # If a specific function is specified, deploy only that one
    if [ -n "$1" ]; then
        # Support partial matching
        local matched=0
        for func in "${!FUNCTIONS[@]}"; do
            if [[ "$func" == *"$1"* ]]; then
                deploy_function "$func"
                matched=1
            fi
        done
        
        if [ $matched -eq 0 ]; then
            print_error "No functions matching: $1"
            list_functions
            exit 1
        fi
        exit 0
    fi
    
    # Deploy all functions
    print_status "Deploying all Cloud Functions..."
    echo ""
    
    local failed=0
    local success=0
    
    for func in "${!FUNCTIONS[@]}"; do
        if deploy_function "$func"; then
            ((success++))
        else
            ((failed++))
        fi
    done
    
    echo ""
    echo "=============================================="
    echo "  Deployment Summary"
    echo "=============================================="
    print_success "Successful: $success"
    if [ $failed -gt 0 ]; then
        print_error "Failed: $failed"
    fi
    echo "=============================================="
    echo ""
}

# Run main function
main "$@"
