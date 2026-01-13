import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// QuickBooks OAuth 2.0 Token URL
const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId'); // QuickBooks company ID
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (errorParam) {
    console.error('QuickBooks OAuth error:', errorParam, errorDescription);
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=${errorParam}`);
  }

  // Parse state to get organizationId
  let organizationId: string;
  try {
    const stateData = JSON.parse(decodeURIComponent(state || '{}'));
    organizationId = stateData.organizationId;
  } catch {
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=invalid_state`);
  }

  if (!organizationId) {
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=missing_organization`);
  }

  if (!code) {
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=missing_code`);
  }

  if (!realmId) {
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=missing_realm_id`);
  }

  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=quickbooks_not_configured`);
  }

  try {
    // Exchange the authorization code for tokens
    const basicAuth = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${BASE_URL}/api/quickbooks/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('QuickBooks token exchange failed:', errorData);
      return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // seconds until access token expires
    const refreshTokenExpiresIn = tokenData.x_refresh_token_expires_in; // seconds until refresh token expires

    // Fetch company info from QuickBooks
    let companyName = '';
    try {
      const companyResponse = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        companyName = companyData.CompanyInfo?.CompanyName || '';
      }
    } catch (e) {
      console.error('Failed to fetch company info:', e);
    }

    // Calculate token expiry times
    const now = new Date();
    const accessTokenExpiry = new Date(now.getTime() + (expiresIn * 1000));
    const refreshTokenExpiry = new Date(now.getTime() + (refreshTokenExpiresIn * 1000));

    // Store the connection in Firestore
    const connectionRef = doc(db, 'quickbooks_connections', organizationId);
    await setDoc(connectionRef, {
      status: 'connected',
      realmId: realmId,
      companyName: companyName,
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiry: accessTokenExpiry,
      refreshTokenExpiry: refreshTokenExpiry,
      connectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Redirect back to the QuickBooks page with success
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?connected=true`);
  } catch (error) {
    console.error('QuickBooks OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(`${BASE_URL}/sources/quickbooks?error=${encodeURIComponent(message)}`);
  }
}

