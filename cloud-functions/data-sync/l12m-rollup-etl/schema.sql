-- BigQuery Schema for Last 12 Months (L12M) Entity Metrics
-- Aggregates monthly_entity_metrics for the trailing 12 months
-- Part of the hierarchical aggregation: daily → weekly → monthly → L12M → all-time
-- 
-- KEY: L12M aggregates from MONTHLY data, not daily
-- This provides seasonality context and yearly baseline comparisons

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.l12m_entity_metrics` (
  organization_id STRING NOT NULL,
  as_of_date DATE NOT NULL,            -- The date this L12M snapshot was calculated
  period_start_month STRING NOT NULL,  -- First month included (e.g., "2024-02")
  period_end_month STRING NOT NULL,    -- Last month included (e.g., "2025-01")
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,         -- page, campaign, keyword, product, email
  
  -- Core Metrics (summed across 12 months)
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  
  -- Engagement Metrics (weighted averages across 12 months)
  avg_session_duration FLOAT64 DEFAULT 0,
  avg_bounce_rate FLOAT64 DEFAULT 0,
  avg_engagement_rate FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  -- Revenue Metrics (summed across 12 months)
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  profit FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics (averaged across 12 months)
  avg_ctr FLOAT64 DEFAULT 0,
  avg_cpc FLOAT64 DEFAULT 0,
  avg_cpa FLOAT64 DEFAULT 0,
  avg_roas FLOAT64 DEFAULT 0,
  avg_roi FLOAT64 DEFAULT 0,
  
  -- SEO Metrics
  avg_position FLOAT64 DEFAULT 0,
  avg_search_volume INT64 DEFAULT 0,
  
  -- Email Metrics (summed across 12 months)
  sends INT64 DEFAULT 0,
  opens INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  
  -- Monthly Averages (for comparison)
  avg_monthly_sessions FLOAT64 DEFAULT 0,
  avg_monthly_revenue FLOAT64 DEFAULT 0,
  avg_monthly_conversions FLOAT64 DEFAULT 0,
  
  -- Variance & Range (for anomaly detection)
  sessions_stddev FLOAT64 DEFAULT 0,
  revenue_stddev FLOAT64 DEFAULT 0,
  sessions_min INT64 DEFAULT 0,
  sessions_max INT64 DEFAULT 0,
  revenue_min FLOAT64 DEFAULT 0,
  revenue_max FLOAT64 DEFAULT 0,
  
  -- Trend Metrics (comparing first 6 months to last 6 months)
  trend_direction STRING,              -- 'up', 'down', 'stable'
  trend_pct_change FLOAT64,            -- % change H2 vs H1
  
  -- Best/Worst Month References
  best_month STRING,                   -- e.g., "2024-12"
  best_month_sessions INT64,
  worst_month STRING,                  -- e.g., "2024-03"
  worst_month_sessions INT64,
  
  -- Data Quality
  months_with_data INT64 DEFAULT 0,    -- How many of the 12 months have data
  data_completeness FLOAT64 DEFAULT 0, -- months_with_data / 12
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY as_of_date
CLUSTER BY organization_id, canonical_entity_id, entity_type;

-- View for L12M summary across all entities
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.l12m_metrics_summary` AS
SELECT 
  organization_id,
  as_of_date,
  entity_type,
  COUNT(DISTINCT canonical_entity_id) as entity_count,
  SUM(sessions) as total_sessions,
  SUM(revenue) as total_revenue,
  SUM(cost) as total_cost,
  SAFE_DIVIDE(SUM(revenue), SUM(cost)) as avg_roas,
  SAFE_DIVIDE(SUM(conversions), SUM(sessions)) as avg_conversion_rate,
  AVG(trend_pct_change) as avg_trend_pct_change
FROM `opsos-864a1.marketing_ai.l12m_entity_metrics`
GROUP BY organization_id, as_of_date, entity_type;
