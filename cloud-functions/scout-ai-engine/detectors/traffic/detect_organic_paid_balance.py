"""
Detect Organic vs Paid Balance Detector
Category: Traffic
Detects: Unhealthy reliance on paid vs organic traffic
"""

from google.cloud import bigquery
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_organic_paid_balance(organization_id: str) -> list:
    """
    Detect unhealthy organic/paid traffic balance (>70% from single source type)
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Organic vs Paid Balance detector...")
    
    opportunities = []
    
    query = f"""
    WITH traffic_by_type AS (
      SELECT 
        CASE 
          WHEN LOWER(canonical_entity_id) LIKE '%organic%' OR LOWER(canonical_entity_id) LIKE '%seo%' THEN 'organic'
          WHEN LOWER(canonical_entity_id) LIKE '%paid%' OR LOWER(canonical_entity_id) LIKE '%cpc%' OR LOWER(canonical_entity_id) LIKE '%ppc%' OR LOWER(canonical_entity_id) LIKE '%google_ads%' OR LOWER(canonical_entity_id) LIKE '%facebook_ads%' THEN 'paid'
          WHEN LOWER(canonical_entity_id) LIKE '%direct%' THEN 'direct'
          WHEN LOWER(canonical_entity_id) LIKE '%referral%' THEN 'referral'
          WHEN LOWER(canonical_entity_id) LIKE '%social%' THEN 'social'
          WHEN LOWER(canonical_entity_id) LIKE '%email%' THEN 'email'
          ELSE 'other'
        END as traffic_type,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SUM(revenue) as revenue
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND entity_type = 'traffic_source'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY traffic_type
    ),
    totals AS (
      SELECT 
        SUM(sessions) as total_sessions,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue
      FROM traffic_by_type
    )
    SELECT 
      t.traffic_type,
      t.sessions,
      t.conversions,
      t.revenue,
      SAFE_DIVIDE(t.sessions, totals.total_sessions) * 100 as sessions_share,
      SAFE_DIVIDE(t.conversions, totals.total_conversions) * 100 as conversions_share,
      SAFE_DIVIDE(t.revenue, totals.total_revenue) * 100 as revenue_share,
      totals.total_sessions,
      totals.total_conversions
    FROM traffic_by_type t
    CROSS JOIN totals
    ORDER BY t.sessions DESC
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        results = list(bq_client.query(query, job_config=job_config).result())
        
        # Calculate organic and paid specifically
        organic_sessions = sum(r['sessions'] for r in results if r['traffic_type'] == 'organic')
        paid_sessions = sum(r['sessions'] for r in results if r['traffic_type'] == 'paid')
        total_sessions = sum(r['sessions'] for r in results)
        
        if total_sessions == 0:
            return opportunities
        
        organic_share = (organic_sessions / total_sessions) * 100
        paid_share = (paid_sessions / total_sessions) * 100
        
        # Check for imbalances
        for row in results:
            traffic_type = row['traffic_type']
            sessions_share = row['sessions_share'] or 0
            
            # Flag if any single channel > 70%
            if sessions_share > 70:
                opportunities.append({
                    'id': str(uuid.uuid4()),
                    'organization_id': organization_id,
                    'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                    'category': 'traffic_channel_balance',
                    'type': 'channel_over_reliance',
                    'priority': 'high',
                    'status': 'new',
                    'entity_id': f'channel_{traffic_type}',
                    'entity_type': 'traffic_channel',
                    'title': f"⚠️ Over-Reliance on {traffic_type.title()} Traffic",
                    'description': f"{traffic_type.title()} traffic accounts for {sessions_share:.0f}% of all sessions. This creates risk if this channel experiences issues.",
                    'evidence': {
                        'traffic_type': traffic_type,
                        'sessions': int(row['sessions'] or 0),
                        'sessions_share': float(sessions_share),
                        'conversions_share': float(row['conversions_share'] or 0),
                        'total_sessions': int(row['total_sessions'] or 0)
                    },
                    'metrics': {
                        'channel_share': float(sessions_share),
                        'channel_sessions': int(row['sessions'] or 0)
                    },
                    'hypothesis': f"Heavy reliance on {traffic_type} traffic creates business risk. Diversification recommended.",
                    'confidence_score': 0.90,
                    'potential_impact_score': min(100, sessions_share),
                    'urgency_score': 70,
                    'recommended_actions': [
                        'Develop alternative traffic channels',
                        f'Reduce {traffic_type} dependency gradually',
                        'Invest in content marketing for organic growth' if traffic_type == 'paid' else 'Consider strategic paid campaigns',
                        'Build email list for owned audience',
                        'Monitor channel health closely'
                    ],
                    'estimated_effort': 'high',
                    'estimated_timeline': '3-6 months',
                    'historical_performance': {},
                    'comparison_data': {},
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })
        
        # Also flag if paid > organic by large margin (unhealthy for long-term)
        if paid_share > organic_share + 30 and paid_share > 40:
            opportunities.append({
                'id': str(uuid.uuid4()),
                'organization_id': organization_id,
                'detected_at': datetime.utcnow().isoformat(),
                'data_period_end': (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                'category': 'traffic_channel_balance',
                'type': 'paid_organic_imbalance',
                'priority': 'medium',
                'status': 'new',
                'entity_id': 'paid_vs_organic',
                'entity_type': 'traffic_balance',
                'title': f"💰 Paid Traffic Dominates Organic ({paid_share:.0f}% vs {organic_share:.0f}%)",
                'description': f"Paid traffic ({paid_share:.0f}%) significantly exceeds organic ({organic_share:.0f}%). Consider investing more in SEO/content for sustainable growth.",
                'evidence': {
                    'paid_share': float(paid_share),
                    'organic_share': float(organic_share),
                    'paid_sessions': int(paid_sessions),
                    'organic_sessions': int(organic_sessions)
                },
                'metrics': {
                    'paid_share': float(paid_share),
                    'organic_share': float(organic_share)
                },
                'hypothesis': "Over-reliance on paid traffic is expensive and unsustainable. Building organic traffic provides long-term value.",
                'confidence_score': 0.85,
                'potential_impact_score': 70,
                'urgency_score': 50,
                'recommended_actions': [
                    'Invest in SEO and content marketing',
                    'Audit existing content for optimization opportunities',
                    'Build backlink strategy',
                    'Create content targeting high-value keywords',
                    'Set target for organic traffic growth'
                ],
                'estimated_effort': 'high',
                'estimated_timeline': '6-12 months',
                'historical_performance': {},
                'comparison_data': {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        logger.info(f"✅ Found {len(opportunities)} organic/paid balance issues")
        
    except Exception as e:
        logger.error(f"❌ Error in organic_paid_balance detector: {e}")
    
    return opportunities
