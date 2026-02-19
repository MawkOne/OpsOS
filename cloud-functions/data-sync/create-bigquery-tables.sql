-- =============================================================================
-- BigQuery Table Creation Script
-- Run this in BigQuery Console to create all aggregation tables
-- =============================================================================

-- The hierarchy: daily → weekly → monthly → L12M → all-time

-- =============================================================================
-- 1. WEEKLY ENTITY METRICS
-- =============================================================================

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
  wow_change_pct FLOAT64,
  wow_change_abs FLOAT64,
  is_best_week BOOLEAN DEFAULT FALSE,
  is_worst_week BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY week_start_date
CLUSTER BY organization_id, canonical_entity_id, entity_type;


-- =============================================================================
-- 2. L12M (LAST 12 MONTHS) ENTITY METRICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.l12m_entity_metrics` (
  organization_id STRING NOT NULL,
  as_of_date DATE NOT NULL,
  period_start_month STRING NOT NULL,
  period_end_month STRING NOT NULL,
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,
  
  -- Core Metrics (summed across 12 months)
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  
  -- Engagement Metrics
  avg_session_duration FLOAT64 DEFAULT 0,
  avg_bounce_rate FLOAT64 DEFAULT 0,
  avg_engagement_rate FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  -- Revenue Metrics
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  profit FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics
  avg_ctr FLOAT64 DEFAULT 0,
  avg_cpc FLOAT64 DEFAULT 0,
  avg_cpa FLOAT64 DEFAULT 0,
  avg_roas FLOAT64 DEFAULT 0,
  avg_roi FLOAT64 DEFAULT 0,
  
  -- SEO Metrics
  avg_position FLOAT64 DEFAULT 0,
  avg_search_volume INT64 DEFAULT 0,
  
  -- Email Metrics
  sends INT64 DEFAULT 0,
  opens INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  
  -- Monthly Averages
  avg_monthly_sessions FLOAT64 DEFAULT 0,
  avg_monthly_revenue FLOAT64 DEFAULT 0,
  avg_monthly_conversions FLOAT64 DEFAULT 0,
  
  -- Variance & Range
  sessions_stddev FLOAT64 DEFAULT 0,
  revenue_stddev FLOAT64 DEFAULT 0,
  sessions_min INT64 DEFAULT 0,
  sessions_max INT64 DEFAULT 0,
  revenue_min FLOAT64 DEFAULT 0,
  revenue_max FLOAT64 DEFAULT 0,
  
  -- Trend Metrics (H1 vs H2)
  trend_direction STRING,
  trend_pct_change FLOAT64,
  
  -- Best/Worst Month References
  best_month STRING,
  best_month_sessions INT64,
  worst_month STRING,
  worst_month_sessions INT64,
  
  -- Data Quality
  months_with_data INT64 DEFAULT 0,
  data_completeness FLOAT64 DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY as_of_date
CLUSTER BY organization_id, canonical_entity_id, entity_type;


-- =============================================================================
-- 3. ALL-TIME ENTITY METRICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.alltime_entity_metrics` (
  organization_id STRING NOT NULL,
  as_of_date DATE NOT NULL,
  first_month STRING NOT NULL,
  last_month STRING NOT NULL,
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,
  
  -- Core Metrics (summed across all time)
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  
  -- Engagement Metrics
  avg_session_duration FLOAT64 DEFAULT 0,
  avg_bounce_rate FLOAT64 DEFAULT 0,
  avg_engagement_rate FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  -- Revenue Metrics
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  profit FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics
  avg_ctr FLOAT64 DEFAULT 0,
  avg_cpc FLOAT64 DEFAULT 0,
  avg_cpa FLOAT64 DEFAULT 0,
  avg_roas FLOAT64 DEFAULT 0,
  avg_roi FLOAT64 DEFAULT 0,
  
  -- SEO Metrics
  avg_position FLOAT64 DEFAULT 0,
  avg_search_volume INT64 DEFAULT 0,
  
  -- Email Metrics
  sends INT64 DEFAULT 0,
  opens INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  
  -- Monthly Averages
  avg_monthly_sessions FLOAT64 DEFAULT 0,
  avg_monthly_revenue FLOAT64 DEFAULT 0,
  avg_monthly_conversions FLOAT64 DEFAULT 0,
  
  -- Variance & Range
  sessions_stddev FLOAT64 DEFAULT 0,
  revenue_stddev FLOAT64 DEFAULT 0,
  sessions_min INT64 DEFAULT 0,
  sessions_max INT64 DEFAULT 0,
  revenue_min FLOAT64 DEFAULT 0,
  revenue_max FLOAT64 DEFAULT 0,
  
  -- Percentile Bands
  sessions_p10 FLOAT64 DEFAULT 0,
  sessions_p25 FLOAT64 DEFAULT 0,
  sessions_p50 FLOAT64 DEFAULT 0,
  sessions_p75 FLOAT64 DEFAULT 0,
  sessions_p90 FLOAT64 DEFAULT 0,
  
  -- Best/Worst Month References
  best_month STRING,
  best_month_sessions INT64,
  best_month_revenue FLOAT64,
  worst_month STRING,
  worst_month_sessions INT64,
  worst_month_revenue FLOAT64,
  
  -- Long-term Trend
  trend_direction STRING,
  trend_pct_change FLOAT64,
  
  -- Data Quality
  total_months INT64 DEFAULT 0,
  months_with_data INT64 DEFAULT 0,
  data_span_months INT64 DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY as_of_date
CLUSTER BY organization_id, canonical_entity_id, entity_type;


-- =============================================================================
-- VIEWS
-- =============================================================================

-- Weekly Summary View
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

-- L12M Summary View
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

-- All-Time Summary View
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


-- =============================================================================
-- DONE!
-- =============================================================================
-- 
-- After running this script, you have:
-- 
-- Tables:
--   ✅ weekly_entity_metrics (aggregates daily → weekly)
--   ✅ l12m_entity_metrics (aggregates monthly → last 12 months)
--   ✅ alltime_entity_metrics (aggregates monthly → all time)
-- 
-- Views:
--   ✅ weekly_metrics_summary
--   ✅ l12m_metrics_summary
--   ✅ alltime_metrics_summary
-- 
-- Complete Hierarchy:
--   daily_entity_metrics (existed)
--       ↓
--   weekly_entity_metrics (NEW)
--       ↓
--   monthly_entity_metrics (existed)
--       ↓
--   l12m_entity_metrics (NEW - from monthly)
--       ↓
--   alltime_entity_metrics (NEW - from monthly)
