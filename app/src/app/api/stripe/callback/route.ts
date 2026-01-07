import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (errorParam) {
    console.error('Stripe OAuth error:', errorParam, errorDescription);
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=${errorParam}`);
  }

  // Parse state to get organizationId
  let organizationId: string;
  try {
    const stateData = JSON.parse(decodeURIComponent(state || '{}'));
    organizationId = stateData.organizationId;
  } catch (e) {
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=invalid_state`);
  }

  if (!organizationId) {
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=missing_organization`);
  }

  if (!code) {
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=missing_code`);
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=stripe_not_configured`);
  }

  try {
    // Exchange the authorization code for an access token
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });

    // For Stripe Connect Standard, we use the OAuth token endpoint
    const response = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_secret: STRIPE_SECRET_KEY,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Stripe token exchange failed:', errorData);
      return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=token_exchange_failed`);
    }

    const tokenData = await response.json();
    const stripeUserId = tokenData.stripe_user_id;
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const livemode = tokenData.livemode;

    // Get account details
    let accountName = '';
    try {
      const account = await stripe.accounts.retrieve(stripeUserId);
      accountName = account.business_profile?.name || account.settings?.dashboard?.display_name || '';
    } catch (e) {
      console.error('Failed to fetch account details:', e);
    }

    // Store the connection in Firestore
    const connectionRef = doc(db, 'stripe_connections', organizationId);
    await setDoc(connectionRef, {
      status: 'connected',
      stripeAccountId: stripeUserId,
      stripeAccountName: accountName,
      accessToken: accessToken,
      refreshToken: refreshToken,
      isTestMode: !livemode,
      connectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Redirect back to the Stripe page with success
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?connected=true`);
  } catch (error: any) {
    console.error('Stripe OAuth callback error:', error);
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=${encodeURIComponent(error.message || 'Unknown error')}`);
  }
}

