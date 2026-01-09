import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";

// GET - List all members of an organization
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
    const membersQuery = query(
      collection(db, "org_members"),
      where("organizationId", "==", organizationId)
    );
    const membersSnapshot = await getDocs(membersQuery);

    const members = membersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        email: data.email,
        name: data.name,
        accessLevel: data.accessLevel,
        joinedAt: data.joinedAt?.toDate?.(),
        invitedBy: data.invitedBy,
      };
    });

    // Also get the organization owner from the organizations collection
    const orgDoc = await getDoc(doc(db, "organizations", organizationId));
    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      // Check if owner is already in members list
      const ownerInList = members.some(m => m.userId === orgData.ownerId);
      if (!ownerInList && orgData.ownerId) {
        // Fetch owner info
        const ownerDoc = await getDoc(doc(db, "users", orgData.ownerId));
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          members.unshift({
            id: `${organizationId}_${orgData.ownerId}`,
            userId: orgData.ownerId,
            email: ownerData.email || "",
            name: ownerData.displayName || ownerData.email?.split("@")[0] || "Owner",
            accessLevel: "owner",
            joinedAt: orgData.createdAt?.toDate?.() || new Date(),
            invitedBy: null,
          });
        }
      }
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// PATCH - Update a member's access level
export async function PATCH(request: NextRequest) {
  try {
    const { memberId, accessLevel, requesterId, organizationId } = await request.json();

    if (!memberId || !accessLevel || !requesterId || !organizationId) {
      return NextResponse.json(
        { error: "Member ID, access level, requester ID, and organization ID are required" },
        { status: 400 }
      );
    }

    // Validate access level
    const validLevels = ["admin", "editor", "viewer"];
    if (!validLevels.includes(accessLevel)) {
      return NextResponse.json(
        { error: "Invalid access level. Cannot set as owner." },
        { status: 400 }
      );
    }

    // Check if requester has permission (must be owner or admin)
    const orgDoc = await getDoc(doc(db, "organizations", organizationId));
    if (!orgDoc.exists()) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgData = orgDoc.data();
    const isOwner = orgData.ownerId === requesterId;

    if (!isOwner) {
      // Check if requester is admin
      const requesterMemberQuery = query(
        collection(db, "org_members"),
        where("organizationId", "==", organizationId),
        where("userId", "==", requesterId)
      );
      const requesterSnapshot = await getDocs(requesterMemberQuery);
      const requesterMember = requesterSnapshot.docs[0]?.data();
      
      if (!requesterMember || requesterMember.accessLevel !== "admin") {
        return NextResponse.json(
          { error: "You don't have permission to change member roles" },
          { status: 403 }
        );
      }
    }

    // Update the member's access level
    await updateDoc(doc(db, "org_members", memberId), {
      accessLevel,
      updatedAt: Timestamp.now(),
      updatedBy: requesterId,
    });

    return NextResponse.json({
      success: true,
      message: "Member access level updated",
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a member from the organization
export async function DELETE(request: NextRequest) {
  try {
    const { memberId, requesterId, organizationId } = await request.json();

    if (!memberId || !requesterId || !organizationId) {
      return NextResponse.json(
        { error: "Member ID, requester ID, and organization ID are required" },
        { status: 400 }
      );
    }

    // Get member info first
    const memberDoc = await getDoc(doc(db, "org_members", memberId));
    if (!memberDoc.exists()) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const memberData = memberDoc.data();

    // Check if requester has permission (must be owner or admin)
    const orgDoc = await getDoc(doc(db, "organizations", organizationId));
    if (!orgDoc.exists()) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgData = orgDoc.data();
    const isOwner = orgData.ownerId === requesterId;

    // Cannot remove the owner
    if (memberData.userId === orgData.ownerId) {
      return NextResponse.json(
        { error: "Cannot remove the organization owner" },
        { status: 400 }
      );
    }

    if (!isOwner) {
      // Check if requester is admin
      const requesterMemberQuery = query(
        collection(db, "org_members"),
        where("organizationId", "==", organizationId),
        where("userId", "==", requesterId)
      );
      const requesterSnapshot = await getDocs(requesterMemberQuery);
      const requesterMember = requesterSnapshot.docs[0]?.data();
      
      if (!requesterMember || requesterMember.accessLevel !== "admin") {
        return NextResponse.json(
          { error: "You don't have permission to remove members" },
          { status: 403 }
        );
      }
    }

    // Remove from org_members
    await deleteDoc(doc(db, "org_members", memberId));

    // Remove org from user's organizationIds
    const userDoc = await getDoc(doc(db, "users", memberData.userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const orgIds = (userData.organizationIds || []).filter(
        (id: string) => id !== organizationId
      );
      await updateDoc(doc(db, "users", memberData.userId), {
        organizationIds: orgIds,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Member removed from organization",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}

