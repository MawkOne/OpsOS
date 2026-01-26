"""
PAGES Detectors
All detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

# Import existing page detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Note: detect_scale_winners and detect_fix_losers are defined in main.py
# To avoid circular imports, we'll import them dynamically when needed
from _old_detectors import detect_high_traffic_low_conversion_pages, detect_page_engagement_decay
from _old_monthly_trend_detectors import detect_scale_winners_multitimeframe

# Dynamic imports to avoid circular dependency
def detect_scale_winners(organization_id):
    """Wrapper to import and call detect_scale_winners from main"""
    from main import detect_scale_winners as _detect_scale_winners
    return _detect_scale_winners(organization_id)

def detect_fix_losers(organization_id):
    """Wrapper to import and call detect_fix_losers from main"""
    from main import detect_fix_losers as _detect_fix_losers
    return _detect_fix_losers(organization_id)

__all__ = [
    'detect_scale_winners',
    'detect_fix_losers',
    'detect_high_traffic_low_conversion_pages',
    'detect_page_engagement_decay',
    'detect_scale_winners_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_scale_winners': {
        'layer': 'strategic',
        'timeframe': '30d vs 30d',
        'priority': 'high',
        'description': 'High-converting pages/campaigns with low traffic (scale opportunity)'
    },
    'detect_fix_losers': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'high',
        'description': 'High-traffic pages with poor conversion rates'
    },
    'detect_high_traffic_low_conversion_pages': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'high',
        'description': 'Pages getting traffic but converting poorly'
    },
    'detect_page_engagement_decay': {
        'layer': 'trend',
        'timeframe': '7d vs 30d',
        'priority': 'medium',
        'description': 'Pages with declining engagement metrics'
    },
    'detect_scale_winners_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'high',
        'description': 'High CVR entities with low traffic, with CVR trend analysis'
    },
}
