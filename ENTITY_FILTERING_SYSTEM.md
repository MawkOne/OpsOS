# Entity Filtering System

**Purpose:** Control which pages/entities Scout AI analyzes  
**Use Case:** Filter out `/job/*` and `/talent/*` pages (or any pattern)

---

## 🎯 **OPTION 1: Simple + Flexible (RECOMMENDED)**

### **What It Does:**
- Adds `is_active` boolean to `entity_map`
- Creates `entity_filter_rules` table for pattern matching
- All detectors automatically respect filters
- Easy to manage via UI or SQL

### **Step 1: Add `is_active` to entity_map**

```sql
-- Add column to existing table
ALTER TABLE `opsos-864a1.marketing_ai.entity_map`
ADD COLUMN IF NOT EXISTS is_active BOOL DEFAULT TRUE;

-- Set all existing entities to active
UPDATE `opsos-864a1.marketing_ai.entity_map`
SET is_active = TRUE
WHERE is_active IS NULL;
```

### **Step 2: Create filter rules table**

```sql
CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.entity_filter_rules` (
  rule_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  entity_type STRING NOT NULL,  -- 'page', 'campaign', 'all'
  filter_type STRING NOT NULL,  -- 'exclude' or 'include'
  pattern_type STRING NOT NULL, -- 'exact', 'prefix', 'contains', 'regex'
  pattern STRING NOT NULL,       -- '/job', '/talent', etc.
  reason STRING,                 -- 'temporary page', 'test page', etc.
  created_by STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Insert your rules
INSERT INTO `opsos-864a1.marketing_ai.entity_filter_rules` VALUES
  (GENERATE_UUID(), 'YOUR_ORG_ID', 'page', 'exclude', 'prefix', '/job', 'Job posting pages - temporary', 'admin', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
  (GENERATE_UUID(), 'YOUR_ORG_ID', 'page', 'exclude', 'prefix', '/talent', 'Talent pages - temporary', 'admin', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
```

### **Step 3: Apply filters to entity_map**

```sql
-- Mark entities as inactive based on rules
UPDATE `opsos-864a1.marketing_ai.entity_map` e
SET is_active = FALSE
WHERE EXISTS (
  SELECT 1
  FROM `opsos-864a1.marketing_ai.entity_filter_rules` r
  WHERE r.organization_id = e.organization_id
    AND r.filter_type = 'exclude'
    AND (
      -- Exact match
      (r.pattern_type = 'exact' AND e.source_entity_id = r.pattern)
      OR
      -- Prefix match (starts with)
      (r.pattern_type = 'prefix' AND STARTS_WITH(e.source_entity_id, r.pattern))
      OR
      -- Contains
      (r.pattern_type = 'contains' AND CONTAINS_SUBSTR(e.source_entity_id, r.pattern))
      OR
      -- Regex
      (r.pattern_type = 'regex' AND REGEXP_CONTAINS(e.source_entity_id, r.pattern))
    )
);
```

### **Step 4: Update all detectors**

Add to every detector query:

```sql
-- BEFORE:
SELECT * FROM `opsos-864a1.marketing_ai.daily_entity_metrics` m
JOIN `opsos-864a1.marketing_ai.entity_map` e
  ON m.canonical_entity_id = e.canonical_entity_id
WHERE m.organization_id = @organization_id

-- AFTER:
SELECT * FROM `opsos-864a1.marketing_ai.daily_entity_metrics` m
JOIN `opsos-864a1.marketing_ai.entity_map` e
  ON m.canonical_entity_id = e.canonical_entity_id
WHERE m.organization_id = @organization_id
  AND e.is_active = TRUE  -- ✅ Filter out inactive entities
```

---

## 🎯 **OPTION 2: Firestore Configuration (Fastest to Implement)**

### **What It Does:**
- Store filter rules in Firestore
- Check filters in Cloud Function before running detectors
- No BigQuery schema changes needed

### **Firestore Structure:**

```
organizations/{orgId}/settings/entity_filters
{
  "page_filters": {
    "exclude_prefixes": ["/job", "/talent", "/test"],
    "exclude_exact": ["/temp", "/draft"],
    "exclude_patterns": [".*-draft$", ".*-test$"]
  },
  "campaign_filters": {
    "exclude_patterns": ["test-.*", "draft-.*"]
  },
  "global": {
    "exclude_temporary": true,
    "exclude_test": true
  }
}
```

### **Cloud Function Logic:**

```python
def should_analyze_entity(entity_id: str, entity_type: str, org_id: str) -> bool:
    """Check if entity should be analyzed"""
    
    # Get filters from Firestore
    filters_ref = db.collection('organizations').document(org_id)\
                    .collection('settings').document('entity_filters')
    filters = filters_ref.get().to_dict() or {}
    
    type_filters = filters.get(f'{entity_type}_filters', {})
    
    # Check exclude prefixes
    for prefix in type_filters.get('exclude_prefixes', []):
        if entity_id.startswith(prefix):
            return False
    
    # Check exact matches
    if entity_id in type_filters.get('exclude_exact', []):
        return False
    
    # Check regex patterns
    for pattern in type_filters.get('exclude_patterns', []):
        if re.match(pattern, entity_id):
            return False
    
    return True
```

---

## 🎯 **OPTION 3: Metadata Tags (Most Flexible)**

### **What It Does:**
- Add tags to entities (`temporary`, `test`, `exclude_from_ai`)
- Filter based on tags
- Most flexible but requires more setup

### **Schema:**

```sql
-- Add tags column
ALTER TABLE `opsos-864a1.marketing_ai.entity_map`
ADD COLUMN IF NOT EXISTS tags ARRAY<STRING>;

-- Tag entities
UPDATE `opsos-864a1.marketing_ai.entity_map`
SET tags = ['temporary', 'job_posting']
WHERE source_entity_id LIKE '/job%';

UPDATE `opsos-864a1.marketing_ai.entity_map`
SET tags = ['temporary', 'talent']
WHERE source_entity_id LIKE '/talent%';
```

### **Query with tags:**

```sql
WHERE 'exclude_from_ai' NOT IN UNNEST(IFNULL(e.tags, []))
  AND 'temporary' NOT IN UNNEST(IFNULL(e.tags, []))
```

---

## 📊 **COMPARISON**

| Feature | Option 1 (BigQuery Rules) | Option 2 (Firestore Config) | Option 3 (Tags) |
|---------|---------------------------|------------------------------|-----------------|
| **Setup Time** | 30 min | 15 min | 45 min |
| **Flexibility** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **UI-Friendly** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Pattern Matching** | ✅ All types | ✅ All types | ❌ Limited |
| **Audit Trail** | ✅ Built-in | ❌ Manual | ❌ Manual |
| **Bulk Updates** | ✅ Easy | ❌ Harder | ⭐⭐⭐ |

---

## ✅ **MY RECOMMENDATION: Option 1**

**Why?**
- ✅ Most powerful (prefix, contains, regex)
- ✅ Easy to audit (who excluded what, when)
- ✅ Scales well (BigQuery handles it)
- ✅ One-time setup in detectors
- ✅ Can build UI on top later

**Quick Start:**
```bash
# 1. Run the SQL to add is_active column
# 2. Create filter rules table
# 3. Insert your rules for /job and /talent
# 4. Run update query to mark entities inactive
# 5. Add `AND e.is_active = TRUE` to detector queries
```

---

## 🚀 **QUICK IMPLEMENTATION (Option 1)**

### **For YOUR specific use case** (`/job` and `/talent`):

**Step 1: Run this SQL**
```sql
-- Add column
ALTER TABLE `opsos-864a1.marketing_ai.entity_map`
ADD COLUMN IF NOT EXISTS is_active BOOL DEFAULT TRUE;

-- Create rules table
CREATE TABLE IF NOT EXISTS `opsos-864a1.marketing_ai.entity_filter_rules` (
  rule_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  entity_type STRING NOT NULL,
  filter_type STRING NOT NULL,
  pattern_type STRING NOT NULL,
  pattern STRING NOT NULL,
  reason STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Add your exclusion rules
INSERT INTO `opsos-864a1.marketing_ai.entity_filter_rules` VALUES
  (GENERATE_UUID(), 'YOUR_ORG_ID', 'page', 'exclude', 'prefix', '/job', 'Temporary job pages', CURRENT_TIMESTAMP()),
  (GENERATE_UUID(), 'YOUR_ORG_ID', 'page', 'exclude', 'prefix', '/talent', 'Temporary talent pages', CURRENT_TIMESTAMP());

-- Apply filters
UPDATE `opsos-864a1.marketing_ai.entity_map` e
SET is_active = FALSE
WHERE EXISTS (
  SELECT 1
  FROM `opsos-864a1.marketing_ai.entity_filter_rules` r
  WHERE r.filter_type = 'exclude'
    AND r.pattern_type = 'prefix'
    AND STARTS_WITH(e.source_entity_id, r.pattern)
);
```

**Step 2: Update detectors (I can do this for you)**

---

## ❓ **WHAT WOULD YOU LIKE TO DO?**

1. **Option 1 (Recommended):** I'll implement the BigQuery filtering system
2. **Option 2 (Faster):** I'll add Firestore configuration
3. **Option 3 (Flexible):** I'll add tagging system
4. **Custom:** Tell me your specific needs

**For now, to quickly exclude `/job` and `/talent`, I recommend Option 1.**

Should I implement it?
