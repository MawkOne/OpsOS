import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, selectedPropertyId, selectedPropertyName, selectedAccountName } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId' },
        { status: 400 }
      );
    }

    if (!selectedPropertyId) {
      return NextResponse.json(
        { error: 'Missing selectedPropertyId' },
        { status: 400 }
      );
    }

    // Get the pending connection
    const pendingRef = doc(db, 'ga_pending_connections', organizationId);
    const pendingSnap = await getDoc(pendingRef);

    if (!pendingSnap.exists()) {
      return NextResponse.json(
        { error: 'No pending connection found. Please try connecting again.' },
        { status: 404 }
      );
    }

    const pendingData = pendingSnap.data();

    // Check if the pending connection has expired
    const expiresAt = pendingData.expiresAt?.toDate?.() || new Date(0);
    if (expiresAt < new Date()) {
      await deleteDoc(pendingRef);
      return NextResponse.json(
        { error: 'Connection expired. Please try connecting again.' },
        { status: 410 }
      );
    }

    // Verify the selected property exists in the pending connection
    const selectedProperty = pendingData.properties?.find(
      (p: { id: string }) => p.id === selectedPropertyId
    );

    if (!selectedProperty) {
      return NextResponse.json(
        { error: 'Selected property not found in your account' },
        { status: 400 }
      );
    }

    // Create the actual connection with only the selected property
    const connectionRef = doc(db, 'ga_connections', organizationId);
    await setDoc(connectionRef, {
      organizationId,
      status: 'connected',
      accessToken: pendingData.accessToken,
      refreshToken: pendingData.refreshToken,
      tokenExpiresAt: pendingData.tokenExpiresAt,
      userEmail: pendingData.userEmail,
      userName: pendingData.userName,
      // Store all properties for potential future switching
      properties: pendingData.properties,
      accounts: pendingData.accounts,
      // Set the selected property
      selectedPropertyId,
      selectedPropertyName: selectedPropertyName || selectedProperty.displayName,
      selectedAccountName: selectedAccountName || selectedProperty.accountName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Delete the pending connection
    await deleteDoc(pendingRef);

    return NextResponse.json({ 
      success: true,
      propertyId: selectedPropertyId,
      propertyName: selectedPropertyName || selectedProperty.displayName,
    });

  } catch (error) {
    console.error('Error finalizing GA connection:', error);
    return NextResponse.json(
      { error: 'Failed to finalize connection' },
      { status: 500 }
    );
  }
}

