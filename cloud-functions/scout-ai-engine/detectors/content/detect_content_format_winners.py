"""
Content Format Winners Detector

Detects: Which content formats (blog, video, guide, etc.) perform best
Layer: strategic
Category: content
Data Source: GA4 metrics by content_type
"""
from google.cloud import bigquery
from datetime import datetime
import logging
import uuid
import os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'

def detect_content_format_winners(organization_id: str) -> list:
    """Identify winning content formats to double down on"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Content Format Winners detector...")
    
    opportunities = []
    
    query = f"""
    WITH format_performance AS (
      SELECT 
        m.content_type,
        COUNT(DISTINCT m.canonical_entity_id) as content_count,
        SUM(m.pageviews) as total_pageviews,
        SUM(m.sessions) as total_sessions,
        SUM(m.conversions) as total_conversions,
        AVG(m.dwell_time) as avg_dwell_time,
        AVG(m.engagement_rate) as avg_engagement_rate,
        AVG(m.bounce_rate) as avg_bounce_rate,
        -- Calculate per-piece averages
        SUM(m.pageviews) / NULLIF(COUNT(DISTINCT m.canonical_entity_id), 0) as avg_pageviews_per_piece,
        SUM(m.conversions) / NULLIF(COUNT(DISTINCT m.canonical_entity_id), 0) as avg_conversions_per_piece
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics` m
      WHERE m.organization_id = @org_id
        AND m.entity_type = 'page'
        AND m.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND m.content_type IS NOT NULL
        AND m.content_type != ''
      GROUP BY m.content_type
      HAVING content_count >= 3  -- At least 3 pieces of content
    ),
    overall_avg AS (
      SELECT 
        AVG(avg_pageviews_per_piece) as overall_avg_pageviews,
        AVG(avg_conversions_per_piece) as overall_avg_conversions,
        AVG(avg_engagement_rate) as overall_avg_engagement
      FROM format_performance
    )
    SELECT 
      fp.content_type,
      fp.content_count,
      fp.total_pageviews,
      fp.total_conversions,
      fp.avg_dwell_time,
      fp.avg_engagement_rate,
      fp.avg_bounce_rate,
      fp.avg_pageviews_per_piece,
      fp.avg_conversions_per_piece,
      oa.overall_avg_pageviews,
      oa.overall_avg_conversions,
      oa.overall_avg_engagement,
      -- Performance vs average
      SAFE_DIVIDE((fp.avg_pageviews_per_piece - oa.overall_avg_pageviews) * 100.0, 
                  NULLIF(oa.overall_avg_pageviews, 0)) as pageviews_vs_avg_pct,
      SAFE_DIVIDE((fp.avg_conversions_per_piece - oa.overall_avg_conversions) * 100.0,
                  NULLIF(oa.overall_avg_conversions, 0)) as conversions_vs_avg_pct,
      SAFE_DIVIDE((fp.avg_engagement_rate - oa.overall_avg_engagement) * 100.0,
                  NULLIF(oa.overall_avg_engagement, 0)) as engagement_vs_avg_pct
    FROM format_performance fp
    CROSS JOIN overall_avg oa
    WHERE (
      -- Winners: significantly above average
      fp.avg_pageviews_per_piece > oa.overall_avg_pageviews * 1.3  -- 30%+ better pageviews
      OR fp.avg_conversions_per_piece > oa.overall_avg_conversions * 1.3  -- 30%+ better conversions
      OR fp.avg_engagement_rate > oa.overall_avg_engagement * 1.2  -- 20%+ better engagement
    )
    ORDER BY 
      fp.avg_conversions_per_piece DESC,
      fp.avg_pageviews_per_piece DESC
    LIMIT 5  -- Top 5 formats
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            content_type = row.content_type.title()
            
            # Calculate winner strength
            wins = []
            if row.pageviews_vs_avg_pct and row.pageviews_vs_avg_pct > 30:
                wins.append(f"{row.pageviews_vs_avg_pct:.0f}% more pageviews")
            if row.conversions_vs_avg_pct and row.conversions_vs_avg_pct > 30:
                wins.append(f"{row.conversions_vs_avg_pct:.0f}% more conversions")
            if row.engagement_vs_avg_pct and row.engagement_vs_avg_pct > 20:
                wins.append(f"{row.engagement_vs_avg_pct:.0f}% higher engagement")
            
            # Determine priority based on conversion performance
            if row.avg_conversions_per_piece and row.avg_conversions_per_piece > 5:
                priority = "high"
            elif row.avg_conversions_per_piece and row.avg_conversions_per_piece > 1:
                priority = "medium"
            else:
                priority = "low"
            
            # Build recommended actions
            actions = [
                f"Create more {content_type.lower()} content - it's outperforming other formats",
                f"Allocate more resources to {content_type.lower()} production",
                f"Analyze what makes your {content_type.lower()} successful and replicate",
                "Study top-performing pieces to identify winning patterns",
                "Consider promoting existing high-performing content more heavily",
                "Test variations of this format to optimize further",
                "Train team on best practices for this content type"
            ]
            
            opportunity = {
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "content_opportunity",
                "type": "content_format_winners",
                "priority": priority,
                "status": "new",
                "entity_id": row.content_type,
                "entity_type": "content_format",
                "title": f"Winning Format: {content_type} Content ({', '.join(wins[:2])})",
                "description": f"{content_type} content is a top performer with {row.avg_pageviews_per_piece:.0f} avg pageviews/piece and {row.avg_engagement_rate:.1f}% engagement. Create more of this format.",
                "evidence": {
                    "content_type": row.content_type,
                    "pieces_analyzed": int(row.content_count),
                    "total_pageviews": int(row.total_pageviews),
                    "total_conversions": int(row.total_conversions) if row.total_conversions else 0,
                    "avg_pageviews_per_piece": float(row.avg_pageviews_per_piece),
                    "avg_conversions_per_piece": float(row.avg_conversions_per_piece) if row.avg_conversions_per_piece else 0,
                    "avg_dwell_time": float(row.avg_dwell_time) if row.avg_dwell_time else None,
                    "avg_engagement_rate": float(row.avg_engagement_rate) if row.avg_engagement_rate else None,
                    "pageviews_vs_avg_pct": float(row.pageviews_vs_avg_pct) if row.pageviews_vs_avg_pct else None,
                    "conversions_vs_avg_pct": float(row.conversions_vs_avg_pct) if row.conversions_vs_avg_pct else None,
                    "engagement_vs_avg_pct": float(row.engagement_vs_avg_pct) if row.engagement_vs_avg_pct else None,
                    "performance_indicators": wins
                },
                "metrics": {
                    "avg_pageviews_per_piece": float(row.avg_pageviews_per_piece),
                    "avg_conversions_per_piece": float(row.avg_conversions_per_piece) if row.avg_conversions_per_piece else 0,
                    "content_count": int(row.content_count),
                    "total_pageviews": int(row.total_pageviews)
                },
                "hypothesis": f"Doubling down on {content_type.lower()} content will amplify what's already working and drive more traffic/conversions",
                "confidence_score": 0.9,
                "potential_impact_score": min(95, 70 + len(wins) * 5),
                "urgency_score": 70,
                "recommended_actions": actions[:6],
                "estimated_effort": "medium",
                "estimated_timeline": "2-8 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            opportunities.append(opportunity)
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} winning content formats")
        else:
            logger.info("✅ No clear format winners detected yet")
            
    except Exception as e:
        logger.error(f"❌ Content Format Winners detector failed: {e}")
    
    return opportunities
