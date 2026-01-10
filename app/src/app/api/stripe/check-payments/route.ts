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

    // Find payments with "Subscription creation" or "Subscription update" line items
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId),
      where("status", "==", "succeeded"),
      firestoreLimit(100)
    );

    const paymentsSnap = await getDocs(paymentsQuery);
    
    const suspiciousPayments = [];
    let totalSubCreationUpdate = 0;

    for (const doc of paymentsSnap.docs) {
      const payment = doc.data();
      const lineItems = payment.lineItems || [];
      
      if (lineItems.length === 0) continue;

      const subCreationItems = lineItems.filter((item: any) =>
        item.description &&
        (item.description.includes('Subscription creation') ||
         item.description.includes('Subscription update'))
      );

      if (subCreationItems.length > 0) {
        const otherItems = lineItems.filter((item: any) =>
          item.description &&
          !item.description.includes('Subscription creation') &&
          !item.description.includes('Subscription update')
        );

        const subCreationAmount = subCreationItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        const otherAmount = otherItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        totalSubCreationUpdate += subCreationAmount;

        suspiciousPayments.push({
          paymentId: payment.stripeId,
          invoiceId: payment.invoiceId || null,
          totalAmount: payment.amount,
          totalLineItems: lineItems.length,
          subCreationUpdateItems: subCreationItems.length,
          subCreationUpdateAmount: subCreationAmount / 100,
          otherItems: otherItems.length,
          otherAmount: otherAmount / 100,
          lineItemDetails: lineItems.map((item: any) => ({
            description: item.description,
            amount: (item.amount || 0) / 100,
            productId: item.productId || null,
            priceId: item.priceId || null,
            productName: item.productName || null,
          })),
        });
      }
    }

    return NextResponse.json({
      summary: {
        paymentsChecked: paymentsSnap.size,
        paymentsWithSubCreationUpdate: suspiciousPayments.length,
        totalSubCreationUpdateAmount: totalSubCreationUpdate / 100,
      },
      suspiciousPayments: suspiciousPayments.slice(0, 10), // First 10 examples
    });

  } catch (error: any) {
    console.error("Debug check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

