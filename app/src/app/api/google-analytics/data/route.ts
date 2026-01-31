import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const daysBack = parseInt(searchParams.get('daysBack') || '30');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId parameter' },
      { status: 400 }
    );
  }

  try {
    // Dynamically import BigQuery
    const { BigQuery } = await import('@google-cloud/bigquery');
    
    // Check for credentials
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      console.error('[GA Data API] Missing GOOGLE_APPLICATION_CREDENTIALS_JSON');
      return NextResponse.json(
        { 
          error: 'BigQuery credentials not configured',
          activeUsers: 0,
          newUsers: 0,
          sessions: 0,
          pageViews: 0,
          avgSessionDuration: 0,
          bounceRate: 0,
          engagedSessions: 0,
        },
        { status: 200 }
      );
    }

    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Query BigQuery for aggregated GA4 metrics
    // Using correct column names from table schema
    const query = `
      SELECT 
        SUM(users) as activeUsers,
        SUM(sessions) as sessions,
        SUM(pageviews) as pageViews,
        AVG(avg_session_duration) as avgSessionDuration,
        AVG(bounce_rate) as bounceRate
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE organization_id = @organizationId
        AND entity_type = 'website_traffic'
        AND date >= @startDate
        AND date <= @endDate
    `;

    const options = {
      query,
      params: {
        organizationId,
        startDate: startDateStr,
        endDate: endDateStr,
      },
    };

    const [rows] = await bq.query(options);

    if (!rows || rows.length === 0 || !rows[0].activeUsers) {
      return NextResponse.json(
        { 
          error: 'No GA4 data found in BigQuery. Please sync data first.',
          hint: 'Click "Sync to BigQuery" to pull data from Google Analytics.',
          activeUsers: 0,
          newUsers: 0,
          sessions: 0,
          pageViews: 0,
          avgSessionDuration: 0,
          bounceRate: 0,
          engagedSessions: 0,
        },
        { status: 200 }
      );
    }

    const row = rows[0];
    const result = {
      activeUsers: parseInt(row.activeUsers || '0'),
      newUsers: 0, // Not tracked in current schema
      sessions: parseInt(row.sessions || '0'),
      pageViews: parseInt(row.pageViews || '0'),
      avgSessionDuration: parseFloat(row.avgSessionDuration || '0'),
      bounceRate: parseFloat(row.bounceRate || '0') * 100,
      engagedSessions: 0, // Not tracked in current schema
      dateRange: { startDate: startDateStr, endDate: endDateStr },
      source: 'bigquery',
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching GA data from BigQuery:', error);
    return NextResponse.json(
      { 
        error: `BigQuery error: ${error.message || 'Unknown error'}`,
        activeUsers: 0,
        newUsers: 0,
        sessions: 0,
        pageViews: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
        engagedSessions: 0,
      },
      { status: 200 }
    );
  }
}

