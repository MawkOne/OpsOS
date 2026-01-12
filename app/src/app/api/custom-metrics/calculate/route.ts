import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { CustomMetric, MetricSelector } from '@/types/custom-metrics';

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

async function fetchGAData(
  accessToken: string,
  propertyId: string,
  selector: MetricSelector,
  startDate: string,
  endDate: string
): Promise<number> {
  const dimensionFilters: any[] = [];
  
  // Add country filter (check if filters object exists)
  if (selector.filters?.country) {
    dimensionFilters.push({
      filter: {
        fieldName: 'country',
        stringFilter: {
          matchType: 'EXACT',
          value: selector.filters.country,
        },
      },
    });
  }
  
  // Add device filter (check if filters object exists)
  if (selector.filters?.device) {
    dimensionFilters.push({
      filter: {
        fieldName: 'deviceCategory',
        stringFilter: {
          matchType: 'EXACT',
          value: selector.filters.device,
        },
      },
    });
  }
  
  // Add event name filter (for events)
  if (selector.metricType === 'event' && selector.gaEventName) {
    dimensionFilters.push({
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'EXACT',
          value: selector.gaEventName,
        },
      },
    });
  }
  
  const requestBody: any = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [],
    metrics: [],
  };
  
  // Set metric based on type
  if (selector.metricType === 'metric' && selector.gaMetric) {
    requestBody.metrics.push({ name: selector.gaMetric });
  } else if (selector.metricType === 'event') {
    requestBody.metrics.push({ name: 'eventCount' });
  }
  
  // Add dimension filter if we have any
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
    console.error('GA API error:', await response.text());
    return 0;
  }
  
  const data = await response.json();
  
  // Extract value from response
  if (data.rows && data.rows.length > 0) {
    const value = parseFloat(data.rows[0].metricValues[0]?.value || '0');
    return value;
  }
  
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const { metricId, organizationId, viewMode = 'ttm', year } = await request.json();
    
    if (!metricId || !organizationId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Fetch the custom metric configuration
    const metricDoc = await getDoc(doc(db, 'custom_metrics', metricId));
    if (!metricDoc.exists()) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    }
    
    const metric = { id: metricDoc.id, ...metricDoc.data() } as CustomMetric;
    
    // Check if we support the data sources
    if (metric.numerator.source !== 'google-analytics' || metric.denominator.source !== 'google-analytics') {
      return NextResponse.json({ error: 'Only Google Analytics data source is currently supported' }, { status: 400 });
    }
    
    // Get GA connection
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
    
    const propertyId = connection.selectedPropertyId.replace('properties/', '');
    
    // Calculate date ranges for each month
    const now = new Date();
    const months: { key: string; startDate: string; endDate: string }[] = [];
    const selectedYear = year || now.getFullYear();
    
    if (viewMode === 'ttm') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const startDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
        
        let endDate: string;
        if (i === 0) {
          endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        } else {
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
        }
        
        months.push({ key: monthKey, startDate, endDate });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const monthKey = `${selectedYear}-${(m + 1).toString().padStart(2, '0')}`;
        const startDate = `${selectedYear}-${(m + 1).toString().padStart(2, '0')}-01`;
        
        const monthDate = new Date(selectedYear, m, 1);
        if (monthDate > now) continue;
        
        let endDate: string;
        if (selectedYear === now.getFullYear() && m === now.getMonth()) {
          endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        } else {
          const lastDay = new Date(selectedYear, m + 1, 0);
          endDate = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
        }
        
        months.push({ key: monthKey, startDate, endDate });
      }
    }
    
    // Fetch data for each month
    const monthlyValues: Record<string, { numerator: number; denominator: number; percentage: number }> = {};
    
    for (const month of months) {
      // Fetch numerator value
      const numeratorValue = await fetchGAData(
        accessToken,
        propertyId,
        metric.numerator,
        month.startDate,
        month.endDate
      );
      
      // Fetch denominator value
      const denominatorValue = await fetchGAData(
        accessToken,
        propertyId,
        metric.denominator,
        month.startDate,
        month.endDate
      );
      
      // Calculate percentage
      const percentage = denominatorValue > 0 ? (numeratorValue / denominatorValue) * 100 : 0;
      
      monthlyValues[month.key] = {
        numerator: numeratorValue,
        denominator: denominatorValue,
        percentage,
      };
    }
    
    // Update the metric with calculated values
    await setDoc(doc(db, 'custom_metrics', metricId), {
      monthlyValues: Object.entries(monthlyValues).reduce((acc, [key, value]) => {
        acc[key] = value.percentage;
        return acc;
      }, {} as Record<string, number>),
      lastCalculated: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    return NextResponse.json({
      metricId,
      monthlyValues,
      calculatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error calculating custom metric:', error);
    return NextResponse.json({ error: 'Failed to calculate metric' }, { status: 500 });
  }
}

