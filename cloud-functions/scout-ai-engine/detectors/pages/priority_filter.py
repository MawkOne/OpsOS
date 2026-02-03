"""
Priority Pages Filter Helper
Generates SQL WHERE clause to filter by priority pages
"""

from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)


def build_priority_pages_filter(priority_pages: Optional[Dict], entity_column: str = "canonical_entity_id") -> str:
    """
    Build SQL WHERE clause fragment to filter by priority pages.
    
    Args:
        priority_pages: Dict with 'urls', 'prefixes', and 'domain' keys
        entity_column: The column name containing the page entity ID
    
    Returns:
        SQL WHERE clause fragment (without leading AND)
        Returns empty string if no priority pages filter
    """
    if not priority_pages:
        return ""
    
    urls = priority_pages.get('urls', [])
    prefixes = priority_pages.get('prefixes', [])
    domain = priority_pages.get('domain', '')
    
    if not urls and not prefixes:
        return ""
    
    conditions = []
    
    # Build URL match conditions
    if urls:
        # Extract paths from full URLs for matching
        url_paths = []
        for url in urls:
            # Handle full URLs - extract path
            if url.startswith('http'):
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    url_paths.append(parsed.path)
                except:
                    url_paths.append(url)
            else:
                url_paths.append(url)
        
        if url_paths:
            # Use IN clause for exact path matches
            escaped_paths = [f"'{path}'" for path in url_paths]
            conditions.append(f"{entity_column} IN ({', '.join(escaped_paths)})")
    
    # Build prefix match conditions  
    if prefixes:
        prefix_conditions = []
        for prefix in prefixes:
            # Use STARTS_WITH for prefix matching
            prefix_conditions.append(f"STARTS_WITH({entity_column}, '{prefix}')")
        
        if prefix_conditions:
            conditions.append(f"({' OR '.join(prefix_conditions)})")
    
    if not conditions:
        return ""
    
    # Combine with OR since we want pages matching ANY of the criteria
    filter_sql = f"({' OR '.join(conditions)})"
    
    logger.info(f"   ⭐ Priority filter: {len(urls)} URLs, {len(prefixes)} prefixes")
    
    return filter_sql


def get_priority_pages_where_clause(priority_pages: Optional[Dict], entity_column: str = "canonical_entity_id") -> str:
    """
    Get full WHERE clause fragment including AND prefix.
    Returns empty string if no filter needed.
    """
    filter_sql = build_priority_pages_filter(priority_pages, entity_column)
    if filter_sql:
        return f"AND {filter_sql}"
    return ""
