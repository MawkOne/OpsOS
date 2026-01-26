"""
TRAFFIC Detectors
All detection layers (Fast, Trend, Strategic) for traffic sources & channels
"""

# Import existing traffic detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from _old_detectors import detect_cross_channel_gaps
from _old_monthly_trend_detectors import detect_declining_performers_multitimeframe

# Dynamic import to avoid circular dependency
def detect_declining_performers(organization_id):
    """Wrapper to import and call detect_declining_performers from main"""
    from main import detect_declining_performers as _detect_declining_performers
    return _detect_declining_performers(organization_id)

__all__ = [
    'detect_cross_channel_gaps',
    'detect_declining_performers',
    'detect_declining_performers_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_cross_channel_gaps': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'medium',
        'description': 'Pages performing well in one channel but missing support in others'
    },
    'detect_declining_performers': {
        'layer': 'trend',
        'timeframe': '30d vs 30d',
        'priority': 'high',
        'description': 'Entities that were performing well but are declining'
    },
    'detect_declining_performers_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Long-term declining performance with acceleration/deceleration analysis'
    },
}
