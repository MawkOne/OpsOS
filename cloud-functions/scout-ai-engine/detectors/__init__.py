"""
Scout AI Detectors - Organized by Marketing Area
Each category folder contains individual detector files
"""

# Import all detector functions from category folders
from .email import *
from .seo import *
from .advertising import *
from .pages import *
from .content import *
from .traffic import *
from .revenue import *

# Re-export all for easy access
__all__ = [
    # From email/
    'detect_email_bounce_rate_spike',
    'detect_email_click_to_open_rate_decline',
    'detect_email_engagement_drop',
    'detect_email_high_opens_low_clicks',
    'detect_email_list_health_decline',
    'detect_email_optimal_frequency_deviation',
    'detect_email_spam_complaint_spike',
    'detect_email_trends_multitimeframe',
    'detect_email_volume_gap',
    'detect_revenue_per_subscriber_decline',
    'detect_device_client_performance_gap',
    'detect_ab_test_recommendations',
    'detect_list_segmentation_opportunities',
    
    # From seo/
    'detect_backlink_quality_decline',
    'detect_content_freshness_decay',
    'detect_core_web_vitals_failing',
    'detect_featured_snippet_opportunities',
    'detect_internal_link_opportunities',
    'detect_keyword_cannibalization',
    'detect_rank_volatility_daily',
    'detect_schema_markup_gaps',
    'detect_seo_rank_drops',
    'detect_seo_rank_trends_multitimeframe',
    'detect_seo_striking_distance',
    'detect_technical_seo_health_score',
    
    # From advertising/
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
    
    # From pages/
    'detect_ab_test_opportunities',
    'detect_conversion_funnel_dropoff',
    'detect_cta_performance_analysis',
    'detect_fix_losers',
    'detect_high_traffic_low_conversion_pages',
    'detect_mobile_desktop_cvr_gap',
    'detect_page_cart_abandonment_increase',
    'detect_page_engagement_decay',
    'detect_page_error_rate_spike',
    'detect_page_exit_rate_increase',
    'detect_page_form_abandonment_spike',
    'detect_page_micro_conversion_drop',
    'detect_page_speed_decline',
    'detect_scale_winners',
    'detect_scale_winners_multitimeframe',
    'detect_social_proof_opportunities',
    'detect_trust_signal_gaps',
    'detect_video_engagement_gap',
    
    # From content/
    'detect_content_decay',
    'detect_content_decay_multitimeframe',
    'detect_content_distribution_gap',
    'detect_content_format_winners',
    'detect_content_pillar_opportunities',
    'detect_content_to_lead_attribution',
    'detect_dwell_time_decline',
    'detect_engagement_rate_decline',
    'detect_publishing_volume_gap',
    'detect_republishing_opportunities',
    'detect_topic_gap_analysis',
    
    # From traffic/
    'detect_attribution_model_comparison',
    'detect_cac_by_channel',
    'detect_channel_dependency_risk',
    'detect_channel_mix_optimization',
    'detect_cross_channel_gaps',
    'detect_cross_device_journey_issues',
    'detect_declining_performers',
    'detect_declining_performers_multitimeframe',
    'detect_multitouch_path_issues',
    'detect_revenue_by_channel_attribution',
    'detect_traffic_bot_spam_spike',
    'detect_traffic_quality_by_source',
    'detect_traffic_referral_opportunities',
    'detect_traffic_source_disappearance',
    'detect_traffic_spike_quality_check',
    'detect_traffic_utm_parameter_gaps',
    
    # From revenue/
    'detect_cohort_performance_trends',
    'detect_customer_churn_spike',
    'detect_expansion_revenue_gap',
    'detect_forecast_deviation',
    'detect_growth_velocity_trends',
    'detect_ltv_cac_ratio_decline',
    'detect_metric_anomalies',
    'detect_mrr_arr_tracking',
    'detect_pricing_opportunity_analysis',
    'detect_revenue_anomaly',
    'detect_revenue_aov_decline',
    'detect_revenue_concentration_risk',
    'detect_revenue_discount_cannibalization',
    'detect_revenue_new_customer_decline',
    'detect_revenue_payment_failure_spike',
    'detect_revenue_seasonality_deviation',
    'detect_revenue_trends_multitimeframe',
    'detect_transaction_refund_anomalies',
    'detect_unit_economics_dashboard',
]
