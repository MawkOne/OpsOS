import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXTAUTH_URL 
  ? `${process.env.NEXTAUTH_URL}/api/google-analytics/callback`
  : 'http://localhost:3000/api/google-analytics/callback';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string;
}

interface GoogleAnalyticsAccount {
  name: string;
  displayName: string;
}

interface GoogleAnalyticsProperty {
  name: string;
  displayName: string;
  parent: string;
  accountId?: string;
  accountName?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      `${baseUrl}/sources/google-analytics?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/sources/google-analytics?error=missing_params`
    );
  }

  try {
    // Decode state to get organizationId
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { organizationId } = stateData;

    if (!organizationId) {
      throw new Error('Missing organizationId in state');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let userInfo: GoogleUserInfo | null = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    // Get Google Analytics accounts
    const accountsResponse = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accounts',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let accounts: GoogleAnalyticsAccount[] = [];
    let properties: GoogleAnalyticsProperty[] = [];

    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      accounts = accountsData.accounts || [];

      // Get properties for each account
      for (const account of accounts) {
        const accountId = account.name.replace('accounts/', '');
        
        const propertiesResponse = await fetch(
          `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${account.name}`,
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );

        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          const accountProperties = (propertiesData.properties || []).map((p: GoogleAnalyticsProperty) => ({
            ...p,
            accountId: accountId,
            accountName: account.displayName,
          }));
          properties = [...properties, ...accountProperties];
        }
      }
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store the pending connection (tokens + available properties) in Firestore
    // User will select which property to sync
    const pendingConnectionRef = doc(db, 'ga_pending_connections', organizationId);
    await setDoc(pendingConnectionRef, {
      organizationId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: expiresAt,
      userEmail: userInfo?.email || null,
      userName: userInfo?.name || null,
      accounts: accounts.map(a => ({
        id: a.name,
        displayName: a.displayName,
      })),
      properties: properties.map(p => ({
        id: p.name,
        displayName: p.displayName,
        accountId: p.accountId || p.parent,
        accountName: p.accountName || '',
      })),
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minute expiry for selection
    });

    // Prepare data for the selection page
    const selectionData = {
      organizationId,
      userEmail: userInfo?.email,
      userName: userInfo?.name,
      accounts: accounts.map(a => ({
        id: a.name,
        displayName: a.displayName,
      })),
      properties: properties.map(p => ({
        id: p.name,
        displayName: p.displayName,
        accountId: p.accountId || p.parent,
        accountName: p.accountName || '',
      })),
    };

    // Redirect to property selection page
    const encodedData = encodeURIComponent(JSON.stringify(selectionData));
    return NextResponse.redirect(
      `${baseUrl}/sources/google-analytics/select-property?data=${encodedData}`
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      `${baseUrl}/sources/google-analytics?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
