import { NextRequest, NextResponse } from 'next/server';

/**
 * Trigger entity map seeding from existing Firestore data
 * POST /api/entity-map/seed
 */
export async function POST(request: NextRequest) {
  const { organizationId } = await request.json();

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Missing organizationId' },
      { status: 400 }
    );
  }

  try {
    // Call Cloud Function
    const response = await fetch(
      'https://us-central1-opsos-864a1.cloudfunctions.net/entity-map-seeder',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to seed entity map' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Entity map seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed entity map' },
      { status: 500 }
    );
  }
}
