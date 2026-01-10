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

    // Get payments without line items
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(500)
    );

    const paymentsSnap = await getDocs(paymentsQuery);
    
    let withLineItems = 0;
    let withoutLineItems = 0;
    let withoutLineItemsButHasSubscriptionId = 0;
    let withoutLineItemsAndNoSubscriptionId = 0;
    
    const samples = {
      withSubscriptionId: [] as any[],
      withoutSubscriptionId: [] as any[],
    };

    for (const doc of paymentsSnap.docs) {
      const payment = doc.data();
      
      if (payment.lineItems && payment.lineItems.length > 0) {
        withLineItems++;
        continue;
      }
      
      withoutLineItems++;
      
      if (payment.subscriptionId) {
        withoutLineItemsButHasSubscriptionId++;
        if (samples.withSubscriptionId.length < 5) {
          samples.withSubscriptionId.push({
            paymentId: payment.stripeId,
            subscriptionId: payment.subscriptionId,
            amount: payment.amount / 100,
            description: payment.description || null,
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
          });
        }
      }
    }

    return NextResponse.json({
      summary: {
        paymentsChecked: paymentsSnap.size,
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

