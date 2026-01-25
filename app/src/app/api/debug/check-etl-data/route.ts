import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * Debug API to check if Stripe and ActiveCampaign data exists
 * and matches what the ETL expects
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    const results: any = {
      organizationId,
      timestamp: new Date().toISOString(),
      stripe_invoices: {
        exists: false,
        count: 0,
        sample: null,
        expectedFields: ['organizationId', 'date', 'amount', 'productId'],
        actualFields: []
      },
      activecampaign_campaigns: {
        exists: false,
        count: 0,
        sample: null,
        expectedFields: ['organizationId', 'name', 'id', 'total_sent', 'total_opens', 'total_clicks', 'send_date'],
        actualFields: []
      }
    };

    // Check stripe_invoices
    const stripeQuery = query(
      collection(db, 'stripe_invoices'),
      where('organizationId', '==', organizationId),
      limit(5)
    );
    const stripeSnapshot = await getDocs(stripeQuery);
    
    results.stripe_invoices.exists = true;
    results.stripe_invoices.count = stripeSnapshot.size;
    
    if (!stripeSnapshot.empty) {
      const firstDoc = stripeSnapshot.docs[0];
      const data = firstDoc.data();
      results.stripe_invoices.sample = data;
      results.stripe_invoices.actualFields = Object.keys(data);
      
      // Check if expected fields exist
      results.stripe_invoices.missingFields = results.stripe_invoices.expectedFields.filter(
        (field: string) => !(field in data)
      );
    }

    // Check activecampaign_campaigns
    const acQuery = query(
      collection(db, 'activecampaign_campaigns'),
      where('organizationId', '==', organizationId),
      limit(5)
    );
    const acSnapshot = await getDocs(acQuery);
    
    results.activecampaign_campaigns.exists = true;
    results.activecampaign_campaigns.count = acSnapshot.size;
    
    if (!acSnapshot.empty) {
      const firstDoc = acSnapshot.docs[0];
      const data = firstDoc.data();
      results.activecampaign_campaigns.sample = data;
      results.activecampaign_campaigns.actualFields = Object.keys(data);
      
      // Check if expected fields exist
      results.activecampaign_campaigns.missingFields = results.activecampaign_campaigns.expectedFields.filter(
        (field: string) => !(field in data)
      );
    }

    // Get total counts (up to 100 for performance)
    const stripeCountQuery = query(
      collection(db, 'stripe_invoices'),
      where('organizationId', '==', organizationId),
      limit(100)
    );
    const stripeCountSnapshot = await getDocs(stripeCountQuery);
    results.stripe_invoices.totalCount = stripeCountSnapshot.size;

    const acCountQuery = query(
      collection(db, 'activecampaign_campaigns'),
      where('organizationId', '==', organizationId),
      limit(100)
    );
    const acCountSnapshot = await getDocs(acCountQuery);
    results.activecampaign_campaigns.totalCount = acCountSnapshot.size;

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('Error checking ETL data:', error);
    return NextResponse.json(
      { error: 'Failed to check ETL data', details: String(error) },
      { status: 500 }
    );
  }
}
