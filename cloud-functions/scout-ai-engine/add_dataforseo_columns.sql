-- Add DataForSEO SEO Metrics to daily_entity_metrics
-- This unlocks 7-8 SEO detectors immediately!

ALTER TABLE `opsos-864a1.marketing_ai.daily_entity_metrics`
ADD COLUMN IF NOT EXISTS seo_position FLOAT64 OPTIONS(description="Current keyword ranking position"),
ADD COLUMN IF NOT EXISTS seo_position_change FLOAT64 OPTIONS(description="Change in position from previous period"),
ADD COLUMN IF NOT EXISTS seo_search_volume INTEGER OPTIONS(description="Keyword search volume"),
ADD COLUMN IF NOT EXISTS backlinks_total INTEGER OPTIONS(description="Total backlinks to page/domain"),
ADD COLUMN IF NOT EXISTS backlinks_change INTEGER OPTIONS(description="Change in backlinks from previous period"),
ADD COLUMN IF NOT EXISTS referring_domains INTEGER OPTIONS(description="Number of unique referring domains"),
ADD COLUMN IF NOT EXISTS domain_rank FLOAT64 OPTIONS(description="DataForSEO domain rank score"),
ADD COLUMN IF NOT EXISTS onpage_score FLOAT64 OPTIONS(description="DataForSEO on-page SEO score 0-100"),
ADD COLUMN IF NOT EXISTS core_web_vitals_lcp FLOAT64 OPTIONS(description="Largest Contentful Paint in ms"),
ADD COLUMN IF NOT EXISTS core_web_vitals_fid FLOAT64 OPTIONS(description="First Input Delay in ms"),
ADD COLUMN IF NOT EXISTS core_web_vitals_cls FLOAT64 OPTIONS(description="Cumulative Layout Shift score"),
ADD COLUMN IF NOT EXISTS page_size_bytes INTEGER OPTIONS(description="Total page size in bytes"),
ADD COLUMN IF NOT EXISTS has_schema_markup BOOLEAN OPTIONS(description="Whether page has structured data"),
ADD COLUMN IF NOT EXISTS broken_links_count INTEGER OPTIONS(description="Number of broken links on page"),
ADD COLUMN IF NOT EXISTS duplicate_content_detected BOOLEAN OPTIONS(description="Whether duplicate content detected"),
ADD COLUMN IF NOT EXISTS missing_meta_description BOOLEAN OPTIONS(description="Whether meta description is missing"),
ADD COLUMN IF NOT EXISTS missing_h1_tag BOOLEAN OPTIONS(description="Whether H1 tag is missing");
