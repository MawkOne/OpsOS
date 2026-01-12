import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const viewMode = searchParams.get('viewMode') || 'ttm'; // 'ttm' or 'year'
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const country = searchParams.get('country') || ''; // Country filter
  const deviceCategory = searchParams.get('device') || ''; // Device filter (desktop, mobile, tablet)
  const eventName = searchParams.get('event') || ''; // Event name filter

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
        await setDoc(connectionRef, {
          status: 'error',
          errorMessage: 'Token refresh failed. Please reconnect.',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }

      accessToken = newToken;
      await setDoc(connectionRef, {
        accessToken: newToken,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    // Calculate date ranges for each month
    const now = new Date();
    const months: { key: string; startDate: string; endDate: string }[] = [];

    if (viewMode === 'ttm') {
      // Trailing 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        
        // Start of month
        const startDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
        
        // End of month (or today if current month)
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
    } else {
      // Calendar year
      for (let m = 0; m < 12; m++) {
        const monthKey = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const startDate = `${year}-${(m + 1).toString().padStart(2, '0')}-01`;
        
        // Check if this month is in the future
        const monthDate = new Date(year, m, 1);
        if (monthDate > now) {
          // Skip future months
          continue;
        }
        
        let endDate: string;
        if (year === now.getFullYear() && m === now.getMonth()) {
          // Current month - use today
          endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        } else {
          // Past month - use last day of month
          const lastDay = new Date(year, m + 1, 0);
          endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
        }
        
        months.push({ key: monthKey, startDate, endDate });
      }
    }

    // Fetch data from Google Analytics for each month
    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    const trafficData: Record<string, Record<string, any>> = {};

    for (const month of months) {
      // Build dimension filters
      const dimensionFilters: any[] = [];
      
      if (country) {
        dimensionFilters.push({
          filter: {
            fieldName: 'country',
            stringFilter: {
              matchType: 'EXACT',
              value: country,
            },
          },
        });
      }
      
      if (deviceCategory) {
        dimensionFilters.push({
          filter: {
            fieldName: 'deviceCategory',
            stringFilter: {
              matchType: 'EXACT',
              value: deviceCategory,
            },
          },
        });
      }

      if (eventName) {
        dimensionFilters.push({
          filter: {
            fieldName: 'eventName',
            stringFilter: {
              matchType: 'EXACT',
              value: eventName,
            },
          },
        });
      }

      const requestBody: any = {
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
      };

      // Add dimension filter if we have any filters
      if (dimensionFilters.length > 0) {
        if (dimensionFilters.length === 1) {
          requestBody.dimensionFilter = dimensionFilters[0];
        } else {
          requestBody.dimensionFilter = {
            andGroup: {
              expressions: dimensionFilters,
            },
          };
        }
      }

      const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch data for ${month.key}:`, await response.text());
        continue;
      }

      const data = await response.json();
      
      // Process rows
      if (data.rows) {
        for (const row of data.rows) {
          const channelGroup = row.dimensionValues[0].value;
          const sourceId = channelGroup.toLowerCase().replace(/\s+/g, '-');
          
          if (!trafficData[sourceId]) {
            trafficData[sourceId] = {
              id: sourceId,
              name: channelGroup,
              months: {},
            };
          }

          const metrics = row.metricValues;
          trafficData[sourceId].months[month.key] = {
            users: parseInt(metrics[0]?.value || '0'),
            newUsers: parseInt(metrics[1]?.value || '0'),
            sessions: parseInt(metrics[2]?.value || '0'),
            engagementRate: parseFloat(metrics[3]?.value || '0') * 100,
            avgEngagementTime: parseFloat(metrics[4]?.value || '0'),
            eventsPerSession: parseFloat(metrics[5]?.value || '0'),
            events: parseInt(metrics[6]?.value || '0'),
            conversions: parseInt(metrics[7]?.value || '0'),
            conversionRate: 0, // Calculate below
            revenue: parseFloat(metrics[8]?.value || '0'),
          };

          // Calculate conversion rate
          const monthData = trafficData[sourceId].months[month.key];
          if (monthData.users > 0) {
            monthData.conversionRate = (monthData.conversions / monthData.users) * 100;
          }
        }
      }
    }

    // Convert to array
    const result = Object.values(trafficData);

    return NextResponse.json({
      sources: result,
      months: months.map(m => m.key),
    });

  } catch (error) {
    console.error('Error fetching traffic sources:', error);
    return NextResponse.json({ error: 'Failed to fetch traffic data' }, { status: 500 });
  }
}

