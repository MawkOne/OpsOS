import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId' },
        { status: 400 }
      );
    }

    // Update connection status to disconnected
    const connectionRef = doc(db, 'stripe_connections', organizationId);
    await setDoc(connectionRef, {
      status: 'disconnected',
      updatedAt: serverTimestamp(),
      disconnectedAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Stripe disconnect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect Stripe' },
      { status: 500 }
    );
  }
}

