import { NextRequest, NextResponse } from 'next/server';

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// QuickBooks OAuth 2.0 Authorization URL
const QUICKBOOKS_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.redirect(`${BASE_URL}/revenue/quickbooks?error=missing_organization`);
  }

  if (!QUICKBOOKS_CLIENT_ID) {
    return NextResponse.redirect(`${BASE_URL}/revenue/quickbooks?error=quickbooks_not_configured`);
  }

  // Build the QuickBooks OAuth URL
  const state = encodeURIComponent(JSON.stringify({ organizationId }));
  
  const authUrl = new URL(QUICKBOOKS_AUTH_URL);
  authUrl.searchParams.set('client_id', QUICKBOOKS_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
  authUrl.searchParams.set('redirect_uri', `${BASE_URL}/api/quickbooks/callback`);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}

