import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXTAUTH_URL 
  ? `${process.env.NEXTAUTH_URL}/api/google-ads/callback`
  : 'http://localhost:3000/api/google-ads/callback';

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

interface GoogleAdsCustomer {
  resourceName: string;
  id: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  manager?: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  console.log('Google Ads Callback received:', {
    hasCode: !!code,
    hasState: !!state,
    error,
  });

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      `${baseUrl}/sources/google-ads?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    console.error('Missing OAuth params:', { code: !!code, state: !!state });
    return NextResponse.redirect(
      `${baseUrl}/sources/google-ads?error=missing_params`
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

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store the pending connection - user needs to provide developer token and customer ID
    const pendingConnectionRef = doc(db, 'google_ads_pending', organizationId);
    await setDoc(pendingConnectionRef, {
      organizationId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: expiresAt,
      userEmail: userInfo?.email || null,
      userName: userInfo?.name || null,
      createdAt: serverTimestamp(),
      status: 'pending_config', // User needs to provide developer token and customer ID
    });

    // Redirect to configuration page
    return NextResponse.redirect(
      `${baseUrl}/sources/google-ads?status=oauth_complete&email=${encodeURIComponent(userInfo?.email || '')}`
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      `${baseUrl}/sources/google-ads?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
