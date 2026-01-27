-- Add all Enhanced Analytics columns in ONE statement to avoid rate limits

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS device_type STRING OPTIONS(description="Device type: mobile, desktop, tablet"),
ADD COLUMN IF NOT EXISTS page_load_time FLOAT64 OPTIONS(description="Average page load time in seconds"),
ADD COLUMN IF NOT EXISTS dwell_time FLOAT64 OPTIONS(description="Average time spent on page in seconds"),
ADD COLUMN IF NOT EXISTS scroll_depth FLOAT64 OPTIONS(description="Average scroll depth percentage 0-100"),
ADD COLUMN IF NOT EXISTS add_to_cart INTEGER OPTIONS(description="Number of add-to-cart events"),
ADD COLUMN IF NOT EXISTS checkout_started INTEGER OPTIONS(description="Number of checkout initiation events"),
ADD COLUMN IF NOT EXISTS purchase_completed INTEGER OPTIONS(description="Number of completed purchases"),
ADD COLUMN IF NOT EXISTS cta_clicks INTEGER OPTIONS(description="CTA/button click events"),
ADD COLUMN IF NOT EXISTS error_count INTEGER OPTIONS(description="Page error count"),
ADD COLUMN IF NOT EXISTS video_plays INTEGER OPTIONS(description="Video play events"),
ADD COLUMN IF NOT EXISTS video_completion_rate FLOAT64 OPTIONS(description="Average video completion rate 0-1"),
ADD COLUMN IF NOT EXISTS content_type STRING OPTIONS(description="Content type: blog, video, infographic"),
ADD COLUMN IF NOT EXISTS publish_date DATE OPTIONS(description="Content publish date"),
ADD COLUMN IF NOT EXISTS last_update_date DATE OPTIONS(description="Content last update date"),
ADD COLUMN IF NOT EXISTS word_count INTEGER OPTIONS(description="Content word count"),
ADD COLUMN IF NOT EXISTS pages_per_session FLOAT64 OPTIONS(description="Average pages viewed per session"),
ADD COLUMN IF NOT EXISTS is_returning_traffic BOOLEAN OPTIONS(description="Whether traffic is from returning users"),
ADD COLUMN IF NOT EXISTS traffic_quality_score FLOAT64 OPTIONS(description="Calculated traffic quality score 0-100");
