import { NextRequest, NextResponse } from 'next/server';

const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID;
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=missing_organization`);
  }

  if (!STRIPE_CONNECT_CLIENT_ID) {
    return NextResponse.redirect(`${BASE_URL}/revenue/stripe?error=stripe_not_configured`);
  }

  // Build the Stripe Connect OAuth URL
  const state = encodeURIComponent(JSON.stringify({ organizationId }));
  
  const stripeAuthUrl = new URL('https://connect.stripe.com/oauth/authorize');
  stripeAuthUrl.searchParams.set('response_type', 'code');
  stripeAuthUrl.searchParams.set('client_id', STRIPE_CONNECT_CLIENT_ID);
  stripeAuthUrl.searchParams.set('scope', 'read_only');
  stripeAuthUrl.searchParams.set('state', state);
  stripeAuthUrl.searchParams.set('redirect_uri', `${BASE_URL}/api/stripe/callback`);

  // Debug logging
  console.log('[Stripe Auth] BASE_URL:', BASE_URL);
  console.log('[Stripe Auth] Redirect URL:', stripeAuthUrl.toString());

  return NextResponse.redirect(stripeAuthUrl.toString());
}

