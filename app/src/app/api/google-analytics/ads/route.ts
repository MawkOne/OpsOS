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
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const startDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
        
        let endDate: string;
        if (i === 0) {
          // Current month - use today
          endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
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
          endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        } else {
          const lastDay = new Date(year, m + 1, 0);
          endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
        }
        
        months.push({ key: monthKey, startDate, endDate });
      }
    }

    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    const campaignData: Record<string, { id: string; name: string; months: Record<string, any> }> = {};

    // Fetch Google Ads data for each month via GA4 API
    for (const month of months) {
      try {
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
                { name: 'sessionCampaignName' },
              ],
              metrics: [
                { name: 'advertiserAdClicks' },
                { name: 'advertiserAdImpressions' },
                { name: 'advertiserAdCost' },
                { name: 'advertiserAdCostPerClick' },
                { name: 'sessions' },
                { name: 'conversions' },
                { name: 'totalRevenue' },
              ],
              dimensionFilter: {
                filter: {
                  fieldName: 'sessionCampaignName',
                  stringFilter: {
                    matchType: 'FULL_REGEXP',
                    value: '.+', // Only non-empty campaign names
                  },
                },
              },
              orderBys: [
                { metric: { metricName: 'advertiserAdCost' }, desc: true },
              ],
              limit: 50,
            }),
          }
        );

        if (!response.ok) {
          // Try alternative metrics if advertiser metrics aren't available
          const altResponse = await fetch(
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
                  { name: 'sessionCampaignName' },
                ],
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
                orderBys: [
                  { metric: { metricName: 'sessions' }, desc: true },
                ],
                limit: 50,
              }),
            }
          );

          if (altResponse.ok) {
            const altData = await altResponse.json();
            processAltData(altData, month.key, campaignData);
          }
          continue;
        }

        const data = await response.json();
        processData(data, month.key, campaignData);
      } catch (err) {
        console.error(`Error fetching ads data for ${month.key}:`, err);
      }
    }

    // Convert to array and sort by total spend
    const result = Object.values(campaignData).sort((a, b) => {
      const totalA = Object.values(a.months).reduce((sum: number, m: any) => sum + (m?.spend || m?.sessions || 0), 0);
      const totalB = Object.values(b.months).reduce((sum: number, m: any) => sum + (m?.spend || m?.sessions || 0), 0);
      return totalB - totalA;
    });

    return NextResponse.json({
      campaigns: result,
      months: months.map(m => m.key),
    });

  } catch (error) {
    console.error('Error fetching ads data:', error);
    return NextResponse.json({ error: 'Failed to fetch ads data' }, { status: 500 });
  }
}

function processData(data: any, monthKey: string, campaignData: Record<string, any>) {
  // Non-paid campaign names to filter out
  const nonPaidCampaigns = [
    '(not set)', '(direct)', '(organic)', '(referral)', '(none)',
    'organic', 'referral', 'direct', 'none',
    'Organic Search', 'Organic Social', 'Organic Video', 'Organic Shopping',
    'Direct', 'Referral', 'Email', 'Affiliates', 'Audio',
  ];
  
  if (data.rows) {
    for (const row of data.rows) {
      const campaignName = row.dimensionValues[0].value;
      // Skip non-paid campaign names
      if (!campaignName || nonPaidCampaigns.some(np => 
        campaignName.toLowerCase() === np.toLowerCase() || 
        campaignName.toLowerCase().includes('organic') ||
        campaignName.toLowerCase().includes('referral') ||
        campaignName.toLowerCase() === 'direct'
      )) continue;
      
      const campaignId = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      
      if (!campaignData[campaignId]) {
        campaignData[campaignId] = {
          id: campaignId,
          name: campaignName,
          months: {},
        };
      }

      const metrics = row.metricValues;
      const clicks = parseInt(metrics[0]?.value || '0');
      const impressions = parseInt(metrics[1]?.value || '0');
      const spend = parseFloat(metrics[2]?.value || '0');
      const cpc = parseFloat(metrics[3]?.value || '0');
      const sessions = parseInt(metrics[4]?.value || '0');
      const conversions = parseFloat(metrics[5]?.value || '0');
      const revenue = parseFloat(metrics[6]?.value || '0');

      campaignData[campaignId].months[monthKey] = {
        clicks,
        impressions,
        spend,
        cpc,
        sessions,
        conversions,
        revenue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
        roas: spend > 0 ? revenue / spend : 0,
      };
    }
  }
}

function processAltData(data: any, monthKey: string, campaignData: Record<string, any>) {
  // Non-paid campaign names to filter out
  const nonPaidCampaigns = [
    '(not set)', '(direct)', '(organic)', '(referral)', '(none)',
    'organic', 'referral', 'direct', 'none',
    'Organic Search', 'Organic Social', 'Organic Video', 'Organic Shopping',
    'Direct', 'Referral', 'Email', 'Affiliates', 'Audio',
  ];
  
  if (data.rows) {
    for (const row of data.rows) {
      const campaignName = row.dimensionValues[0].value;
      // Skip non-paid campaign names
      if (!campaignName || nonPaidCampaigns.some(np => 
        campaignName.toLowerCase() === np.toLowerCase() || 
        campaignName.toLowerCase().includes('organic') ||
        campaignName.toLowerCase().includes('referral') ||
        campaignName.toLowerCase() === 'direct'
      )) continue;
      
      const campaignId = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      
      if (!campaignData[campaignId]) {
        campaignData[campaignId] = {
          id: campaignId,
          name: campaignName,
          months: {},
        };
      }

      const metrics = row.metricValues;
      const sessions = parseInt(metrics[0]?.value || '0');
      const newUsers = parseInt(metrics[1]?.value || '0');
      const conversions = parseFloat(metrics[2]?.value || '0');
      const revenue = parseFloat(metrics[3]?.value || '0');
      const engagedSessions = parseInt(metrics[4]?.value || '0');

      campaignData[campaignId].months[monthKey] = {
        clicks: 0,
        impressions: 0,
        spend: 0,
        cpc: 0,
        sessions,
        newUsers,
        conversions,
        revenue,
        engagedSessions,
        ctr: 0,
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        roas: 0,
      };
    }
  }
}

