"""
Detector Utility Functions

Shared utilities for all detectors including priority pages filtering.
"""

from .priority_pages import (
    get_priority_pages_only_clause,
    get_priority_pages_query,
    add_priority_filter,
    should_focus_on_priority_pages
)

__all__ = [
    'get_priority_pages_only_clause',
    'get_priority_pages_query',
    'add_priority_filter',
    'should_focus_on_priority_pages',
]
