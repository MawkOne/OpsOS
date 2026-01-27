"""Advertising Detectors"""

from .detect_ad_retargeting_gap import detect_ad_retargeting_gap
from .detect_ad_schedule_optimization import detect_ad_schedule_optimization
from .detect_audience_saturation_proxy import detect_audience_saturation_proxy
from .detect_competitor_activity_alerts import detect_competitor_activity_alerts
from .detect_cost_inefficiency import detect_cost_inefficiency
from .detect_creative_fatigue import detect_creative_fatigue
from .detect_device_geo_optimization_gaps import detect_device_geo_optimization_gaps
from .detect_impression_share_loss import detect_impression_share_loss
from .detect_landing_page_relevance_gap import detect_landing_page_relevance_gap
from .detect_negative_keyword_opportunities import detect_negative_keyword_opportunities
from .detect_paid_campaigns_multitimeframe import detect_paid_campaigns_multitimeframe
from .detect_paid_waste import detect_paid_waste
from .detect_quality_score_decline import detect_quality_score_decline

__all__ = [
    'detect_ad_retargeting_gap',
    'detect_ad_schedule_optimization',
    'detect_audience_saturation_proxy',
    'detect_competitor_activity_alerts',
    'detect_cost_inefficiency',
    'detect_creative_fatigue',
    'detect_device_geo_optimization_gaps',
    'detect_impression_share_loss',
    'detect_landing_page_relevance_gap',
    'detect_negative_keyword_opportunities',
    'detect_paid_campaigns_multitimeframe',
    'detect_paid_waste',
    'detect_quality_score_decline',
]
