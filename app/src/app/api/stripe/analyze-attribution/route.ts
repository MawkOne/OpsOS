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

    // Get samples of each collection to analyze linkage
    const [paymentsSnap, paymentIntentsSnap, invoicesSnap] = await Promise.all([
      getDocs(query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded"),
        firestoreLimit(100)
      )),
      getDocs(query(
        collection(db, "stripe_payment_intents"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded"),
        firestoreLimit(100)
      )),
      getDocs(query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId),
        where("status", "==", "paid"),
        firestoreLimit(100)
      )),
    ]);

    // Build maps for quick lookup
    const paymentIntentsById = new Map();
    paymentIntentsSnap.docs.forEach(doc => {
      const pi = doc.data();
      paymentIntentsById.set(pi.stripeId, pi);
    });

    const invoicesById = new Map();
    invoicesSnap.docs.forEach(doc => {
      const inv = doc.data();
      invoicesById.set(inv.stripeId, inv);
    });

    // Analyze payments
    let paymentsWithNoLineItems = 0;
    let paymentsWithPaymentIntent = 0;
    let paymentIntentsWithInvoice = 0;
    let invoicesWithProducts = 0;
    let successfullyAttributed = 0;

    const samples = {
      cannotAttribute: [] as any[],
      canAttribute: [] as any[],
    };

    for (const doc of paymentsSnap.docs) {
      const payment = doc.data();
      
      // Only look at payments without line items
      if (payment.lineItems && payment.lineItems.length > 0) continue;
      
      paymentsWithNoLineItems++;

      // Try to link to payment intent
      if (!payment.paymentIntentId) {
        if (samples.cannotAttribute.length < 5) {
          samples.cannotAttribute.push({
            paymentId: payment.stripeId,
            reason: "No paymentIntentId",
            amount: payment.amount / 100,
          });
        }
        continue;
      }

      paymentsWithPaymentIntent++;
      const paymentIntent = paymentIntentsById.get(payment.paymentIntentId);
      
      if (!paymentIntent) {
        if (samples.cannotAttribute.length < 5) {
          samples.cannotAttribute.push({
            paymentId: payment.stripeId,
            reason: "PaymentIntent not found in sample",
            amount: payment.amount / 100,
          });
        }
        continue;
      }

      // Try to link to invoice
      if (!paymentIntent.invoiceId) {
        if (samples.cannotAttribute.length < 5) {
          samples.cannotAttribute.push({
            paymentId: payment.stripeId,
            reason: "PaymentIntent has no invoiceId",
            amount: payment.amount / 100,
            paymentIntentId: payment.paymentIntentId,
          });
        }
        continue;
      }

      paymentIntentsWithInvoice++;
      const invoice = invoicesById.get(paymentIntent.invoiceId);

      if (!invoice) {
        if (samples.cannotAttribute.length < 5) {
          samples.cannotAttribute.push({
            paymentId: payment.stripeId,
            reason: "Invoice not found in sample",
            amount: payment.amount / 100,
            invoiceId: paymentIntent.invoiceId,
          });
        }
        continue;
      }

      // Check if invoice has product info
      const lineItems = invoice.lineItems || [];
      if (lineItems.length === 0) {
        if (samples.cannotAttribute.length < 5) {
          samples.cannotAttribute.push({
            paymentId: payment.stripeId,
            reason: "Invoice has no line items",
            amount: payment.amount / 100,
            invoiceId: invoice.stripeId,
          });
        }
        continue;
      }

      invoicesWithProducts++;
      successfullyAttributed++;

      if (samples.canAttribute.length < 5) {
        samples.canAttribute.push({
          paymentId: payment.stripeId,
          amount: payment.amount / 100,
          paymentIntentId: payment.paymentIntentId,
          invoiceId: invoice.stripeId,
          products: lineItems.map((item: any) => ({
            productId: item.productId,
            priceId: item.priceId,
            description: item.description,
            amount: (item.amount || 0) / 100,
          })),
        });
      }
    }

    return NextResponse.json({
      summary: {
        paymentsChecked: paymentsSnap.size,
        paymentsWithNoLineItems,
        paymentsWithPaymentIntent,
        paymentIntentsWithInvoice,
        invoicesWithProducts,
        successfullyAttributed,
        attributionSuccessRate: paymentsWithNoLineItems > 0 
          ? `${((successfullyAttributed / paymentsWithNoLineItems) * 100).toFixed(1)}%`
          : "0%",
      },
      samples,
    });

  } catch (error: any) {
    console.error("Attribution analysis error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

