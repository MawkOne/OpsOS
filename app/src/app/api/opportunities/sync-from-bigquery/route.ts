import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Sync opportunities from BigQuery to Firestore
 * This is a workaround since Cloud Function Firestore writes may fail
 * POST /api/opportunities/sync-from-bigquery
 */
export async function POST(request: NextRequest) {
  const { organizationId } = await request.json();

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    // Query BigQuery for opportunities
    const BigQuery = require('@google-cloud/bigquery').BigQuery;
    const bigquery = new BigQuery({ projectId: 'opsos-864a1' });

    const query = `
      SELECT *
      FROM \`opsos-864a1.marketing_ai.opportunities\`
      WHERE organization_id = @organizationId
      ORDER BY detected_at DESC
      LIMIT 100
    `;

    const options = {
      query: query,
      params: { organizationId: organizationId },
    };

    const [rows] = await bigquery.query(options);

    // Write to Firestore
    let count = 0;
    for (const row of rows) {
      const docRef = doc(db, 'opportunities', row.id);
      await setDoc(docRef, {
        ...row,
        // Convert BigQuery types to Firestore-friendly types
        detected_at: row.detected_at?.value || new Date().toISOString(),
        created_at: row.created_at?.value || new Date().toISOString(),
        updated_at: row.updated_at?.value || new Date().toISOString(),
        dismissed_at: row.dismissed_at?.value || null,
        completed_at: row.completed_at?.value || null,
      });
      count++;
    }

    return NextResponse.json({
      success: true,
      synced: count,
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
