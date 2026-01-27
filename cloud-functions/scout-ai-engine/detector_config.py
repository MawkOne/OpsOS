"""
Detector Configuration
Control which detector categories are enabled for each product/organization
"""

import os
from typing import List, Dict

# Default configuration - all detectors enabled
DEFAULT_ENABLED_CATEGORIES = [
    'email',
    'revenue',
    'pages',
    'traffic',
    'seo',
    'advertising',
    'content',
    # 'system',  # Not yet implemented
]

# Product-specific configurations
# You can customize which detectors run for different product types
PRODUCT_CONFIGS: Dict[str, List[str]] = {
    'saas': [
        'email',
        'revenue',
        'pages',
        'traffic',
        'seo',  # DataForSEO detectors now fully working
        'advertising',
        'content',  # Content detectors now working with Phase 2 data
    ],
    'ecommerce': [
        'email',
        'revenue',
        'pages',
        'traffic',
        'seo',
        'advertising',
    ],
    'content': [
        'seo',
        'content',
        'pages',
        'traffic',
    ],
    'b2b': [
        'email',
        'revenue',
        'pages',
        'traffic',
        'advertising',
    ],
}

def get_enabled_categories(product_type: str = None) -> List[str]:
    """
    Get list of enabled detector categories
    
    Args:
        product_type: Optional product type ('saas', 'ecommerce', 'content', 'b2b')
                     If None, uses DEFAULT_ENABLED_CATEGORIES
    
    Returns:
        List of category names to run
    """
    # Check for environment variable override
    env_categories = os.environ.get('ENABLED_DETECTOR_CATEGORIES')
    if env_categories:
        return [c.strip() for c in env_categories.split(',')]
    
    # Use product-specific config if provided
    if product_type and product_type in PRODUCT_CONFIGS:
        return PRODUCT_CONFIGS[product_type]
    
    # Default to all enabled
    return DEFAULT_ENABLED_CATEGORIES

def is_category_enabled(category: str, product_type: str = None) -> bool:
    """Check if a specific category is enabled"""
    return category in get_enabled_categories(product_type)
