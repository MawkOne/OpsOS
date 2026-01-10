import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit as firestoreLimit, orderBy } from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // Get most recent payments
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(100)
    );

    const paymentsSnap = await getDocs(paymentsQuery);
    
    const dates = paymentsSnap.docs.map(doc => {
      const payment = doc.data();
      return payment.created?.toDate?.() || new Date(0);
    }).sort((a, b) => b.getTime() - a.getTime()); // Sort newest first

    const newestDate = dates[0];
    const oldestInSample = dates[dates.length - 1];

    // Get sample of most recent payments
    const recentSamples = paymentsSnap.docs
      .map(doc => {
        const payment = doc.data();
        return {
          paymentId: payment.stripeId,
          amount: payment.amount / 100,
          date: payment.created?.toDate?.()?.toISOString() || null,
          subscriptionId: payment.subscriptionId || null,
          invoiceId: payment.invoiceId || null,
          paymentIntentId: payment.paymentIntentId || null,
          lineItemsCount: payment.lineItems?.length || 0,
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        paymentsChecked: paymentsSnap.size,
        newestPaymentDate: newestDate.toISOString().split('T')[0],
        oldestInSample: oldestInSample.toISOString().split('T')[0],
      },
      recentSamples,
    });

  } catch (error: any) {
    console.error("Date range check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

