"""
EMAIL Detectors
All detection layers (Fast, Trend, Strategic) for email marketing
"""

# Import existing email detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from _old_detectors import detect_email_engagement_drop, detect_email_high_opens_low_clicks
from _old_monthly_trend_detectors import detect_email_trends_multitimeframe

__all__ = [
    'detect_email_engagement_drop',
    'detect_email_high_opens_low_clicks',
    'detect_email_trends_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_email_engagement_drop': {
        'layer': 'trend',
        'timeframe': '30d vs 30d',
        'priority': 'medium',
        'description': 'Detects email campaigns with declining engagement rates'
    },
    'detect_email_high_opens_low_clicks': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'low',
        'description': 'Emails with good opens but poor click-through (content/CTA issue)'
    },
    'detect_email_trends_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Long-term email performance trends and patterns'
    },
}
