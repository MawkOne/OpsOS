import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;

// QuickBooks API base URL
const QUICKBOOKS_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

interface QuickBooksConnection {
  status: string;
  realmId: string;
  companyName: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: { toDate: () => Date };
  refreshTokenExpiry: { toDate: () => Date };
}

// Refresh access token if expired
async function refreshAccessToken(
  organizationId: string, 
  connection: QuickBooksConnection
): Promise<string> {
  const now = new Date();
  const expiry = connection.accessTokenExpiry?.toDate?.() || new Date(0);
  
  // If token is still valid (with 5 min buffer), return it
  if (expiry.getTime() - 5 * 60 * 1000 > now.getTime()) {
    return connection.accessToken;
  }

  // Token expired, refresh it
  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    throw new Error('QuickBooks credentials not configured');
  }

  const basicAuth = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Token refresh failed:', errorData);
    throw new Error('Failed to refresh QuickBooks token');
  }

  const tokenData = await response.json();
  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token;
  const expiresIn = tokenData.expires_in;
  const refreshTokenExpiresIn = tokenData.x_refresh_token_expires_in;

  // Update tokens in Firestore
  const connectionRef = doc(db, 'quickbooks_connections', organizationId);
  await updateDoc(connectionRef, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessTokenExpiry: new Date(now.getTime() + (expiresIn * 1000)),
    refreshTokenExpiry: new Date(now.getTime() + (refreshTokenExpiresIn * 1000)),
    updatedAt: serverTimestamp(),
  });

  return newAccessToken;
}

// Make authenticated QuickBooks API request
async function qbRequest(
  accessToken: string,
  realmId: string,
  endpoint: string
): Promise<Response> {
  const url = `${QUICKBOOKS_API_BASE}/${realmId}/${endpoint}`;
  return fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });
}

