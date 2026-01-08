import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, apiUrl, apiKey } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'API URL and API Key required' }, { status: 400 });
    }

    // Validate the credentials by fetching account info
    const accountResponse = await fetch(`${apiUrl}/api/3/users/me`, {
      headers: {
        'Api-Token': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!accountResponse.ok) {
      const errorData = await accountResponse.json().catch(() => ({}));
      console.error('ActiveCampaign validation failed:', errorData);
      return NextResponse.json({ error: 'Invalid API credentials' }, { status: 400 });
    }

    const accountData = await accountResponse.json();
    const user = accountData.user;

    // Store the connection in Firestore
    const connectionRef = doc(db, 'activecampaign_connections', organizationId);
    await setDoc(connectionRef, {
      status: 'connected',
      apiUrl: apiUrl,
      apiKey: apiKey, // In production, encrypt this
      accountName: user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.email || 'ActiveCampaign Account',
      accountEmail: user?.email || '',
      connectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ 
      success: true,
      accountName: user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.email || 'ActiveCampaign Account',
    });
  } catch (error) {
    console.error('ActiveCampaign connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    );
  }
}

