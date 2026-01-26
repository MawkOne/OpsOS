"""
ADVERTISING Detectors
All detection layers (Fast, Trend, Strategic) for paid advertising
"""

# Import existing advertising detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from _old_detectors import detect_cost_inefficiency, detect_paid_waste
from _old_monthly_trend_detectors import detect_paid_campaigns_multitimeframe

__all__ = [
    'detect_cost_inefficiency',
    'detect_paid_waste',
    'detect_paid_campaigns_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_cost_inefficiency': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'high',
        'description': 'High-cost campaigns/keywords with poor ROI'
    },
    'detect_paid_waste': {
        'layer': 'fast',
        'timeframe': 'daily',
        'priority': 'high',
        'description': 'Campaigns spending money with zero or minimal conversions'
    },
    'detect_paid_campaigns_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Campaign efficiency trends over time'
    },
}
