import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit } from 'firebase/firestore';

/**
 * Opportunities API
 * GET - List opportunities
 * PATCH - Update opportunity status
 */

// GET /api/opportunities?organizationId=xxx&status=new&priority=high
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const category = searchParams.get('category');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    let q = query(
      collection(db, 'opportunities'),
      where('organization_id', '==', organizationId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    if (priority) {
      q = query(q, where('priority', '==', priority));
    }

    if (category) {
      q = query(q, where('category', '==', category));
    }

    // Order by detected_at descending
    q = query(q, orderBy('detected_at', 'desc'), limit(100));

    const snapshot = await getDocs(q);
    const opportunities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      opportunities,
      total: opportunities.length
    });

  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities' },
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
