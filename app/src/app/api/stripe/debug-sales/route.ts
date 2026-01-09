import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  // Fetch ALL stripe_invoices for this org
  const invoicesQuery = query(
    collection(db, "stripe_invoices"),
    where("organizationId", "==", organizationId)
  );
  const invoicesSnap = await getDocs(invoicesQuery);
  
  let totalInvoices = 0;
  let paidInvoices = 0;
  let totalAmountCents = 0;
  let totalFromLineItems = 0;
  let invoicesWithLineItems = 0;
  let invoicesWithoutLineItems = 0;
  
  const statusCounts: Record<string, number> = {};
  const yearCounts: Record<string, number> = {};
  const yearAmounts: Record<string, number> = {};
  
  const sampleInvoices: any[] = [];
  
  invoicesSnap.docs.forEach((doc, index) => {
    const invoice = doc.data();
    totalInvoices++;
    
    // Count statuses
    const status = invoice.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    
    // Only process paid
    if (status !== 'paid') return;
    paidInvoices++;
    
    // Get date
    const invoiceDate = invoice.created?.toDate?.() || new Date();
    const year = invoiceDate.getFullYear().toString();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
    
    // Calculate amount
    const invoiceAmount = invoice.amount || 0;
    totalAmountCents += invoiceAmount;
    yearAmounts[year] = (yearAmounts[year] || 0) + invoiceAmount;
    
    // Check line items
    const lineItems = invoice.lineItems || [];
    if (lineItems.length > 0) {
      invoicesWithLineItems++;
      let lineItemTotal = 0;
      lineItems.forEach((item: any) => {
        lineItemTotal += item.amount || 0;
      });
      totalFromLineItems += lineItemTotal;
    } else {
      invoicesWithoutLineItems++;
    }
    
    // Sample first 5
    if (sampleInvoices.length < 5) {
      sampleInvoices.push({
        id: doc.id,
        stripeId: invoice.stripeId,
        status: invoice.status,
        amount: invoice.amount,
        amountDollars: (invoice.amount || 0) / 100,
        lineItemsCount: lineItems.length,
        lineItemsTotal: lineItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0),
        created: invoiceDate.toISOString(),
        year,
      });
    }
  });
  
  return NextResponse.json({
    summary: {
      totalInvoices,
      paidInvoices,
      totalAmountCents,
      totalAmountDollars: totalAmountCents / 100,
      totalFromLineItemsCents: totalFromLineItems,
      totalFromLineItemsDollars: totalFromLineItems / 100,
      invoicesWithLineItems,
      invoicesWithoutLineItems,
    },
    statusCounts,
    yearCounts,
    yearAmountsCents: yearAmounts,
    yearAmountsDollars: Object.fromEntries(
      Object.entries(yearAmounts).map(([k, v]) => [k, v / 100])
    ),
    sampleInvoices,
  });
}

