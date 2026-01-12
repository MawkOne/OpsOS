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
  const channelGroup = searchParams.get('channelGroup');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const country = searchParams.get('country') || '';
  const deviceCategory = searchParams.get('device') || '';

  if (!organizationId || !channelGroup || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
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

    const propertyId = connection.selectedPropertyId.replace('properties/', '');

    // Build dimension filters
    const dimensionFilters: any[] = [
      {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          stringFilter: {
            matchType: 'EXACT',
            value: channelGroup,
          },
        },
      },
    ];

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

    const requestBody: any = {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [
        { name: 'eventCount' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
      dimensionFilter: dimensionFilters.length === 1 ? dimensionFilters[0] : {
        andGroup: {
          expressions: dimensionFilters,
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 50,
    };

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
      console.error('Failed to fetch event breakdown:', await response.text());
      return NextResponse.json({ error: 'Failed to fetch event breakdown' }, { status: 500 });
    }

    const data = await response.json();

    // Process event breakdown
    const events: any[] = [];
    if (data.rows) {
      for (const row of data.rows) {
        const eventName = row.dimensionValues[0].value;
        const metrics = row.metricValues;
        
        events.push({
          eventName,
          eventCount: parseInt(metrics[0]?.value || '0'),
          conversions: parseInt(metrics[1]?.value || '0'),
          revenue: parseFloat(metrics[2]?.value || '0'),
        });
      }
    }

    return NextResponse.json({ events });

  } catch (error) {
    console.error('Error fetching event breakdown:', error);
    return NextResponse.json({ error: 'Failed to fetch event breakdown' }, { status: 500 });
  }
}

