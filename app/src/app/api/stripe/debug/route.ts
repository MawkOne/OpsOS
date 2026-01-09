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
    // Sample products
    const productsQuery = query(
      collection(db, 'stripe_products'),
      where('organizationId', '==', organizationId),
      limit(10)
    );
    const productsSnap = await getDocs(productsQuery);
    const products = productsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sample payments with line items
    const paymentsQuery = query(
      collection(db, 'stripe_payments'),
      where('organizationId', '==', organizationId),
      limit(10)
    );
    const paymentsSnap = await getDocs(paymentsQuery);
    const payments = paymentsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        stripeId: data.stripeId,
        amount: data.amount,
        status: data.status,
        hasLineItems: !!(data.lineItems && data.lineItems.length > 0),
        lineItemsCount: data.lineItems?.length || 0,
        lineItems: data.lineItems || [],
        invoiceId: data.invoiceId,
        subscriptionId: data.subscriptionId || null,
        description: data.description,
      };
    });

    // Sample subscriptions
    const subsQuery = query(
      collection(db, 'stripe_subscriptions'),
      where('organizationId', '==', organizationId),
      limit(10)
    );
    const subsSnap = await getDocs(subsQuery);
    const subscriptions = subsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        stripeId: data.stripeId,
        status: data.status,
        items: data.items || [],
        mrr: data.mrr,
      };
    });

    // Sample invoices (key for product attribution)
    const invoicesQuery = query(
      collection(db, 'stripe_invoices'),
      where('organizationId', '==', organizationId),
      limit(10)
    );
    const invoicesSnap = await getDocs(invoicesQuery);
    const invoices = invoicesSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        stripeId: data.stripeId,
        amount: data.amount,
        status: data.status,
        hasLineItems: !!(data.lineItems && data.lineItems.length > 0),
        lineItemsCount: data.lineItems?.length || 0,
        lineItems: data.lineItems || [],
        subscriptionId: data.subscriptionId,
      };
    });

    // Counts
    const counts = {
      products: productsSnap.size,
      payments: paymentsSnap.size,
      subscriptions: subsSnap.size,
      invoices: invoicesSnap.size,
    };

    return NextResponse.json({
      counts,
      products,
      payments,
      subscriptions,
      invoices,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

