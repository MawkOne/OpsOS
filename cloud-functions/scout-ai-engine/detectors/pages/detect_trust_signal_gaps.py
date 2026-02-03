"""
Trust Signal Gaps Detector
Detects pages where users show purchase intent but don't convert
High add-to-cart but low checkout = trust/credibility issues
"""
from google.cloud import bigquery
from datetime import datetime, timedelta
import logging, uuid, os

logger = logging.getLogger(__name__)
PROJECT_ID = os.environ.get('GCP_PROJECT', 'opsos-864a1')
DATASET_ID = 'marketing_ai'


def detect_trust_signal_gaps(organization_id: str) -> list:
    """
    Detect pages where users show intent (add-to-cart, form starts) but don't convert.
    
    Logic:
    - High add-to-cart or form starts
    - Low conversion/checkout rate
    - This pattern suggests users want to buy but something stops them (trust issues)
    """
    bq_client = bigquery.Client()
    logger.info("🔍 Running Trust Signal Gaps detector...")
    opportunities = []
    
    query = f"""
    WITH intent_metrics AS (
      SELECT 
        canonical_entity_id,
        SUM(sessions) as total_sessions,
        SUM(add_to_cart) as total_add_to_cart,
        SUM(checkout_started) as total_checkouts,
        SUM(conversions) as total_conversions,
        SUM(form_starts) as total_form_starts,
        SUM(form_submits) as total_form_submits,
        AVG(conversion_rate) as avg_cvr,
        -- Calculate intent-to-conversion rates
        SAFE_DIVIDE(SUM(checkout_started), SUM(add_to_cart)) * 100 as cart_to_checkout_rate,
        SAFE_DIVIDE(SUM(form_submits), SUM(form_starts)) * 100 as form_completion_rate
      FROM `{PROJECT_ID}.{DATASET_ID}.monthly_entity_metrics`
      WHERE organization_id = @org_id 
        AND year_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))
        AND entity_type = 'page'
      GROUP BY canonical_entity_id
    )
    SELECT *,
      PERCENT_RANK() OVER (ORDER BY total_sessions) as traffic_percentile
    FROM intent_metrics
    WHERE (
      -- High cart activity but low checkout (trust issue at checkout)
      (total_add_to_cart > 20 AND cart_to_checkout_rate < 40)
      OR
      -- High form starts but low completion (trust issue on forms)
      (total_form_starts > 20 AND form_completion_rate < 50)
      OR
      -- Decent traffic but very low CVR (general trust issue)
      (total_sessions > 500 AND avg_cvr < 0.5 AND total_add_to_cart > 10)
    )
    ORDER BY total_sessions DESC
    LIMIT 15
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)]
    )
    
    try:
        results = bq_client.query(query, job_config=job_config).result()
        
        for row in results:
            sessions = int(row.total_sessions)
            cart_to_checkout = float(row.cart_to_checkout_rate) if row.cart_to_checkout_rate else None
            form_completion = float(row.form_completion_rate) if row.form_completion_rate else None
            add_to_cart = int(row.total_add_to_cart) if row.total_add_to_cart else 0
            checkouts = int(row.total_checkouts) if row.total_checkouts else 0
            form_starts = int(row.total_form_starts) if row.total_form_starts else 0
            form_submits = int(row.total_form_submits) if row.total_form_submits else 0
            
            # Determine the primary trust gap
            if cart_to_checkout and cart_to_checkout < 40 and add_to_cart > 20:
                issue_type = "cart_abandonment"
                issue_desc = f"Cart→Checkout: only {cart_to_checkout:.0f}%"
                lost_users = add_to_cart - checkouts
            elif form_completion and form_completion < 50 and form_starts > 20:
                issue_type = "form_abandonment"
                issue_desc = f"Form completion: only {form_completion:.0f}%"
                lost_users = form_starts - form_submits
            else:
                issue_type = "general_trust"
                issue_desc = f"Low CVR ({row.avg_cvr:.2f}%) despite intent signals"
                lost_users = add_to_cart - int(row.total_conversions or 0)
            
            # Priority based on traffic
            if row.traffic_percentile >= 0.8:
                priority = "high"
            elif row.traffic_percentile >= 0.5:
                priority = "medium"
            else:
                priority = "low"
            
            opportunities.append({
                "id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "detected_at": datetime.utcnow().isoformat(),
                "data_period_end": (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d'),
                "category": "page_optimization",
                "type": "trust_signal_gap",
                "priority": priority,
                "status": "new",
                "entity_id": row.canonical_entity_id,
                "entity_type": "page",
                "title": f"Trust Gap: {issue_desc}",
                "description": f"Users show purchase intent but don't convert. {lost_users:,} users added to cart or started forms but didn't complete. This pattern suggests trust/credibility issues.",
                "evidence": {
                    "sessions": sessions,
                    "add_to_cart": add_to_cart,
                    "checkouts": checkouts,
                    "cart_to_checkout_rate": cart_to_checkout,
                    "form_starts": form_starts,
                    "form_submits": form_submits,
                    "form_completion_rate": form_completion,
                    "conversion_rate": float(row.avg_cvr) if row.avg_cvr else 0,
                    "lost_users": lost_users,
                    "traffic_percentile": float(row.traffic_percentile)
                },
                "metrics": {
                    "cart_to_checkout_rate": cart_to_checkout,
                    "form_completion_rate": form_completion,
                    "sessions": sessions
                },
                "hypothesis": f"Users want to buy but something stops them. Adding trust signals (reviews, security badges, guarantees) could recover {lost_users:,} lost conversions.",
                "confidence_score": 0.85,
                "potential_impact_score": min(95, 60 + lost_users / 10),
                "urgency_score": 80 if priority == "high" else 60,
                "recommended_actions": [
                    "Add customer reviews/testimonials near checkout",
                    "Display security badges (SSL, payment icons)",
                    "Add money-back guarantee messaging",
                    "Show trust indicators (years in business, customer count)",
                    "Reduce checkout steps and fields",
                    f"Potential recovery: {lost_users:,} users showing intent"
                ],
                "estimated_effort": "low",
                "estimated_timeline": "1-3 days",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })
        
        if opportunities:
            logger.info(f"✅ Found {len(opportunities)} trust signal gaps")
        else:
            logger.info("✅ No trust signal gaps detected")
            
    except Exception as e:
        logger.error(f"❌ Trust Signal Gaps detector error: {e}")
    
    return opportunities
