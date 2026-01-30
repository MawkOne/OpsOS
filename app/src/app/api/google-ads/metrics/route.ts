import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

// Return empty metrics with a message
function emptyMetrics(message: string) {
  return {
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
      spendTrend: 0,
      conversionsTrend: 0,
    },
    campaigns: [],
    source: 'bigquery',
    message,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    console.log(`📊 Fetching Google Ads metrics from BigQuery for org: ${organizationId}`);

    // Check if BigQuery credentials are available
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.warn('GOOGLE_APPLICATION_CREDENTIALS_JSON not set, returning empty metrics');
      return NextResponse.json(emptyMetrics('BigQuery not configured. Sync data to populate metrics.'));
    }

    // Lazy import BigQuery
    const { BigQuery } = await import('@google-cloud/bigquery');
    
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } catch (parseError) {
      console.error('Failed to parse BigQuery credentials:', parseError);
      return NextResponse.json(emptyMetrics('BigQuery credentials invalid.'));
    }

    const bigquery = new BigQuery({
      projectId: PROJECT_ID,
      credentials,
    });

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

    const options = {
      query: '',
      params: { organizationId },
    };

    // Run queries in parallel
    const [accountResults, campaignResults] = await Promise.all([
      bigquery.query({ ...options, query: accountQuery }),
      bigquery.query({ ...options, query: campaignQuery }),
    ]);

    const accountData = accountResults[0][0] || {};
    const campaigns = campaignResults[0] || [];

    const metrics = {
      hasData: (accountData.total_spend || 0) > 0 || campaigns.length > 0,
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
        spendTrend: 0,
        conversionsTrend: 0,
      },
      campaigns: campaigns.map((c: any) => {
        let sourceData = {};
        try {
          sourceData = c.source_breakdown ? JSON.parse(c.source_breakdown) : {};
        } catch (e) {
          // Ignore parse errors
        }
        return {
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
          status: (sourceData as any).status || 'UNKNOWN',
        };
      }),
      source: 'bigquery',
    };

    return NextResponse.json(metrics);

  } catch (error: any) {
    console.error('Error fetching Google Ads metrics:', error);
    return NextResponse.json(emptyMetrics('Unable to fetch metrics. Click "Sync to BigQuery" to populate data.'));
  }
}
