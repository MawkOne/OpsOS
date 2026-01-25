-- BigQuery Schema for Daily Entity Metrics
-- This table aggregates all metrics at the daily entity level for Scout AI

-- Daily Entity Metrics Table
CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.daily_entity_metrics` (
  organization_id STRING NOT NULL,
  date DATE NOT NULL,
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,  -- page, campaign, keyword, product, email
  
  -- Core Metrics
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  
  -- Engagement Metrics
  avg_session_duration FLOAT64 DEFAULT 0,
  bounce_rate FLOAT64 DEFAULT 0,
  engagement_rate FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  -- Revenue Metrics
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  profit FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics
  ctr FLOAT64 DEFAULT 0,          -- clicks / impressions
  cpc FLOAT64 DEFAULT 0,          -- cost / clicks
  cpa FLOAT64 DEFAULT 0,          -- cost / conversions
  roas FLOAT64 DEFAULT 0,         -- revenue / cost
  roi FLOAT64 DEFAULT 0,          -- (revenue - cost) / cost
  
  -- SEO Metrics (for keywords/pages)
  position FLOAT64 DEFAULT 0,
  search_volume INT64 DEFAULT 0,
  
  -- Email Metrics
  sends INT64 DEFAULT 0,
  opens INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  
  -- Metadata
  source_breakdown JSON,          -- Which sources contributed (ga4: 50 sessions, ads: 30 sessions)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, canonical_entity_id, entity_type;

-- Create a view for easy metric access
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.daily_metrics_summary` AS
SELECT 
  organization_id,
  date,
  entity_type,
  COUNT(DISTINCT canonical_entity_id) as entity_count,
  SUM(sessions) as total_sessions,
  SUM(revenue) as total_revenue,
  SUM(cost) as total_cost,
  SAFE_DIVIDE(SUM(revenue), SUM(cost)) as avg_roas,
  SAFE_DIVIDE(SUM(conversions), SUM(sessions)) as avg_conversion_rate
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
GROUP BY organization_id, date, entity_type;

-- Example queries:
-- Get metrics for a specific entity over time:
-- SELECT date, sessions, revenue, roas 
-- FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
-- WHERE canonical_entity_id = 'page_pricing' 
-- ORDER BY date DESC;

-- Compare entity performance:
-- SELECT canonical_entity_id, SUM(revenue) as total_revenue, AVG(roas) as avg_roas
-- FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
-- WHERE entity_type = 'page' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
-- GROUP BY canonical_entity_id
-- ORDER BY total_revenue DESC;
