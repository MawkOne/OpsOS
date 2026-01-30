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
  const viewMode = searchParams.get('viewMode') || 'ttm';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const limit = parseInt(searchParams.get('limit') || '10000');
  
  console.log('[GA Pages API - BigQuery] Request params:', { organizationId, viewMode, year, limit });

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    const bq = getBigQueryClient();
    
    // Calculate date range
    const now = new Date();
    let startDate: string;
    let endDate: string;
    
    if (viewMode === 'ttm') {
      // Trailing 12 months
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      startDate = start.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else {
      // Specific year
      startDate = `${year}-01-01`;
      endDate = year === now.getFullYear() 
        ? now.toISOString().split('T')[0]
        : `${year}-12-31`;
    }

    // Query BigQuery for page data
    // Pages are stored with entity_type = 'page' from the GA4 sync
    const query = `
      SELECT 
        seo_url as page_path,
        entity_name as page_title,
        COALESCE(page_views, 0) as pageviews,
        COALESCE(active_users, 0) as users,
        COALESCE(avg_session_duration, 0) as avg_time_on_page,
        COALESCE(bounce_rate, 0) as bounce_rate,
        date,
        FORMAT_DATE('%Y-%m', DATE(date)) as month_key
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE organization_id = @organizationId
        AND data_source = 'ga4'
        AND entity_type = 'page'
        AND date >= @startDate
        AND date <= @endDate
      ORDER BY pageviews DESC
    `;

    const options = {
      query,
      params: {
        organizationId,
        startDate,
        endDate,
      },
    };

    const [rows] = await bq.query(options);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { 
          error: 'No page data found in BigQuery. Please sync GA4 data first.',
          hint: 'Go to Sources > Google Analytics and click "Sync to BigQuery"',
          pages: [],
          months: [],
        },
        { status: 200 }
      );
    }

    // Group by page path and aggregate by month
    const pageData: Record<string, {
      id: string;
      name: string;
      months: Record<string, {
        pageviews: number;
        sessions: number;
        avgTimeOnPage: number;
      }>;
    }> = {};

    // Collect unique months
    const monthSet = new Set<string>();

    for (const row of rows) {
      const pagePath = row.page_path || '/';
      const pageId = pagePath.toLowerCase().replace(/\//g, '_').replace(/[^a-z0-9_]/g, '') || 'homepage';
      const monthKey = row.month_key;
      
      monthSet.add(monthKey);

      if (!pageData[pageId]) {
        pageData[pageId] = {
          id: pageId,
          name: pagePath === '/' ? 'Homepage' : pagePath,
          months: {},
        };
      }

      // Aggregate data for this month (in case there are multiple rows per page per month)
      if (!pageData[pageId].months[monthKey]) {
        pageData[pageId].months[monthKey] = {
          pageviews: 0,
          sessions: 0,
          avgTimeOnPage: 0,
        };
      }

      pageData[pageId].months[monthKey].pageviews += parseInt(row.pageviews || 0);
      pageData[pageId].months[monthKey].sessions += parseInt(row.users || 0); // Using users as proxy for sessions
      pageData[pageId].months[monthKey].avgTimeOnPage = parseFloat(row.avg_time_on_page || 0);
    }

    // Convert to array and sort by total pageviews
    const result = Object.values(pageData)
      .map(page => {
        const totalPageviews = Object.values(page.months).reduce((sum, m) => sum + m.pageviews, 0);
        return { ...page, totalPageviews };
      })
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, limit)
      .map(({ totalPageviews, ...page }) => page); // Remove totalPageviews helper field

    const months = Array.from(monthSet).sort();
    
    console.log(`[GA Pages API - BigQuery] Returning ${result.length} pages from BigQuery`);
    console.log(`[GA Pages API - BigQuery] Pages with /blog prefix:`, result.filter((p: any) => p.name.startsWith('/blog')).length);

    return NextResponse.json(
      {
        pages: result,
        months,
        source: 'bigquery',
        _meta: {
          version: 'v3-bigquery',
          totalPages: result.length,
          blogPages: result.filter((p: any) => p.name.startsWith('/blog')).length,
          dateRange: { startDate, endDate },
        }
      },
      {
        headers: {
          'X-API-Version': 'v3-bigquery',
          'X-Data-Source': 'bigquery',
        }
      }
    );

  } catch (error) {
    console.error('Error fetching pages from BigQuery:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page data from BigQuery' }, 
      { status: 500 }
    );
  }
}
