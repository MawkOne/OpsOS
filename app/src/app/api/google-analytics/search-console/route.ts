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
  searchConsoleSiteUrl?: string;
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
  const viewMode = searchParams.get('viewMode') || 'ttm';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

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

    // First, get the list of Search Console sites
    const sitesResponse = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!sitesResponse.ok) {
      const errorText = await sitesResponse.text();
      console.error('Search Console sites error:', errorText);
      
      if (sitesResponse.status === 403) {
        return NextResponse.json({ 
          error: 'Search Console access not granted. Please reconnect Google Analytics to grant Search Console permissions.',
          needsReconnect: true 
        }, { status: 403 });
      }
      
      return NextResponse.json({ error: 'Failed to fetch Search Console sites' }, { status: 500 });
    }

    const sitesData = await sitesResponse.json();
    const sites = sitesData.siteEntry || [];

    if (sites.length === 0) {
      return NextResponse.json({ 
        error: 'No Search Console sites found for this account',
        queries: [],
        months: [] 
      });
    }

    // Use the first site or the one stored in connection
    const siteUrl = connection.searchConsoleSiteUrl || sites[0].siteUrl;

    // Calculate date ranges for each month
    const now = new Date();
    const months: { key: string; startDate: string; endDate: string }[] = [];

    if (viewMode === 'ttm') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const startDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
        
        let endDate: string;
        if (i === 0) {
          // Current month - use yesterday (Search Console has ~3 day delay)
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 3);
          endDate = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;
        } else {
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
        }
        
        months.push({ key: monthKey, startDate, endDate });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const monthKey = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const startDate = `${year}-${(m + 1).toString().padStart(2, '0')}-01`;
        
        const monthDate = new Date(year, m, 1);
        if (monthDate > now) continue;
        
        let endDate: string;
        if (year === now.getFullYear() && m === now.getMonth()) {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 3);
          endDate = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;
        } else {
          const lastDay = new Date(year, m + 1, 0);
          endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
        }
        
        months.push({ key: monthKey, startDate, endDate });
      }
    }

    const searchData: Record<string, { id: string; query: string; months: Record<string, any> }> = {};

    // Fetch Search Console data for each month
    for (const month of months) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate: month.startDate,
              endDate: month.endDate,
              dimensions: ['query'],
              rowLimit: 100,
              dataState: 'all',
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Search Console query error for ${month.key}:`, errorText);
          continue;
        }

        const data = await response.json();
        
        if (data.rows) {
          for (const row of data.rows) {
            const query = row.keys[0];
            if (!query || query === '(not set)') continue;
            
            const queryId = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
            
            if (!searchData[queryId]) {
              searchData[queryId] = {
                id: queryId,
                query: query,
                months: {},
              };
            }

            searchData[queryId].months[month.key] = {
              clicks: row.clicks || 0,
              impressions: row.impressions || 0,
              ctr: (row.ctr || 0) * 100,
              position: row.position || 0,
            };
          }
        }
      } catch (err) {
        console.error(`Error fetching Search Console data for ${month.key}:`, err);
      }
    }

    // Convert to array and sort by total clicks
    const result = Object.values(searchData).sort((a, b) => {
      const totalA = Object.values(a.months).reduce((sum: number, m: any) => sum + (m?.clicks || 0), 0);
      const totalB = Object.values(b.months).reduce((sum: number, m: any) => sum + (m?.clicks || 0), 0);
      return totalB - totalA;
    });

    return NextResponse.json({
      queries: result.slice(0, 50),
      months: months.map(m => m.key),
      siteUrl: siteUrl,
      availableSites: sites.map((s: any) => s.siteUrl),
    });

  } catch (error) {
    console.error('Error fetching search console data:', error);
    return NextResponse.json({ error: 'Failed to fetch search data' }, { status: 500 });
  }
}
