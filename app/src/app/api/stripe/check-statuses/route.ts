import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // Get all payments for this org
    const paymentsQuery = query(
      collection(db, "stripe_payments"),
      where("organizationId", "==", organizationId)
    );

    const paymentsSnap = await getDocs(paymentsQuery);
    
    // Count by status
    const statusCounts: Record<string, number> = {};
    const statusSamples: Record<string, any[]> = {};
    
    paymentsSnap.docs.forEach(doc => {
      const payment = doc.data();
      const status = payment.status || 'null';
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Keep first 3 samples of each status
      if (!statusSamples[status]) {
        statusSamples[status] = [];
      }
      if (statusSamples[status].length < 3) {
        statusSamples[status].push({
          stripeId: payment.stripeId,
          amount: payment.amount / 100,
          date: payment.created?.toDate?.()?.toISOString().split('T')[0] || null,
          invoiceId: payment.invoiceId || null,
          lineItems: payment.lineItems?.length || 0,
        });
      }
    });

    return NextResponse.json({
      summary: {
        totalPayments: paymentsSnap.size,
        statusCounts,
      },
      samples: statusSamples,
    });

  } catch (error: any) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

