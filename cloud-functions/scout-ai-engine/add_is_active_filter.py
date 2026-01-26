"""
Helper script to add is_active filter to all detector queries
"""

import re

def add_is_active_filter(query: str) -> str:
    """Add is_active filter to queries that use entity metrics"""
    
    # Pattern 1: Add JOIN with entity_map if not present
    if 'entity_map' not in query.lower():
        # Find the main FROM clause (daily_entity_metrics or monthly_entity_metrics)
        if 'daily_entity_metrics' in query:
            table_name = 'daily_entity_metrics'
            alias = 'm'
        elif 'monthly_entity_metrics' in query:
            table_name = 'monthly_entity_metrics'
            alias = 'm'
        else:
            return query
        
        # Add JOIN with entity_map after the FROM clause
        join_clause = f"""
      JOIN `{{PROJECT_ID}}.{{DATASET_ID}}.entity_map` e
        ON {alias}.canonical_entity_id = e.canonical_entity_id
        AND e.is_active = TRUE"""
        
        # Find WHERE clause and add before it
        where_pos = query.lower().find('where')
        if where_pos > -1:
            query = query[:where_pos] + join_clause + '\n    ' + query[where_pos:]
        else:
            # No WHERE clause, add at end before GROUP BY/ORDER BY
            for keyword in ['GROUP BY', 'ORDER BY', 'LIMIT']:
                pos = query.upper().find(keyword)
                if pos > -1:
                    query = query[:pos] + join_clause + '\n    ' + query[pos:]
                    break
    
    return query

# Read files
with open('detectors.py', 'r') as f:
    detectors_content = f.read()

with open('monthly_trend_detectors.py', 'r') as f:
    monthly_content = f.read()

print("Files read successfully!")
print("Note: Manual review needed for complex queries")
