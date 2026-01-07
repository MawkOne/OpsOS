import { Timestamp } from "firebase/firestore";

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export interface Organization {
  id: string;
  name: string;
  slug: string; // URL-friendly identifier
  createdBy: string; // User ID who created
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings?: {
    defaultCurrency?: string;
    fiscalYearStart?: number; // Month (1-12)
  };
}

export interface OrgMembership {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  role: OrgRole;
  invitedBy?: string;
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrgInvite {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: OrgRole;
  invitedBy: string;
  invitedByEmail: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  status: "pending" | "accepted" | "declined" | "expired";
}

// Role permissions
export const rolePermissions: Record<OrgRole, {
  canViewData: boolean;
  canEditData: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canDeleteOrg: boolean;
}> = {
  owner: {
    canViewData: true,
    canEditData: true,
    canManageMembers: true,
    canManageSettings: true,
    canDeleteOrg: true,
  },
  admin: {
    canViewData: true,
    canEditData: true,
    canManageMembers: true,
    canManageSettings: true,
    canDeleteOrg: false,
  },
  member: {
    canViewData: true,
    canEditData: true,
    canManageMembers: false,
    canManageSettings: false,
    canDeleteOrg: false,
  },
  viewer: {
    canViewData: true,
    canEditData: false,
    canManageMembers: false,
    canManageSettings: false,
    canDeleteOrg: false,
  },
};

