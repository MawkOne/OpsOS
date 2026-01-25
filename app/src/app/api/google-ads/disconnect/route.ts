import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // Delete connection
    const connectionRef = doc(db, 'google_ads_connections', organizationId);
    const connectionDoc = await getDoc(connectionRef);
    
    if (connectionDoc.exists()) {
      await deleteDoc(connectionRef);
    }

    // Also delete any pending connections
    const pendingRef = doc(db, 'google_ads_pending', organizationId);
    const pendingDoc = await getDoc(pendingRef);
    
    if (pendingDoc.exists()) {
      await deleteDoc(pendingRef);
    }

    // Optionally delete synced data
    const dataRef = doc(db, 'google_ads_data', organizationId);
    const dataDoc = await getDoc(dataRef);
    
    if (dataDoc.exists()) {
      await deleteDoc(dataRef);
    }

    return NextResponse.json({
      success: true,
      message: 'Google Ads disconnected successfully',
    });

  } catch (error) {
    console.error('Error disconnecting Google Ads:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Disconnect failed' },
      { status: 500 }
    );
  }
}
