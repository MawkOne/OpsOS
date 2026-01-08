import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Get all invoices for this organization
    const invoicesQuery = query(
      collection(db, 'quickbooks_invoices'),
      where('organizationId', '==', organizationId)
    );
    const invoicesSnapshot = await getDocs(invoicesQuery);
    
    let totalRevenue = 0;
    let accountsReceivable = 0;
    
    invoicesSnapshot.forEach((doc) => {
      const invoice = doc.data();
      totalRevenue += invoice.totalAmount || 0;
      accountsReceivable += invoice.balance || 0;
    });

    // Get all expenses for this organization
    const expensesQuery = query(
      collection(db, 'quickbooks_expenses'),
      where('organizationId', '==', organizationId)
    );
    const expensesSnapshot = await getDocs(expensesQuery);
    
    let totalExpenses = 0;
    let accountsPayable = 0;
    
    expensesSnapshot.forEach((doc) => {
      const expense = doc.data();
      totalExpenses += expense.totalAmount || 0;
      accountsPayable += expense.balance || 0;
    });

    // Get customer count
    const customersQuery = query(
      collection(db, 'quickbooks_customers'),
      where('organizationId', '==', organizationId),
      where('active', '==', true)
    );
    const customersSnapshot = await getDocs(customersQuery);
    const customerCount = customersSnapshot.size;

    const netIncome = totalRevenue - totalExpenses;

    return NextResponse.json({
      totalRevenue,
      totalExpenses,
      netIncome,
      accountsReceivable,
      accountsPayable,
      customerCount,
    });
  } catch (error) {
    console.error('QuickBooks metrics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

