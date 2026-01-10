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

    // Sample payments to analyze attribution options
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(50)
    );
    const paymentsSnap = await getDocs(paymentsQuery);

    let withLineItems = 0;
    let withInvoiceId = 0;
    let withPaymentIntentId = 0;
    let withSubscriptionId = 0;
    let withMetadata = 0;
    let withDescription = 0;
    let withCustomerId = 0;
    let total = 0;

    const attributionSamples: any[] = [];

    paymentsSnap.docs.forEach(doc => {
      const payment = doc.data();
      total++;

      const hasLineItems = payment.lineItems && payment.lineItems.length > 0;
      const hasInvoiceId = !!payment.invoiceId;
      const hasPaymentIntentId = !!payment.paymentIntentId;
      const hasSubscriptionId = !!payment.subscriptionId;
      const hasMetadata = payment.metadata && Object.keys(payment.metadata).length > 0;
      const hasDescription = !!payment.description;
      const hasCustomerId = !!payment.customerId;

      if (hasLineItems) withLineItems++;
      if (hasInvoiceId) withInvoiceId++;
      if (hasPaymentIntentId) withPaymentIntentId++;
      if (hasSubscriptionId) withSubscriptionId++;
      if (hasMetadata) withMetadata++;
      if (hasDescription) withDescription++;
      if (hasCustomerId) withCustomerId++;

      if (attributionSamples.length < 10) {
        attributionSamples.push({
          paymentId: payment.stripeId,
          amount: payment.amount / 100,
          date: payment.created?.toDate?.()?.toISOString().split('T')[0] || null,
          hasLineItems,
          hasInvoiceId,
          hasPaymentIntentId,
          hasSubscriptionId,
          hasMetadata,
          hasDescription,
          hasCustomerId,
          invoiceId: payment.invoiceId || null,
          subscriptionId: payment.subscriptionId || null,
          description: payment.description || null,
          metadata: hasMetadata ? Object.keys(payment.metadata).join(', ') : null,
        });
      }
    });

    return NextResponse.json({
      summary: {
        paymentsChecked: total,
        attributionPaths: {
          "Direct Line Items": `${withLineItems} (${((withLineItems/total)*100).toFixed(1)}%)`,
          "Via Invoice ID": `${withInvoiceId} (${((withInvoiceId/total)*100).toFixed(1)}%)`,
          "Via Payment Intent ID": `${withPaymentIntentId} (${((withPaymentIntentId/total)*100).toFixed(1)}%)`,
          "Via Subscription ID": `${withSubscriptionId} (${((withSubscriptionId/total)*100).toFixed(1)}%)`,
          "Via Metadata": `${withMetadata} (${((withMetadata/total)*100).toFixed(1)}%)`,
          "Via Description": `${withDescription} (${((withDescription/total)*100).toFixed(1)}%)`,
          "Via Customer ID": `${withCustomerId} (${((withCustomerId/total)*100).toFixed(1)}%)`,
        },
      },
      samples: attributionSamples,
      recommendation: 
        withInvoiceId > 0 ? "Use payment.invoiceId to link to stripe_invoices" :
        withPaymentIntentId > 0 ? "Use payment.paymentIntentId → PaymentIntent.invoiceId to link to stripe_invoices" :
        withSubscriptionId > 0 ? "Use payment.subscriptionId to link to stripe_subscriptions" :
        "No clear attribution path - payments may need to stay 'Unlabeled'",
    });

  } catch (error: any) {
    console.error("Attribution options check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

