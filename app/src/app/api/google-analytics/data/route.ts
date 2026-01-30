import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

// Initialize BigQuery client
function getBigQueryClient() {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentials) {
    return new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });
  }
  return new BigQuery({ projectId: PROJECT_ID });
}

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
    const bq = getBigQueryClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Query BigQuery for aggregated GA4 metrics
    const query = `
      SELECT 
        SUM(active_users) as activeUsers,
        SUM(new_users) as newUsers,
        SUM(sessions) as sessions,
        SUM(page_views) as pageViews,
        AVG(avg_session_duration) as avgSessionDuration,
        AVG(bounce_rate) as bounceRate,
        SUM(engaged_sessions) as engagedSessions
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE organization_id = @organizationId
        AND data_source = 'ga4'
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
          hint: 'Click "Sync to BigQuery" to pull data from Google Analytics.'
        },
        { status: 404 }
      );
    }

    const row = rows[0];
    const result = {
      activeUsers: parseInt(row.activeUsers || '0'),
      newUsers: parseInt(row.newUsers || '0'),
      sessions: parseInt(row.sessions || '0'),
      pageViews: parseInt(row.pageViews || '0'),
      avgSessionDuration: parseFloat(row.avgSessionDuration || '0'),
      bounceRate: parseFloat(row.bounceRate || '0') * 100,
      engagedSessions: parseInt(row.engagedSessions || '0'),
      dateRange: { startDate: startDateStr, endDate: endDateStr },
      source: 'bigquery', // Indicate data is from BigQuery
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching GA data from BigQuery:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data from BigQuery' },
      { status: 500 }
    );
  }
}

