"""
SEO Detectors
All detection layers (Fast, Trend, Strategic) for SEO & organic search
"""

# Import existing SEO detectors from old structure
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from _old_detectors import detect_seo_striking_distance, detect_seo_rank_drops, detect_keyword_cannibalization
from _old_monthly_trend_detectors import detect_seo_rank_trends_multitimeframe

__all__ = [
    'detect_seo_striking_distance',
    'detect_seo_rank_drops',
    'detect_keyword_cannibalization',
    'detect_seo_rank_trends_multitimeframe',
]

# Detector metadata
DETECTOR_INFO = {
    'detect_seo_striking_distance': {
        'layer': 'strategic',
        'timeframe': '30d',
        'priority': 'medium',
        'description': 'Keywords ranking 4-15 that could reach page 1 with optimization'
    },
    'detect_seo_rank_drops': {
        'layer': 'trend',
        'timeframe': '7d vs 30d',
        'priority': 'high',
        'description': 'Keywords with significant rank declines'
    },
    'detect_keyword_cannibalization': {
        'layer': 'strategic',
        'timeframe': 'all-time',
        'priority': 'low',
        'description': 'Multiple pages competing for same keywords'
    },
    'detect_seo_rank_trends_multitimeframe': {
        'layer': 'strategic',
        'timeframe': 'monthly',
        'priority': 'medium',
        'description': 'Long-term ranking trends and patterns'
    },
}
