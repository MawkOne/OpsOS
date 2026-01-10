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

    // Get paid invoices
    const invoicesQuery = query(
      collection(db, "stripe_invoices"),
      where("organizationId", "==", organizationId),
      where("status", "==", "paid"),
      firestoreLimit(100)
    );
    const invoicesSnap = await getDocs(invoicesQuery);

    // Build set of invoice IDs
    const invoiceIds = new Set<string>();
    invoicesSnap.docs.forEach(doc => {
      const invoice = doc.data();
      if (invoice.stripeId) {
        invoiceIds.add(invoice.stripeId);
      }
    });

    // Get successful payments
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(100)
    );
    const paymentsSnap = await getDocs(paymentsQuery);

    let paymentsWithInvoiceId = 0;
    let paymentsMatchingInvoice = 0;
    let paymentsNotMatchingInvoice = 0;
    let totalPaymentAmount = 0;
    let matchedPaymentAmount = 0;
    let unmatchedPaymentAmount = 0;

    const matchedSamples: any[] = [];
    const unmatchedSamples: any[] = [];

    paymentsSnap.docs.forEach(doc => {
      const payment = doc.data();
      const amount = payment.amount / 100;
      totalPaymentAmount += amount;

      if (payment.invoiceId) {
        paymentsWithInvoiceId++;
        
        if (invoiceIds.has(payment.invoiceId)) {
          paymentsMatchingInvoice++;
          matchedPaymentAmount += amount;
          if (matchedSamples.length < 5) {
            matchedSamples.push({
              paymentId: payment.stripeId,
              invoiceId: payment.invoiceId,
              amount,
              date: payment.created?.toDate?.()?.toISOString().split('T')[0] || null,
            });
          }
        } else {
          paymentsNotMatchingInvoice++;
          unmatchedPaymentAmount += amount;
          if (unmatchedSamples.length < 5) {
            unmatchedSamples.push({
              paymentId: payment.stripeId,
              invoiceId: payment.invoiceId,
              invoiceFound: false,
              amount,
              date: payment.created?.toDate?.()?.toISOString().split('T')[0] || null,
            });
          }
        }
      }
    });

    // Calculate total invoice amount
    let totalInvoiceAmount = 0;
    invoicesSnap.docs.forEach(doc => {
      const invoice = doc.data();
      totalInvoiceAmount += (invoice.amount || 0) / 100;
    });

    return NextResponse.json({
      summary: {
        invoicesChecked: invoicesSnap.size,
        paymentsChecked: paymentsSnap.size,
        invoiceTotalAmount: totalInvoiceAmount,
        paymentTotalAmount: totalPaymentAmount,
        paymentsWithInvoiceId,
        paymentsMatchingInvoice,
        paymentsNotMatchingInvoice,
        matchedPaymentAmount,
        unmatchedPaymentAmount,
        potentialDoubleCountAmount: Math.min(totalInvoiceAmount, matchedPaymentAmount),
      },
      matchedSamples,
      unmatchedSamples,
    });

  } catch (error: any) {
    console.error("Double count check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

