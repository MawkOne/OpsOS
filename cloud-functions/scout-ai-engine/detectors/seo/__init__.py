"""SEO Detectors"""

from .detect_backlink_opportunities import detect_backlink_opportunities
from .detect_backlink_quality_decline import detect_backlink_quality_decline
from .detect_content_freshness_decay import detect_content_freshness_decay
from .detect_core_web_vitals_failing import detect_core_web_vitals_failing
from .detect_featured_snippet_opportunities import detect_featured_snippet_opportunities
from .detect_internal_link_opportunities import detect_internal_link_opportunities
from .detect_keyword_cannibalization import detect_keyword_cannibalization
from .detect_rank_volatility_daily import detect_rank_volatility_daily
from .detect_schema_markup_gaps import detect_schema_markup_gaps
from .detect_seo_rank_drops import detect_seo_rank_drops
from .detect_seo_rank_trends_multitimeframe import detect_seo_rank_trends_multitimeframe
from .detect_seo_striking_distance import detect_seo_striking_distance
from .detect_technical_seo_health_score import detect_technical_seo_health_score

__all__ = [
    'detect_backlink_opportunities',
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
]
