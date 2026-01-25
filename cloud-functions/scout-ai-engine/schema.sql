-- BigQuery Schema for Scout AI Core Tables
-- Opportunities and Metric Registry

-- Opportunities Table - Stores detected opportunities from Scout AI
CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.opportunities` (
  id STRING NOT NULL,
  organization_id STRING NOT NULL,
  detected_at TIMESTAMP NOT NULL,
  
  -- Opportunity Classification
  category STRING NOT NULL,        -- scale_winner, fix_loser, cross_channel, etc.
  type STRING NOT NULL,            -- Specific type within category
  priority STRING NOT NULL,        -- high, medium, low
  status STRING DEFAULT 'new',     -- new, acknowledged, in_progress, completed, dismissed
  
  -- What was found
  entity_id STRING,                -- Canonical entity ID (if applicable)
  entity_type STRING,              -- page, campaign, keyword, product, email
  title STRING NOT NULL,
  description STRING NOT NULL,
  
  -- Evidence
  evidence JSON NOT NULL,          -- Data points supporting this opportunity
  metrics JSON NOT NULL,           -- Current metrics snapshot
  
  -- Analysis
  hypothesis STRING NOT NULL,      -- Why this is an opportunity
  confidence_score FLOAT64,        -- 0-1, how confident Scout AI is
  potential_impact_score FLOAT64,  -- 0-100, estimated impact
  urgency_score FLOAT64,           -- 0-100, how urgent
  
  -- Recommendations
  recommended_actions ARRAY<STRING>,
  estimated_effort STRING,         -- low, medium, high
  estimated_timeline STRING,       -- < 1 day, 1-3 days, 1-2 weeks, etc.
  
  -- Historical context
  historical_performance JSON,     -- Trend data
  comparison_data JSON,            -- How it compares to similar entities
  
  -- Tracking
  viewed_by ARRAY<STRING>,         -- User IDs who viewed
  dismissed_by STRING,             -- User ID who dismissed
  dismissed_at TIMESTAMP,
  dismissed_reason STRING,
  completed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(detected_at)
CLUSTER BY organization_id, category, priority, status;

-- Metric Registry - Defines all metrics and their formulas
CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.metric_registry` (
  metric_id STRING NOT NULL,
  metric_name STRING NOT NULL,
  metric_category STRING NOT NULL,  -- traffic, engagement, conversion, revenue, seo, email
  
  -- Definition
  description STRING,
  formula STRING,                   -- SQL-like formula
  unit STRING,                      -- count, currency, percentage, seconds, etc.
  
  -- Metadata
  applicable_entity_types ARRAY<STRING>,  -- Which entity types this applies to
  data_sources ARRAY<STRING>,            -- Which sources provide this data
  
  -- Thresholds for opportunity detection
  good_threshold FLOAT64,          -- Above this = good
  great_threshold FLOAT64,         -- Above this = great
  poor_threshold FLOAT64,          -- Below this = poor
  critical_threshold FLOAT64,      -- Below this = critical
  
  -- Display
  display_format STRING,           -- How to format for UI (e.g., "$%.2f", "%.1f%%")
  is_higher_better BOOLEAN,        -- true = higher is better, false = lower is better
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY metric_category;

-- Seed some initial metrics
INSERT INTO `opsos-864a1.marketing_ai.metric_registry` 
(metric_id, metric_name, metric_category, description, formula, unit, applicable_entity_types, data_sources, good_threshold, great_threshold, poor_threshold, critical_threshold, display_format, is_higher_better)
VALUES
  ('roas', 'Return on Ad Spend', 'revenue', 'Revenue generated per dollar spent', 'revenue / cost', 'ratio', ['campaign', 'keyword', 'page'], ['ga4', 'google_ads'], 2.0, 4.0, 1.0, 0.5, '%.2fx', true),
  ('conversion_rate', 'Conversion Rate', 'conversion', 'Percentage of sessions that convert', '(conversions / sessions) * 100', 'percentage', ['page', 'campaign', 'keyword'], ['ga4'], 2.0, 5.0, 0.5, 0.2, '%.1f%%', true),
  ('ctr', 'Click-Through Rate', 'engagement', 'Percentage of impressions that get clicked', '(clicks / impressions) * 100', 'percentage', ['campaign', 'keyword', 'email'], ['ga4', 'google_ads', 'activecampaign'], 2.0, 5.0, 0.5, 0.2, '%.1f%%', true),
  ('bounce_rate', 'Bounce Rate', 'engagement', 'Percentage of single-page sessions', 'bounces / sessions * 100', 'percentage', ['page'], ['ga4'], 60.0, 40.0, 80.0, 90.0, '%.1f%%', false),
  ('avg_session_duration', 'Avg Session Duration', 'engagement', 'Average time users spend in a session', 'total_duration / sessions', 'seconds', ['page', 'campaign'], ['ga4'], 60.0, 120.0, 30.0, 10.0, '%.0fs', true),
  ('position', 'Average Position', 'seo', 'Average ranking position in search results', 'AVG(position)', 'rank', ['keyword'], ['dataforseo'], 10.0, 3.0, 30.0, 50.0, '%.1f', false),
  ('open_rate', 'Email Open Rate', 'email', 'Percentage of emails opened', '(opens / sends) * 100', 'percentage', ['email'], ['activecampaign'], 20.0, 35.0, 10.0, 5.0, '%.1f%%', true),
  ('revenue_per_session', 'Revenue per Session', 'revenue', 'Average revenue generated per session', 'revenue / sessions', 'currency', ['page', 'campaign'], ['ga4', 'stripe'], 5.0, 15.0, 1.0, 0.5, '$%.2f', true);

-- Create view for active opportunities
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.active_opportunities` AS
SELECT 
  id,
  organization_id,
  detected_at,
  category,
  type,
  priority,
  status,
  entity_id,
  entity_type,
  title,
  description,
  confidence_score,
  potential_impact_score,
  urgency_score,
  recommended_actions,
  estimated_effort,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), detected_at, DAY) as days_since_detected
FROM `opsos-864a1.marketing_ai.opportunities`
WHERE status NOT IN ('completed', 'dismissed')
ORDER BY 
  CASE priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  potential_impact_score DESC,
  detected_at DESC;

-- Create view for opportunity summary by category
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.opportunity_summary` AS
SELECT 
  organization_id,
  category,
  priority,
  COUNT(*) as count,
  AVG(potential_impact_score) as avg_impact,
  AVG(confidence_score) as avg_confidence
FROM `opsos-864a1.marketing_ai.opportunities`
WHERE status NOT IN ('completed', 'dismissed')
GROUP BY organization_id, category, priority;
