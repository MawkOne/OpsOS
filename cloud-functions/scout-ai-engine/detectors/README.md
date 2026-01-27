# Detector Structure

## Overview

Detectors are organized into **category folders** with **one file per detector** for maximum modularity and scalability across different product types.

```
detectors/
├── email/
│   ├── __init__.py
│   ├── detect_email_engagement_drop.py
│   ├── detect_email_bounce_rate_spike.py
│   └── ... (8 detectors total)
├── revenue/
│   ├── __init__.py
│   ├── detect_revenue_anomaly.py
│   ├── detect_revenue_aov_decline.py
│   └── ... (8 detectors total)
├── pages/
│   └── ... (10 detectors)
├── traffic/
│   └── ... (7 detectors)
├── seo/
│   └── ... (4 detectors)
├── advertising/
│   └── ... (3 detectors)
├── content/
│   └── ... (2 detectors)
└── system/
    └── (planned)
```

## Benefits

### 🎯 Multi-Product Support
Enable different detector sets for different product types:
- **SaaS:** Email, Revenue, Pages, Traffic, Advertising
- **E-commerce:** Email, Revenue, Pages, Traffic, SEO, Advertising
- **Content Site:** SEO, Content, Pages, Traffic
- **B2B:** Email, Revenue, Pages, Traffic, Advertising

### 📦 Modularity
- One detector = one file
- Easy to find: `detectors/email/detect_email_bounce_rate_spike.py`
- Easy to enable/disable specific detectors
- Clear git history (one detector per commit)

### 📊 Clear Status
- Missing file? → Detector not built yet
- `ls detectors/email/` → See all 8 email detectors
- No confusion about what exists vs what's planned

### 🚀 Scalability
- Add new categories easily (just create new folder)
- Parallel development (less merge conflicts)
- Can build plugin marketplace later

## Configuration

### Product-Level Config
Set detector categories per product type in `detector_config.py`:

```python
PRODUCT_CONFIGS = {
    'saas': ['email', 'revenue', 'pages', 'traffic', 'advertising'],
    'ecommerce': ['email', 'revenue', 'pages', 'traffic', 'seo', 'advertising'],
    # ... more product types
}
```

### Organization-Level Config
Store in Firestore `organizations/{orgId}`:

```json
{
  "enabled_detector_areas": {
    "email": true,
    "revenue": true,
    "pages": false,  // Disabled for this org
    "traffic": true,
    ...
  }
}
```

### Environment Variable Override
```bash
ENABLED_DETECTOR_CATEGORIES="email,revenue,pages"
```

## How It Works

The new `main.py` **dynamically loads** detectors:

```python
# Get enabled categories
enabled = get_enabled_categories(product_type='saas')
# → ['email', 'revenue', 'pages', 'traffic', 'advertising']

# Load and run detectors
for category in enabled:
    detectors = load_detectors_for_category(category)
    for detector in detectors:
        opportunities = detector(organization_id)
```

No hardcoded imports needed! Just drop a new detector file in the right folder.

## Adding a New Detector

1. **Create the file:**
   ```bash
   touch detectors/email/detect_email_subject_line_performance.py
   ```

2. **Write the detector:**
   ```python
   """
   Email Subject Line Performance Detector
   Category: Email
   """
   
   from google.cloud import bigquery
   import logging
   
   logger = logging.getLogger(__name__)
   
   def detect_email_subject_line_performance(organization_id: str) -> list:
       """Detects subject lines with poor open rates"""
       # ... your logic here
       return opportunities
   ```

3. **That's it!** The detector will automatically:
   - Be imported by `detectors/email/__init__.py`
   - Be discovered and run by `main.py`
   - Show up in the category count

## Performance

**Cold Start Impact:** ~1-2 seconds slower (10-15s → 11-17s total)
- Negligible compared to BigQuery client init (~8s)
- Worth it for the modularity benefits

**Runtime (Warm):** No impact
- BigQuery queries are the bottleneck, not imports

## Migration Notes

- Old monolithic files moved to `*_old.py` (backup)
- All 42 detectors successfully split
- `main.py` rewritten to use dynamic loading
- **Zero functionality changes** - just better organized

See `/DETECTOR_ROADMAP.md` for complete detector checklist.
