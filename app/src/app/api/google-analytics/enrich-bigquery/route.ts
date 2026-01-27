import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BigQuery } from '@google-cloud/bigquery';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

const bigquery = new BigQuery();

interface GAConnection {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: { toDate: () => Date };
  selectedPropertyId: string;
}

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

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const daysBack = parseInt(searchParams.get('days') || '7');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Get GA connection
    const connectionRef = doc(db, 'ga_connections', organizationId);
    const connectionSnap = await getDoc(connectionRef);

    if (!connectionSnap.exists()) {
      return NextResponse.json({ error: 'Google Analytics not connected' }, { status: 404 });
    }

    const connection = connectionSnap.data() as GAConnection;

    // Get access token
    let accessToken = connection.accessToken;
    const expiresAt = connection.tokenExpiresAt?.toDate?.() || new Date(0);

    if (expiresAt < new Date()) {
      const newToken = await refreshAccessToken(connection.refreshToken);
      if (!newToken) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }
      accessToken = newToken;
    }

    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date();

    console.log(`📊 Enriching BigQuery with device & funnel data for ${organizationId}`);

    // 1. Fetch device metrics from GA4
    const deviceMetrics = await fetchDeviceMetrics(propertyId, accessToken, startDate, endDate);
    console.log(`📱 Fetched device metrics: ${deviceMetrics.length} rows`);

    // 2. Fetch funnel events from GA4
    const funnelMetrics = await fetchFunnelMetrics(propertyId, accessToken, startDate, endDate);
    console.log(`🛒 Fetched funnel metrics: ${funnelMetrics.length} rows`);

    // 3. Write to BigQuery
    await writeDeviceMetricsToBigQuery(organizationId, deviceMetrics);
    await writeFunnelMetricsToBigQuery(organizationId, funnelMetrics);

    return NextResponse.json({
      success: true,
      deviceRows: deviceMetrics.length,
      funnelRows: funnelMetrics.length,
      message: 'BigQuery enriched with device & funnel data'
    });

  } catch (error) {
    console.error('Error enriching BigQuery:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to enrich BigQuery'
    }, { status: 500 });
  }
}

async function fetchDeviceMetrics(propertyId: string, accessToken: string, startDate: Date, endDate: Date) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        dimensions: [
          { name: 'deviceCategory' },
          { name: 'pagePath' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'conversions' },
          { name: 'bounceRate' }
        ],
        limit: 10000
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`GA API error: ${response.status}`);
  }

  const data = await response.json();
  const rows: any[] = [];

  if (data.rows) {
    // Use endDate as the date for all rows (latest data)
    const dateStr = endDate.toISOString().split('T')[0];
    
    for (const row of data.rows) {
      const deviceCategory = row.dimensionValues[0].value.toLowerCase();
      const pagePath = row.dimensionValues[1].value;

      rows.push({
        date: dateStr,
        pagePath,
        device_type: deviceCategory,
        sessions: parseInt(row.metricValues[0].value || '0'),
        pageviews: parseInt(row.metricValues[1].value || '0'),
        conversions: parseInt(row.metricValues[2].value || '0'),
        bounce_rate: parseFloat(row.metricValues[3].value || '0') * 100,
      });
    }
  }

  return rows;
}

async function fetchFunnelMetrics(propertyId: string, accessToken: string, startDate: Date, endDate: Date) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        dimensions: [
          { name: 'pagePath' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' }
        ],
        limit: 10000
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`GA API error: ${response.status}`);
  }

  const data = await response.json();
  const rows: any[] = [];

  if (data.rows) {
    // Use endDate as the date for all rows
    const dateStr = endDate.toISOString().split('T')[0];
    
    for (const row of data.rows) {
      const pagePath = row.dimensionValues[0].value;

      const pageviews = parseInt(row.metricValues[0].value || '0');
      const activeUsers = parseInt(row.metricValues[1].value || '0');
      const avgDuration = parseFloat(row.metricValues[2].value || '0');

      rows.push({
        date: dateStr,
        pagePath,
        pageviews,
        dwell_time: avgDuration,
        engagement_rate: null,  // Skip for now
        add_to_cart: 0,  // Skip ecommerce for now
        checkout_started: 0,
        purchase_completed: 0,
      });
    }
  }

  return rows;
}

async function writeDeviceMetricsToBigQuery(organizationId: string, rows: any[]) {
  if (rows.length === 0) return;

  const dataset = bigquery.dataset('marketing_ai');
  const table = dataset.table('daily_entity_metrics');

  const bqRows = rows.map(row => ({
    organization_id: organizationId,
    canonical_entity_id: row.pagePath,
    entity_type: 'page',
    date: row.date,
    device_type: row.device_type,
    sessions: row.sessions,
    pageviews: row.pageviews,
    conversions: row.conversions,
    bounce_rate: row.bounce_rate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  await table.insert(bqRows);
}

async function writeFunnelMetricsToBigQuery(organizationId: string, rows: any[]) {
  if (rows.length === 0) return;

  const dataset = bigquery.dataset('marketing_ai');
  const table = dataset.table('daily_entity_metrics');

  const bqRows = rows.map(row => ({
    organization_id: organizationId,
    canonical_entity_id: row.pagePath,
    entity_type: 'page',
    date: row.date,
    pageviews: row.pageviews,
    dwell_time: row.dwell_time,
    engagement_rate: row.engagement_rate,
    add_to_cart: row.add_to_cart,
    checkout_started: row.checkout_started,
    purchase_completed: row.purchase_completed,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  await table.insert(bqRows);
}
