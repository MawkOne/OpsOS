import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

function getBigQueryClient() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');
  }
  
  try {
    const credentials = JSON.parse(credentialsJson);
    return new BigQuery({
      projectId: PROJECT_ID,
      credentials,
    });
  } catch (e) {
    throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format');
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const organizationId = searchParams.get('organizationId');
  const entityTypes = searchParams.get('entityTypes'); // comma-separated
  const metricType = searchParams.get('metricType'); // revenue, expenses, etc.
  const viewMode = searchParams.get('viewMode') || 'ttm'; // ttm, ytd, all
  
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    const bq = getBigQueryClient();
    
    // Build date filter based on viewMode
    let dateFilter = '';
    const now = new Date();
    
    if (viewMode === 'ttm') {
      // Trailing twelve months
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      dateFilter = `AND date >= '${twelveMonthsAgo.toISOString().split('T')[0]}'`;
    } else if (viewMode === 'ytd') {
      // Year to date
      dateFilter = `AND date >= '${now.getFullYear()}-01-01'`;
    }
    // 'all' = no date filter
    
    // Build entity type filter
    let entityTypeFilter = '';
    if (entityTypes) {
      const types = entityTypes.split(',').map(t => `'${t.trim()}'`).join(',');
      entityTypeFilter = `AND entity_type IN (${types})`;
    }
    
    // Query BigQuery for aggregated monthly data
    const query = `
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
      WHERE organization_id = '${organizationId}'
        ${dateFilter}
        ${entityTypeFilter}
      GROUP BY entity_type, canonical_entity_id, month
      ORDER BY entity_type, canonical_entity_id, month
    `;
    
    const [rows] = await bq.query({ query });
    
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
    console.error('BigQuery metrics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
