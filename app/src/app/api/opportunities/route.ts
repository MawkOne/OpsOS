import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Opportunities API
 * GET - List opportunities (reads directly from BigQuery)
 * PATCH - Update opportunity status (updates BigQuery)
 */

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';

function getBigQueryClient() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');
  }
  
  const credentials = JSON.parse(credentialsJson);
  return new BigQuery({
    projectId: PROJECT_ID,
    credentials,
  });
}

// GET /api/opportunities?organizationId=xxx&status=new&priority=high
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const status = searchParams.get('status') || 'new';
  const priority = searchParams.get('priority');
  const category = searchParams.get('category');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    // Build query with filters
    let whereClause = `WHERE organization_id = @organizationId
      AND detected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)`;
    
    if (status && status !== 'all') {
      whereClause += ` AND status = @status`;
    }
    
    if (priority && priority !== 'all') {
      whereClause += ` AND priority = @priority`;
    }
    
    if (category && category !== 'all') {
      whereClause += ` AND category = @category`;
    }

    const query = `
      WITH ranked_opps AS (
        SELECT 
          id,
          organization_id,
          detected_at,
          category,
          type,
          priority,
          COALESCE(status, 'new') as status,
          entity_id,
          entity_type,
          title,
          description,
          evidence,
          metrics,
          hypothesis,
          COALESCE(confidence_score, 0) as confidence_score,
          COALESCE(potential_impact_score, 0) as potential_impact_score,
          COALESCE(urgency_score, 0) as urgency_score,
          recommended_actions,
          estimated_effort,
          estimated_timeline,
          historical_performance,
          comparison_data,
          ROW_NUMBER() OVER (
            PARTITION BY title, entity_id 
            ORDER BY detected_at DESC
          ) as rn
        FROM \`${PROJECT_ID}.${DATASET_ID}.opportunities\`
        ${whereClause}
      )
      SELECT * EXCEPT(rn)
      FROM ranked_opps
      WHERE rn = 1
      ORDER BY 
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        potential_impact_score DESC
      LIMIT 500
    `;

    const params: Record<string, string> = { organizationId };
    if (status && status !== 'all') params.status = status;
    if (priority && priority !== 'all') params.priority = priority;
    if (category && category !== 'all') params.category = category;

    const bigquery = getBigQueryClient();
    const [rows] = await bigquery.query({
      query,
      params,
    });

    // Transform BigQuery rows to API format
    const opportunities = rows.map((row: any) => ({
      id: row.id,
      organization_id: row.organization_id,
      detected_at: row.detected_at?.value || row.detected_at,
      category: row.category,
      type: row.type,
      priority: row.priority,
      status: row.status,
      entity_id: row.entity_id,
      entity_type: row.entity_type,
      title: row.title,
      description: row.description,
      evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence || {},
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics || {},
      hypothesis: row.hypothesis,
      confidence_score: row.confidence_score || 0,
      potential_impact_score: row.potential_impact_score || 0,
      urgency_score: row.urgency_score || 0,
      recommended_actions: row.recommended_actions || [],
      estimated_effort: row.estimated_effort,
      estimated_timeline: row.estimated_timeline,
      historical_performance: typeof row.historical_performance === 'string' 
        ? JSON.parse(row.historical_performance) 
        : row.historical_performance || {},
      comparison_data: typeof row.comparison_data === 'string' 
        ? JSON.parse(row.comparison_data) 
        : row.comparison_data || {},
    }));

    return NextResponse.json({
      opportunities,
      total: opportunities.length
    });

  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    
    // Check if it's a credentials issue
    if (error.message?.includes('GOOGLE_APPLICATION_CREDENTIALS_JSON')) {
      return NextResponse.json(
        { error: 'BigQuery credentials not configured', details: error.message, opportunities: [], total: 0 },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch opportunities', details: String(error), opportunities: [], total: 0 },
      { status: 500 }
    );
  }
}

// PATCH /api/opportunities - Update opportunity status in BigQuery
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, dismissed_by, dismissed_reason } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing opportunity id' },
      { status: 400 }
    );
  }

  try {
    let updateFields = [`status = @status`, `updated_at = CURRENT_TIMESTAMP()`];
    const params: Record<string, string> = { id, status };
    
    if (status === 'dismissed') {
      updateFields.push(`dismissed_at = CURRENT_TIMESTAMP()`);
      if (dismissed_by) {
        updateFields.push(`dismissed_by = @dismissed_by`);
        params.dismissed_by = dismissed_by;
      }
      if (dismissed_reason) {
        updateFields.push(`dismissed_reason = @dismissed_reason`);
        params.dismissed_reason = dismissed_reason;
      }
    }
    
    if (status === 'completed') {
      updateFields.push(`completed_at = CURRENT_TIMESTAMP()`);
    }

    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.opportunities\`
      SET ${updateFields.join(', ')}
      WHERE id = @id
    `;

    const bigquery = getBigQueryClient();
    await bigquery.query({ query, params });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}
