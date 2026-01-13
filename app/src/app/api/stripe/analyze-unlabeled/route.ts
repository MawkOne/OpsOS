import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

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

    // Fetch invoices
    const invoicesQuery = query(
      collection(db, 'stripe_invoices'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'paid')
    );
    const invoicesSnap = await getDocs(invoicesQuery);

    const analysis = {
      totalInvoices: invoicesSnap.size,
      withLineItems: 0,
      withoutLineItems: 0,
      unlabeledSamples: [] as any[],
      fieldAnalysis: {
        hasSubscriptionId: 0,
        hasChargeId: 0,
        hasBillingReason: 0,
        hasDescription: 0,
        billingReasons: {} as Record<string, number>,
      }
    };

    invoicesSnap.docs.forEach((doc) => {
      const invoice = doc.data();
      const lineItems = invoice.lineItems || [];

      if (lineItems.length > 0) {
        // Check if line items have productId
        const hasProducts = lineItems.some((item: any) => item.productId);
        if (hasProducts) {
          analysis.withLineItems++;
        } else {
          analysis.withoutLineItems++;
          
          // Collect sample for analysis
          if (analysis.unlabeledSamples.length < 10) {
            analysis.unlabeledSamples.push({
              stripeId: invoice.stripeId,
              total: invoice.total / 100,
              customerId: invoice.customerId,
              customerName: invoice.customerName,
              customerEmail: invoice.customerEmail,
              subscriptionId: invoice.subscriptionId || null,
              chargeId: invoice.chargeId || null,
              billingReason: invoice.billingReason || null,
              description: invoice.description || null,
              lineItems: lineItems.map((item: any) => ({
                description: item.description,
                amount: item.amount / 100,
                type: item.type,
                priceId: item.priceId,
                productId: item.productId,
              })),
            });
          }
        }
      } else {
        analysis.withoutLineItems++;
        
        // Collect sample
        if (analysis.unlabeledSamples.length < 10) {
          analysis.unlabeledSamples.push({
            stripeId: invoice.stripeId,
            total: invoice.total / 100,
            customerId: invoice.customerId,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            subscriptionId: invoice.subscriptionId || null,
            chargeId: invoice.chargeId || null,
            billingReason: invoice.billingReason || null,
            description: invoice.description || null,
            lineItems: [],
          });
        }
      }

      // Field analysis
      if (invoice.subscriptionId) analysis.fieldAnalysis.hasSubscriptionId++;
      if (invoice.chargeId) analysis.fieldAnalysis.hasChargeId++;
      if (invoice.billingReason) {
        analysis.fieldAnalysis.hasBillingReason++;
        analysis.fieldAnalysis.billingReasons[invoice.billingReason] = 
          (analysis.fieldAnalysis.billingReasons[invoice.billingReason] || 0) + 1;
      }
      if (invoice.description) analysis.fieldAnalysis.hasDescription++;
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Error analyzing unlabeled transactions:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
