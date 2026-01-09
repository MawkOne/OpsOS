import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, query, where, getDocs, Timestamp, deleteDoc } from "firebase/firestore";
import crypto from "crypto";

// Access levels for organization members
export type AccessLevel = "owner" | "admin" | "editor" | "viewer";

const ACCESS_LEVELS: Record<AccessLevel, { label: string; description: string; permissions: string[] }> = {
  owner: {
    label: "Owner",
    description: "Full access including billing and organization settings",
    permissions: ["*"],
  },
  admin: {
    label: "Admin",
    description: "Can manage members and all data",
    permissions: ["manage_members", "manage_data", "view_data"],
  },
  editor: {
    label: "Editor",
    description: "Can create and edit data",
    permissions: ["manage_data", "view_data"],
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to dashboards",
    permissions: ["view_data"],
  },
};

// POST - Send an invite
export async function POST(request: NextRequest) {
  try {
    const { organizationId, email, accessLevel, invitedBy } = await request.json();

    if (!organizationId || !email || !accessLevel || !invitedBy) {
      return NextResponse.json(
        { error: "Organization ID, email, access level, and inviter are required" },
        { status: 400 }
      );
    }

    // Validate access level
    if (!ACCESS_LEVELS[accessLevel as AccessLevel]) {
      return NextResponse.json(
        { error: "Invalid access level" },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const membersQuery = query(
      collection(db, "org_members"),
      where("organizationId", "==", organizationId),
      where("email", "==", email.toLowerCase())
    );
    const existingMembers = await getDocs(membersQuery);
    
    if (!existingMembers.empty) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 }
      );
    }

    // Check if invite already exists
    const invitesQuery = query(
      collection(db, "org_invites"),
      where("organizationId", "==", organizationId),
      where("email", "==", email.toLowerCase()),
      where("status", "==", "pending")
    );
    const existingInvites = await getDocs(invitesQuery);
    
    if (!existingInvites.empty) {
      return NextResponse.json(
        { error: "An invite has already been sent to this email" },
        { status: 400 }
      );
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Get organization name
    const orgDoc = await getDoc(doc(db, "organizations", organizationId));
    const orgName = orgDoc.exists() ? orgDoc.data().name : "Unknown Organization";

    // Create invite
    const inviteId = `${organizationId}_${crypto.randomBytes(8).toString("hex")}`;
    await setDoc(doc(db, "org_invites", inviteId), {
      id: inviteId,
      organizationId,
      organizationName: orgName,
      email: email.toLowerCase(),
      accessLevel,
      token,
      status: "pending",
      invitedBy,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
    });

    // TODO: Send email with invite link
    // For now, return the invite link
    const inviteLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${token}`;

    return NextResponse.json({
      success: true,
      message: `Invite sent to ${email}`,
      inviteLink, // In production, this would be sent via email
      inviteId,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}

// GET - List pending invites for an organization
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
    const invitesQuery = query(
      collection(db, "org_invites"),
      where("organizationId", "==", organizationId)
    );
    const invitesSnapshot = await getDocs(invitesQuery);
    
    const invites = invitesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        accessLevel: data.accessLevel,
        status: data.status,
        invitedBy: data.invitedBy,
        createdAt: data.createdAt?.toDate?.(),
        expiresAt: data.expiresAt?.toDate?.(),
      };
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

// DELETE - Revoke an invite
export async function DELETE(request: NextRequest) {
  try {
    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID is required" },
        { status: 400 }
      );
    }

    await deleteDoc(doc(db, "org_invites", inviteId));

    return NextResponse.json({
      success: true,
      message: "Invite revoked",
    });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json(
      { error: "Failed to revoke invite" },
      { status: 500 }
    );
  }
}

