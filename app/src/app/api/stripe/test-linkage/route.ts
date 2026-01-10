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

    // Get samples of each collection
    const [paymentsSnap, paymentIntentsSnap, invoicesSnap] = await Promise.all([
      getDocs(query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded"),
        firestoreLimit(20)
      )),
      getDocs(query(
        collection(db, "stripe_payment_intents"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded"),
        firestoreLimit(20)
      )),
      getDocs(query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId),
        where("status", "==", "paid"),
        firestoreLimit(20)
      )),
    ]);

    // Take first payment and try to trace the chain
    const firstPayment = paymentsSnap.docs[0]?.data();
    const firstPaymentIntent = paymentIntentsSnap.docs[0]?.data();
    const firstInvoice = invoicesSnap.docs[0]?.data();

    // Try to find matching PaymentIntent for first payment
    let matchingPI = null;
    for (const doc of paymentIntentsSnap.docs) {
      const pi = doc.data();
      if (pi.latestChargeId === firstPayment?.stripeId) {
        matchingPI = pi;
        break;
      }
    }

    // Try to find matching Invoice for first PaymentIntent
    let matchingInvoice = null;
    if (firstPaymentIntent?.invoiceId) {
      for (const doc of invoicesSnap.docs) {
        const inv = doc.data();
        if (inv.stripeId === firstPaymentIntent.invoiceId) {
          matchingInvoice = inv;
          break;
        }
      }
    }

    return NextResponse.json({
      firstPayment: {
        stripeId: firstPayment?.stripeId || null,
        paymentIntentId: firstPayment?.paymentIntentId || null,
        invoiceId: firstPayment?.invoiceId || null,
        amount: (firstPayment?.amount || 0) / 100,
        lineItems: firstPayment?.lineItems?.length || 0,
      },
      firstPaymentIntent: {
        stripeId: firstPaymentIntent?.stripeId || null,
        latestChargeId: firstPaymentIntent?.latestChargeId || null,
        invoiceId: firstPaymentIntent?.invoiceId || null,
        amount: (firstPaymentIntent?.amount || 0) / 100,
      },
      firstInvoice: {
        stripeId: firstInvoice?.stripeId || null,
        chargeId: firstInvoice?.chargeId || null,
        amount: (firstInvoice?.amount || 0) / 100,
        lineItems: firstInvoice?.lineItems?.length || 0,
      },
      linkageTest: {
        paymentMatchesPI: !!matchingPI,
        matchingPIId: matchingPI?.stripeId || null,
        matchingPIInvoiceId: matchingPI?.invoiceId || null,
        piMatchesInvoice: !!matchingInvoice,
        matchingInvoiceId: matchingInvoice?.stripeId || null,
        matchingInvoiceLineItems: matchingInvoice?.lineItems?.length || 0,
      },
    });

  } catch (error: any) {
    console.error("Linkage test error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

