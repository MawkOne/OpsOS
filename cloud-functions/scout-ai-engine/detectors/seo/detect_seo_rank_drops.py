"""
Detect Seo Rank Drops Detector
Category: Seo
"""

"""
SEO Detectors\nAll detection layers (Fast, Trend, Strategic) for SEO & organic search
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime
import logging
import sys
import os

# Add parent directory to path to import utils
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.priority_pages import get_priority_pages_only_clause

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_seo_rank_drops(organization_id: str, priority_pages_only: bool = False) -> list:
    bq_client = bigquery.Client()
    """
    PHASE 2A #6: SEO Rank Drops
    Detect: Keywords with significant rank declines
    
    Args:
        organization_id: Organization ID to analyze
        priority_pages_only: If True, only analyze priority pages
    """
    logger.info(f"🔍 Running SEO Rank Drops detector (priority_pages_only={priority_pages_only})...")
    
    opportunities = []
    
    # Build priority pages filter
    priority_filter = ""
    if priority_pages_only:
        priority_filter = f"AND {get_priority_pages_only_clause()}"
        logger.info("Focusing analysis on priority pages only")
    
    query = f"""
    WITH recent_ranks AS (
      SELECT 
        canonical_entity_id,
        AVG(position) as avg_position_recent,
        AVG(search_volume) as avg_volume
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'keyword'
        AND position IS NOT NULL
      GROUP BY canonical_entity_id
    ),
    historical_ranks AS (
      SELECT 
        canonical_entity_id,
        AVG(position) as avg_position_historical
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 37 DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND entity_type = 'keyword'
        AND position IS NOT NULL
      GROUP BY canonical_entity_id
    )
    SELECT 
      r.canonical_entity_id,
      r.avg_position_recent,
      h.avg_position_historical,
      r.avg_volume,
      (r.avg_position_recent - h.avg_position_historical) as position_drop
    FROM recent_ranks r
    INNER JOIN historical_ranks h
      ON r.canonical_entity_id = h.canonical_entity_id
    WHERE (r.avg_position_recent - h.avg_position_historical) > 5  -- Dropped 5+ positions
      AND h.avg_position_historical <= 20  -- Was ranking reasonably well
    ORDER BY position_drop DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            entity_id = row['canonical_entity_id']
            current_pos = row['avg_position_recent']
            historical_pos = row['avg_position_historical']
            drop = row['position_drop']
            
            fell_off_page_1 = historical_pos <= 10 and current_pos > 10
            
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'category': 'seo_issue',
                'type': 'rank_drop_urgent' if fell_off_page_1 else 'rank_drop',
                'priority': 'high' if fell_off_page_1 else 'medium',
                'status': 'new',
                'entity_id': entity_id,
                'entity_type': 'keyword',
                'title': f"📉 Rank Drop: {entity_id} (↓{drop:.1f} positions)",
                'description': f"Dropped from position {historical_pos:.1f} to {current_pos:.1f} ({drop:.1f} positions). {'Fell off page 1!' if fell_off_page_1 else 'Requires investigation.'}",
                'evidence': {
                    'current_position': current_pos,
                    'historical_position': historical_pos,
                    'position_drop': drop,
                    'search_volume': row['avg_volume'],
                    'fell_off_page_1': fell_off_page_1
                },
                'metrics': {
                    'current_position': current_pos,
                    'previous_position': historical_pos,
                    'positions_lost': drop
                },
                'hypothesis': f"Rank drops can result from algorithm updates, competitor improvements, content decay, or technical issues. Quick action can prevent further losses.",
                'confidence_score': 0.85,
                'potential_impact_score': min(100, drop * 8),
                'urgency_score': 85 if fell_off_page_1 else 65,
                'recommended_actions': [
                    'Check Google Search Console for manual actions',
                    'Review recent SERP changes and new competitors',
                    'Audit page for technical SEO issues',
                    'Refresh content with updated information',
                    'Check if page has been de-indexed',
                    'Analyze top-ranking competitor pages',
                    'Improve E-A-T signals and backlinks',
                    'Monitor for further drops'
                ],
                'estimated_effort': 'medium',
                'estimated_timeline': '1-3 weeks',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} SEO rank drop opportunities")
        
    except Exception as e:
        logger.error(f"❌ Error in seo_rank_drops detector: {e}")
    
    return opportunities
