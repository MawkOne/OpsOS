-- Opportunities Table Schema
-- This table stores all opportunities detected by Scout AI
-- JSON fields are stored as STRING type to handle variable structures
--
-- To recreate the table, run:
-- bq rm -f opsos-864a1:marketing_ai.opportunities
-- bq mk --table opsos-864a1:marketing_ai.opportunities /path/to/this/schema.json
--
-- Or use this DDL directly in BigQuery console:

CREATE OR REPLACE TABLE `opsos-864a1.marketing_ai.opportunities` (
  -- Primary identifiers
  id STRING NOT NULL,
  organization_id STRING NOT NULL,
  
  -- Detection metadata
  detected_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  -- Categorization
  category STRING NOT NULL,  -- e.g., 'seo_issue', 'revenue_opportunity', 'traffic_anomaly'
  type STRING NOT NULL,      -- e.g., 'rank_drop', 'high_bounce_rate', 'revenue_decline'
  priority STRING NOT NULL,  -- 'high', 'medium', 'low'
  status STRING DEFAULT 'new',  -- 'new', 'in_progress', 'completed', 'dismissed'
  
  -- Entity reference
  entity_id STRING,          -- URL, keyword, campaign ID, etc.
  entity_type STRING,        -- 'page', 'keyword', 'campaign', 'email', etc.
  
  -- Human-readable content
  title STRING NOT NULL,
  description STRING,
  hypothesis STRING,
  
  -- Scores (0-100)
  confidence_score FLOAT64 DEFAULT 0,
  potential_impact_score FLOAT64 DEFAULT 0,
  urgency_score FLOAT64 DEFAULT 0,
  
  -- Effort estimation
  estimated_effort STRING,    -- 'low', 'medium', 'high'
  estimated_timeline STRING,  -- '1-2 days', '1 week', etc.
  
  -- JSON fields stored as strings (variable structure)
  evidence STRING,            -- JSON: supporting data for the detection
  metrics STRING,             -- JSON: relevant metrics
  historical_performance STRING,  -- JSON: historical comparison data
  comparison_data STRING,     -- JSON: benchmarks or comparisons
  recommended_actions STRING, -- JSON array: suggested actions
  
  -- Dismissal tracking
  dismissed_at TIMESTAMP,
  dismissed_by STRING,
  dismissed_reason STRING,
  
  -- Completion tracking
  completed_at TIMESTAMP,
  completed_by STRING
)
PARTITION BY DATE(detected_at)
CLUSTER BY organization_id, category, priority
OPTIONS(
  description = 'Opportunities detected by Scout AI Engine',
  labels = [('team', 'data'), ('app', 'opsos')]
);

-- Index for common queries
-- Note: BigQuery doesn't support traditional indexes, but clustering helps

-- Example queries:
-- 
-- Get new high-priority opportunities:
-- SELECT * FROM `opsos-864a1.marketing_ai.opportunities`
-- WHERE organization_id = 'xxx'
--   AND status = 'new'
--   AND priority = 'high'
--   AND detected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
-- ORDER BY urgency_score DESC
--
-- Parse JSON evidence field:
-- SELECT 
--   id,
--   title,
--   JSON_VALUE(evidence, '$.current_position') as current_position,
--   JSON_VALUE(evidence, '$.historical_position') as historical_position
-- FROM `opsos-864a1.marketing_ai.opportunities`
-- WHERE category = 'seo_issue'
