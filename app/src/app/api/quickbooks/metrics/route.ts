import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

// Return empty metrics with a message
function emptyMetrics(message: string) {
  return {
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    bankBalance: 0,
    invoiceCount: 0,
    expenseCount: 0,
    customerCount: 0,
    source: 'bigquery',
    message,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    console.log(`📊 Fetching QuickBooks metrics from BigQuery for org: ${organizationId}`);

    // Check if BigQuery credentials are available
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.warn('GOOGLE_APPLICATION_CREDENTIALS_JSON not set, returning empty metrics');
      return NextResponse.json(emptyMetrics('BigQuery not configured. Sync data to populate metrics.'));
    }

    // Lazy import BigQuery
    const { BigQuery } = await import('@google-cloud/bigquery');
    
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } catch (parseError) {
      console.error('Failed to parse BigQuery credentials:', parseError);
      return NextResponse.json(emptyMetrics('BigQuery credentials invalid.'));
    }

    const bigquery = new BigQuery({
      projectId: PROJECT_ID,
      credentials,
    });

    const tableRef = `${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}`;

    // Query for account balances (most recent)
    const accountQuery = `
      SELECT 
        accounts_receivable,
        accounts_payable,
        bank_balance,
        total_income,
        total_expenses,
        net_income,
        date
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'quickbooks'
        AND entity_type = 'account'
      ORDER BY date DESC
      LIMIT 1
    `;

    // Query for invoice totals (last 90 days)
    const invoiceQuery = `
      SELECT 
        SUM(revenue) as total_revenue,
        SUM(invoiced_amount) as total_invoiced,
        SUM(invoice_count) as total_invoices
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'quickbooks'
        AND entity_type = 'invoice'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    `;

    // Query for expense totals (last 90 days)
    const expenseQuery = `
      SELECT 
        SUM(expense_amount) as total_expenses,
        SUM(expense_count) as total_expense_count
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'quickbooks'
        AND entity_type = 'expense'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    `;

    const options = {
      query: '',
      params: { organizationId },
    };

    // Run queries in parallel
    const [accountResults, invoiceResults, expenseResults] = await Promise.all([
      bigquery.query({ ...options, query: accountQuery }),
      bigquery.query({ ...options, query: invoiceQuery }),
      bigquery.query({ ...options, query: expenseQuery }),
    ]);

    const accountData = accountResults[0][0] || {};
    const invoiceData = invoiceResults[0][0] || {};
    const expenseData = expenseResults[0][0] || {};

    const totalRevenue = invoiceData.total_revenue || accountData.total_income || 0;
    const totalExpenses = expenseData.total_expenses || accountData.total_expenses || 0;

    const metrics = {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      accountsReceivable: accountData.accounts_receivable || 0,
      accountsPayable: accountData.accounts_payable || 0,
      bankBalance: accountData.bank_balance || 0,
      invoiceCount: invoiceData.total_invoices || 0,
      expenseCount: expenseData.total_expense_count || 0,
      customerCount: 0,
      source: 'bigquery',
    };

    console.log(`   Metrics calculated:`, metrics);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('QuickBooks metrics error:', error);
    return NextResponse.json(emptyMetrics('Unable to fetch metrics. Click "Sync to BigQuery" to populate data.'));
  }
}
