import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, writeBatch } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

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
  const monthsToSync = parseInt(searchParams.get('months') || '12'); // Default: sync last 12 months

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Get connection from Firestore
    const connectionRef = doc(db, 'ga_connections', organizationId);
    const connectionSnap = await getDoc(connectionRef);

    if (!connectionSnap.exists()) {
      return NextResponse.json({ error: 'Google Analytics not connected' }, { status: 404 });
    }

    const connection = connectionSnap.data() as GAConnection;

    if (!connection.selectedPropertyId) {
      return NextResponse.json({ error: 'No property selected' }, { status: 400 });
    }

    // Check if token is expired and refresh if needed
    let accessToken = connection.accessToken;
    const expiresAt = connection.tokenExpiresAt?.toDate?.() || new Date(0);

    if (expiresAt < new Date()) {
      if (!connection.refreshToken) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }

      const newToken = await refreshAccessToken(connection.refreshToken);
      if (!newToken) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }

      accessToken = newToken;
      await setDoc(connectionRef, {
        accessToken: newToken,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    // Calculate months to sync
    const now = new Date();
    const months: { key: string; startDate: string; endDate: string }[] = [];

    for (let i = monthsToSync - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const startDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
      
      let endDate: string;
      if (i === 0) {
        // Current month - use today
        endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      } else {
        // Past month - use last day of month
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
      }
      
      months.push({ key: monthKey, startDate, endDate });
    }

    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    const syncResults = {
      trafficSources: 0,
      campaigns: 0,
      events: 0,
      pages: 0,
      deviceMetrics: 0,
      pagePerformance: 0,
    };

    // Sync Traffic Sources
    console.log('Syncing traffic sources...');
    try {
      const trafficData = await syncTrafficSources(propertyId, accessToken, months);
      for (const [sourceId, sourceData] of Object.entries(trafficData)) {
        const docRef = doc(db, 'ga_traffic_sources', `${organizationId}_${sourceId}`);
        await setDoc(docRef, {
          organizationId,
          sourceId,
          sourceName: sourceData.name,
          months: sourceData.months,
          syncedAt: serverTimestamp(),
        }, { merge: true });
        syncResults.trafficSources++;
      }
    } catch (err) {
      console.error('Error syncing traffic sources:', err);
      throw new Error('Failed to sync traffic sources: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    // Sync Campaigns (Google Ads)
    console.log('Syncing campaigns...');
    const campaignData = await syncCampaigns(propertyId, accessToken, months);
    for (const [campaignId, campaignInfo] of Object.entries(campaignData)) {
      const docRef = doc(db, 'ga_campaigns', `${organizationId}_${campaignId}`);
      await setDoc(docRef, {
        organizationId,
        campaignId,
        campaignName: campaignInfo.name,
        months: campaignInfo.months,
        syncedAt: serverTimestamp(),
      }, { merge: true });
      syncResults.campaigns++;
    }

    // Sync Events
    console.log('Syncing events...');
    const eventsData = await syncEvents(propertyId, accessToken, months);
    for (const [eventName, eventInfo] of Object.entries(eventsData)) {
      const docRef = doc(db, 'ga_events', `${organizationId}_${eventName.replace(/[^a-z0-9_]/gi, '_')}`);
      await setDoc(docRef, {
        organizationId,
        eventName,
        months: eventInfo.months,
        syncedAt: serverTimestamp(),
      }, { merge: true });
      syncResults.events++;
    }

    // Sync Pages
    console.log('Syncing pages...');
    const pagesData = await syncPages(propertyId, accessToken, months);
    for (const [pageId, pageInfo] of Object.entries(pagesData)) {
      const docRef = doc(db, 'ga_pages', `${organizationId}_${pageId}`);
      await setDoc(docRef, {
        organizationId,
        pageId,
        pageTitle: pageInfo.title,
        pagePath: pageInfo.path,
        months: pageInfo.months,
        syncedAt: serverTimestamp(),
      }, { merge: true });
      syncResults.pages++;
    }

    // Sync Device-level metrics (Phase 2.1)
    console.log('Syncing device metrics...');
    try {
      const deviceData = await syncDeviceMetrics(propertyId, accessToken, months, organizationId);
      syncResults.deviceMetrics = Object.keys(deviceData).length;
    } catch (err) {
      console.error('Error syncing device metrics:', err);
    }

    // Sync Enhanced Page Performance (Phase 2.2)
    console.log('Syncing page performance metrics...');
    try {
      const perfData = await syncPagePerformance(propertyId, accessToken, months, organizationId);
      syncResults.pagePerformance = Object.keys(perfData).length;
    } catch (err) {
      console.error('Error syncing page performance:', err);
    }

    return NextResponse.json({
      success: true,
      monthsSynced: months.length,
      results: syncResults,
      message: `Synced ${months.length} months of GA4 data to Firestore (including device & performance metrics)`,
    });

  } catch (error) {
    console.error('Error syncing GA4 data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync GA4 data';
    return NextResponse.json({ 
      error: errorMessage,
      details: 'Check if GA API access token is valid and Analytics Data API is enabled'
    }, { status: 500 });
  }
}

// Sync Traffic Sources
async function syncTrafficSources(
  propertyId: string,
  accessToken: string,
  months: { key: string; startDate: string; endDate: string }[]
): Promise<Record<string, any>> {
  const trafficData: Record<string, any> = {};

  for (const month of months) {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'sessions' },
            { name: 'engagementRate' },
            { name: 'averageSessionDuration' },
            { name: 'eventsPerSession' },
            { name: 'eventCount' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GA API error (${response.status}) for ${month.key}:`, errorText);
      if (response.status === 403) {
        throw new Error('Google Analytics API returned 403 Forbidden. Token may be expired or Analytics Data API not enabled in GCP.');
      }
      continue;
    }

    const data = await response.json();
    
    if (data.rows) {
      for (const row of data.rows) {
        const channelGroup = row.dimensionValues[0].value;
        const sourceId = channelGroup.toLowerCase().replace(/\s+/g, '-');
        
        if (!trafficData[sourceId]) {
          trafficData[sourceId] = {
            name: channelGroup,
            months: {},
          };
        }

        const metrics = row.metricValues;
        const users = parseInt(metrics[0]?.value || '0');
        
        trafficData[sourceId].months[month.key] = {
          users: users,
          newUsers: parseInt(metrics[1]?.value || '0'),
          sessions: parseInt(metrics[2]?.value || '0'),
          engagementRate: parseFloat(metrics[3]?.value || '0') * 100,
          avgEngagementTime: parseFloat(metrics[4]?.value || '0'),
          eventsPerSession: parseFloat(metrics[5]?.value || '0'),
          events: parseInt(metrics[6]?.value || '0'),
          conversions: parseInt(metrics[7]?.value || '0'),
          conversionRate: users > 0 ? (parseInt(metrics[7]?.value || '0') / users) * 100 : 0,
          revenue: parseFloat(metrics[8]?.value || '0'),
        };
      }
    }
  }

  return trafficData;
}

// Sync Campaigns
async function syncCampaigns(
  propertyId: string,
  accessToken: string,
  months: { key: string; startDate: string; endDate: string }[]
): Promise<Record<string, any>> {
  const campaignData: Record<string, any> = {};
  const nonPaidCampaigns = [
    '(not set)', '(direct)', '(organic)', '(referral)', '(none)',
    'organic', 'referral', 'direct', 'none',
  ];

  for (const month of months) {
    // First try with Google Ads cost metrics (if linked)
    let response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
          dimensions: [{ name: 'sessionCampaignName' }],
          metrics: [
            { name: 'sessions' },
            { name: 'newUsers' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
            { name: 'engagedSessions' },
            // Google Ads cost metrics (available if Google Ads is linked to GA4)
            { name: 'advertiserAdClicks' },
            { name: 'advertiserAdImpressions' },
            { name: 'advertiserAdCost' },
            { name: 'advertiserAdCostPerClick' },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'sessionCampaignName',
              stringFilter: {
                matchType: 'FULL_REGEXP',
                value: '.+',
              },
            },
          },
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 1000, // Increased from 100 - get all campaigns
        }),
      }
    );

    let hasCostMetrics = true;
    
    // If cost metrics fail (not linked), fallback to basic metrics
    if (!response.ok) {
      hasCostMetrics = false;
      response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
            dimensions: [{ name: 'sessionCampaignName' }],
            metrics: [
              { name: 'sessions' },
              { name: 'newUsers' },
              { name: 'conversions' },
              { name: 'totalRevenue' },
              { name: 'engagedSessions' },
            ],
            dimensionFilter: {
              filter: {
                fieldName: 'sessionCampaignName',
                stringFilter: {
                  matchType: 'FULL_REGEXP',
                  value: '.+',
                },
              },
            },
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 1000, // Increased from 100
          }),
        }
      );
      
      if (!response.ok) continue;
    }

    const data = await response.json();
    
    if (data.rows) {
      for (const row of data.rows) {
        const campaignName = row.dimensionValues[0].value;
        
        // Skip non-paid campaigns
        if (!campaignName || nonPaidCampaigns.some(np => 
          campaignName.toLowerCase() === np.toLowerCase() || 
          campaignName.toLowerCase().includes('organic')
        )) continue;
        
        const campaignId = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
        
        if (!campaignData[campaignId]) {
          campaignData[campaignId] = {
            name: campaignName,
            months: {},
          };
        }

        const metrics = row.metricValues;
        const sessions = parseInt(metrics[0]?.value || '0');
        const conversions = parseFloat(metrics[2]?.value || '0');
        const revenue = parseFloat(metrics[3]?.value || '0');
        
        // Build metrics object
        const monthMetrics: Record<string, any> = {
          sessions,
          newUsers: parseInt(metrics[1]?.value || '0'),
          conversions,
          revenue,
          engagedSessions: parseInt(metrics[4]?.value || '0'),
          conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        };
        
        // Add cost metrics if available
        if (hasCostMetrics) {
          const clicks = parseInt(metrics[5]?.value || '0');
          const impressions = parseInt(metrics[6]?.value || '0');
          const spend = parseFloat(metrics[7]?.value || '0');
          const cpc = parseFloat(metrics[8]?.value || '0');
          
          monthMetrics.clicks = clicks;
          monthMetrics.impressions = impressions;
          monthMetrics.spend = spend;
          monthMetrics.cpc = cpc;
          monthMetrics.ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          monthMetrics.cpa = conversions > 0 ? spend / conversions : 0;
          monthMetrics.roas = spend > 0 ? revenue / spend : 0;
        }
        
        campaignData[campaignId].months[month.key] = monthMetrics;
      }
    }
  }

  return campaignData;
}

// Sync Events
async function syncEvents(
  propertyId: string,
  accessToken: string,
  months: { key: string; startDate: string; endDate: string }[]
): Promise<Record<string, any>> {
  const eventsData: Record<string, any> = {};

  for (const month of months) {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
          dimensions: [{ name: 'eventName' }],
          metrics: [
            { name: 'eventCount' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
          ],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 500, // Increased from 100 - get all events
        }),
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    
    if (data.rows) {
      for (const row of data.rows) {
        const eventName = row.dimensionValues[0].value;
        
        if (!eventsData[eventName]) {
          eventsData[eventName] = {
            months: {},
          };
        }

        const metrics = row.metricValues;
        
        eventsData[eventName].months[month.key] = {
          events: parseInt(metrics[0]?.value || '0'),
          conversions: parseInt(metrics[1]?.value || '0'),
          revenue: parseFloat(metrics[2]?.value || '0'),
        };
      }
    }
  }

  return eventsData;
}

// Sync Pages
async function syncPages(
  propertyId: string,
  accessToken: string,
  months: { key: string; startDate: string; endDate: string }[]
): Promise<Record<string, any>> {
  const pagesData: Record<string, any> = {};

  for (const month of months) {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
          dimensions: [
            { name: 'pageTitle' },
            { name: 'pagePath' },
          ],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'activeUsers' },
            { name: 'averageSessionDuration' },
            { name: 'conversions' },
          ],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 1000, // Increased from 50 - get all pages
        }),
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    
    if (data.rows) {
      for (const row of data.rows) {
        const pageTitle = row.dimensionValues[0].value;
        const pagePath = row.dimensionValues[1].value;
        const pageId = pagePath.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        
        if (!pagesData[pageId]) {
          pagesData[pageId] = {
            title: pageTitle,
            path: pagePath,
            months: {},
          };
        }

        const metrics = row.metricValues;
        
        pagesData[pageId].months[month.key] = {
          pageViews: parseInt(metrics[0]?.value || '0'),
          users: parseInt(metrics[1]?.value || '0'),
          avgSessionDuration: parseFloat(metrics[2]?.value || '0'),
          conversions: parseInt(metrics[3]?.value || '0'),
        };
      }
    }
  }

  return pagesData;
}

// Sync Device-level Metrics (Phase 2.1)
async function syncDeviceMetrics(
  propertyId: string,
  accessToken: string,
  months: { key: string; startDate: string; endDate: string }[],
  organizationId: string
): Promise<Record<string, any>> {
  const deviceData: Record<string, any> = {};

  for (const month of months) {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
          dimensions: [
            { name: 'deviceCategory' }, // mobile, desktop, tablet
            { name: 'pagePath' },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 1000,
        }),
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    
    if (data.rows) {
      for (const row of data.rows) {
        const deviceType = row.dimensionValues[0].value;
        const pagePath = row.dimensionValues[1].value;
        const devicePageKey = `${deviceType}_${pagePath}`;
        
        if (!deviceData[devicePageKey]) {
          deviceData[devicePageKey] = {
            deviceType,
            pagePath,
            months: {},
          };
        }

        const metrics = row.metricValues;
        
        deviceData[devicePageKey].months[month.key] = {
          sessions: parseInt(metrics[0]?.value || '0'),
          conversions: parseInt(metrics[1]?.value || '0'),
          pageViews: parseInt(metrics[2]?.value || '0'),
          avgSessionDuration: parseFloat(metrics[3]?.value || '0'),
          bounceRate: parseFloat(metrics[4]?.value || '0') * 100,
        };
      }
    }
  }

  // Write to Firestore
  for (const [key, data] of Object.entries(deviceData)) {
    const docRef = doc(db, 'ga_device_metrics', `${organizationId}_${key}`);
    await setDoc(docRef, {
      organizationId,
      ...data,
      syncedAt: serverTimestamp(),
    }, { merge: true });
  }

  return deviceData;
}

// Sync Enhanced Page Performance Metrics (Phase 2.2)
async function syncPagePerformance(
  propertyId: string,
  accessToken: string,
  months: { key: string; startDate: string; endDate: string }[],
  organizationId: string
): Promise<Record<string, any>> {
  const perfData: Record<string, any> = {};

  for (const month of months) {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'userEngagementDuration' }, // Total engagement time
            { name: 'averageSessionDuration' },
            { name: 'scrolledUsers' }, // Users who scrolled
            { name: 'activeUsers' },
            { name: 'addToCarts' }, // Ecommerce event
            { name: 'checkouts' }, // Ecommerce event (checkout_started)
            { name: 'purchases' }, // purchase_completed
          ],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 1000,
        }),
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    
    if (data.rows) {
      for (const row of data.rows) {
        const pagePath = row.dimensionValues[0].value;
        
        if (!perfData[pagePath]) {
          perfData[pagePath] = {
            pagePath,
            months: {},
          };
        }

        const metrics = row.metricValues;
        const pageViews = parseInt(metrics[0]?.value || '0');
        const engagementDuration = parseFloat(metrics[1]?.value || '0');
        const activeUsers = parseInt(metrics[4]?.value || '0');
        const scrolledUsers = parseInt(metrics[3]?.value || '0');
        
        perfData[pagePath].months[month.key] = {
          pageViews,
          dwellTime: pageViews > 0 ? engagementDuration / pageViews : 0, // Avg time per page view
          avgSessionDuration: parseFloat(metrics[2]?.value || '0'),
          scrollDepth: activeUsers > 0 ? (scrolledUsers / activeUsers) * 100 : 0, // % who scrolled
          addToCart: parseInt(metrics[5]?.value || '0'),
          checkoutStarted: parseInt(metrics[6]?.value || '0'),
          purchaseCompleted: parseInt(metrics[7]?.value || '0'),
        };
      }
    }
  }

  // Write to Firestore
  for (const [path, data] of Object.entries(perfData)) {
    const docRef = doc(db, 'ga_page_performance', `${organizationId}_${Buffer.from(path).toString('base64').substring(0, 50)}`);
    await setDoc(docRef, {
      organizationId,
      ...data,
      syncedAt: serverTimestamp(),
    }, { merge: true });
  }

  return perfData;
}
