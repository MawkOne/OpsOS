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
  unique_opens INT64 DEFAULT 0,
  clicks_email INT64 DEFAULT 0,
  unique_clicks INT64 DEFAULT 0,
  open_rate FLOAT64 DEFAULT 0,
  click_through_rate FLOAT64 DEFAULT 0,
  click_to_open_rate FLOAT64 DEFAULT 0,
  bounces INT64 DEFAULT 0,
  soft_bounces INT64 DEFAULT 0,
  hard_bounces INT64 DEFAULT 0,
  bounce_rate FLOAT64 DEFAULT 0,
  spam_complaints INT64 DEFAULT 0,
  spam_complaint_rate FLOAT64 DEFAULT 0,
  unsubscribes INT64 DEFAULT 0,
  unsubscribe_rate FLOAT64 DEFAULT 0,
  forwards INT64 DEFAULT 0,
  list_size INT64 DEFAULT 0,
  
  -- Advertising Metrics (Google Ads)
  quality_score FLOAT64 DEFAULT 0,
  ad_approval_status STRING,
  impression_share FLOAT64 DEFAULT 0,
  impression_share_lost_budget FLOAT64 DEFAULT 0,
  impression_share_lost_rank FLOAT64 DEFAULT 0,
  search_impression_share FLOAT64 DEFAULT 0,
  landing_page_experience_score STRING,
  expected_ctr FLOAT64 DEFAULT 0,
  ad_relevance STRING,
  bid_strategy_type STRING,
  
  -- Page/Conversion Metrics
  form_starts INT64 DEFAULT 0,
  form_submits INT64 DEFAULT 0,
  form_abandonment_rate FLOAT64 DEFAULT 0,
  add_to_cart INT64 DEFAULT 0,
  begin_checkout INT64 DEFAULT 0,
  purchase_count INT64 DEFAULT 0,
  cart_abandonment_rate FLOAT64 DEFAULT 0,
  exit_rate FLOAT64 DEFAULT 0,
  scroll_depth_50 INT64 DEFAULT 0,
  scroll_depth_75 INT64 DEFAULT 0,
  scroll_depth_100 INT64 DEFAULT 0,
  scroll_depth_avg FLOAT64 DEFAULT 0,
  error_count INT64 DEFAULT 0,
  page_load_time FLOAT64 DEFAULT 0,
  time_to_interactive FLOAT64 DEFAULT 0,
  
  -- Content Metrics
  publish_date DATE,
  last_updated_date DATE,
  internal_links_in INT64 DEFAULT 0,
  internal_links_out INT64 DEFAULT 0,
  social_shares INT64 DEFAULT 0,
  comments_count INT64 DEFAULT 0,
  
  -- Revenue Metrics (Enhanced)
  transactions INT64 DEFAULT 0,
  average_order_value FLOAT64 DEFAULT 0,
  refunds FLOAT64 DEFAULT 0,
  refund_count INT64 DEFAULT 0,
  refund_rate FLOAT64 DEFAULT 0,
  payment_failures INT64 DEFAULT 0,
  payment_failure_rate FLOAT64 DEFAULT 0,
  first_time_customers INT64 DEFAULT 0,
  returning_customers INT64 DEFAULT 0,
  
  -- SEO Metrics (Enhanced)
  indexed_pages INT64 DEFAULT 0,
  crawl_errors INT64 DEFAULT 0,
  core_web_vitals_lcp FLOAT64 DEFAULT 0,
  core_web_vitals_fid FLOAT64 DEFAULT 0,
  core_web_vitals_cls FLOAT64 DEFAULT 0,
  backlink_count INT64 DEFAULT 0,
  backlink_domain_rating FLOAT64 DEFAULT 0,
  serp_features JSON,
  
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

