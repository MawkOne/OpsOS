import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit, Timestamp } from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // Get recent successful payments (2025-2026)
    const startDate = Timestamp.fromDate(new Date('2025-01-01'));
    
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(100)
    );

    const paymentsSnap = await getDocs(paymentsQuery);
    
    // Filter to 2025+ in code
    const recentPayments = paymentsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(payment => {
        const created = payment.created?.toDate?.() || new Date(0);
        return created >= startDate.toDate();
      })
      .sort((a, b) => {
        const dateA = a.created?.toDate?.() || new Date(0);
        const dateB = b.created?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

    console.log(`Found ${recentPayments.length} successful payments from 2025+`);

    // Get PaymentIntents for these payments
    const paymentIntentIds = recentPayments
      .filter(p => p.paymentIntentId)
      .map(p => p.paymentIntentId)
      .slice(0, 10); // First 10

    const piResults = [];
    for (const piId of paymentIntentIds) {
      const piQuery = query(
        collection(db, "stripe_payment_intents"),
        where("organizationId", "==", organizationId),
        where("stripeId", "==", piId),
        firestoreLimit(1)
      );
      const piSnap = await getDocs(piQuery);
      if (!piSnap.empty) {
        piResults.push(piSnap.docs[0].data());
      }
    }

    // Check how many PaymentIntents have invoiceId
    const piWithInvoiceId = piResults.filter(pi => pi.invoiceId).length;

    return NextResponse.json({
      summary: {
        successfulPayments2025Plus: recentPayments.length,
        paymentsWithPaymentIntentId: recentPayments.filter(p => p.paymentIntentId).length,
        paymentsWithInvoiceId: recentPayments.filter(p => p.invoiceId).length,
        paymentsWithLineItems: recentPayments.filter(p => p.lineItems && p.lineItems.length > 0).length,
        paymentIntentsChecked: piResults.length,
        paymentIntentsWithInvoiceId: piWithInvoiceId,
        linkageRate: piResults.length > 0 
          ? `${((piWithInvoiceId / piResults.length) * 100).toFixed(1)}%`
          : "0%",
      },
      samplePayments: recentPayments.slice(0, 5).map(p => ({
        stripeId: p.stripeId,
        amount: p.amount / 100,
        date: p.created?.toDate?.()?.toISOString().split('T')[0] || null,
        paymentIntentId: p.paymentIntentId || null,
        invoiceId: p.invoiceId || null,
        lineItems: p.lineItems?.length || 0,
      })),
      samplePaymentIntents: piResults.slice(0, 5).map(pi => ({
        stripeId: pi.stripeId,
        invoiceId: pi.invoiceId || null,
        amount: pi.amount / 100,
      })),
    });

  } catch (error: any) {
    console.error("2026 linkage check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

