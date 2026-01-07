import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId parameter' },
        { status: 400 }
      );
    }

    // Check if connection exists
    const connectionRef = doc(db, 'stripe_connections', organizationId);
    const connectionSnapshot = await getDoc(connectionRef);

    if (!connectionSnapshot.exists() || connectionSnapshot.data()?.status !== 'connected') {
      return NextResponse.json(
        { error: 'Stripe not connected' },
        { status: 404 }
      );
    }

    // Get all active subscriptions to calculate MRR
    const subsQuery = query(
      collection(db, 'stripe_subscriptions'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'active')
    );
    const subsSnapshot = await getDocs(subsQuery);

    let mrr = 0;
    let activeSubscriptions = 0;

    subsSnapshot.forEach((doc) => {
      const sub = doc.data();
      mrr += sub.mrr || 0;
      activeSubscriptions++;
    });

    // Get total customers
    const customersQuery = query(
      collection(db, 'stripe_customers'),
      where('organizationId', '==', organizationId)
    );
    const customersSnapshot = await getDocs(customersQuery);
    const totalCustomers = customersSnapshot.size;

    // Get total revenue from payments
    const paymentsQuery = query(
      collection(db, 'stripe_payments'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'succeeded')
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    
    let totalRevenue = 0;
    let paymentCount = 0;
    paymentsSnapshot.forEach((doc) => {
      const payment = doc.data();
      totalRevenue += payment.amount || 0;
      paymentCount++;
    });

    // Calculate metrics
    const arr = mrr * 12;
    const averageRevenuePerUser = totalCustomers > 0 ? mrr / totalCustomers : 0;

    // Get canceled subscriptions for churn calculation (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceledQuery = query(
      collection(db, 'stripe_subscriptions'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'canceled')
    );
    const canceledSnapshot = await getDocs(canceledQuery);
    
    let recentlyCanceled = 0;
    canceledSnapshot.forEach((doc) => {
      const sub = doc.data();
      if (sub.canceledAt?.toDate() >= thirtyDaysAgo) {
        recentlyCanceled++;
      }
    });

    // Simple churn rate calculation
    const totalSubsEver = subsSnapshot.size + canceledSnapshot.size;
    const churnRate = totalSubsEver > 0 ? (recentlyCanceled / totalSubsEver) * 100 : 0;

    const metrics = {
      mrr,
      arr,
      activeSubscriptions,
      totalCustomers,
      totalRevenue: totalRevenue / 100, // Convert from cents
      paymentCount,
      churnRate: parseFloat(churnRate.toFixed(2)),
      averageRevenuePerUser: parseFloat(averageRevenuePerUser.toFixed(2)),
      lastCalculatedAt: new Date().toISOString(),
    };

    // Cache the metrics
    const metricsRef = doc(db, 'stripe_metrics', organizationId);
    await setDoc(metricsRef, {
      ...metrics,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Stripe metrics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate metrics' },
      { status: 500 }
    );
  }
}

