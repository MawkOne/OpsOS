import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit as firestoreLimit } from 'firebase/firestore';

/**
 * Opportunities API
 * GET - List opportunities (reads from Firestore - synced from BigQuery)
 * PATCH - Update opportunity status
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
    // Read from Firestore instead of BigQuery (works better in serverless)
    let q = query(
      collection(db, 'opportunities'),
      where('organization_id', '==', organizationId)
    );

    if (status && status !== 'all') {
      q = query(q, where('status', '==', status));
    }

    if (priority && priority !== 'all') {
      q = query(q, where('priority', '==', priority));
    }

    if (category && category !== 'all') {
      q = query(q, where('category', '==', category));
    }

    // Limit to 100 opportunities
    q = query(q, firestoreLimit(100));

    const snapshot = await getDocs(q);
    
    // Filter to only show opportunities from last 7 days (removes old pre-priority-pages data)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const opportunities = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          organization_id: data.organization_id,
          detected_at: data.detected_at,
          category: data.category,
          type: data.type,
          priority: data.priority,
          status: data.status || 'new',
          entity_id: data.entity_id,
          entity_type: data.entity_type,
          title: data.title,
          description: data.description,
          evidence: data.evidence || {},
          metrics: data.metrics || {},
          hypothesis: data.hypothesis,
          confidence_score: data.confidence_score || 0,
          potential_impact_score: data.potential_impact_score || 0,
          urgency_score: data.urgency_score || 0,
          recommended_actions: data.recommended_actions || [],
          estimated_effort: data.estimated_effort,
          estimated_timeline: data.estimated_timeline,
          historical_performance: data.historical_performance || {},
          comparison_data: data.comparison_data || {},
        };
      })
      .filter(opp => {
        // Only show opportunities from last 7 days
        if (!opp.detected_at) return false;
        const detectedDate = new Date(opp.detected_at);
        return detectedDate >= sevenDaysAgo;
      });

    // Sort by impact score (client-side since Firestore has limited ordering with filters)
    opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.potential_impact_score - a.potential_impact_score;
    });

    return NextResponse.json({
      opportunities,
      total: opportunities.length
    });

  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities', details: String(error), opportunities: [], total: 0 },
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
