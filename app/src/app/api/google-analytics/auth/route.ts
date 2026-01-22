import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXTAUTH_URL 
  ? `${process.env.NEXTAUTH_URL}/api/google-analytics/callback`
  : 'http://localhost:3000/api/google-analytics/callback';

// Google Analytics + Search Console scopes
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId parameter' },
      { status: 400 }
    );
  }

  // Create state parameter to pass organizationId through OAuth flow
  const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const finalUrl = authUrl.toString();
  
  console.log('GA OAuth - Full authorization URL:', finalUrl);
  console.log('GA OAuth - Parameters:', {
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scopes: SCOPES,
    state: state.substring(0, 20) + '...',
  });

  return NextResponse.redirect(finalUrl);
}

