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

interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token');
      return null;
    }

    const data: RefreshTokenResponse = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const startDate = searchParams.get('startDate') || '30daysAgo';
  const endDate = searchParams.get('endDate') || 'today';

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId parameter' },
      { status: 400 }
    );
  }

  try {
    // Get connection from Firestore
    const connectionRef = doc(db, 'ga_connections', organizationId);
    const connectionSnap = await getDoc(connectionRef);

    if (!connectionSnap.exists()) {
      return NextResponse.json(
        { error: 'Google Analytics not connected' },
        { status: 404 }
      );
    }

    const connection = connectionSnap.data() as GAConnection;

    if (!connection.selectedPropertyId) {
      return NextResponse.json(
        { error: 'No property selected' },
        { status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = connection.accessToken;
    const expiresAt = connection.tokenExpiresAt?.toDate?.() || new Date(0);

    if (expiresAt < new Date()) {
      if (!connection.refreshToken) {
        return NextResponse.json(
          { error: 'Token expired and no refresh token available' },
          { status: 401 }
        );
      }

      const newToken = await refreshAccessToken(connection.refreshToken);
      if (!newToken) {
        // Update status to indicate re-auth needed
        await setDoc(connectionRef, {
          status: 'error',
          errorMessage: 'Token refresh failed. Please reconnect.',
          updatedAt: serverTimestamp(),
        }, { merge: true });

        return NextResponse.json(
          { error: 'Failed to refresh token. Please reconnect.' },
          { status: 401 }
        );
      }

      accessToken = newToken;

      // Update token in Firestore
      await setDoc(connectionRef, {
        accessToken: newToken,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    // Fetch data from Google Analytics Data API (GA4)
    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'engagedSessions' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('GA API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Parse the response
    const metrics = data.rows?.[0]?.metricValues || [];
    const result = {
      activeUsers: parseInt(metrics[0]?.value || '0'),
      newUsers: parseInt(metrics[1]?.value || '0'),
      sessions: parseInt(metrics[2]?.value || '0'),
      pageViews: parseInt(metrics[3]?.value || '0'),
      avgSessionDuration: parseFloat(metrics[4]?.value || '0'),
      bounceRate: parseFloat(metrics[5]?.value || '0') * 100,
      engagedSessions: parseInt(metrics[6]?.value || '0'),
      dateRange: { startDate, endDate },
    };

    // Update last sync time
    await setDoc(connectionRef, {
      lastSyncAt: serverTimestamp(),
      lastSyncResults: result,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching GA data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

