# BACKEND RULES - READ THIS FIRST

## 🚨 CRITICAL: DO NOT TOUCH THE BACKEND TO FIX THE FRONTEND

### The Golden Rule

**FRONTEND ADAPTS TO BACKEND. NEVER THE OTHER WAY AROUND.**

If a chart doesn't work, you fix the chart. You do NOT touch:
- BigQuery tables
- BigQuery views
- API endpoints
- Cloud Functions
- Data aggregations

### Why This Matters

**What happened:**
1. Frontend chart wasn't displaying weekly/monthly data
2. Agent triggered `reporting-table-refresh` function
3. Function DELETED 365 days of data from all tables
4. Function failed to rebuild (schema mismatch)
5. Agent manually rebuilt tables with incomplete columns
6. Data was lost/corrupted multiple times

**Cost of "helpful" backend fixes:**
- Lost historical data
- Broken downstream systems
- Hours of debugging
- User frustration

### What You CAN Do

✅ **Frontend changes** (ALWAYS ALLOWED):
- Update React components
- Fix TypeScript types
- Adjust chart configurations
- Handle null/missing data gracefully
- Format dates/numbers differently
- Add loading states
- Show error messages

✅ **Read-only backend inspection** (ALLOWED):
- Query BigQuery to understand data structure
- Check API responses
- View table schemas
- Read Cloud Function logs

### What You CANNOT Do

❌ **NEVER touch these without explicit permission:**
- `DELETE FROM` any BigQuery table
- `INSERT INTO` any BigQuery table
- `UPDATE` any BigQuery table
- Modify BigQuery views
- Deploy Cloud Functions
- Trigger data refresh functions
- Modify aggregation logic
- "Fix" data inconsistencies

### When Backend Changes ARE Needed

**You MUST ask first:**

❌ **BAD:**
"I noticed weekly data is missing sessions. Let me rebuild the table..."

✅ **GOOD:**
"The weekly table is missing sessions data. The frontend can display what's available (stripe_revenue) and show '—' for missing fields. Do you want me to:
1. Leave it as-is (frontend handles it)
2. Investigate why sessions are missing
3. Fix the data (requires backend changes)"

### Exception: User Explicitly Requests Backend Fix

**Only proceed with backend changes when user says:**
- "Fix the data"
- "Rebuild the tables"
- "Delete and re-aggregate"
- "Deploy the function"
- "QA all the data and make sure endpoints are returning complete and accurate data"

Even then:
1. Show what you're about to do
2. Check for existing data first
3. Explain the impact
4. Get confirmation if unclear

### Data Change Checklist

Before ANY `DELETE`, `INSERT`, `UPDATE`, or Cloud Function trigger:

- [ ] Did user explicitly request this?
- [ ] Have I checked what data currently exists?
- [ ] Do I understand the downstream impact?
- [ ] Is there a frontend-only solution instead?
- [ ] Have I explained what I'm about to do?

### Red Flags

If you find yourself thinking:
- "Let me just quickly fix this view..."
- "I'll rebuild the table real quick..."
- "Let me trigger a refresh to fix this..."
- "I'll aggregate the data differently..."

**STOP.** That's how data gets lost.

### Remember

Data is permanent. Code is temporary.

If the frontend doesn't work, fix the frontend.

If the data is wrong, ask before touching it.
