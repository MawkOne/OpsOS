"""
Priority Pages Utilities

Helper functions for detectors to focus analysis on priority pages.
Priority pages are user-defined pages that should receive deeper analysis.
"""

def add_priority_filter(query: str, required: bool = False) -> str:
    """
    Add priority page filter to a BigQuery SQL query.
    
    Args:
        query: The SQL query to modify
        required: If True, ONLY return priority pages. If False, prioritize but include all.
    
    Returns:
        Modified query with priority page logic
    
    Example:
        query = "SELECT * FROM daily_entity_metrics WHERE entity_type = 'page'"
        query_with_priority = add_priority_filter(query, required=True)
    """
    if required:
        # Only return priority pages
        if "WHERE" in query.upper():
            return query.replace("WHERE", "WHERE is_priority_page = TRUE AND")
        else:
            return query + " WHERE is_priority_page = TRUE"
    else:
        # Prioritize priority pages but include all (useful for ranking/sorting)
        return query + " ORDER BY is_priority_page DESC"


def get_priority_pages_only_clause() -> str:
    """
    Get a WHERE clause fragment to filter for priority pages only.
    
    Returns:
        SQL fragment: "is_priority_page = TRUE"
    
    Example:
        WHERE entity_type = 'page' AND {get_priority_pages_only_clause()}
    """
    return "is_priority_page = TRUE"


def get_priority_pages_query(organization_id: str, project_id: str = "opsos-864a1", dataset_id: str = "marketing_ai") -> str:
    """
    Get a complete query for fetching all priority pages with latest metrics.
    
    Args:
        organization_id: The organization ID
        project_id: BigQuery project ID
        dataset_id: BigQuery dataset ID
    
    Returns:
        Complete SQL query string
    """
    return f"""
    WITH latest_metrics AS (
      SELECT 
        canonical_entity_id,
        MAX(date) as latest_date
      FROM `{project_id}.{dataset_id}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND is_priority_page = TRUE
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT 
      m.*
    FROM `{project_id}.{dataset_id}.daily_entity_metrics` m
    INNER JOIN latest_metrics l
      ON m.canonical_entity_id = l.canonical_entity_id
      AND m.date = l.latest_date
    WHERE m.organization_id = @org_id
      AND m.is_priority_page = TRUE
      AND m.entity_type = 'page'
    ORDER BY m.sessions DESC
    """


def should_focus_on_priority_pages(page_count: int, threshold: int = 50) -> bool:
    """
    Decide if detector should focus on priority pages based on total page count.
    
    If site has many pages, focusing on priority pages improves signal/noise ratio.
    
    Args:
        page_count: Total number of pages tracked
        threshold: Page count threshold (default 50)
    
    Returns:
        True if should focus on priority pages, False otherwise
    """
    return page_count > threshold
