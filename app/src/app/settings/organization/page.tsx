"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Settings,
  Mail,
  Trash2,
  UserPlus,
  Crown,
  Shield,
  User,
  Eye,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { OrgMembership, OrgRole } from "@/types/organization";

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const { currentOrg, currentMembership, canManageMembers, canManageSettings, inviteMember, updateMemberRole, removeMember } = useOrganization();
  const [members, setMembers] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch members
  useEffect(() => {
    if (!currentOrg?.id) {
      setLoading(false);
      return;
    }

    const membersQuery = query(
      collection(db, "org_memberships"),
      where("organizationId", "==", currentOrg.id)
    );

    const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
      const membersList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as OrgMembership))
        .filter(m => (m as any).status !== "removed");
      setMembers(membersList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentOrg?.id]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      await inviteMember(inviteEmail.trim(), inviteRole);
      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const getRoleIcon = (role: OrgRole) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4" style={{ color: "#f59e0b" }} />;
      case "admin":
        return <Shield className="w-4 h-4" style={{ color: "#8b5cf6" }} />;
      case "member":
        return <User className="w-4 h-4" style={{ color: "#3b82f6" }} />;
      case "viewer":
        return <Eye className="w-4 h-4" style={{ color: "#6b7280" }} />;
    }
  };

  const getRoleLabel = (role: OrgRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (!currentOrg) {
    return (
      <AppLayout title="Organization Settings" subtitle="Manage your organization">
        <div className="flex items-center justify-center h-64">
          <p style={{ color: "var(--foreground-muted)" }}>No organization selected</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Organization Settings" subtitle={`Manage ${currentOrg.name}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Organization Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                {currentOrg.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                  {currentOrg.name}
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {members.length} member{members.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {canManageSettings && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    Organization Name
                  </label>
                  <input
                    type="text"
                    defaultValue={currentOrg.name}
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--background)" }}
                >
                  Save Changes
                </button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Team Members
                </h3>
              </div>
            </div>

            {/* Invite Form */}
            {canManageMembers && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <h4 className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>
                  Invite a Team Member
                </h4>
                
                {error && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>
                    {success}
                  </div>
                )}

                <div className="flex gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--background-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: "var(--background-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={inviting}
                    className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    {inviting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Invite
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)", color: "white" }}
                    >
                      {(member.userName || member.userEmail).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {member.userName || member.userEmail}
                        {member.userId === user?.uid && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent)", color: "var(--background)" }}>
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {member.userEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(member.role)}
                      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                    {canManageMembers && member.userId !== user?.uid && member.role !== "owner" && (
                      <button
                        onClick={() => removeMember(member.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Your Role */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: "#8b5cf620", color: "#8b5cf6" }}
              >
                {currentMembership && getRoleIcon(currentMembership.role)}
              </div>
              <div>
                <h3 className="font-medium" style={{ color: "var(--foreground)" }}>
                  Your Role: {currentMembership ? getRoleLabel(currentMembership.role) : "Unknown"}
                </h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {currentMembership?.role === "owner" && "Full access to all organization settings and data"}
                  {currentMembership?.role === "admin" && "Can manage members and settings, but cannot delete the organization"}
                  {currentMembership?.role === "member" && "Can view and edit data, but cannot manage members or settings"}
                  {currentMembership?.role === "viewer" && "Can only view data, cannot make changes"}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}

