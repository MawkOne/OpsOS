-- Phase 2: Enhanced Analytics - Add Missing Columns to daily_entity_metrics
-- Run these ALTER TABLE commands in BigQuery console

-- Task 2.1: Add device dimension
ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS device_type STRING OPTIONS(description="Device type: mobile, desktop, tablet");

-- Task 2.2: Add page performance metrics  
ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS page_load_time FLOAT64 OPTIONS(description="Average page load time in seconds");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS dwell_time FLOAT64 OPTIONS(description="Average time spent on page in seconds");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS scroll_depth FLOAT64 OPTIONS(description="Average scroll depth percentage (0-100)");

-- Task 2.3: Add ecommerce funnel events
ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS add_to_cart INTEGER OPTIONS(description="Number of add-to-cart events");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS checkout_started INTEGER OPTIONS(description="Number of checkout initiation events");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS purchase_completed INTEGER OPTIONS(description="Number of completed purchases");

-- Task 2.4: Add CTA and engagement tracking
ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS cta_clicks INTEGER OPTIONS(description="CTA/button click events");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS error_count INTEGER OPTIONS(description="Page error count");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS video_plays INTEGER OPTIONS(description="Video play events");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS video_completion_rate FLOAT64 OPTIONS(description="Average video completion rate (0-1)");

-- Phase 5: Content metadata
ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS content_type STRING OPTIONS(description="Content type: blog, video, infographic, etc");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS publish_date DATE OPTIONS(description="Content publish date");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS last_update_date DATE OPTIONS(description="Content last update date");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS word_count INTEGER OPTIONS(description="Content word count");

-- Phase 6: Traffic quality and attribution
ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS pages_per_session FLOAT64 OPTIONS(description="Average pages viewed per session");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS is_returning_traffic BOOLEAN OPTIONS(description="Whether traffic is from returning users");

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS traffic_quality_score FLOAT64 OPTIONS(description="Calculated traffic quality score 0-100");

-- Verify columns were added
SELECT column_name, data_type, description
FROM `opsos-864a1.marketing_ai.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS`
WHERE table_name = 'daily_entity_metrics'
  AND column_name IN (
    'device_type', 'page_load_time', 'dwell_time', 'scroll_depth',
    'add_to_cart', 'checkout_started', 'purchase_completed',
    'cta_clicks', 'error_count', 'video_plays', 'video_completion_rate',
    'content_type', 'publish_date', 'last_update_date', 'word_count',
    'pages_per_session', 'is_returning_traffic', 'traffic_quality_score'
  )
ORDER BY column_name;
