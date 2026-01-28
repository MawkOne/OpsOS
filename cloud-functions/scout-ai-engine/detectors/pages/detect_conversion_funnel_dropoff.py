"""Conversion Funnel Drop-Off Detector"""
from google.cloud import bigquery
from datetime import datetime
import logging, uuid, os
logger = logging.getLogger(__name__)
PROJECT_ID, DATASET_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1'), 'marketing_ai'

def detect_conversion_funnel_dropoff(organization_id: str) -> list:
    """Detect pages with high funnel drop-off rates"""
    bq_client = bigquery.Client()
    logger.info("🔍 Running Conversion Funnel Drop-Off detector...")
    opportunities = []
    
    query = f"""
    WITH funnel_performance AS (
      SELECT 
        canonical_entity_id,
        SUM(pageviews) as pageviews,
        SUM(sessions) as sessions,
        SUM(add_to_cart) as add_to_carts,
        SUM(checkout_started) as checkouts,
        SUM(purchase_completed) as purchases,
        SUM(conversions) as conversions,
        AVG(bounce_rate) as bounce_rate,
        -- Calculate step-by-step conversion rates
        SAFE_DIVIDE(SUM(add_to_cart), SUM(pageviews)) * 100 as view_to_cart_rate,
        SAFE_DIVIDE(SUM(checkout_started), SUM(add_to_cart)) * 100 as cart_to_checkout_rate,
        SAFE_DIVIDE(SUM(purchase_completed), SUM(checkout_started)) * 100 as checkout_to_purchase_rate,
        SAFE_DIVIDE(SUM(purchase_completed), SUM(pageviews)) * 100 as overall_cvr
      FROM `{PROJECT_ID}.{DATASET_ID}.daily_entity_metrics`
      WHERE organization_id = @org_id
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
        AND entity_type = 'page'
        AND pageviews > 100
      GROUP BY canonical_entity_id
    )
    SELECT * FROM funnel_performance
    WHERE (
      -- High cart abandonment
      (add_to_carts > 20 AND cart_to_checkout_rate < 40)
      OR
      -- High checkout abandonment  
      (checkouts > 10 AND checkout_to_purchase_rate < 50)
      OR
      -- Low overall conversion with funnel activity
      (add_to_carts > 10 AND overall_cvr < 2)
    )
    AND pageviews > 200  -- Meaningful traffic
    ORDER BY pageviews DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            # Identify worst drop-off point
            dropoff_points = []
            if row.add_to_carts > 20 and row.cart_to_checkout_rate < 40:
                dropoff_points.append(f"Cart→Checkout: {row.cart_to_checkout_rate:.0f}%")
            if row.checkouts > 10 and row.checkout_to_purchase_rate < 50:
                dropoff_points.append(f"Checkout→Purchase: {row.checkout_to_purchase_rate:.0f}%")
            
            # Determine priority
            lost_revenue_potential = row.pageviews * 0.03  # Assume 3% target CVR
            if row.pageviews > 1000 or row.overall_cvr < 1:
                priority = "high"
            elif row.pageviews > 500:
                priority = "medium"
            else:
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "category": "page_optimization",
                "type": "conversion_funnel_dropoff",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Funnel Drop-Off: {', '.join(dropoff_points)} - {row.canonical_entity_id}",
                "description": f"Significant drop-off in conversion funnel. {int(row.pageviews)} pageviews but only {row.overall_cvr:.1f}% convert. Drop-off points: {', '.join(dropoff_points)}",
                "evidence": {
                    "pageviews": int(row.pageviews),
                    "add_to_carts": int(row.add_to_carts) if row.add_to_carts else 0,
                    "checkouts": int(row.checkouts) if row.checkouts else 0,
                    "purchases": int(row.purchases) if row.purchases else 0,
                    "view_to_cart_rate": float(row.view_to_cart_rate) if row.view_to_cart_rate else 0,
                    "cart_to_checkout_rate": float(row.cart_to_checkout_rate) if row.cart_to_checkout_rate else 0,
                    "checkout_to_purchase_rate": float(row.checkout_to_purchase_rate) if row.checkout_to_purchase_rate else 0,
                    "overall_cvr": float(row.overall_cvr),
                    "bounce_rate": float(row.bounce_rate) if row.bounce_rate else None,
                    "worst_dropoff": dropoff_points[0] if dropoff_points else "Overall low conversion"
                },
                "metrics": {
                    "overall_conversion_rate": float(row.overall_cvr),
                    "pageviews": int(row.pageviews),
                    "cart_abandonment": 100 - float(row.cart_to_checkout_rate) if row.cart_to_checkout_rate else None
                },
                "hypothesis": f"Fixing funnel drop-offs could 2-3x conversion rate and add {int(lost_revenue_potential)} conversions",
                "confidence_score": 0.85,
                "potential_impact_score": min(95, 70 + (3 - row.overall_cvr) * 5),
                "urgency_score": 85 if priority == "high" else 65,
                "recommended_actions": [
                    "Map complete user journey to identify friction",
                    "Simplify checkout process (reduce steps/fields)",
                    "Add trust signals (security badges, reviews)",
                    "Test exit-intent popups with offers",
                    "Improve mobile checkout experience",
                    "Add progress indicators in checkout",
                    "Offer guest checkout option",
                    "Test different payment options"
                ][:6],
                "estimated_effort": "medium",
                "estimated_timeline": "3-6 weeks",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} funnel drop-off opportunities")
        else:
            logger.info("✅ No significant funnel drop-offs detected")
            
    except Exception as e:
        logger.error(f"❌ Conversion Funnel Drop-Off detector error: {e}")
    
    return opportunities
