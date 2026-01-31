import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

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
    // Dynamically import BigQuery to avoid build issues
    const { BigQuery } = await import('@google-cloud/bigquery');
    
    // Check for credentials
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      console.error('[GA Pages API] Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env var');
      return NextResponse.json(
        { 
          error: 'BigQuery credentials not configured',
          hint: 'Set GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable in Vercel',
          pages: [],
          months: [],
        },
        { status: 200 }
      );
    }

    let bq;
    try {
      bq = new BigQuery({
        projectId: PROJECT_ID,
        credentials: JSON.parse(credentials),
      });
    } catch (parseError) {
      console.error('[GA Pages API] Failed to parse credentials:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid BigQuery credentials format',
          pages: [],
          months: [],
        },
        { status: 200 }
      );
    }
    
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
    // canonical_entity_id contains the page path
    const query = `
      SELECT 
        canonical_entity_id as page_path,
        COALESCE(pageviews, 0) as pageviews,
        COALESCE(users, 0) as users,
        COALESCE(avg_session_duration, 0) as avg_time_on_page,
        COALESCE(bounce_rate, 0) as bounce_rate,
        date,
        FORMAT_DATE('%Y-%m', DATE(date)) as month_key
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE organization_id = @organizationId
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

  } catch (error: any) {
    console.error('Error fetching pages from BigQuery:', error);
    
    // Return helpful error with empty pages array so UI doesn't break
    return NextResponse.json(
      { 
        error: `BigQuery error: ${error.message || 'Unknown error'}`,
        hint: 'Make sure GA4 data has been synced to BigQuery first',
        pages: [],
        months: [],
      }, 
      { status: 200 }
    );
  }
}
