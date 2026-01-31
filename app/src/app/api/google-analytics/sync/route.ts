import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes max for Vercel Pro

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, mode = 'update', daysBack } = body;
    // mode: 'update' = incremental (30 days), 'full' = complete resync (5 years)

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    console.log(`[GA Sync Proxy] Starting sync for org: ${organizationId}`);

    // Call the Cloud Function with a longer timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 290000); // 290 seconds

    try {
      const response = await fetch(
        'https://us-central1-opsos-864a1.cloudfunctions.net/ga4-bigquery-sync',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, mode, ...(daysBack && { daysBack }) }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      const data = await response.json();
      
      console.log(`[GA Sync Proxy] Sync complete:`, data);
      
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        // The request timed out, but the Cloud Function may still be running
        return NextResponse.json({
          success: true,
          message: 'Sync started but took too long to respond. Check back in a few minutes.',
          partial: true,
        });
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[GA Sync Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
