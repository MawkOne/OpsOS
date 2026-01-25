import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Validate Google Ads credentials by listing accessible customers
async function validateAndListCustomers(
  accessToken: string,
  developerToken: string
): Promise<{ valid: boolean; customers?: any[]; error?: string }> {
  try {
    // Use the Google Ads API to list accessible customers
    const response = await fetch(
      'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Ads API error:', errorText);
      
      if (response.status === 401) {
        return { valid: false, error: 'Invalid developer token or OAuth token expired' };
      }
      if (response.status === 403) {
        return { valid: false, error: 'Developer token not approved or access denied' };
      }
      return { valid: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const customerResourceNames = data.resourceNames || [];

    // Get details for each customer
    const customers = [];
    for (const resourceName of customerResourceNames) {
      const customerId = resourceName.replace('customers/', '');
      
      try {
        const customerResponse = await fetch(
          `https://googleads.googleapis.com/v18/${resourceName}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': developerToken,
            },
          }
        );

        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          customers.push({
            id: customerId,
            resourceName,
            descriptiveName: customerData.descriptiveName || `Account ${customerId}`,
            currencyCode: customerData.currencyCode || 'USD',
            timeZone: customerData.timeZone || 'America/Los_Angeles',
            manager: customerData.manager || false,
          });
        }
      } catch (err) {
        // If we can't get details, still include with basic info
        customers.push({
          id: customerId,
          resourceName,
          descriptiveName: `Account ${customerId}`,
        });
      }
    }

    return { valid: true, customers };
  } catch (error) {
    console.error('Error validating Google Ads credentials:', error);
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// POST - Configure Google Ads with developer token and customer ID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, developerToken, customerId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    if (!developerToken) {
      return NextResponse.json({ error: 'Missing developerToken' }, { status: 400 });
    }

    // Get the pending connection with OAuth tokens
    const pendingRef = doc(db, 'google_ads_pending', organizationId);
    const pendingDoc = await getDoc(pendingRef);

    if (!pendingDoc.exists()) {
      return NextResponse.json(
        { error: 'No pending OAuth connection. Please authenticate with Google first.' },
        { status: 400 }
      );
    }

    const pendingData = pendingDoc.data();
    const accessToken = pendingData.accessToken;
    const refreshToken = pendingData.refreshToken;

    // Validate credentials and get customer list
    const validation = await validateAndListCustomers(accessToken, developerToken);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // If no customerId provided, return the list of available customers
    if (!customerId) {
      return NextResponse.json({
        success: true,
        status: 'select_customer',
        customers: validation.customers,
      });
    }

    // Verify the selected customer is in the list
    const selectedCustomer = validation.customers?.find(c => c.id === customerId);
    if (!selectedCustomer) {
      return NextResponse.json(
        { error: 'Selected customer ID not found in accessible accounts' },
        { status: 400 }
      );
    }

    // Save the complete connection
    const connectionRef = doc(db, 'google_ads_connections', organizationId);
    await setDoc(connectionRef, {
      organizationId,
      accessToken,
      refreshToken,
      developerToken,
      customerId,
      customerName: selectedCustomer.descriptiveName,
      currencyCode: selectedCustomer.currencyCode || 'USD',
      timeZone: selectedCustomer.timeZone || 'America/Los_Angeles',
      userEmail: pendingData.userEmail,
      userName: pendingData.userName,
      tokenExpiresAt: pendingData.tokenExpiresAt,
      connectedAt: serverTimestamp(),
      lastSyncAt: null,
      status: 'connected',
    });

    // Delete the pending connection
    await deleteDoc(pendingRef);

    return NextResponse.json({
      success: true,
      status: 'connected',
      customer: selectedCustomer,
    });

  } catch (error) {
    console.error('Error configuring Google Ads:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Configuration failed' },
      { status: 500 }
    );
  }
}

// GET - Check configuration status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Check for active connection
    const connectionRef = doc(db, 'google_ads_connections', organizationId);
    const connectionDoc = await getDoc(connectionRef);

    if (connectionDoc.exists()) {
      const data = connectionDoc.data();
      return NextResponse.json({
        status: 'connected',
        customerId: data.customerId,
        customerName: data.customerName,
        userEmail: data.userEmail,
        lastSyncAt: data.lastSyncAt?.toDate?.() || null,
      });
    }

    // Check for pending OAuth
    const pendingRef = doc(db, 'google_ads_pending', organizationId);
    const pendingDoc = await getDoc(pendingRef);

    if (pendingDoc.exists()) {
      const data = pendingDoc.data();
      return NextResponse.json({
        status: 'pending_config',
        userEmail: data.userEmail,
        message: 'OAuth complete. Please provide developer token and customer ID.',
      });
    }

    return NextResponse.json({ status: 'not_connected' });

  } catch (error) {
    console.error('Error checking Google Ads status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
