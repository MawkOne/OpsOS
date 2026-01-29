#!/usr/bin/env python3
"""
Test all 12 SEO detectors to verify they execute without errors
"""
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from detectors.seo.detect_backlink_quality_decline import detect_backlink_quality_decline
from detectors.seo.detect_content_freshness_decay import detect_content_freshness_decay
from detectors.seo.detect_core_web_vitals_failing import detect_core_web_vitals_failing
from detectors.seo.detect_featured_snippet_opportunities import detect_featured_snippet_opportunities
from detectors.seo.detect_internal_link_opportunities import detect_internal_link_opportunities
from detectors.seo.detect_keyword_cannibalization import detect_keyword_cannibalization
from detectors.seo.detect_rank_volatility_daily import detect_rank_volatility_daily
from detectors.seo.detect_schema_markup_gaps import detect_schema_markup_gaps
from detectors.seo.detect_seo_rank_drops import detect_seo_rank_drops
from detectors.seo.detect_seo_rank_trends_multitimeframe import detect_seo_rank_trends_multitimeframe
from detectors.seo.detect_seo_striking_distance import detect_seo_striking_distance
from detectors.seo.detect_technical_seo_health_score import detect_technical_seo_health_score

# Test organization ID (use a real one from your system)
TEST_ORG_ID = "test_org_123"

detectors = [
    ("Backlink Quality Decline", detect_backlink_quality_decline),
    ("Content Freshness Decay", detect_content_freshness_decay),
    ("Core Web Vitals Failing", detect_core_web_vitals_failing),
    ("Featured Snippet Opportunities", detect_featured_snippet_opportunities),
    ("Internal Link Opportunities", detect_internal_link_opportunities),
    ("Keyword Cannibalization", detect_keyword_cannibalization),
    ("Rank Volatility Daily", detect_rank_volatility_daily),
    ("Schema Markup Gaps", detect_schema_markup_gaps),
    ("SEO Rank Drops", detect_seo_rank_drops),
    ("SEO Rank Trends (Multi-timeframe)", detect_seo_rank_trends_multitimeframe),
    ("SEO Striking Distance", detect_seo_striking_distance),
    ("Technical SEO Health Score", detect_technical_seo_health_score),
]

def test_detector(name, detector_func):
    """Test a single detector"""
    try:
        print(f"\n{'='*60}")
        print(f"Testing: {name}")
        print('='*60)
        
        result = detector_func(TEST_ORG_ID)
        
        if isinstance(result, list):
            print(f"✅ SUCCESS: Returned {len(result)} opportunities")
            return True
        else:
            print(f"⚠️  WARNING: Unexpected return type: {type(result)}")
            return False
            
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return False

def main():
    print(f"\n🔍 Testing {len(detectors)} SEO Detectors")
    print(f"Organization ID: {TEST_ORG_ID}\n")
    
    results = []
    for name, func in detectors:
        success = test_detector(name, func)
        results.append((name, success))
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print('='*60)
    
    passed = sum(1 for _, success in results if success)
    failed = len(results) - passed
    
    print(f"\n✅ Passed: {passed}/{len(results)}")
    print(f"❌ Failed: {failed}/{len(results)}")
    
    if failed > 0:
        print("\nFailed detectors:")
        for name, success in results:
            if not success:
                print(f"  - {name}")
    
    print(f"\n{'='*60}\n")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
