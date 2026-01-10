import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    const collections = [
      'stripe_payments',
      'stripe_payment_intents',
      'stripe_invoices',
      'stripe_subscriptions',
      'stripe_customers',
      'stripe_products',
      'stripe_prices',
      'stripe_connections',
    ];

    const results: any = {};

    for (const collectionName of collections) {
      try {
        const q = query(
          collection(db, collectionName),
          where('organizationId', '==', organizationId),
          limit(1)
        );
        const snapshot = await getDocs(q);
        
        // Get total count
        const countQuery = query(
          collection(db, collectionName),
          where('organizationId', '==', organizationId)
        );
        const countSnapshot = await getDocs(countQuery);
        
        results[collectionName] = {
          count: countSnapshot.size,
          exists: snapshot.size > 0,
          sample: snapshot.size > 0 ? snapshot.docs[0].data() : null,
        };
      } catch (error: any) {
        results[collectionName] = {
          error: error.message,
        };
      }
    }

    // Also get the connection status
    try {
      const connectionQuery = query(
        collection(db, 'stripe_connections'),
        where('__name__', '==', organizationId)
      );
      const connectionSnap = await getDocs(connectionQuery);
      if (connectionSnap.size > 0) {
        results.connectionStatus = connectionSnap.docs[0].data();
      }
    } catch (error: any) {
      results.connectionStatus = { error: error.message };
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('Debug collections error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

