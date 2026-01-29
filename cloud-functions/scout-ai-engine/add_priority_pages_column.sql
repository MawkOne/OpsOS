-- Add Priority Pages tracking to daily_entity_metrics
-- This allows detectors to focus analysis on important pages

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS is_priority_page BOOLEAN OPTIONS(description="Whether this page is marked as a priority page for deeper analysis"),
ADD COLUMN IF NOT EXISTS priority_added_at TIMESTAMP OPTIONS(description="When this page was added to priority list");

-- Create index to speed up queries filtering by priority pages
-- Note: BigQuery doesn't use traditional indexes, but clustering helps
-- We'll update the table clustering in a separate command if needed

-- Add a view for easy querying of priority pages only
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.priority_pages_metrics` AS
SELECT 
  *
FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
WHERE is_priority_page = TRUE
  AND entity_type = 'page';

-- Example query to see priority pages with their latest metrics
CREATE OR REPLACE VIEW `opsos-864a1.marketing_ai.priority_pages_latest` AS
WITH latest_metrics AS (
  SELECT 
    organization_id,
    canonical_entity_id,
    MAX(date) as latest_date
  FROM `opsos-864a1.marketing_ai.daily_entity_metrics`
  WHERE is_priority_page = TRUE
    AND entity_type = 'page'
  GROUP BY organization_id, canonical_entity_id
)
SELECT 
  m.*
FROM `opsos-864a1.marketing_ai.daily_entity_metrics` m
INNER JOIN latest_metrics l
  ON m.organization_id = l.organization_id
  AND m.canonical_entity_id = l.canonical_entity_id
  AND m.date = l.latest_date
WHERE m.is_priority_page = TRUE
  AND m.entity_type = 'page';
