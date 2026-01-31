import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const organizationId = searchParams.get('organizationId');
  const entityTypes = searchParams.get('entityTypes'); // comma-separated
  const metricType = searchParams.get('metricType'); // revenue, expenses, etc.
  const viewMode = searchParams.get('viewMode') || 'ttm'; // ttm, ytd, all
  
  console.log('[BigQuery Metrics API] Request:', { organizationId, entityTypes, viewMode });
  
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Dynamically import BigQuery to avoid build issues
    const { BigQuery } = await import('@google-cloud/bigquery');
    
    // Check for credentials
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      console.error('[BigQuery Metrics API] Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env var');
      return NextResponse.json(
        { 
          error: 'BigQuery credentials not configured',
          entities: [],
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
      console.error('[BigQuery Metrics API] Failed to parse credentials:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid BigQuery credentials format',
          entities: [],
        },
        { status: 200 }
      );
    }
    
    // Calculate date range based on viewMode
    const now = new Date();
    let startDate: string | null = null;
    
    if (viewMode === 'ttm') {
      // Trailing twelve months
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      startDate = twelveMonthsAgo.toISOString().split('T')[0];
    } else if (viewMode === 'ytd') {
      // Year to date
      startDate = `${now.getFullYear()}-01-01`;
    }
    // 'all' = no date filter (startDate stays null)
    
    // Build entity type filter
    const entityTypesList = entityTypes ? entityTypes.split(',').map(t => t.trim()) : null;
    
    // Query BigQuery for aggregated monthly data
    // Use parameterized query for safety
    let query = `
      SELECT 
        entity_type,
        canonical_entity_id,
        FORMAT_DATE('%Y-%m', date) as month,
        SUM(COALESCE(revenue, 0)) as revenue,
        SUM(COALESCE(sessions, 0)) as sessions,
        SUM(COALESCE(users, 0)) as users,
        SUM(COALESCE(pageviews, 0)) as pageviews,
        SUM(COALESCE(conversions, 0)) as conversions,
        MAX(source_breakdown) as source_breakdown
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE organization_id = @organizationId
    `;
    
    const params: Record<string, any> = { organizationId };
    
    if (startDate) {
      query += ` AND date >= @startDate`;
      params.startDate = startDate;
    }
    
    if (entityTypesList && entityTypesList.length > 0) {
      query += ` AND entity_type IN UNNEST(@entityTypes)`;
      params.entityTypes = entityTypesList;
    }
    
    query += ` GROUP BY entity_type, canonical_entity_id, month ORDER BY entity_type, canonical_entity_id, month`;
    
    console.log('[BigQuery Metrics API] Query:', query);
    console.log('[BigQuery Metrics API] Params:', params);
    
    const [rows] = await bq.query({ query, params });
    
    // Transform into entity-centric structure with monthly data
    const entities: Record<string, {
      entityId: string;
      entityType: string;
      months: Record<string, {
        revenue: number;
        sessions: number;
        users: number;
        pageviews: number;
        conversions: number;
      }>;
      totals: {
        revenue: number;
        sessions: number;
        users: number;
        pageviews: number;
        conversions: number;
      };
      sourceBreakdown?: any;
    }> = {};
    
    for (const row of rows) {
      const key = `${row.entity_type}_${row.canonical_entity_id}`;
      
      if (!entities[key]) {
        entities[key] = {
          entityId: row.canonical_entity_id,
          entityType: row.entity_type,
          months: {},
          totals: { revenue: 0, sessions: 0, users: 0, pageviews: 0, conversions: 0 },
          sourceBreakdown: row.source_breakdown ? JSON.parse(row.source_breakdown) : null,
        };
      }
      
      entities[key].months[row.month] = {
        revenue: row.revenue || 0,
        sessions: row.sessions || 0,
        users: row.users || 0,
        pageviews: row.pageviews || 0,
        conversions: row.conversions || 0,
      };
      
      // Accumulate totals
      entities[key].totals.revenue += row.revenue || 0;
      entities[key].totals.sessions += row.sessions || 0;
      entities[key].totals.users += row.users || 0;
      entities[key].totals.pageviews += row.pageviews || 0;
      entities[key].totals.conversions += row.conversions || 0;
    }
    
    // Filter by metric type if specified
    let filteredEntities = Object.values(entities);
    
    if (metricType === 'revenue') {
      filteredEntities = filteredEntities.filter(e => 
        e.totals.revenue > 0 || e.entityType === 'revenue'
      );
    }
    
    return NextResponse.json({
      success: true,
      entities: filteredEntities,
      count: filteredEntities.length,
      viewMode,
    });
    
  } catch (error: any) {
    console.error('[BigQuery Metrics API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch metrics',
        entities: [],
      },
      { status: 200 }
    );
  }
}