// Query QuickBooks API
async function qbQuery(
  accessToken: string,
  realmId: string,
  query: string
): Promise<Response> {
  const encodedQuery = encodeURIComponent(query);
  return qbRequest(accessToken, realmId, `query?query=${encodedQuery}&minorversion=65`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Get connection from Firestore
    const connectionRef = doc(db, 'quickbooks_connections', organizationId);
    const connectionSnap = await getDoc(connectionRef);

    if (!connectionSnap.exists()) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }

    const connection = connectionSnap.data() as QuickBooksConnection;

    if (connection.status !== 'connected') {
      return NextResponse.json({ error: 'QuickBooks connection invalid' }, { status: 400 });
    }

    // Update status to syncing
    await updateDoc(connectionRef, { status: 'syncing', updatedAt: serverTimestamp() });

    // Refresh token if needed
    const accessToken = await refreshAccessToken(organizationId, connection);
    const realmId = connection.realmId;

    const results = {
      invoices: 0,
      payments: 0,
      customers: 0,
      accounts: 0,
      items: 0,
      expenses: 0,
      errors: [] as string[],
    };

    // Sync Customers
    try {
      const customersResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Customer MAXRESULTS 1000');
      if (customersResponse.ok) {
        const data = await customersResponse.json();
        const customers = data.QueryResponse?.Customer || [];
        
        for (const customer of customers) {
          const customerRef = doc(collection(db, 'quickbooks_customers'), `${organizationId}_${customer.Id}`);
          await setDoc(customerRef, {
            organizationId,
            quickbooksId: customer.Id,
            displayName: customer.DisplayName || '',
            companyName: customer.CompanyName || '',
            email: customer.PrimaryEmailAddr?.Address || '',
            phone: customer.PrimaryPhone?.FreeFormNumber || '',
            balance: customer.Balance || 0,
            active: customer.Active ?? true,
            createdAt: customer.MetaData?.CreateTime ? Timestamp.fromDate(new Date(customer.MetaData.CreateTime)) : null,
            updatedAt: customer.MetaData?.LastUpdatedTime ? Timestamp.fromDate(new Date(customer.MetaData.LastUpdatedTime)) : null,
            syncedAt: serverTimestamp(),
          });
          results.customers++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Customers sync failed: ${error}`);
    }

    // Sync Invoices
    try {
      const invoicesResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Invoice MAXRESULTS 1000');
      if (invoicesResponse.ok) {
        const data = await invoicesResponse.json();
        const invoices = data.QueryResponse?.Invoice || [];
        
        for (const invoice of invoices) {
          const invoiceRef = doc(collection(db, 'quickbooks_invoices'), `${organizationId}_${invoice.Id}`);
          
          // Extract line items
          const lineItems = (invoice.Line || [])
            .filter((line: { DetailType: string }) => line.DetailType === 'SalesItemLineDetail')
            .map((line: { 
              Id: string; 
              Description: string; 
              Amount: number;
              SalesItemLineDetail: {
                ItemRef?: { value: string; name: string };
                Qty?: number;
                UnitPrice?: number;
              }
            }) => ({
              lineId: line.Id,
              description: line.Description || '',
              amount: line.Amount || 0,
              itemId: line.SalesItemLineDetail?.ItemRef?.value || null,
              itemName: line.SalesItemLineDetail?.ItemRef?.name || '',
              quantity: line.SalesItemLineDetail?.Qty || 0,
              unitPrice: line.SalesItemLineDetail?.UnitPrice || 0,
            }));

          await setDoc(invoiceRef, {
            organizationId,
            quickbooksId: invoice.Id,
            docNumber: invoice.DocNumber || '',
            customerId: invoice.CustomerRef?.value || '',
            customerName: invoice.CustomerRef?.name || '',
            txnDate: invoice.TxnDate ? Timestamp.fromDate(new Date(invoice.TxnDate)) : null,
            dueDate: invoice.DueDate ? Timestamp.fromDate(new Date(invoice.DueDate)) : null,
            totalAmount: invoice.TotalAmt || 0,
            balance: invoice.Balance || 0,
            status: invoice.Balance === 0 ? 'paid' : (invoice.Balance === invoice.TotalAmt ? 'unpaid' : 'partial'),
            currency: invoice.CurrencyRef?.value || 'CAD',
            lineItems,
            createdAt: invoice.MetaData?.CreateTime ? Timestamp.fromDate(new Date(invoice.MetaData.CreateTime)) : null,
            syncedAt: serverTimestamp(),
          });
          results.invoices++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Invoices sync failed: ${error}`);
    }

    // Sync Payments
    try {
      const paymentsResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Payment MAXRESULTS 1000');
      if (paymentsResponse.ok) {
        const data = await paymentsResponse.json();
        const payments = data.QueryResponse?.Payment || [];
        
        for (const payment of payments) {
          const paymentRef = doc(collection(db, 'quickbooks_payments'), `${organizationId}_${payment.Id}`);
          
          // Extract linked invoices
          const linkedInvoices = (payment.Line || []).map((line: { LinkedTxn?: { TxnId: string; TxnType: string }[]; Amount: number }) => ({
            invoiceId: line.LinkedTxn?.[0]?.TxnId || null,
            amount: line.Amount || 0,
          }));

          await setDoc(paymentRef, {
            organizationId,
            quickbooksId: payment.Id,
            customerId: payment.CustomerRef?.value || '',
            customerName: payment.CustomerRef?.name || '',
            txnDate: payment.TxnDate ? Timestamp.fromDate(new Date(payment.TxnDate)) : null,
            totalAmount: payment.TotalAmt || 0,
            currency: payment.CurrencyRef?.value || 'CAD',
            paymentMethod: payment.PaymentMethodRef?.name || '',
            linkedInvoices,
            createdAt: payment.MetaData?.CreateTime ? Timestamp.fromDate(new Date(payment.MetaData.CreateTime)) : null,
            syncedAt: serverTimestamp(),
          });
          results.payments++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Payments sync failed: ${error}`);
    }

    // Sync Items (Products/Services)
    try {
      const itemsResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Item MAXRESULTS 1000');
      if (itemsResponse.ok) {
        const data = await itemsResponse.json();
        const items = data.QueryResponse?.Item || [];
        
        for (const item of items) {
          const itemRef = doc(collection(db, 'quickbooks_items'), `${organizationId}_${item.Id}`);
          await setDoc(itemRef, {
            organizationId,
            quickbooksId: item.Id,
            name: item.Name || '',
            description: item.Description || '',
            type: item.Type || 'Service',
            unitPrice: item.UnitPrice || 0,
            purchaseCost: item.PurchaseCost || 0,
            active: item.Active ?? true,
            incomeAccountId: item.IncomeAccountRef?.value || null,
            expenseAccountId: item.ExpenseAccountRef?.value || null,
            syncedAt: serverTimestamp(),
          });
          results.items++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Items sync failed: ${error}`);
    }

    // Sync Accounts (Chart of Accounts)
    try {
      const accountsResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Account MAXRESULTS 1000');
      if (accountsResponse.ok) {
        const data = await accountsResponse.json();
        const accounts = data.QueryResponse?.Account || [];
        
        for (const account of accounts) {
          const accountRef = doc(collection(db, 'quickbooks_accounts'), `${organizationId}_${account.Id}`);
          await setDoc(accountRef, {
            organizationId,
            quickbooksId: account.Id,
            name: account.Name || '',
            fullyQualifiedName: account.FullyQualifiedName || '',
            accountType: account.AccountType || '',
            accountSubType: account.AccountSubType || '',
            classification: account.Classification || '',
            currentBalance: account.CurrentBalance || 0,
            active: account.Active ?? true,
            syncedAt: serverTimestamp(),
          });
          results.accounts++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Accounts sync failed: ${error}`);
    }

    // Sync Expenses (Bills/Purchases)
    try {
      const billsResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Bill MAXRESULTS 1000');
      if (billsResponse.ok) {
        const data = await billsResponse.json();
        const bills = data.QueryResponse?.Bill || [];
        
        for (const bill of bills) {
          const billRef = doc(collection(db, 'quickbooks_expenses'), `${organizationId}_bill_${bill.Id}`);
          
          const lineItems = (bill.Line || []).map((line: {
            Id: string;
            Description: string;
            Amount: number;
            AccountBasedExpenseLineDetail?: { AccountRef?: { value: string; name: string } };
            ItemBasedExpenseLineDetail?: { ItemRef?: { value: string; name: string } };
          }) => ({
            lineId: line.Id,
            description: line.Description || '',
            amount: line.Amount || 0,
            accountId: line.AccountBasedExpenseLineDetail?.AccountRef?.value || null,
            accountName: line.AccountBasedExpenseLineDetail?.AccountRef?.name || '',
            itemId: line.ItemBasedExpenseLineDetail?.ItemRef?.value || null,
            itemName: line.ItemBasedExpenseLineDetail?.ItemRef?.name || '',
          }));

          await setDoc(billRef, {
            organizationId,
            quickbooksId: bill.Id,
            type: 'bill',
            vendorId: bill.VendorRef?.value || '',
            vendorName: bill.VendorRef?.name || '',
            txnDate: bill.TxnDate ? Timestamp.fromDate(new Date(bill.TxnDate)) : null,
            dueDate: bill.DueDate ? Timestamp.fromDate(new Date(bill.DueDate)) : null,
            totalAmount: bill.TotalAmt || 0,
            balance: bill.Balance || 0,
            currency: bill.CurrencyRef?.value || 'CAD',
            lineItems,
            syncedAt: serverTimestamp(),
          });
          results.expenses++;
        }
      }

      // Also sync Purchase transactions
      const purchasesResponse = await qbQuery(accessToken, realmId, 'SELECT * FROM Purchase MAXRESULTS 1000');
      if (purchasesResponse.ok) {
        const data = await purchasesResponse.json();
        const purchases = data.QueryResponse?.Purchase || [];
        
        for (const purchase of purchases) {
          const purchaseRef = doc(collection(db, 'quickbooks_expenses'), `${organizationId}_purchase_${purchase.Id}`);
          
          const lineItems = (purchase.Line || []).map((line: {
            Id: string;
            Description: string;
            Amount: number;
            AccountBasedExpenseLineDetail?: { AccountRef?: { value: string; name: string } };
          }) => ({
            lineId: line.Id,
            description: line.Description || '',
            amount: line.Amount || 0,
            accountId: line.AccountBasedExpenseLineDetail?.AccountRef?.value || null,
            accountName: line.AccountBasedExpenseLineDetail?.AccountRef?.name || '',
          }));

          await setDoc(purchaseRef, {
            organizationId,
            quickbooksId: purchase.Id,
            type: purchase.PaymentType === 'CreditCard' ? 'credit_card' : 'expense',
            vendorId: purchase.EntityRef?.value || '',
            vendorName: purchase.EntityRef?.name || '',
            txnDate: purchase.TxnDate ? Timestamp.fromDate(new Date(purchase.TxnDate)) : null,
            totalAmount: purchase.TotalAmt || 0,
            currency: purchase.CurrencyRef?.value || 'CAD',
            paymentType: purchase.PaymentType || '',
            lineItems,
            syncedAt: serverTimestamp(),
          });
          results.expenses++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Expenses sync failed: ${error}`);
    }

    // Update connection with sync results
    await updateDoc(connectionRef, {
      status: 'connected',
      lastSyncAt: serverTimestamp(),
      lastSyncResults: results,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

