-- BigQuery Schema for All-Time Entity Metrics
-- Aggregates monthly_entity_metrics for the entire history
-- Part of the hierarchical aggregation: daily → weekly → monthly → L12M → all-time
-- 
-- KEY: All-time aggregates from MONTHLY data, not daily
-- This provides structural baselines and historical context

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.alltime_entity_metrics` (
  organization_id STRING NOT NULL,
  as_of_date DATE NOT NULL,            -- The date this snapshot was calculated
  first_month STRING NOT NULL,         -- First month with data (e.g., "2022-01")
  last_month STRING NOT NULL,          -- Last month with data (e.g., "2025-01")
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,         -- page, campaign, keyword, product, email
  
  -- Core Metrics (summed across all time)
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  
  -- Engagement Metrics (weighted averages across all time)
  avg_session_duration FLOAT64 DEFAULT 0,
  avg_bounce_rate FLOAT64 DEFAULT 0,
  avg_engagement_rate FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  -- Revenue Metrics (summed across all time)
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  profit FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics (averaged across all time)
  avg_ctr FLOAT64 DEFAULT 0,
  avg_cpc FLOAT64 DEFAULT 0,
  avg_cpa FLOAT64 DEFAULT 0,
  avg_roas FLOAT64 DEFAULT 0,
  avg_roi FLOAT64 DEFAULT 0,
  
  -- SEO Metrics
  avg_position FLOAT64 DEFAULT 0,
  avg_search_volume INT64 DEFAULT 0,
  
  -- Email Metrics (summed across all time)
  sends INT64 DEFAULT 0,
  opens INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  
  -- Monthly Averages (for baseline comparison)
  avg_monthly_sessions FLOAT64 DEFAULT 0,
  avg_monthly_revenue FLOAT64 DEFAULT 0,
  avg_monthly_conversions FLOAT64 DEFAULT 0,
  
  -- Variance & Range (for anomaly detection / regime detection)
  sessions_stddev FLOAT64 DEFAULT 0,
  revenue_stddev FLOAT64 DEFAULT 0,
  sessions_min INT64 DEFAULT 0,
  sessions_max INT64 DEFAULT 0,
  revenue_min FLOAT64 DEFAULT 0,
  revenue_max FLOAT64 DEFAULT 0,
  
  -- Percentile Bands (for "where does current month fall?")
  sessions_p10 FLOAT64 DEFAULT 0,      -- 10th percentile
  sessions_p25 FLOAT64 DEFAULT 0,      -- 25th percentile (Q1)
  sessions_p50 FLOAT64 DEFAULT 0,      -- 50th percentile (median)
  sessions_p75 FLOAT64 DEFAULT 0,      -- 75th percentile (Q3)
  sessions_p90 FLOAT64 DEFAULT 0,      -- 90th percentile
  
  -- Best/Worst Month References
  best_month STRING,                   -- e.g., "2024-12"
  best_month_sessions INT64,
  best_month_revenue FLOAT64,
  worst_month STRING,                  -- e.g., "2022-03"
  worst_month_sessions INT64,
  worst_month_revenue FLOAT64,
  
  -- Long-term Trend (comparing first year to most recent year, if available)
  trend_direction STRING,              -- 'up', 'down', 'stable'
  trend_pct_change FLOAT64,            -- % change (recent 12mo vs first 12mo)
  
  -- Data Quality
  total_months INT64 DEFAULT 0,        -- Total months of data
  months_with_data INT64 DEFAULT 0,    -- Months that have non-zero sessions
  data_span_months INT64 DEFAULT 0,    -- Months between first and last data point
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY as_of_date
CLUSTER BY organization_id, canonical_entity_id, entity_type;

-- View for all-time summary across all entities
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.alltime_metrics_summary` AS
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
  AVG(total_months) as avg_months_of_data,
  AVG(trend_pct_change) as avg_trend_pct_change
FROM `opsos-864a1.marketing_ai.alltime_entity_metrics`
GROUP BY organization_id, as_of_date, entity_type;
