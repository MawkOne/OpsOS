"""
CONTENT Detectors
All detection layers (Fast, Trend, Strategic) for content marketing
"""

# Import existing content detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from _old_detectors import detect_content_decay
from _old_monthly_trend_detectors import detect_content_decay_multitimeframe

__all__ = [
    'detect_content_decay',
    'detect_content_decay_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_content_decay': {
        'layer': 'trend',
        'timeframe': '30d vs 30d',
        'priority': 'medium',
        'description': 'Previously strong content losing traffic/performance over time'
    },
    'detect_content_decay_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Long-term content decay patterns with acceleration analysis'
    },
}
