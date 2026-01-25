import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Entity Map API
 * GET - List all entity mappings
 * POST - Create new mapping
 */

// GET /api/entity-map?organizationId=xxx&entityType=page
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const entityType = searchParams.get('entityType'); // optional filter

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    let q = query(
      collection(db, 'entity_map'),
      where('organizationId', '==', organizationId)
    );

    if (entityType) {
      q = query(q, where('entity_type', '==', entityType));
    }

    const snapshot = await getDocs(q);
    const mappings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Group by canonical_entity_id
    const grouped: Record<string, any> = {};
    mappings.forEach((mapping: any) => {
      const canonicalId = mapping.canonical_entity_id;
      if (!grouped[canonicalId]) {
        grouped[canonicalId] = {
          canonical_entity_id: canonicalId,
          entity_type: mapping.entity_type,
          sources: []
        };
      }
      grouped[canonicalId].sources.push({
        source: mapping.source,
        source_entity_id: mapping.source_entity_id,
        source_metadata: mapping.source_metadata
      });
    });

    return NextResponse.json({
      mappings: Object.values(grouped),
      total: Object.keys(grouped).length
    });

  } catch (error) {
    console.error('Error fetching entity mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity mappings' },
      { status: 500 }
    );
  }
}

// POST /api/entity-map - Create new mapping
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    organizationId,
    canonical_entity_id,
    entity_type,
    source,
    source_entity_id,
    source_metadata
  } = body;

  if (!organizationId || !canonical_entity_id || !entity_type || !source || !source_entity_id) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const doc_id = `${canonical_entity_id}_${source}`;
    const docRef = doc(db, 'entity_map', doc_id);

    await setDoc(docRef, {
      organizationId,
      canonical_entity_id,
      entity_type,
      source,
      source_entity_id,
      source_metadata: source_metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      id: doc_id
    });

  } catch (error) {
    console.error('Error creating entity mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create entity mapping' },
      { status: 500 }
    );
  }
}

// DELETE /api/entity-map - Delete mapping
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Missing mapping id' },
      { status: 400 }
    );
  }

  try {
    await deleteDoc(doc(db, 'entity_map', id));

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Error deleting entity mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete entity mapping' },
      { status: 500 }
    );
  }
}