-- =============================================================================
-- HOURLY ENTITY METRICS (for real-time Fast layer detection)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.hourly_entity_metrics` (
  organization_id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,
  
  -- Core Metrics (hourly aggregation)
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  revenue FLOAT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  
  -- Calculated Metrics
  ctr FLOAT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  cpa FLOAT64 DEFAULT 0,
  roas FLOAT64 DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY TIMESTAMP_TRUNC(timestamp, HOUR)
CLUSTER BY organization_id, canonical_entity_id;

-- =============================================================================
-- DEVICE ENTITY METRICS (device/browser/geo breakdown)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.device_entity_metrics` (
  organization_id STRING NOT NULL,
  date DATE NOT NULL,
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,
  
  -- Dimensions
  device_type STRING,        -- mobile, desktop, tablet
  browser STRING,            -- Chrome, Safari, Firefox, etc.
  country STRING,
  region STRING,
  city STRING,
  
  -- Core Metrics
  sessions INT64 DEFAULT 0,
  users INT64 DEFAULT 0,
  pageviews INT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  revenue FLOAT64 DEFAULT 0,
  
  -- Engagement
  avg_session_duration FLOAT64 DEFAULT 0,
  bounce_rate FLOAT64 DEFAULT 0,
  conversion_rate FLOAT64 DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, canonical_entity_id, device_type, country;

-- =============================================================================
-- CUSTOMER COHORTS (customer-level revenue analysis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.customer_cohorts` (
  organization_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  
  -- Cohort Info
  cohort_month STRING NOT NULL,     -- YYYY-MM of first purchase
  cohort_quarter STRING NOT NULL,   -- YYYY-Q1/Q2/Q3/Q4
  acquisition_channel STRING,       -- How they were acquired
  acquisition_campaign STRING,
  
  -- Customer Metrics
  first_purchase_date DATE,
  last_purchase_date DATE,
  status STRING,                    -- active, churned, at_risk
  
  -- Revenue Metrics
  ltv FLOAT64 DEFAULT 0,
  mrr FLOAT64 DEFAULT 0,
  arr FLOAT64 DEFAULT 0,
  total_revenue FLOAT64 DEFAULT 0,
  total_transactions INT64 DEFAULT 0,
  average_order_value FLOAT64 DEFAULT 0,
  
  -- Engagement
  purchase_frequency FLOAT64 DEFAULT 0,
  days_since_last_purchase INT64,
  churn_risk_score FLOAT64,
  
  -- Upgrades/Downgrades
  upgrade_count INT64 DEFAULT 0,
  downgrade_count INT64 DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY organization_id, cohort_month, status;

-- =============================================================================
-- CONVERSION PATHS (multi-touch attribution)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.conversion_paths` (
  organization_id STRING NOT NULL,
  conversion_id STRING NOT NULL,
  user_id STRING NOT NULL,
  conversion_timestamp TIMESTAMP NOT NULL,
  
  -- Conversion Info
  conversion_value FLOAT64,
  conversion_type STRING,          -- purchase, trial, signup, etc.
  
  -- Attribution
  first_touch_channel STRING,
  first_touch_campaign STRING,
  first_touch_timestamp TIMESTAMP,
  
  last_touch_channel STRING,
  last_touch_campaign STRING,
  last_touch_timestamp TIMESTAMP,
  
  -- Path
  touchpoint_count INT64,
  touchpoint_sequence JSON,        -- Array of touchpoints with timestamps
  days_to_conversion INT64,
  
  -- UTM Parameters
  utm_source STRING,
  utm_medium STRING,
  utm_campaign STRING,
  utm_term STRING,
  utm_content STRING,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(conversion_timestamp)
CLUSTER BY organization_id, user_id;

-- =============================================================================
-- SEARCH TERMS DAILY (query-level paid search analysis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.search_terms_daily` (
  organization_id STRING NOT NULL,
  date DATE NOT NULL,
  campaign_id STRING NOT NULL,
  ad_group_id STRING,
  
  -- Search Term
  search_term STRING NOT NULL,
  match_type STRING,               -- exact, phrase, broad
  
  -- Performance
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  cost FLOAT64 DEFAULT 0,
  conversions INT64 DEFAULT 0,
  revenue FLOAT64 DEFAULT 0,
  
  -- Calculated
  ctr FLOAT64 DEFAULT 0,
  cpc FLOAT64 DEFAULT 0,
  cpa FLOAT64 DEFAULT 0,
  roas FLOAT64 DEFAULT 0,
  
  -- Status
  is_negative_keyword BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, campaign_id, search_term;

-- =============================================================================
-- SERP FEATURES (SERP feature tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.serp_features` (
  organization_id STRING NOT NULL,
  date DATE NOT NULL,
  keyword_id STRING NOT NULL,
  keyword STRING NOT NULL,
  
  -- Feature Detection
  has_featured_snippet BOOLEAN DEFAULT FALSE,
  featured_snippet_owned_by_us BOOLEAN DEFAULT FALSE,
  has_ai_overview BOOLEAN DEFAULT FALSE,
  has_people_also_ask BOOLEAN DEFAULT FALSE,
  has_local_pack BOOLEAN DEFAULT FALSE,
  has_knowledge_panel BOOLEAN DEFAULT FALSE,
  has_video_results BOOLEAN DEFAULT FALSE,
  has_image_pack BOOLEAN DEFAULT FALSE,
  
  -- Competitor Analysis
  competitors_in_features JSON,
  
  -- Our Performance
  our_position INT64,
  our_url STRING,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, keyword_id;

-- =============================================================================
-- BACKLINKS DAILY (backlink monitoring)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.backlinks_daily` (
  organization_id STRING NOT NULL,
  date DATE NOT NULL,
  target_url STRING NOT NULL,
  
  -- Backlink Details
  referring_domain STRING NOT NULL,
  referring_url STRING,
  domain_rating FLOAT64,
  domain_authority FLOAT64,
  
  -- Link Details
  anchor_text STRING,
  link_type STRING,                -- dofollow, nofollow
  is_active BOOLEAN DEFAULT TRUE,
  first_seen_date DATE,
  last_seen_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY organization_id, target_url, referring_domain;

-- =============================================================================
-- DATA QUALITY LOGS (system health monitoring)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.data_quality_logs` (
  organization_id STRING NOT NULL,
  check_timestamp TIMESTAMP NOT NULL,
  
  -- Source Info
  source_system STRING NOT NULL,   -- ga4, google_ads, stripe, etc.
  table_name STRING NOT NULL,
  
  -- Sync Status
  sync_status STRING,              -- success, failed, partial
  sync_duration_seconds FLOAT64,
  last_successful_sync TIMESTAMP,
  
  -- Data Quality Metrics
  record_count INT64,
  expected_record_count INT64,
  record_count_variance_pct FLOAT64,
  
  null_rates JSON,                 -- Field-level null percentages
  
  -- Data Freshness
  latest_data_timestamp TIMESTAMP,
  data_lag_hours FLOAT64,
  
  -- Mapping Quality
  mapped_records INT64,
  unmapped_records INT64,
  mapping_success_rate FLOAT64,
  
  -- Error Details
  error_message STRING,
  error_count INT64,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(check_timestamp)
CLUSTER BY organization_id, source_system;

-- =============================================================================
-- VIEWS & INDEXES
-- =============================================================================

-- Real-time opportunity view (last hour)
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.realtime_metrics` AS
SELECT 
  organization_id,
  timestamp,
  canonical_entity_id,
  entity_type,
  SUM(cost) as hourly_cost,
  SUM(conversions) as hourly_conversions,
  SAFE_DIVIDE(SUM(cost), SUM(conversions)) as hourly_cpa,
  SAFE_DIVIDE(SUM(revenue), SUM(cost)) as hourly_roas
FROM `opsos-864a1.marketing_ai.hourly_entity_metrics`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
GROUP BY organization_id, timestamp, canonical_entity_id, entity_type;

-- Device performance comparison
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.device_performance` AS
SELECT 
  organization_id,
  date,
  canonical_entity_id,
  device_type,
  SUM(sessions) as sessions,
  SUM(conversions) as conversions,
  SAFE_DIVIDE(SUM(conversions), SUM(sessions)) as conversion_rate,
  SUM(revenue) as revenue
FROM `opsos-864a1.marketing_ai.device_entity_metrics`
GROUP BY organization_id, date, canonical_entity_id, device_type;

-- Customer cohort summary
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.cohort_summary` AS
SELECT 
  organization_id,
  cohort_month,
  COUNT(DISTINCT customer_id) as customer_count,
  SUM(total_revenue) as cohort_revenue,
  AVG(ltv) as avg_ltv,
  AVG(mrr) as avg_mrr,
  SUM(CASE WHEN status = 'churned' THEN 1 ELSE 0 END) as churned_count,
  SAFE_DIVIDE(
    SUM(CASE WHEN status = 'churned' THEN 1 ELSE 0 END),
    COUNT(DISTINCT customer_id)
  ) as churn_rate
FROM `opsos-864a1.marketing_ai.customer_cohorts`
GROUP BY organization_id, cohort_month;

-- Data quality summary
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.data_quality_summary` AS
SELECT 
  organization_id,
  source_system,
  MAX(check_timestamp) as last_check,
  MAX(last_successful_sync) as last_successful_sync,
  AVG(mapping_success_rate) as avg_mapping_rate,
  AVG(data_lag_hours) as avg_data_lag,
  SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END) as failed_syncs_last_24h
FROM `opsos-864a1.marketing_ai.data_quality_logs`
WHERE check_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY organization_id, source_system;

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
