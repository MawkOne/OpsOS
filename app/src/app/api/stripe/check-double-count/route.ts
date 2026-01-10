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

    // Find invoices with "Subscription creation" or "Subscription update" line items
    const invoicesQuery = query(
      collection(db, "stripe_invoices"),
      where("organizationId", "==", organizationId),
      where("status", "==", "paid"),
      firestoreLimit(100)
    );

    const invoicesSnap = await getDocs(invoicesQuery);
    
    const suspiciousInvoices = [];
    let totalSubCreationUpdate = 0;

    for (const doc of invoicesSnap.docs) {
      const invoice = doc.data();
      const lineItems = invoice.lineItems || [];
      
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

        suspiciousInvoices.push({
          invoiceId: invoice.stripeId,
          totalAmount: invoice.amount,
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
        invoicesChecked: invoicesSnap.size,
        invoicesWithSubCreationUpdate: suspiciousInvoices.length,
        totalSubCreationUpdateAmount: totalSubCreationUpdate / 100,
      },
      suspiciousInvoices: suspiciousInvoices.slice(0, 10), // First 10 examples
    });

  } catch (error: any) {
    console.error("Debug check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

