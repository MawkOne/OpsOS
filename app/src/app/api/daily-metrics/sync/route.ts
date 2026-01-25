import { NextRequest, NextResponse } from 'next/server';

/**
 * Trigger daily metrics rollup from Firestore to BigQuery
 * POST /api/daily-metrics/sync
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, startDate, endDate } = body;

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    // Call Daily Rollup ETL Cloud Function
    const response = await fetch(
      'https://us-central1-opsos-864a1.cloudfunctions.net/daily-rollup-etl',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          organizationId,
          startDate,
          endDate 
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to run daily rollup' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Daily rollup error:', error);
    return NextResponse.json(
      { error: 'Failed to run daily rollup' },
      { status: 500 }
    );
  }
}
