import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'opsos-864a1';
const DATASET_ID = 'marketing_ai';
const TABLE_ID = 'daily_entity_metrics';

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON 
    ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    : undefined,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId parameter' },
        { status: 400 }
      );
    }

    const tableRef = `${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}`;

    // Query for subscription metrics (most recent)
    const subscriptionQuery = `
      SELECT 
        mrr,
        arr,
        active_subscriptions,
        churned_subscriptions,
        churn_rate,
        date
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'stripe'
        AND entity_type = 'subscription'
      ORDER BY date DESC
      LIMIT 1
    `;

    // Query for customer metrics (most recent)
    const customerQuery = `
      SELECT 
        total_customers,
        new_customers_today,
        date
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'stripe'
        AND entity_type = 'customer'
      ORDER BY date DESC
      LIMIT 1
    `;

    // Query for revenue totals (last 30 days)
    const revenueQuery = `
      SELECT 
        SUM(revenue) as total_revenue,
        SUM(payment_count) as total_payments,
        SUM(net_revenue) as net_revenue
      FROM \`${tableRef}\`
      WHERE organization_id = @organizationId
        AND data_source = 'stripe'
        AND entity_type = 'revenue'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `;

    const options = {
      query: '',
      params: { organizationId },
    };

    // Run queries in parallel
    const [subscriptionResults, customerResults, revenueResults] = await Promise.all([
      bigquery.query({ ...options, query: subscriptionQuery }),
      bigquery.query({ ...options, query: customerQuery }),
      bigquery.query({ ...options, query: revenueQuery }),
    ]);

    const subscriptionData = subscriptionResults[0][0] || {};
    const customerData = customerResults[0][0] || {};
    const revenueData = revenueResults[0][0] || {};

    const mrr = subscriptionData.mrr || 0;
    const totalCustomers = customerData.total_customers || 0;

    const metrics = {
      mrr,
      arr: subscriptionData.arr || mrr * 12,
      activeSubscriptions: subscriptionData.active_subscriptions || 0,
      totalCustomers,
      totalRevenue: revenueData.total_revenue || 0,
      paymentCount: revenueData.total_payments || 0,
      churnRate: subscriptionData.churn_rate || 0,
      averageRevenuePerUser: totalCustomers > 0 ? mrr / totalCustomers : 0,
      netRevenue: revenueData.net_revenue || 0,
      lastCalculatedAt: new Date().toISOString(),
      source: 'bigquery',
    };

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Stripe metrics error:', error);
    
    // Return empty metrics if no data found
    if (error.message?.includes('Not found')) {
      return NextResponse.json({
        mrr: 0,
        arr: 0,
        activeSubscriptions: 0,
        totalCustomers: 0,
        totalRevenue: 0,
        paymentCount: 0,
        churnRate: 0,
        averageRevenuePerUser: 0,
        netRevenue: 0,
        lastCalculatedAt: new Date().toISOString(),
        source: 'bigquery',
        message: 'No data synced yet. Click "Sync to BigQuery" to fetch data.',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to calculate metrics' },
      { status: 500 }
    );
  }
}
