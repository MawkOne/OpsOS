import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON 
    ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    : undefined,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    console.log(`📊 Fetching Google Ads metrics from BigQuery for org: ${organizationId}`);

    const tableRef = `${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}`;

    // Query for account-level daily metrics (last 30 days)
    const accountQuery = `
      SELECT 
        SUM(ad_spend) as total_spend,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(conversion_value) as total_conversion_value,
        AVG(ctr) as avg_ctr,
        AVG(cpc) as avg_cpc,
        AVG(cpa) as avg_cpa,
        AVG(roas) as avg_roas
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'google_ads'
        AND entity_type = 'ad_account'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `;

    // Query for campaign breakdown
    const campaignQuery = `
      SELECT 
        canonical_entity_id,
        entity_name,
        ad_spend,
        impressions,
        clicks,
        conversions,
        conversion_value,
        ctr,
        cpc,
        roas,
        source_breakdown,
        date
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'google_ads'
        AND entity_type = 'campaign'
      ORDER BY ad_spend DESC
      LIMIT 20
    `;

    // Query for trends (this week vs last week)
    const trendQuery = `
      WITH weekly AS (
        SELECT 
          CASE 
            WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN 'this_week'
            ELSE 'last_week'
          END as period,
          SUM(ad_spend) as spend,
          SUM(conversions) as conversions
        FROM \`${tableRef}\`
        WHERE organization_id = @organizationId
          AND data_source = 'google_ads'
          AND entity_type = 'ad_account'
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        GROUP BY 1
      )
      SELECT * FROM weekly
    `;

    const options = {
      query: '',
      params: { organizationId },
    };

    // Run queries in parallel
    const [accountResults, campaignResults, trendResults] = await Promise.all([
      bigquery.query({ ...options, query: accountQuery }),
      bigquery.query({ ...options, query: campaignQuery }),
      bigquery.query({ ...options, query: trendQuery }),
    ]);

    const accountData = accountResults[0][0] || {};
    const campaigns = campaignResults[0] || [];
    const trends = trendResults[0] || [];

    // Calculate trends
    const thisWeek = trends.find((t: any) => t.period === 'this_week') || {};
    const lastWeek = trends.find((t: any) => t.period === 'last_week') || {};
    
    const spendTrend = lastWeek.spend > 0 
      ? ((thisWeek.spend - lastWeek.spend) / lastWeek.spend) * 100 
      : 0;
    const conversionsTrend = lastWeek.conversions > 0 
      ? ((thisWeek.conversions - lastWeek.conversions) / lastWeek.conversions) * 100 
      : 0;

    const metrics = {
      hasData: accountData.total_spend > 0 || campaigns.length > 0,
      accountMetrics: {
        totalSpend: accountData.total_spend || 0,
        totalImpressions: accountData.total_impressions || 0,
        totalClicks: accountData.total_clicks || 0,
        totalConversions: accountData.total_conversions || 0,
        totalConversionValue: accountData.total_conversion_value || 0,
        ctr: accountData.avg_ctr || 0,
        cpc: accountData.avg_cpc || 0,
        cpa: accountData.avg_cpa || 0,
        roas: accountData.avg_roas || 0,
        spendTrend,
        conversionsTrend,
      },
      campaigns: campaigns.map((c: any) => ({
        id: c.canonical_entity_id,
        name: c.entity_name || c.canonical_entity_id,
        spend: c.ad_spend || 0,
        impressions: c.impressions || 0,
        clicks: c.clicks || 0,
        conversions: c.conversions || 0,
        conversionValue: c.conversion_value || 0,
        ctr: c.ctr || 0,
        cpc: c.cpc || 0,
        roas: c.roas || 0,
        status: c.source_breakdown ? JSON.parse(c.source_breakdown).status : 'UNKNOWN',
      })),
      source: 'bigquery',
    };

    return NextResponse.json(metrics);

  } catch (error: any) {
    console.error('Error fetching Google Ads metrics:', error);
    
    // Return empty metrics if no data found
    if (error.message?.includes('Not found')) {
      return NextResponse.json({
        hasData: false,
        accountMetrics: {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalConversionValue: 0,
          ctr: 0,
          cpc: 0,
          cpa: 0,
          roas: 0,
        },
        campaigns: [],
        source: 'bigquery',
        message: 'No data synced yet. Click "Sync to BigQuery" to fetch data.',
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
