import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Execute Google Ads Query
async function executeGoogleAdsQuery(
  accessToken: string,
  developerToken: string,
  customerId: string,
  query: string
): Promise<any[]> {
  const response = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Ads query error:', errorText);
    throw new Error(`Google Ads API error: ${response.status}`);
  }

  const data = await response.json();
  
  // searchStream returns an array of result batches
  const results: any[] = [];
  if (Array.isArray(data)) {
    for (const batch of data) {
      if (batch.results) {
        results.push(...batch.results);
      }
    }
  }
  
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, dateRange = 'LAST_30_DAYS' } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // Get connection details
    const connectionRef = doc(db, 'google_ads_connections', organizationId);
    const connectionDoc = await getDoc(connectionRef);

    if (!connectionDoc.exists()) {
      return NextResponse.json(
        { error: 'Google Ads not connected. Please connect first.' },
        { status: 400 }
      );
    }

    const connection = connectionDoc.data();
    let accessToken = connection.accessToken;
    const { refreshToken, developerToken, customerId } = connection;

    // Check if token needs refresh
    const tokenExpiry = connection.tokenExpiresAt?.toDate?.() || new Date(connection.tokenExpiresAt);
    if (tokenExpiry < new Date()) {
      console.log('Access token expired, refreshing...');
      const newToken = await refreshAccessToken(refreshToken);
      if (!newToken) {
        return NextResponse.json(
          { error: 'Failed to refresh access token. Please reconnect.' },
          { status: 401 }
        );
      }
      accessToken = newToken;
      
      // Update stored token
      await updateDoc(connectionRef, {
        accessToken: newToken,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      });
    }

    console.log(`Syncing Google Ads data for customer ${customerId}...`);

    // Query 1: Account-level metrics (last 30 days)
    const accountQuery = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM customer
      WHERE segments.date DURING ${dateRange}
    `;

    // Query 2: Campaign performance
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.interaction_rate
      FROM campaign
      WHERE segments.date DURING ${dateRange}
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    // Query 3: Daily metrics for trends (last 90 days for historical)
    const dailyQuery = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date DURING LAST_90_DAYS
      ORDER BY segments.date DESC
    `;

    // Query 4: Ad group performance
    const adGroupQuery = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.id,
        campaign.name,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM ad_group
      WHERE segments.date DURING ${dateRange}
        AND ad_group.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `;

    // Execute queries
    const [accountData, campaignData, dailyData, adGroupData] = await Promise.all([
      executeGoogleAdsQuery(accessToken, developerToken, customerId, accountQuery),
      executeGoogleAdsQuery(accessToken, developerToken, customerId, campaignQuery),
      executeGoogleAdsQuery(accessToken, developerToken, customerId, dailyQuery),
      executeGoogleAdsQuery(accessToken, developerToken, customerId, adGroupQuery),
    ]);

    // Process account metrics
    let accountMetrics: {
      customerId: string;
      customerName: string;
      currency: string;
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
      totalConversionValue: number;
      ctr: number;
      cpc: number;
      cpa: number;
      roas: number;
      conversionRate: number;
    } | null = null;
    
    if (accountData.length > 0) {
      const totalSpend = accountData.reduce((sum, r) => sum + (parseInt(r.metrics?.costMicros || '0') / 1000000), 0);
      const totalImpressions = accountData.reduce((sum, r) => sum + parseInt(r.metrics?.impressions || '0'), 0);
      const totalClicks = accountData.reduce((sum, r) => sum + parseInt(r.metrics?.clicks || '0'), 0);
      const totalConversions = accountData.reduce((sum, r) => sum + parseFloat(r.metrics?.conversions || '0'), 0);
      const totalConversionValue = accountData.reduce((sum, r) => sum + parseFloat(r.metrics?.conversionsValue || '0'), 0);
      
      accountMetrics = {
        customerId: accountData[0].customer?.id,
        customerName: accountData[0].customer?.descriptiveName,
        currency: accountData[0].customer?.currencyCode,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalConversionValue,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
        conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      };
    }

    // Process campaign data
    const campaigns = campaignData.map(row => ({
      id: row.campaign?.id,
      name: row.campaign?.name,
      status: row.campaign?.status,
      channelType: row.campaign?.advertisingChannelType,
      biddingStrategy: row.campaign?.biddingStrategyType,
      spend: parseInt(row.metrics?.costMicros || '0') / 1000000,
      impressions: parseInt(row.metrics?.impressions || '0'),
      clicks: parseInt(row.metrics?.clicks || '0'),
      conversions: parseFloat(row.metrics?.conversions || '0'),
      conversionValue: parseFloat(row.metrics?.conversionsValue || '0'),
      ctr: parseFloat(row.metrics?.ctr || '0') * 100,
      cpc: parseInt(row.metrics?.averageCpc || '0') / 1000000,
      cpa: parseInt(row.metrics?.costPerConversion || '0') / 1000000,
    }));

    // Process daily data for trends
    const dailyMetrics = dailyData.map(row => ({
      date: row.segments?.date,
      spend: parseInt(row.metrics?.costMicros || '0') / 1000000,
      impressions: parseInt(row.metrics?.impressions || '0'),
      clicks: parseInt(row.metrics?.clicks || '0'),
      conversions: parseFloat(row.metrics?.conversions || '0'),
      conversionValue: parseFloat(row.metrics?.conversionsValue || '0'),
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Process ad groups
    const adGroups = adGroupData.map(row => ({
      id: row.adGroup?.id,
      name: row.adGroup?.name,
      status: row.adGroup?.status,
      campaignId: row.campaign?.id,
      campaignName: row.campaign?.name,
      spend: parseInt(row.metrics?.costMicros || '0') / 1000000,
      impressions: parseInt(row.metrics?.impressions || '0'),
      clicks: parseInt(row.metrics?.clicks || '0'),
      conversions: parseFloat(row.metrics?.conversions || '0'),
      ctr: parseFloat(row.metrics?.ctr || '0') * 100,
      cpc: parseInt(row.metrics?.averageCpc || '0') / 1000000,
    }));

    // Calculate trends
    const last30Days = dailyMetrics.slice(-30);
    const previous30Days = dailyMetrics.slice(-60, -30);
    
    const currentSpend = last30Days.reduce((sum, d) => sum + d.spend, 0);
    const previousSpend = previous30Days.reduce((sum, d) => sum + d.spend, 0);
    const currentConversions = last30Days.reduce((sum, d) => sum + d.conversions, 0);
    const previousConversions = previous30Days.reduce((sum, d) => sum + d.conversions, 0);

    const trends = {
      spendChange: previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0,
      conversionsChange: previousConversions > 0 ? ((currentConversions - previousConversions) / previousConversions) * 100 : 0,
    };

    // Store the synced data
    const syncDataRef = doc(db, 'google_ads_data', organizationId);
    await setDoc(syncDataRef, {
      organizationId,
      customerId,
      accountMetrics,
      campaigns,
      adGroups,
      dailyMetrics,
      trends,
      dateRange,
      syncedAt: serverTimestamp(),
    });

    // Store historical snapshot for time-series analysis
    const historyRef = doc(collection(db, 'google_ads_history'), `${organizationId}_${new Date().toISOString().split('T')[0]}`);
    await setDoc(historyRef, {
      organizationId,
      date: new Date().toISOString().split('T')[0],
      accountMetrics,
      trends,
      syncedAt: serverTimestamp(),
    });

    // Update connection last sync time
    await updateDoc(connectionRef, {
      lastSyncAt: serverTimestamp(),
    });

    console.log(`Google Ads sync complete. ${campaigns.length} campaigns, ${dailyMetrics.length} daily records.`);

    return NextResponse.json({
      success: true,
      data: {
        accountMetrics,
        campaignCount: campaigns.length,
        adGroupCount: adGroups.length,
        dailyRecords: dailyMetrics.length,
        trends,
        dateRange,
      },
    });

  } catch (error) {
    console.error('Error syncing Google Ads:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET - Retrieve synced data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    const dataRef = doc(db, 'google_ads_data', organizationId);
    const dataDoc = await getDoc(dataRef);

    if (!dataDoc.exists()) {
      return NextResponse.json({ hasData: false });
    }

    const data = dataDoc.data();
    return NextResponse.json({
      hasData: true,
      ...data,
      syncedAt: data.syncedAt?.toDate?.() || null,
    });

  } catch (error) {
    console.error('Error fetching Google Ads data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
