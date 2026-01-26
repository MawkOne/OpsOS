"""
Scout AI Detectors - Organized by Marketing Area
Each detector file contains all detection layers (Fast, Trend, Strategic) for that area
"""

# Import all detector functions to make them available at package level
from .email_detectors import *
from .seo_detectors import *
from .advertising_detectors import *
from .pages_detectors import *
from .content_detectors import *
from .traffic_detectors import *
from .revenue_detectors import *

__all__ = [
    # Email detectors
    'detect_email_engagement_drop',
    'detect_email_high_opens_low_clicks',
    'detect_email_trends_multitimeframe',
    
    # SEO detectors
    'detect_seo_striking_distance',
    'detect_seo_rank_drops',
    'detect_keyword_cannibalization',
    'detect_seo_rank_trends_multitimeframe',
    
    # Advertising detectors
    'detect_cost_inefficiency',
    'detect_paid_waste',
    'detect_paid_campaigns_multitimeframe',
    
    # Pages detectors
    'detect_scale_winners',
    'detect_fix_losers',
    'detect_high_traffic_low_conversion_pages',
    'detect_page_engagement_decay',
    'detect_scale_winners_multitimeframe',
    
    # Content detectors
    'detect_content_decay',
    'detect_content_decay_multitimeframe',
    
    # Traffic detectors
    'detect_cross_channel_gaps',
    'detect_declining_performers',
    'detect_declining_performers_multitimeframe',
    
    # Revenue detectors
    'detect_revenue_anomaly',
    'detect_metric_anomalies',
    'detect_revenue_trends_multitimeframe',
]
