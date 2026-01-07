"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { Organization, OrgMembership, OrgRole, rolePermissions } from "@/types/organization";

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  currentMembership: OrgMembership | null;
  loading: boolean;
  error: string | null;
  setCurrentOrg: (org: Organization) => void;
  createOrganization: (name: string) => Promise<Organization>;
  switchOrganization: (orgId: string) => Promise<void>;
  inviteMember: (email: string, role: OrgRole) => Promise<void>;
  updateMemberRole: (membershipId: string, role: OrgRole) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  canEdit: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] = useState<OrgMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's organizations
  useEffect(() => {
    if (!user?.uid) {
      setOrganizations([]);
      setCurrentOrg(null);
      setCurrentMembership(null);
      setLoading(false);
      return;
    }

    // Reset loading when user changes - prevents flash to onboarding
    setLoading(true);

    const fetchOrganizations = async () => {
      try {
        // Get all memberships for this user
        const membershipsQuery = query(
          collection(db, "org_memberships"),
          where("userId", "==", user.uid)
        );
        const membershipsSnap = await getDocs(membershipsQuery);
        
        if (membershipsSnap.empty) {
          setOrganizations([]);
          setCurrentOrg(null);
          setLoading(false);
          return;
        }

        // Fetch all organizations the user is a member of
        const orgIds = membershipsSnap.docs.map(doc => doc.data().organizationId);
        const orgs: Organization[] = [];
        
        for (const orgId of orgIds) {
          const orgDoc = await getDoc(doc(db, "organizations", orgId));
          if (orgDoc.exists()) {
            orgs.push({ id: orgDoc.id, ...orgDoc.data() } as Organization);
          }
        }

        setOrganizations(orgs);

        // Set current org from localStorage or use first one
        const savedOrgId = localStorage.getItem("currentOrgId");
        const savedOrg = orgs.find(o => o.id === savedOrgId);
        
        if (savedOrg) {
          setCurrentOrg(savedOrg);
          // Find membership for this org
          const membership = membershipsSnap.docs.find(
            d => d.data().organizationId === savedOrg.id
          );
          if (membership) {
            setCurrentMembership({ id: membership.id, ...membership.data() } as OrgMembership);
          }
        } else if (orgs.length > 0) {
          setCurrentOrg(orgs[0]);
          localStorage.setItem("currentOrgId", orgs[0].id);
          // Find membership for this org
          const membership = membershipsSnap.docs.find(
            d => d.data().organizationId === orgs[0].id
          );
          if (membership) {
            setCurrentMembership({ id: membership.id, ...membership.data() } as OrgMembership);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching organizations:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [user?.uid]);

  // Listen for changes to current org
  useEffect(() => {
    if (!currentOrg?.id) return;

    const unsubscribe = onSnapshot(
      doc(db, "organizations", currentOrg.id),
      (snapshot) => {
        if (snapshot.exists()) {
          setCurrentOrg({ id: snapshot.id, ...snapshot.data() } as Organization);
        }
      }
    );

    return () => unsubscribe();
  }, [currentOrg?.id]);

  const createOrganization = async (name: string): Promise<Organization> => {
    if (!user?.uid || !user?.email) {
      throw new Error("Must be logged in to create an organization");
    }

    // Create slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create organization
    const orgRef = await addDoc(collection(db, "organizations"), {
      name,
      slug,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings: {
        defaultCurrency: "USD",
        fiscalYearStart: 1,
      },
    });

    // Create membership for creator as owner
    await addDoc(collection(db, "org_memberships"), {
      organizationId: orgRef.id,
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || user.email,
      role: "owner" as OrgRole,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const newOrg: Organization = {
      id: orgRef.id,
      name,
      slug,
      createdBy: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      settings: {
        defaultCurrency: "USD",
        fiscalYearStart: 1,
      },
    };

    setOrganizations(prev => [...prev, newOrg]);
    setCurrentOrg(newOrg);
    localStorage.setItem("currentOrgId", newOrg.id);

    // Set membership
    setCurrentMembership({
      id: "", // Will be set on next fetch
      organizationId: newOrg.id,
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || undefined,
      role: "owner",
      joinedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return newOrg;
  };

  const switchOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Find membership
    const membershipsQuery = query(
      collection(db, "org_memberships"),
      where("organizationId", "==", orgId),
      where("userId", "==", user?.uid)
    );
    const membershipsSnap = await getDocs(membershipsQuery);
    
    if (!membershipsSnap.empty) {
      const membershipDoc = membershipsSnap.docs[0];
      setCurrentMembership({ id: membershipDoc.id, ...membershipDoc.data() } as OrgMembership);
    }

    setCurrentOrg(org);
    localStorage.setItem("currentOrgId", orgId);
  };

  const inviteMember = async (email: string, role: OrgRole) => {
    if (!currentOrg || !user) {
      throw new Error("No organization selected");
    }

    // Check if user already a member
    const existingQuery = query(
      collection(db, "org_memberships"),
      where("organizationId", "==", currentOrg.id),
      where("userEmail", "==", email.toLowerCase())
    );
    const existingSnap = await getDocs(existingQuery);
    
    if (!existingSnap.empty) {
      throw new Error("User is already a member of this organization");
    }

    // Create invite
    await addDoc(collection(db, "org_invites"), {
      organizationId: currentOrg.id,
      organizationName: currentOrg.name,
      email: email.toLowerCase(),
      role,
      invitedBy: user.uid,
      invitedByEmail: user.email,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      status: "pending",
    });
  };

  const updateMemberRole = async (membershipId: string, role: OrgRole) => {
    await updateDoc(doc(db, "org_memberships", membershipId), {
      role,
      updatedAt: serverTimestamp(),
    });
  };

  const removeMember = async (membershipId: string) => {
    // In production, you'd want to soft delete or archive
    await updateDoc(doc(db, "org_memberships", membershipId), {
      status: "removed",
      updatedAt: serverTimestamp(),
    });
  };

  // Computed permissions
  const permissions = currentMembership?.role 
    ? rolePermissions[currentMembership.role] 
    : { canViewData: false, canEditData: false, canManageMembers: false, canManageSettings: false, canDeleteOrg: false };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        currentMembership,
        loading,
        error,
        setCurrentOrg,
        createOrganization,
        switchOrganization,
        inviteMember,
        updateMemberRole,
        removeMember,
        canEdit: permissions.canEditData,
        canManageMembers: permissions.canManageMembers,
        canManageSettings: permissions.canManageSettings,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

