import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit as firestoreLimit } from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // Get recent payments (last 30 days from Dec 2025)
    const thirtyDaysAgo = new Date('2025-12-01');
    
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(1000)
    );

    const paymentsSnap = await getDocs(paymentsQuery);
    
    // Filter to last 30 days in code
    const recentPayments = paymentsSnap.docs.filter(doc => {
      const payment = doc.data();
      const paymentDate = payment.created?.toDate?.() || new Date(0);
      return paymentDate >= thirtyDaysAgo;
    });
    
    let withLineItems = 0;
    let withoutLineItems = 0;
    let withoutLineItemsButHasSubscriptionId = 0;
    let withoutLineItemsAndNoSubscriptionId = 0;
    
    const samples = {
      withSubscriptionId: [] as any[],
      withoutSubscriptionId: [] as any[],
    };

    for (const doc of recentPayments) {
      const payment = doc.data();
      
      if (payment.lineItems && payment.lineItems.length > 0) {
        withLineItems++;
        continue;
      }
      
      withoutLineItems++;
      
      const paymentDate = payment.created?.toDate?.();
      
      if (payment.subscriptionId) {
        withoutLineItemsButHasSubscriptionId++;
        if (samples.withSubscriptionId.length < 5) {
          samples.withSubscriptionId.push({
            paymentId: payment.stripeId,
            subscriptionId: payment.subscriptionId,
            amount: payment.amount / 100,
            description: payment.description || null,
            date: paymentDate ? paymentDate.toISOString().split('T')[0] : null,
          });
        }
      } else {
        withoutLineItemsAndNoSubscriptionId++;
        if (samples.withoutSubscriptionId.length < 5) {
          samples.withoutSubscriptionId.push({
            paymentId: payment.stripeId,
            amount: payment.amount / 100,
            description: payment.description || null,
            metadata: payment.metadata || {},
            date: paymentDate ? paymentDate.toISOString().split('T')[0] : null,
          });
        }
      }
    }

    return NextResponse.json({
      summary: {
        dateFilter: "Dec 1, 2025 onwards",
        totalPaymentsFetched: paymentsSnap.size,
        recentPaymentsChecked: recentPayments.length,
        withLineItems,
        withoutLineItems,
        withoutLineItemsButHasSubscriptionId,
        withoutLineItemsAndNoSubscriptionId,
        subscriptionIdRate: withoutLineItems > 0
          ? `${((withoutLineItemsButHasSubscriptionId / withoutLineItems) * 100).toFixed(1)}%`
          : "0%",
      },
      samples,
    });

  } catch (error: any) {
    console.error("Subscription link check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

