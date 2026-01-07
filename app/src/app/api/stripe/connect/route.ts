import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, organizationId, userId } = body;

    if (!apiKey || !organizationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, organizationId, userId' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Must start with sk_live_ or sk_test_' },
        { status: 400 }
      );
    }

    // Initialize Stripe and verify the key
    const stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });

    // Verify the API key by fetching account info
    let account;
    try {
      account = await stripe.accounts.retrieve();
    } catch (stripeError: any) {
      return NextResponse.json(
        { error: `Stripe API error: ${stripeError.message}` },
        { status: 401 }
      );
    }

    // Save connection to Firestore
    // WARNING: In production, encrypt the API key using a KMS or similar service
    // For now, storing plaintext for development purposes
    const connectionRef = doc(db, 'stripe_connections', organizationId);
    await setDoc(connectionRef, {
      organizationId,
      stripeAccountId: account.id,
      status: 'connected',
      syncFrequency: '1h',
      historicalDataRange: '12m',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      // Store the full key for automated syncing
      // TODO: Encrypt this in production!
      apiKey: apiKey,
      apiKeyLast4: apiKey.slice(-4),
      isTestMode: apiKey.startsWith('sk_test_'),
    });

    return NextResponse.json({
      success: true,
      accountId: account.id,
      isTestMode: apiKey.startsWith('sk_test_'),
    });
  } catch (error: any) {
    console.error('Stripe connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to Stripe' },
      { status: 500 }
    );
  }
}

