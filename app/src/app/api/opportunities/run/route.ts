import { NextRequest, NextResponse } from 'next/server';

/**
 * Trigger Scout AI to run and detect opportunities
 * POST /api/opportunities/run
 * 
 * Body:
 * - organizationId: string (required)
 * - lookbackDays: object (optional) - lookback period per category
 *   { seo: 30, email: 30, advertising: 30, pages: 30, traffic: 30, revenue: 30, content: 30 }
 */
export async function POST(request: NextRequest) {
  const { organizationId, lookbackDays } = await request.json();

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    // Call Scout AI Cloud Function with lookback periods
    const response = await fetch(
      'https://us-central1-opsos-864a1.cloudfunctions.net/scout-ai-engine',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          organizationId,
          lookbackDays: lookbackDays || {}
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to run Scout AI' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Scout AI execution error:', error);
    return NextResponse.json(
      { error: 'Failed to run Scout AI' },
      { status: 500 }
    );
  }
}
