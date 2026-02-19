-- BigQuery Schema for Weekly Entity Metrics
-- Aggregates daily_entity_metrics into weekly buckets (ISO week: Mon-Sun)
-- Part of the hierarchical aggregation: daily → weekly → monthly → L12M → all-time

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.weekly_entity_metrics` (
  organization_id STRING NOT NULL,
  year_week STRING NOT NULL,           -- ISO week format: "2025-W05"
  week_start_date DATE NOT NULL,       -- Monday of the week
  week_end_date DATE NOT NULL,         -- Sunday of the week
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,         -- page, campaign, keyword, product, email
  
  -- Core Metrics (summed)
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  
  -- Engagement Metrics (weighted averages)
  avg_session_duration FLOAT64 DEFAULT 0,
  avg_bounce_rate FLOAT64 DEFAULT 0,
  avg_engagement_rate FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  -- Revenue Metrics (summed)
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  profit FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics (averaged)
  avg_ctr FLOAT64 DEFAULT 0,
  avg_cpc FLOAT64 DEFAULT 0,
  avg_cpa FLOAT64 DEFAULT 0,
  avg_roas FLOAT64 DEFAULT 0,
  avg_roi FLOAT64 DEFAULT 0,
  
  -- SEO Metrics
  avg_position FLOAT64 DEFAULT 0,
  avg_search_volume INT64 DEFAULT 0,
  
  -- Email Metrics (summed)
  sends INT64 DEFAULT 0,
  opens INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  
  -- Data Quality
  days_in_week INT64 DEFAULT 7,
  days_with_data INT64 DEFAULT 0,
  data_completeness FLOAT64 DEFAULT 0,
  
  -- Week-over-Week Trends
  wow_change_pct FLOAT64,              -- % change vs previous week
  wow_change_abs FLOAT64,              -- Absolute change vs previous week
  is_best_week BOOLEAN DEFAULT FALSE,  -- Best performing week for this entity
  is_worst_week BOOLEAN DEFAULT FALSE, -- Worst performing week for this entity
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY week_start_date
CLUSTER BY organization_id, canonical_entity_id, entity_type;

-- View for weekly summary across all entities
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.weekly_metrics_summary` AS
SELECT 
  organization_id,
  year_week,
  week_start_date,
  entity_type,
  COUNT(DISTINCT canonical_entity_id) as entity_count,
  SUM(sessions) as total_sessions,
  SUM(revenue) as total_revenue,
  SUM(cost) as total_cost,
  SAFE_DIVIDE(SUM(revenue), SUM(cost)) as avg_roas,
  SAFE_DIVIDE(SUM(conversions), SUM(sessions)) as avg_conversion_rate
FROM `opsos-864a1.marketing_ai.weekly_entity_metrics`
GROUP BY organization_id, year_week, week_start_date, entity_type;
