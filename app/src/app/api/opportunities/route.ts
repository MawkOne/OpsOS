import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Opportunities API
 * GET - List opportunities (reads from BigQuery)
 * PATCH - Update opportunity status (writes to Firestore + BigQuery)
 */

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
    const BigQuery = require('@google-cloud/bigquery').BigQuery;
    const bigquery = new BigQuery({ projectId: 'opsos-864a1' });

    // Build WHERE clauses
    const whereClauses = [`organization_id = @organizationId`];
    if (status && status !== 'all') {
      whereClauses.push(`status = @status`);
    }
    if (priority && priority !== 'all') {
      whereClauses.push(`priority = @priority`);
    }
    if (category && category !== 'all') {
      whereClauses.push(`category = @category`);
    }

    const query = `
      SELECT 
        id, organization_id, detected_at, category, type, priority, status,
        entity_id, entity_type, title, description,
        JSON_VALUE(evidence) as evidence_json,
        JSON_VALUE(metrics) as metrics_json,
        hypothesis, confidence_score, potential_impact_score, urgency_score,
        recommended_actions, estimated_effort, estimated_timeline,
        JSON_VALUE(historical_performance) as historical_performance_json,
        JSON_VALUE(comparison_data) as comparison_data_json,
        created_at, updated_at
      FROM \`opsos-864a1.marketing_ai.opportunities\`
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY potential_impact_score DESC, detected_at DESC
      LIMIT 100
    `;

    const params = {
      organizationId,
      ...(status && status !== 'all' && { status }),
      ...(priority && priority !== 'all' && { priority }),
      ...(category && category !== 'all' && { category }),
    };

    const [rows] = await bigquery.query({ query, params });

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
      evidence: row.evidence_json ? JSON.parse(row.evidence_json) : {},
      metrics: row.metrics_json ? JSON.parse(row.metrics_json) : {},
      hypothesis: row.hypothesis,
      confidence_score: row.confidence_score,
      potential_impact_score: row.potential_impact_score,
      urgency_score: row.urgency_score,
      recommended_actions: row.recommended_actions || [],
      estimated_effort: row.estimated_effort,
      estimated_timeline: row.estimated_timeline,
      historical_performance: row.historical_performance_json ? JSON.parse(row.historical_performance_json) : {},
      comparison_data: row.comparison_data_json ? JSON.parse(row.comparison_data_json) : {},
    }));

    return NextResponse.json({
      opportunities,
      total: opportunities.length
    });

  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/opportunities - Update opportunity
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
    const docRef = doc(db, 'opportunities', id);
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (status) {
      updates.status = status;
      
      if (status === 'dismissed') {
        updates.dismissed_at = new Date().toISOString();
        if (dismissed_by) updates.dismissed_by = dismissed_by;
        if (dismissed_reason) updates.dismissed_reason = dismissed_reason;
      }
      
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }

    await updateDoc(docRef, updates);

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Error updating opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}
