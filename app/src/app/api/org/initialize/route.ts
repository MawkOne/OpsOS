import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, getDocs, query, where } from "firebase/firestore";

// POST - Initialize organization owner (one-time setup)
export async function POST(request: NextRequest) {
  try {
    const { userId, email, displayName, organizationId } = await request.json();

    if (!userId || !email || !organizationId) {
      return NextResponse.json(
        { error: "User ID, email, and organization ID are required" },
        { status: 400 }
      );
    }

    // Check if user document exists, if not create it
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email,
        displayName: displayName || email.split("@")[0],
        createdAt: Timestamp.now(),
        organizationIds: [organizationId],
      });
    } else {
      // Update organization IDs if needed
      const userData = userDoc.data();
      const orgIds = userData.organizationIds || [];
      if (!orgIds.includes(organizationId)) {
        await updateDoc(userDocRef, {
          organizationIds: [...orgIds, organizationId],
        });
      }
    }

    // Set user as organization owner
    const orgDocRef = doc(db, "organizations", organizationId);
    const orgDoc = await getDoc(orgDocRef);
    
    if (!orgDoc.exists()) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgData = orgDoc.data();
    
    // Only set owner if not already set
    if (!orgData.ownerId) {
      await updateDoc(orgDocRef, {
        ownerId: userId,
        updatedAt: Timestamp.now(),
      });
    }

    // Check if user is already in org_members
    const membersQuery = query(
      collection(db, "org_members"),
      where("organizationId", "==", organizationId),
      where("userId", "==", userId)
    );
    const membersSnapshot = await getDocs(membersQuery);
    
    if (membersSnapshot.empty) {
      // Add user to org_members as owner
      await setDoc(doc(collection(db, "org_members")), {
        organizationId,
        userId,
        email,
        name: displayName || email.split("@")[0],
        accessLevel: "owner",
        joinedAt: Timestamp.now(),
        invitedBy: null,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Organization owner initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing organization:", error);
    return NextResponse.json(
      { error: "Failed to initialize organization" },
      { status: 500 }
    );
  }
}
