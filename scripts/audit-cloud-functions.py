#!/usr/bin/env python3
"""
Audit all Cloud Functions for deployment and functionality
"""
import subprocess
import json
from datetime import datetime

# Cloud Functions organized by category
FUNCTIONS = {
    'Data Ingestion': [
        'ga4-bigquery-sync',
        'ga4-raw-bigquery-sync',
        'stripe-bigquery-sync',
        'activecampaign-bigquery-sync',
        'quickbooks-bigquery-sync',
        'google-ads-bigquery-sync',
        'dataforseo-bigquery-sync',
        'social-media-bigquery-sync',
        'ytjobs-mysql-bigquery-sync',
    ],
    'ETL & Rollups': [
        'reporting-table-refresh',
        'daily-rollup-etl',
        'weekly-rollup-etl',
        'monthly-rollup-etl',
        'l12m-rollup-etl',
        'alltime-rollup-etl',
    ],
    'Orchestration': [
        'nightly-sync-scheduler',
    ],
    'Other': [
        'entity-map-seeder',
        'marketing-optimization-engine',
        'marketing-analyze-traffic',
        'marketing-discover-events',
        'scout-ai-engine',
    ]
}

def check_function_deployed(function_name, region='us-central1'):
    """Check if a Cloud Function is deployed"""
    try:
        result = subprocess.run(
            ['gcloud', 'functions', 'describe', function_name, 
             '--region', region, '--format=json', '--project=opsos-864a1'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return {
                'deployed': True,
                'status': data.get('status'),
                'runtime': data.get('runtime'),
                'updateTime': data.get('updateTime'),
                'url': data.get('httpsTrigger', {}).get('url'),
            }
        return {'deployed': False, 'error': result.stderr}
    except Exception as e:
        return {'deployed': False, 'error': str(e)}

def main():
    print("=" * 80)
    print("CLOUD FUNCTIONS AUDIT")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    all_results = {}
    
    for category, functions in FUNCTIONS.items():
        print(f"\n{'=' * 80}")
        print(f"{category.upper()}")
        print("=" * 80)
        
        category_results = {}
        for func_name in functions:
            print(f"\nChecking: {func_name}")
            result = check_function_deployed(func_name)
            category_results[func_name] = result
            
            if result['deployed']:
                print(f"  ✅ Deployed")
                print(f"     Runtime: {result.get('runtime', 'N/A')}")
                print(f"     Status: {result.get('status', 'N/A')}")
                print(f"     Updated: {result.get('updateTime', 'N/A')}")
            else:
                print(f"  ❌ NOT DEPLOYED")
                if result.get('error'):
                    print(f"     Error: {result['error'][:100]}")
        
        all_results[category] = category_results
    
    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print("=" * 80)
    
    total = 0
    deployed = 0
    not_deployed = 0
    
    for category, results in all_results.items():
        cat_total = len(results)
        cat_deployed = sum(1 for r in results.values() if r['deployed'])
        cat_not_deployed = cat_total - cat_deployed
        
        total += cat_total
        deployed += cat_deployed
        not_deployed += cat_not_deployed
        
        print(f"\n{category}:")
        print(f"  Total: {cat_total}")
        print(f"  Deployed: {cat_deployed}")
        print(f"  Not Deployed: {cat_not_deployed}")
        
        if cat_not_deployed > 0:
            print(f"  Missing:")
            for name, result in results.items():
                if not result['deployed']:
                    print(f"    - {name}")
    
    print(f"\n{'=' * 80}")
    print(f"OVERALL: {deployed}/{total} functions deployed ({not_deployed} missing)")
    print("=" * 80)

if __name__ == '__main__':
    main()
