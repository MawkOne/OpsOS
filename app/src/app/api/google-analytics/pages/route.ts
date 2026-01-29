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
  const viewMode = searchParams.get('viewMode') || 'ttm';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const limit = parseInt(searchParams.get('limit') || '50');

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
    } else {
      // Year view
      for (let m = 0; m < 12; m++) {
        const monthKey = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const startDate = `${year}-${(m + 1).toString().padStart(2, '0')}-01`;
        
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

    // Fetch page data from Google Analytics for each month
    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    const pageData: Record<string, Record<string, any>> = {};

    // First, get all unique pages across the entire period (for prefix matching)
    // This single query gets the top N pages by total traffic
    // Note: GA4 might return full URLs in pageLocation or paths in pagePath
    const allPagesRequestBody = {
      dateRanges: [{ 
        startDate: months[0].startDate, 
        endDate: months[months.length - 1].endDate 
      }],
      dimensions: [{ name: 'pageLocation' }], // Use pageLocation which includes full URL
      metrics: [
        { name: 'screenPageViews' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: limit, // This gets top N pages across entire period
    };

    let allPagePaths: string[] = [];
    try {
      const allPagesResponse = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(allPagesRequestBody),
        }
      );

      if (allPagesResponse.ok) {
        const allPagesData = await allPagesResponse.json();
        console.log(`[GA Pages API] Raw response has ${(allPagesData.rows || []).length} rows`);
        console.log(`[GA Pages API] First 3 raw values:`, (allPagesData.rows || []).slice(0, 3).map((r: any) => r.dimensionValues[0].value));
        
        allPagePaths = (allPagesData.rows || []).map((row: any) => {
          let pagePath = row.dimensionValues[0].value;
          
          // If it's a full URL, extract just the path
          if (pagePath.startsWith('http://') || pagePath.startsWith('https://')) {
            try {
              const url = new URL(pagePath);
              pagePath = url.pathname;
            } catch (e) {
              console.warn('Failed to parse URL:', pagePath);
            }
          }
          
          return pagePath;
        });
        console.log(`[GA Pages API] Fetched ${allPagePaths.length} unique pages for the entire period`);
        console.log(`[GA Pages API] First 5 parsed paths:`, allPagePaths.slice(0, 5));
      } else {
        console.error(`[GA Pages API] Failed to fetch all pages:`, await allPagesResponse.text());
      }
    } catch (error) {
      console.error('Error fetching all pages:', error);
    }

    // Initialize pageData with all pages from the initial query
    for (const path of allPagePaths) {
      const pageId = path.toLowerCase().replace(/\//g, '_').replace(/[^a-z0-9_]/g, '') || 'homepage';
      if (!pageData[pageId]) {
        pageData[pageId] = {
          id: pageId,
          name: path === '/' ? 'Homepage' : path,
          months: {},
        };
      }
    }
    
    console.log(`[GA Pages API] Initialized ${Object.keys(pageData).length} pages`);
    
    // Now fetch month-by-month data for these specific pages
    for (const month of months) {
      const requestBody: any = {
        dateRanges: [{ startDate: month.startDate, endDate: month.endDate }],
        dimensions: [{ name: 'pageLocation' }], // Use pageLocation to match the initial query
        metrics: [
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: Math.min(limit, 10000), // GA has a max of 10k per query
      };

      try {
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
          console.error(`Failed to fetch page data for ${month.key}:`, await response.text());
          continue;
        }

        const data = await response.json();
        
        // Process rows
        if (data.rows) {
          for (const row of data.rows) {
            let pagePath = row.dimensionValues[0].value;
            
            // If it's a full URL, extract just the path
            if (pagePath.startsWith('http://') || pagePath.startsWith('https://')) {
              try {
                const url = new URL(pagePath);
                pagePath = url.pathname;
              } catch (e) {
                console.warn('Failed to parse URL:', pagePath);
              }
            }
            
            const pageId = pagePath.toLowerCase().replace(/\//g, '_').replace(/[^a-z0-9_]/g, '') || 'homepage';
            
            if (!pageData[pageId]) {
              pageData[pageId] = {
                id: pageId,
                name: pagePath === '/' ? 'Homepage' : pagePath,
                months: {},
              };
            }

            const metrics = row.metricValues;
            
            pageData[pageId].months[month.key] = {
              pageviews: parseInt(metrics[0]?.value || '0'),
              sessions: parseInt(metrics[1]?.value || '0'),
              avgTimeOnPage: parseFloat(metrics[2]?.value || '0'),
            };
          }
        }
      } catch (error) {
        console.error(`Error fetching page data for ${month.key}:`, error);
        continue;
      }
    }

    // Convert to array
    const result = Object.values(pageData);
    
    console.log(`[GA Pages API] Returning ${result.length} pages to client`);
    console.log(`[GA Pages API] Pages with /blog prefix:`, result.filter((p: any) => p.name.startsWith('/blog')).length);

    return NextResponse.json({
      pages: result,
      months: months.map(m => m.key),
    });

  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ error: 'Failed to fetch page data' }, { status: 500 });
  }
}
