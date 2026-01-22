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
    };

    // Sync Traffic Sources
    console.log('Syncing traffic sources...');
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

    return NextResponse.json({
      success: true,
      monthsSynced: months.length,
      results: syncResults,
      message: `Synced ${months.length} months of GA4 data to Firestore`,
    });

  } catch (error) {
    console.error('Error syncing GA4 data:', error);
    return NextResponse.json({ error: 'Failed to sync GA4 data' }, { status: 500 });
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

    if (!response.ok) continue;

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
          limit: 50,
        }),
      }
    );

    if (!response.ok) continue;

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
        
        campaignData[campaignId].months[month.key] = {
          sessions: sessions,
          newUsers: parseInt(metrics[1]?.value || '0'),
          conversions: parseFloat(metrics[2]?.value || '0'),
          revenue: parseFloat(metrics[3]?.value || '0'),
          engagedSessions: parseInt(metrics[4]?.value || '0'),
          conversionRate: sessions > 0 ? (parseFloat(metrics[2]?.value || '0') / sessions) * 100 : 0,
        };
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
          limit: 100,
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
          limit: 50,
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
