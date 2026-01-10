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

    // Check both invoices and payments for subscription creation/update descriptions
    const invoicesQuery = query(
      collection(db, "stripe_invoices"),
      where("organizationId", "==", organizationId),
      where("status", "==", "paid"),
      firestoreLimit(200)
    );

    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(200)
    );

    const [invoicesSnap, paymentsSnap] = await Promise.all([
      getDocs(invoicesQuery),
      getDocs(paymentsQuery)
    ]);

    const results = {
      invoices: {
        withSubInDescription: [] as any[],
        withSubInLineItems: [] as any[],
      },
      payments: {
        withSubInDescription: [] as any[],
        withSubInLineItems: [] as any[],
      }
    };

    // Check invoices
    for (const doc of invoicesSnap.docs) {
      const invoice = doc.data();
      
      // Check description field
      if (invoice.description && 
          (invoice.description.includes('Subscription creation') || 
           invoice.description.includes('Subscription update'))) {
        results.invoices.withSubInDescription.push({
          id: invoice.stripeId,
          description: invoice.description,
          amount: invoice.amount / 100,
        });
      }

      // Check line item descriptions
      const lineItems = invoice.lineItems || [];
      const subLineItems = lineItems.filter((item: any) =>
        item.description &&
        (item.description.includes('Subscription creation') ||
         item.description.includes('Subscription update'))
      );

      if (subLineItems.length > 0) {
        results.invoices.withSubInLineItems.push({
          id: invoice.stripeId,
          amount: invoice.amount / 100,
          lineItems: subLineItems.map((item: any) => ({
            description: item.description,
            amount: (item.amount || 0) / 100,
          })),
        });
      }
    }

    // Check payments
    for (const doc of paymentsSnap.docs) {
      const payment = doc.data();
      
      // Check description field
      if (payment.description && 
          (payment.description.includes('Subscription creation') || 
           payment.description.includes('Subscription update'))) {
        results.payments.withSubInDescription.push({
          id: payment.stripeId,
          description: payment.description,
          amount: payment.amount / 100,
          invoiceId: payment.invoiceId || null,
        });
      }

      // Check line item descriptions
      const lineItems = payment.lineItems || [];
      const subLineItems = lineItems.filter((item: any) =>
        item.description &&
        (item.description.includes('Subscription creation') ||
         item.description.includes('Subscription update'))
      );

      if (subLineItems.length > 0) {
        results.payments.withSubInLineItems.push({
          id: payment.stripeId,
          amount: payment.amount / 100,
          invoiceId: payment.invoiceId || null,
          lineItems: subLineItems.map((item: any) => ({
            description: item.description,
            amount: (item.amount || 0) / 100,
          })),
        });
      }
    }

    return NextResponse.json({
      summary: {
        invoicesChecked: invoicesSnap.size,
        paymentsChecked: paymentsSnap.size,
        invoicesWithSubInDescription: results.invoices.withSubInDescription.length,
        invoicesWithSubInLineItems: results.invoices.withSubInLineItems.length,
        paymentsWithSubInDescription: results.payments.withSubInDescription.length,
        paymentsWithSubInLineItems: results.payments.withSubInLineItems.length,
      },
      samples: {
        invoicesWithSubInDescription: results.invoices.withSubInDescription.slice(0, 5),
        invoicesWithSubInLineItems: results.invoices.withSubInLineItems.slice(0, 5),
        paymentsWithSubInDescription: results.payments.withSubInDescription.slice(0, 5),
        paymentsWithSubInLineItems: results.payments.withSubInLineItems.slice(0, 5),
      },
    });

  } catch (error: any) {
    console.error("Debug check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

