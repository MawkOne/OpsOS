import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, query, where, getDocs, Timestamp, updateDoc } from "firebase/firestore";

// POST - Accept an invite
export async function POST(request: NextRequest) {
  try {
    const { token, userId, userEmail, userName } = await request.json();

    if (!token || !userId || !userEmail) {
      return NextResponse.json(
        { error: "Token, user ID, and email are required" },
        { status: 400 }
      );
    }

    // Find the invite by token
    const invitesQuery = query(
      collection(db, "org_invites"),
      where("token", "==", token),
      where("status", "==", "pending")
    );
    const invitesSnapshot = await getDocs(invitesQuery);

    if (invitesSnapshot.empty) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    const inviteDoc = invitesSnapshot.docs[0];
    const invite = inviteDoc.data();

    // Check if invite has expired
    const expiresAt = invite.expiresAt?.toDate?.();
    if (expiresAt && expiresAt < new Date()) {
      await updateDoc(doc(db, "org_invites", inviteDoc.id), {
        status: "expired",
      });
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 400 }
      );
    }

    // Verify email matches (case-insensitive)
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const membersQuery = query(
      collection(db, "org_members"),
      where("organizationId", "==", invite.organizationId),
      where("userId", "==", userId)
    );
    const existingMembers = await getDocs(membersQuery);

    if (!existingMembers.empty) {
      // Update invite status
      await updateDoc(doc(db, "org_invites", inviteDoc.id), {
        status: "accepted",
        acceptedAt: Timestamp.now(),
      });
      
      return NextResponse.json({
        success: true,
        message: "You are already a member of this organization",
        organizationId: invite.organizationId,
      });
    }

    // Add user as member
    const memberId = `${invite.organizationId}_${userId}`;
    await setDoc(doc(db, "org_members", memberId), {
      id: memberId,
      organizationId: invite.organizationId,
      userId,
      email: userEmail.toLowerCase(),
      name: userName || userEmail.split("@")[0],
      accessLevel: invite.accessLevel,
      invitedBy: invite.invitedBy,
      joinedAt: Timestamp.now(),
    });

    // Update invite status
    await updateDoc(doc(db, "org_invites", inviteDoc.id), {
      status: "accepted",
      acceptedAt: Timestamp.now(),
      acceptedByUserId: userId,
    });

    // Also update the user's organizations list
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const orgIds = userData.organizationIds || [];
      if (!orgIds.includes(invite.organizationId)) {
        await updateDoc(doc(db, "users", userId), {
          organizationIds: [...orgIds, invite.organizationId],
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Welcome to ${invite.organizationName}!`,
      organizationId: invite.organizationId,
      accessLevel: invite.accessLevel,
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}

// GET - Get invite details by token (for the accept page)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Token is required" },
      { status: 400 }
    );
  }

  try {
    const invitesQuery = query(
      collection(db, "org_invites"),
      where("token", "==", token)
    );
    const invitesSnapshot = await getDocs(invitesQuery);

    if (invitesSnapshot.empty) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    const invite = invitesSnapshot.docs[0].data();

    // Check if already used
    if (invite.status !== "pending") {
      return NextResponse.json({
        valid: false,
        status: invite.status,
        error: invite.status === "accepted" ? "This invite has already been used" : "This invite is no longer valid",
      });
    }

    // Check expiration
    const expiresAt = invite.expiresAt?.toDate?.();
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({
        valid: false,
        status: "expired",
        error: "This invite has expired",
      });
    }

    return NextResponse.json({
      valid: true,
      organizationName: invite.organizationName,
      email: invite.email,
      accessLevel: invite.accessLevel,
      invitedBy: invite.invitedBy,
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json(
      { error: "Failed to fetch invite" },
      { status: 500 }
    );
  }
}

