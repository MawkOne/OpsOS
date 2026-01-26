"""
REVENUE Detectors
All detection layers (Fast, Trend, Strategic) for revenue & metrics
"""

# Import existing revenue detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from _old_detectors import detect_revenue_anomaly, detect_metric_anomalies
from _old_monthly_trend_detectors import detect_revenue_trends_multitimeframe

__all__ = [
    'detect_revenue_anomaly',
    'detect_metric_anomalies',
    'detect_revenue_trends_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_revenue_anomaly': {
        'layer': 'fast',
        'timeframe': '1d vs 7d/28d avg',
        'priority': 'high',
        'description': 'Revenue deviations from baseline (early warning system)'
    },
    'detect_metric_anomalies': {
        'layer': 'fast',
        'timeframe': '1d vs 7d/28d avg',
        'priority': 'medium',
        'description': 'Any metric with significant deviation from baseline'
    },
    'detect_revenue_trends_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'high',
        'description': 'Long-term revenue patterns and trends'
    },
}
