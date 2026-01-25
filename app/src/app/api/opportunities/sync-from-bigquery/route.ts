import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Sync opportunities from BigQuery to Firestore
 * Run this once to populate Firestore with BigQuery data
 * POST /api/opportunities/sync-from-bigquery
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId' },
        { status: 400 }
      );
    }

    // Query BigQuery for opportunities
    const { BigQuery } = await import('@google-cloud/bigquery');
    const bigquery = new BigQuery({ 
      projectId: 'opsos-864a1',
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    const query = `
      SELECT 
        id, organization_id, detected_at, category, type, priority, status,
        entity_id, entity_type, title, description,
        TO_JSON_STRING(evidence) as evidence_json,
        TO_JSON_STRING(metrics) as metrics_json,
        hypothesis, confidence_score, potential_impact_score, urgency_score,
        recommended_actions, estimated_effort, estimated_timeline,
        TO_JSON_STRING(historical_performance) as historical_performance_json,
        TO_JSON_STRING(comparison_data) as comparison_data_json,
        created_at, updated_at
      FROM \`opsos-864a1.marketing_ai.opportunities\`
      WHERE organization_id = @organizationId
      ORDER BY detected_at DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({
      query,
      params: { organizationId }
    });

    console.log(`Fetched ${rows.length} opportunities from BigQuery`);

    // Write to Firestore
    let count = 0;
    const errors = [];
    
    for (const row of rows) {
      try {
        const docRef = doc(db, 'opportunities', row.id);
        
        // Parse JSON strings
        const evidence = row.evidence_json ? JSON.parse(row.evidence_json) : {};
        const metrics = row.metrics_json ? JSON.parse(row.metrics_json) : {};
        const historical_performance = row.historical_performance_json ? JSON.parse(row.historical_performance_json) : {};
        const comparison_data = row.comparison_data_json ? JSON.parse(row.comparison_data_json) : {};
        
        await setDoc(docRef, {
          id: row.id,
          organization_id: row.organization_id,
          detected_at: row.detected_at?.value || row.detected_at || new Date().toISOString(),
          category: row.category,
          type: row.type,
          priority: row.priority,
          status: row.status || 'new',
          entity_id: row.entity_id,
          entity_type: row.entity_type,
          title: row.title,
          description: row.description,
          evidence,
          metrics,
          hypothesis: row.hypothesis,
          confidence_score: row.confidence_score || 0,
          potential_impact_score: row.potential_impact_score || 0,
          urgency_score: row.urgency_score || 0,
          recommended_actions: row.recommended_actions || [],
          estimated_effort: row.estimated_effort,
          estimated_timeline: row.estimated_timeline,
          historical_performance,
          comparison_data,
          created_at: row.created_at?.value || row.created_at || new Date().toISOString(),
          updated_at: row.updated_at?.value || row.updated_at || new Date().toISOString(),
        });
        count++;
      } catch (err) {
        errors.push({ id: row.id, error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      synced: count,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
      organizationId
    });

  } catch (error) {
    console.error('Error syncing from BigQuery:', error);
    return NextResponse.json(
      { error: 'Failed to sync from BigQuery', details: String(error) },
      { status: 500 }
    );
  }
}
