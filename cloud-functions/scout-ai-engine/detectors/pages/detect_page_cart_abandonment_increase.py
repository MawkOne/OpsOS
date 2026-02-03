"""
Detect Page Cart Abandonment Increase Detector
Category: Pages
"""

"""
PAGES Detectors\nAll detection layers (Fast, Trend, Strategic) for landing pages & conversion
"""

from google.cloud import bigquery
import json
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"

def detect_page_cart_abandonment_increase(organization_id: str) -> list:
    bq_client = bigquery.Client()
    """
    Detect: Cart abandonment rate increasing
    Trend Layer: Weekly check
    """
    logger.info("🔍 Running Cart Abandonment Increase detector...")
    
    opportunities = []
    
    query = f"""
    WITH recent_performance AS (
      SELECT 
        AVG(cart_abandonment_rate) as avg_cart_abandonment,
        SUM(add_to_cart) as total_add_to_cart,
        SUM(begin_checkout) as total_begin_checkout,
        SUM(purchase_count) as total_purchases
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        
      WHERE organization_id = @org_id
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        
        AND add_to_cart > 0
    ),
    historical_performance AS (
      SELECT 
        AVG(cart_abandonment_rate) as baseline_cart_abandonment
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
        
      WHERE organization_id = @org_id
        
        
        AND add_to_cart > 0
    )
    SELECT 
      avg_cart_abandonment as current_cart_abandonment,
      baseline_cart_abandonment,
      total_add_to_cart,
      total_begin_checkout,
      total_purchases,
      SAFE_DIVIDE((avg_cart_abandonment - baseline_cart_abandonment), baseline_cart_abandonment) * 100 as cart_abandonment_increase_pct
    FROM recent_performance r
    CROSS JOIN historical_performance h
    WHERE avg_cart_abandonment > 60  -- >60% is concerning
      OR (baseline_cart_abandonment > 0 AND avg_cart_abandonment > baseline_cart_abandonment * 1.15)  -- 15%+ increase
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
        ]
    )
    
    try:
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            priority = "high" if row.current_cart_abandonment > 75 else "medium"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "conversion_optimization",
                "type": "cart_abandonment_increase",
                "priority": priority,
                "status": "new",
                "entity_id": "aggregate",
                "entity_type": "ecommerce",
                "title": f"Cart Abandonment Increasing: {row.current_cart_abandonment:.1f}%",
                "description": f"Cart abandonment at {row.current_cart_abandonment:.1f}%, up from {row.baseline_cart_abandonment:.1f}%",
                "evidence": {
                    "current_cart_abandonment": float(row.current_cart_abandonment),
                    "baseline_cart_abandonment": float(row.baseline_cart_abandonment),
                    "cart_abandonment_increase_pct": float(row.cart_abandonment_increase_pct),
                    "total_add_to_cart": int(row.total_add_to_cart),
                    "total_begin_checkout": int(row.total_begin_checkout),
                    "total_purchases": int(row.total_purchases),
                },
                "metrics": {
                    "cart_abandonment_rate": float(row.current_cart_abandonment),
                },
                "hypothesis": "Shipping costs, checkout friction, payment issues, or lack of trust causing cart abandonment",
                "confidence_score": 0.85,
                "potential_impact_score": min(100, row.current_cart_abandonment * 0.8),
                "urgency_score": 85 if row.current_cart_abandonment > 75 else 65,
                "recommended_actions": [
                    "Review shipping costs - too high or surprise fees?",
                    "Simplify checkout process - reduce steps",
                    "Add more payment options",
                    "Display trust badges and security info",
                    "Test guest checkout option",
                    "Send cart abandonment emails",
                    f"Revenue recovery potential: {int(row.total_add_to_cart - row.total_purchases)} abandoned carts"
                ],
                "estimated_effort": "medium",
                "estimated_timeline": "1-2 weeks",
            })
        
        logger.info(f"✅ Cart Abandonment Increase detector found {len(opportunities)} opportunities")
    except Exception as e:
        logger.error(f"❌ Cart Abandonment Increase detector failed: {e}")
    
    return opportunities
