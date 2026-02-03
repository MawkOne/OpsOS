"""
Priority Pages Filter Helper
Generates SQL WHERE clause to filter by priority pages (include) and exclude patterns
"""

from typing import Optional, Dict, List
import logging
import re

logger = logging.getLogger(__name__)


def normalize_path_to_entity_id(path: str) -> str:
    """
    Normalize a path to match BigQuery canonical entity_id format.
    e.g., "/talent-search/all-categories" -> "talentsearchallcategories"
    """
    # Remove leading slash and 'page_' prefix
    normalized = path.lstrip('/').replace('page_', '')
    # Remove special characters, convert to lowercase
    normalized = re.sub(r'[^a-z0-9]', '', normalized.lower())
    return normalized


def build_exclude_filter(exclude_patterns: List[str], entity_column: str = "canonical_entity_id") -> str:
    """
    Build SQL WHERE clause fragment to EXCLUDE pages matching patterns.
    
    Args:
        exclude_patterns: List of URL prefixes to exclude (e.g., ['/talent-profile', '/job'])
        entity_column: The column name containing the page entity ID
    
    Returns:
        SQL WHERE clause fragment (without leading AND/NOT)
        Returns empty string if no exclude patterns
    """
    if not exclude_patterns:
        return ""
    
    exclude_conditions = []
    for pattern in exclude_patterns:
        # Normalize the pattern to match entity_id format
        normalized = normalize_path_to_entity_id(pattern)
        if normalized:
            # Use STARTS_WITH on the normalized entity_id
            exclude_conditions.append(f"STARTS_WITH(REPLACE(LOWER({entity_column}), 'page_', ''), '{normalized}')")
    
    if not exclude_conditions:
        return ""
    
    # Combine with OR - exclude if ANY pattern matches
    return f"({' OR '.join(exclude_conditions)})"


def build_include_filter(priority_pages: Optional[Dict], entity_column: str = "canonical_entity_id") -> str:
    """
    Build SQL WHERE clause fragment to INCLUDE pages matching criteria.
    
    Args:
        priority_pages: Dict with 'urls', 'prefixes', and 'domain' keys
        entity_column: The column name containing the page entity ID
    
    Returns:
        SQL WHERE clause fragment (without leading AND)
        Returns empty string if no include criteria (means include all)
    """
    if not priority_pages:
        return ""
    
    urls = priority_pages.get('urls', [])
    prefixes = priority_pages.get('prefixes', [])
    
    if not urls and not prefixes:
        return ""
    
    conditions = []
    
    # Build URL match conditions (normalized)
    if urls:
        for url in urls:
            # Handle full URLs - extract and normalize path
            path = url
            if url.startswith('http'):
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    path = parsed.path
                except:
                    pass
            
            normalized = normalize_path_to_entity_id(path)
            if normalized:
                # Match normalized entity_id contains normalized path
                conditions.append(f"REPLACE(LOWER({entity_column}), 'page_', '') = '{normalized}'")
    
    # Build prefix match conditions (normalized)
    if prefixes:
        for prefix in prefixes:
            normalized = normalize_path_to_entity_id(prefix)
            if normalized:
                conditions.append(f"STARTS_WITH(REPLACE(LOWER({entity_column}), 'page_', ''), '{normalized}')")
    
    if not conditions:
        return ""
    
    # Combine with OR - include if ANY criteria matches
    return f"({' OR '.join(conditions)})"


def get_priority_pages_where_clause(priority_pages: Optional[Dict], entity_column: str = "canonical_entity_id") -> str:
    """
    Get full WHERE clause fragment for priority pages filtering.
    Handles both include criteria AND exclude patterns.
    
    Returns empty string if no filtering needed.
    """
    if not priority_pages:
        return ""
    
    exclude_patterns = priority_pages.get('excludePatterns', [])
    
    parts = []
    
    # Build exclude filter (if any patterns, exclude matching pages)
    if exclude_patterns:
        exclude_sql = build_exclude_filter(exclude_patterns, entity_column)
        if exclude_sql:
            parts.append(f"NOT {exclude_sql}")
            logger.info(f"   🚫 Exclude filter: {len(exclude_patterns)} patterns")
    
    # Build include filter (if any criteria, only include matching pages)
    include_sql = build_include_filter(priority_pages, entity_column)
    if include_sql:
        parts.append(include_sql)
        urls = priority_pages.get('urls', [])
        prefixes = priority_pages.get('prefixes', [])
        logger.info(f"   ⭐ Include filter: {len(urls)} URLs, {len(prefixes)} prefixes")
    
    if not parts:
        return ""
    
    # Combine: must NOT match exclude AND must match include (if specified)
    return f"AND ({' AND '.join(parts)})"
