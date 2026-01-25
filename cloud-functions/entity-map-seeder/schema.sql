-- BigQuery Schema for Marketing AI Entity Mapping
-- This table links entities across different platforms using canonical IDs

-- Entity Map Table
CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.entity_map` (
  canonical_entity_id STRING NOT NULL,
  entity_type STRING NOT NULL,  -- page, campaign, keyword, product, email
  source STRING NOT NULL,        -- ga4, google_ads, dataforseo, stripe, activecampaign
  source_entity_id STRING NOT NULL,
  source_metadata JSON,          -- Original names, IDs, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY canonical_entity_id, entity_type, source;

-- Create a view for easy lookups
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.entity_map_lookup` AS
SELECT 
  canonical_entity_id,
  entity_type,
  ARRAY_AGG(STRUCT(
    source,
    source_entity_id,
    source_metadata
  )) as sources
FROM `opsos-864a1.marketing_ai.entity_map`
GROUP BY canonical_entity_id, entity_type;

-- Example queries:
-- Get all sources for a canonical entity:
-- SELECT * FROM `opsos-864a1.marketing_ai.entity_map_lookup` WHERE canonical_entity_id = 'page_pricing';

-- Get canonical ID from a source:
-- SELECT canonical_entity_id FROM `opsos-864a1.marketing_ai.entity_map` 
-- WHERE source = 'ga4' AND source_entity_id = '/pricing';
