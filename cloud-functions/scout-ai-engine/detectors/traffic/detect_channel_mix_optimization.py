"""Channel Mix Optimization Detector"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_channel_mix_optimization(organization_id: str) -> list:
    """Detect suboptimal channel mix and reallocation opportunities"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Channel Mix Optimization detector...")
    opportunities = []
    
    query = f"""
    WITH channel_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SUM(revenue) as revenue,
        SAFE_DIVIDE(SUM(conversions), SUM(sessions)) * 100 as cvr,
        SAFE_DIVIDE(SUM(revenue), SUM(sessions)) as rps,
        SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(conversions), 0)) as aov
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id 
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND entity_type = 'traffic_source'
        AND sessions > 100
      GROUP BY canonical_entity_id
    ),
    total_traffic AS (
      SELECT 
        SUM(sessions) as total_sessions,
        SUM(revenue) as total_revenue
      FROM channel_performance
    ),
    channel_analysis AS (
      SELECT 
        cp.*,
        tt.total_sessions,
        tt.total_revenue,
        SAFE_DIVIDE(cp.sessions * 100.0, tt.total_sessions) as traffic_share_pct,
        SAFE_DIVIDE(cp.revenue * 100.0, NULLIF(tt.total_revenue, 0)) as revenue_share_pct,
        -- ROI score: revenue share relative to traffic share
        SAFE_DIVIDE(
          SAFE_DIVIDE(cp.revenue * 100.0, NULLIF(tt.total_revenue, 0)),
          SAFE_DIVIDE(cp.sessions * 100.0, NULLIF(tt.total_sessions, 0))
        ) as efficiency_ratio
      FROM channel_performance cp
      CROSS JOIN total_traffic tt
    )
    SELECT * FROM channel_analysis
    WHERE (
      -- Over-invested in low performers
      (traffic_share_pct > 20 AND cvr < 1.5 AND efficiency_ratio < 0.5)
      OR
      -- Under-invested in high performers  
      (traffic_share_pct < 15 AND cvr > 3 AND efficiency_ratio > 1.5)
      OR
      -- High concentration risk
      (traffic_share_pct > 40)
    )
    ORDER BY 
      CASE 
        WHEN traffic_share_pct > 40 THEN 1  -- Concentration risk first
        WHEN efficiency_ratio < 0.5 THEN 2  -- Over-invested next
        ELSE 3  -- Under-invested last
      END,
      sessions DESC
    LIMIT 10
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            # Identify issue type
            if row.traffic_share_pct > 40:
                issue_type = "concentration_risk"
                title = f"Channel Concentration Risk: {row.traffic_share_pct:.0f}% of traffic"
                desc = f"{row.canonical_entity_id} represents {row.traffic_share_pct:.0f}% of traffic. Diversify to reduce risk."
                priority = "high"
            elif row.efficiency_ratio and row.efficiency_ratio < 0.5:
                issue_type = "over_invested"
                title = f"Over-Invested: {row.canonical_entity_id} ({row.traffic_share_pct:.0f}% traffic, {row.revenue_share_pct:.0f}% revenue)"
                desc = f"{row.canonical_entity_id} gets {row.traffic_share_pct:.0f}% of traffic but only {row.revenue_share_pct:.0f}% of revenue. Consider reallocating budget."
                priority = "medium"
            else:
                issue_type = "under_invested"
                title = f"Under-Invested: {row.canonical_entity_id} ({row.cvr:.1f}% CVR, only {row.traffic_share_pct:.0f}% traffic)"
                desc = f"{row.canonical_entity_id} has strong {row.cvr:.1f}% CVR but only {row.traffic_share_pct:.0f}% of traffic. Opportunity to scale."
                priority = "high"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "traffic_optimization",
                "type": "channel_mix_optimization",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "traffic_source",
                "title": title,
                "description": desc,
                "evidence": {
                    "issue_type": issue_type,
                    "sessions": int(row.sessions),
                    "conversions": int(row.conversions) if row.conversions else 0,
                    "revenue": float(row.revenue) if row.revenue else 0,
                    "cvr": float(row.cvr) if row.cvr else 0,
                    "traffic_share_pct": float(row.traffic_share_pct),
                    "revenue_share_pct": float(row.revenue_share_pct) if row.revenue_share_pct else 0,
                    "efficiency_ratio": float(row.efficiency_ratio) if row.efficiency_ratio else 0,
                    "revenue_per_session": float(row.rps) if row.rps else 0
                },
                "metrics": {
                    "traffic_share": float(row.traffic_share_pct),
                    "revenue_share": float(row.revenue_share_pct) if row.revenue_share_pct else 0,
                    "conversion_rate": float(row.cvr) if row.cvr else 0
                },
                "hypothesis": "Optimizing channel mix based on efficiency will increase overall ROI by 15-30%",
                "confidence_score": 0.85,
                "potential_impact_score": min(90, 60 + abs(row.traffic_share_pct - (row.revenue_share_pct or 0))),
                "urgency_score": 75 if priority == "high" else 60,
                "recommended_actions": [
                    f"{'Reduce' if issue_type == 'over_invested' else 'Increase'} budget allocation for this channel",
                    "Compare channel-level metrics to identify best performers",
                    "Test budget reallocation with 20% shifts",
                    "Set up channel diversification targets" if issue_type == "concentration_risk" else "Scale winning channels incrementally",
                    "Monitor efficiency ratio (revenue share / traffic share)",
                    "A/B test different channel mixes"
                ][:5],
                "estimated_effort": "low",
                "estimated_timeline": "1-2 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} channel mix optimization opportunities")
        else:
            logger.info("✅ Channel mix is well-optimized")
            
    except Exception as e:
        logger.error(f"❌ Channel Mix Optimization detector error: {e}")
    
    return opportunities
