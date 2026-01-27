"""
Import all expansion detectors for easy integration
"""

# Week 1-2: Quick Wins (8 detectors)
from expansion_detectors import (
    detect_email_volume_gap,
    detect_seo_rank_volatility_daily,
    detect_mobile_desktop_cvr_gap,
    detect_traffic_source_disappearance,
    detect_channel_dependency_risk
)

from expansion_detectors_week1 import (
    detect_ad_retargeting_gap,
    detect_traffic_quality_by_source,
    detect_cac_by_channel
)

# Weeks 3-8: All remaining detectors (24 detectors)
from expansion_detectors_complete import (
    # Week 3-4: High-Value
    detect_ad_creative_fatigue,
    detect_email_revenue_attribution_gap,
    detect_ad_device_geo_optimization_gaps,
    detect_content_publishing_volume_gap,
    detect_content_to_lead_attribution,
    detect_content_freshness_decay,
    detect_mrr_arr_tracking,
    detect_transaction_refund_anomalies,
    
    # Week 5-6: Strategic
    detect_ab_test_opportunities,
    detect_revenue_by_channel_attribution,
    detect_revenue_forecast_deviation,
    detect_ab_test_recommendations,
    detect_seasonality_adjusted_alerts,
    detect_automated_optimization_suggestions,
    detect_unit_economics_dashboard,
    detect_growth_velocity_trends,
    
    # Week 7-8: Proxy/Partial
    detect_email_deliverability_crash_proxy,
    detect_ad_audience_saturation_proxy,
    detect_email_list_health_issues,
    detect_seo_technical_health_score,
    detect_multitouch_conversion_path_issues,
    detect_content_topic_format_winners,
    detect_churn_prediction_early_warning,
    detect_cohort_performance_trends
)

# Export all detectors
__all__ = [
    # Week 1-2
    'detect_email_volume_gap',
    'detect_seo_rank_volatility_daily',
    'detect_mobile_desktop_cvr_gap',
    'detect_traffic_source_disappearance',
    'detect_channel_dependency_risk',
    'detect_ad_retargeting_gap',
    'detect_traffic_quality_by_source',
    'detect_cac_by_channel',
    
    # Week 3-4
    'detect_ad_creative_fatigue',
    'detect_email_revenue_attribution_gap',
    'detect_ad_device_geo_optimization_gaps',
    'detect_content_publishing_volume_gap',
    'detect_content_to_lead_attribution',
    'detect_content_freshness_decay',
    'detect_mrr_arr_tracking',
    'detect_transaction_refund_anomalies',
    
    # Week 5-6
    'detect_ab_test_opportunities',
    'detect_revenue_by_channel_attribution',
    'detect_revenue_forecast_deviation',
    'detect_ab_test_recommendations',
    'detect_seasonality_adjusted_alerts',
    'detect_automated_optimization_suggestions',
    'detect_unit_economics_dashboard',
    'detect_growth_velocity_trends',
    
    # Week 7-8
    'detect_email_deliverability_crash_proxy',
    'detect_ad_audience_saturation_proxy',
    'detect_email_list_health_issues',
    'detect_seo_technical_health_score',
    'detect_multitouch_conversion_path_issues',
    'detect_content_topic_format_winners',
    'detect_churn_prediction_early_warning',
    'detect_cohort_performance_trends'
]

# Configuration: Which detectors to run
ENABLED_DETECTORS = {
    'week1_quick_wins': True,
    'week3_high_value': True,
    'week5_strategic': False,  # Can enable these incrementally
    'week7_proxy': False  # Can enable these incrementally
}

def get_enabled_detectors():
    """Returns list of detector functions to run based on configuration"""
    detectors = []
    
    if ENABLED_DETECTORS['week1_quick_wins']:
        detectors.extend([
            detect_email_volume_gap,
            detect_seo_rank_volatility_daily,
            detect_mobile_desktop_cvr_gap,
            detect_traffic_source_disappearance,
            detect_channel_dependency_risk,
            detect_ad_retargeting_gap,
            detect_traffic_quality_by_source,
            detect_cac_by_channel
        ])
    
    if ENABLED_DETECTORS['week3_high_value']:
        detectors.extend([
            detect_ad_creative_fatigue,
            detect_email_revenue_attribution_gap,
            detect_ad_device_geo_optimization_gaps,
            detect_content_publishing_volume_gap,
            detect_content_to_lead_attribution,
            detect_content_freshness_decay,
            detect_mrr_arr_tracking,
            detect_transaction_refund_anomalies
        ])
    
    if ENABLED_DETECTORS['week5_strategic']:
        detectors.extend([
            detect_ab_test_opportunities,
            detect_revenue_by_channel_attribution,
            detect_revenue_forecast_deviation,
            detect_ab_test_recommendations,
            detect_seasonality_adjusted_alerts,
            detect_automated_optimization_suggestions,
            detect_unit_economics_dashboard,
            detect_growth_velocity_trends
        ])
    
    if ENABLED_DETECTORS['week7_proxy']:
        detectors.extend([
            detect_email_deliverability_crash_proxy,
            detect_ad_audience_saturation_proxy,
            detect_email_list_health_issues,
            detect_seo_technical_health_score,
            detect_multitouch_conversion_path_issues,
            detect_content_topic_format_winners,
            detect_churn_prediction_early_warning,
            detect_cohort_performance_trends
        ])
    
    return detectors
