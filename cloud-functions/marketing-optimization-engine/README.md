# Marketing Optimization Engine - Cloud Function

Automated daily analysis that identifies marketing optimization opportunities and generates actionable recommendations.

## What It Does

1. **Fetches Data** - Pulls last 90 days of marketing data from BigQuery
2. **Analyzes Drivers** - Calculates feature importance to identify what drives signups
3. **Finds Opportunities** - Identifies gaps vs benchmarks (internal best, historical best)
4. **Estimates Impact** - Calculates expected lift for each opportunity
5. **Prioritizes** - Ranks by impact/effort ratio with confidence scores
6. **Delivers Insights** - Stores results in Firestore and can push to Slack

## Architecture

```
main.py                  - Entry point and orchestration
data_fetcher.py          - BigQuery data extraction
driver_analysis.py       - Feature importance calculation
opportunity_finder.py    - Gap analysis and impact estimation
recommendations.py       - Action item generation and formatting
```

## Deployment

### Prerequisites

- GCP Project: `opsos-864a1`
- BigQuery dataset: `firestore_export` with marketing data
- Firestore database for storing results

### Deploy

```bash
cd cloud-functions/marketing-optimization-engine
./deploy.sh
```

This will:
1. Deploy the Cloud Function to `us-central1`
2. Create/update Cloud Scheduler job for daily 6am PT runs
3. Output the function URL for manual testing

### Test Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python main.py

# In another terminal, test the endpoint
curl "http://localhost:8080?organizationId=SBjucW1ztDyFYWBz7ZLE&goalKpi=signups&targetValue=6000"
```

### Test Deployed Function

```bash
# Get function URL
gcloud functions describe marketing-optimization-engine \
  --region=us-central1 \
  --project=opsos-864a1 \
  --gen2 \
  --format="value(serviceConfig.uri)"

# Test it
curl "https://marketing-optimization-engine-xxxxx.run.app?organizationId=SBjucW1ztDyFYWBz7ZLE&goalKpi=signups&targetValue=6000"
```

## API

### Parameters

- `organizationId` (string, required) - Organization ID to analyze
- `goalKpi` (string, default: "signups") - Target metric to optimize
- `targetValue` (number, default: 6000) - Goal value to reach
- `lookbackDays` (number, default: 90) - Days of historical data to analyze

### Response

```json
{
  "status": "success",
  "timestamp": "2026-01-23T06:05:00Z",
  "duration_seconds": 12.5,
  "summary": {
    "goal_kpi": "signups",
    "current": 4200,
    "target": 6000,
    "gap": 1800,
    "gap_pct": 0.3,
    "num_recommendations": 5,
    "total_opportunity": 1740
  },
  "recommendations": [
    {
      "rank": 1,
      "priority": "urgent",
      "title": "Optimize Paywall Frequency",
      "description": "Reduce paywall friction...",
      "expected_lift": 840,
      "effort": "low",
      "confidence": "high",
      "actions": ["Update config...", "Set up A/B test..."]
    }
  ]
}
```

## Data Sources

The function pulls data from these BigQuery tables:

- `ga_events_raw_latest` - 80 Google Analytics events
- `ga_traffic_sources_raw_latest` - 11 traffic sources
- `ga_campaigns_raw_latest` - Campaign performance
- `ga_pages_raw_latest` - Page-level metrics
- `activecampaign_campaigns_raw_latest` - Email campaigns
- `activecampaign_automations_raw_latest` - Email automations

## Algorithm

### Driver Analysis
Uses Random Forest Regressor to calculate feature importance:
- 500 trees, max depth 10
- Trains on last 90 days of monthly data
- Returns R² score and importance for each feature

### Opportunity Identification
For each high-importance driver:
1. Calculate current value (most recent month)
2. Find benchmarks (internal best = 90th percentile, historical best = max)
3. Calculate gap vs best benchmark
4. Estimate lift: `gap% × importance × current_goal_value`
5. Assign confidence based on correlation strength

### Prioritization
Score opportunities by:
```
priority_score = (expected_lift / effort) × confidence_multiplier
```

Where:
- Effort: low=1, medium=3, high=8
- Confidence multipliers: high=1.0, medium=0.7, low=0.4

## Scheduled Execution

Cloud Scheduler runs the function daily at 6:00 AM PT:
- Job name: `marketing-optimization-daily`
- Schedule: `0 6 * * *`
- Timezone: `America/Los_Angeles`

### Manual Trigger

```bash
gcloud scheduler jobs run marketing-optimization-daily \
  --location=us-central1 \
  --project=opsos-864a1
```

## Monitoring

### View Logs

```bash
gcloud functions logs read marketing-optimization-engine \
  --region=us-central1 \
  --project=opsos-864a1 \
  --limit=50
```

### View Scheduler History

```bash
gcloud scheduler jobs describe marketing-optimization-daily \
  --location=us-central1 \
  --project=opsos-864a1
```

## Firestore Storage

Results are stored in the `marketing_insights` collection:

```
marketing_insights/
  {doc_id}/
    organizationId: "SBjucW1ztDyFYWBz7ZLE"
    timestamp: Timestamp
    goalKpi: "signups"
    currentValue: 4200
    targetValue: 6000
    gap: 1800
    gapPct: 0.3
    driverHealth: [...]
    recommendations: [...]
    metadata: {...}
    status: "new"  // new, viewed, actioned, dismissed
```

## Integration with OpsOS

The OpsOS dashboard will:
1. Query `marketing_insights` collection for latest analysis
2. Display goal progress and driver health
3. Show top 3-5 recommendations
4. Allow creating initiatives directly from recommendations
5. Track initiative progress against expected lift

## Future Enhancements

- [ ] Slack notifications when analysis completes
- [ ] Email weekly digest to team
- [ ] Auto-create initiatives in OpsOS
- [ ] A/B test integration and tracking
- [ ] Multi-goal optimization (signups + revenue)
- [ ] Competitive intelligence integration
- [ ] Real-time optimization (hourly analysis)

## Troubleshooting

### "No data found"
- Check that `org_id` exists in BigQuery tables
- Verify date range has data (last 90 days)
- Check BigQuery permissions

### "Model training failed"
- Ensure at least 3 months of data
- Check for data quality issues (all zeros, all NaN)
- Verify goal KPI exists in data

### "Low R² score"
- Normal if R² < 0.5 - indicates high variance or limited data
- Try increasing `lookback_days` for more training data
- Check if goal KPI is stable over time

## Support

For issues or questions:
- See main documentation: `/MARKETING_OPTIMIZATION_ENGINE.md`
- Check logs: `gcloud functions logs read ...`
- Test locally first before deploying changes
