"""
Test Priority Pages Integration with SEO Detectors

This script tests that priority pages filtering works correctly with updated detectors.
"""

import os
os.environ['GCP_PROJECT'] = 'opsos-864a1'

from detectors.seo.detect_core_web_vitals_failing import detect_core_web_vitals_failing
from detectors.seo.detect_schema_markup_gaps import detect_schema_markup_gaps
from detectors.seo.detect_backlink_quality_decline import detect_backlink_quality_decline
from detectors.seo.detect_internal_link_opportunities import detect_internal_link_opportunities

def test_detector(detector_func, detector_name, organization_id):
    """Test a detector with and without priority pages filter"""
    print(f"\n{'='*60}")
    print(f"Testing: {detector_name}")
    print('='*60)
    
    # Test without priority filter
    print(f"\n1️⃣  Running {detector_name} WITHOUT priority filter...")
    try:
        results_all = detector_func(organization_id, priority_pages_only=False)
        print(f"   ✅ Found {len(results_all)} opportunities (all pages)")
        if results_all:
            print(f"   📊 Sample: {results_all[0].get('title', 'N/A')[:80]}")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        results_all = []
    
    # Test with priority filter
    print(f"\n2️⃣  Running {detector_name} WITH priority filter...")
    try:
        results_priority = detector_func(organization_id, priority_pages_only=True)
        print(f"   ✅ Found {len(results_priority)} opportunities (priority pages only)")
        if results_priority:
            print(f"   📊 Sample: {results_priority[0].get('title', 'N/A')[:80]}")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        results_priority = []
    
    # Compare results
    print(f"\n📈 Results Comparison:")
    print(f"   • All pages: {len(results_all)} opportunities")
    print(f"   • Priority pages only: {len(results_priority)} opportunities")
    
    if len(results_all) > 0:
        reduction = ((len(results_all) - len(results_priority)) / len(results_all)) * 100
        print(f"   • Reduction: {reduction:.1f}% fewer opportunities when filtering")
    
    return {
        'all': len(results_all),
        'priority': len(results_priority)
    }

def main():
    print("\n" + "="*60)
    print("🧪 PRIORITY PAGES INTEGRATION TEST")
    print("="*60)
    
    # You'll need to replace this with your actual organization ID
    organization_id = input("\nEnter your organization ID (or press Enter for default): ").strip()
    if not organization_id:
        organization_id = "test-org-id"
        print(f"Using default: {organization_id}")
    
    print(f"\nTesting with organization: {organization_id}")
    
    # Test each detector
    detectors = [
        (detect_core_web_vitals_failing, "Core Web Vitals Failing"),
        (detect_schema_markup_gaps, "Schema Markup Gaps"),
        (detect_backlink_quality_decline, "Backlink Quality Decline"),
        (detect_internal_link_opportunities, "Internal Link Opportunities"),
    ]
    
    results = {}
    for detector_func, name in detectors:
        results[name] = test_detector(detector_func, name, organization_id)
    
    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    
    for name, counts in results.items():
        print(f"\n{name}:")
        print(f"  All pages: {counts['all']}")
        print(f"  Priority only: {counts['priority']}")
        if counts['all'] > 0:
            focus_ratio = (counts['priority'] / counts['all']) * 100
            print(f"  Priority focus: {focus_ratio:.1f}% of total")
    
    print("\n" + "="*60)
    print("✅ Test Complete!")
    print("="*60)
    print("\nNext steps:")
    print("1. Run DataForSEO sync to populate is_priority_page column")
    print("2. Verify priority pages are marked in BigQuery:")
    print("   SELECT COUNT(*) FROM daily_entity_metrics WHERE is_priority_page = TRUE")
    print("3. Run detectors with priority_pages_only=True in production")
    print()

if __name__ == '__main__':
    main()
