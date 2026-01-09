"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Crown,
  Edit2,
  Loader2,
} from "lucide-react";

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  accessLevel: "owner" | "admin" | "editor" | "viewer";
  joinedAt: Date;
  invitedBy: string | null;
}

interface Invite {
  id: string;
  email: string;
  accessLevel: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
}

const ACCESS_LEVELS = [
  { value: "admin", label: "Admin", description: "Can manage members and all data", icon: Shield },
  { value: "editor", label: "Editor", description: "Can create and edit data", icon: Edit2 },
  { value: "viewer", label: "Viewer", description: "Read-only access", icon: Users },
];

export default function TeamSettingsPage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAccessLevel, setInviteAccessLevel] = useState("viewer");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const organizationId = currentOrg?.id || "";
  const currentUserId = user?.uid || "";

  // Check if current user can manage members
  const currentMember = members.find(m => m.userId === currentUserId);
  const canManageMembers = currentMember?.accessLevel === "owner" || currentMember?.accessLevel === "admin";

  const fetchData = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      // Fetch members
      const membersRes = await fetch(`/api/org/members?organizationId=${organizationId}`);
      const membersData = await membersRes.json();
      if (membersData.members) {
        setMembers(membersData.members);
      }

      // Fetch invites
      const invitesRes = await fetch(`/api/org/invite?organizationId=${organizationId}`);
      const invitesData = await invitesRes.json();
      if (invitesData.invites) {
        setInvites(invitesData.invites);
      }
    } catch (err) {
      console.error("Error fetching team data:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteAccessLevel) {
      setError("Please enter an email and select an access level");
      return;
    }

    setIsSending(true);
    setError(null);
    setInviteLink(null);

    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          email: inviteEmail,
          accessLevel: inviteAccessLevel,
          invitedBy: user?.email || currentUserId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send invite");
      }

      setSuccessMessage(`Invite sent to ${inviteEmail}`);
      setInviteLink(data.inviteLink);
      setInviteEmail("");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsSending(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await fetch("/api/org/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      fetchData();
    } catch (err) {
      console.error("Error revoking invite:", err);
    }
  };

  const handleUpdateRole = async (memberId: string, newAccessLevel: string) => {
    try {
      const res = await fetch("/api/org/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          accessLevel: newAccessLevel,
          requesterId: currentUserId,
          organizationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          requesterId: currentUserId,
          organizationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setSuccessMessage("Invite link copied to clipboard!");
    }
  };

  const getAccessLevelBadge = (level: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      owner: { bg: "rgba(139, 92, 246, 0.15)", text: "#8b5cf6" },
      admin: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" },
      editor: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981" },
      viewer: { bg: "rgba(107, 114, 128, 0.15)", text: "#6b7280" },
    };
    const style = colors[level] || colors.viewer;

    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-medium capitalize flex items-center gap-1"
        style={{ background: style.bg, color: style.text }}
      >
        {level === "owner" && <Crown className="w-3 h-3" />}
        {level}
      </span>
    );
  };

  const pendingInvites = invites.filter(i => i.status === "pending");

  return (
    <AppLayout title="Team" subtitle="Manage team members and access levels">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-lg bg-red-500/10 text-red-500 flex items-center gap-2"
            >
              <XCircle className="w-5 h-5 flex-shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto">×</button>
            </motion.div>
          )}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-lg bg-green-500/10 text-green-500 flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              {successMessage}
              <button onClick={() => setSuccessMessage(null)} className="ml-auto">×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invite Link Display */}
        {inviteLink && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl"
            style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Share this invite link:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: "var(--background-tertiary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <button
                onClick={copyInviteLink}
                className="px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
            </div>
          </motion.div>
        )}

        {/* Members Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Team Members
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {members.length} member{members.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {canManageMembers && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2"
                style={{ background: "var(--accent)" }}
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-[var(--background-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{
                        background: member.accessLevel === "owner" 
                          ? "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
                          : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      }}
                    >
                      {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {member.name}
                        {member.userId === currentUserId && (
                          <span className="text-xs ml-2" style={{ color: "var(--foreground-muted)" }}>(you)</span>
                        )}
                      </p>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getAccessLevelBadge(member.accessLevel)}
                    {canManageMembers && member.accessLevel !== "owner" && member.userId !== currentUserId && (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.accessLevel}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                          className="px-2 py-1 rounded text-sm"
                          style={{
                            background: "var(--background-tertiary)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground)",
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Pending Invites Section */}
        {pendingInvites.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
          >
            <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                    Pending Invites
                  </h2>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/10">
                      <Mail className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>{invite.email}</p>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Invited by {invite.invitedBy} • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getAccessLevelBadge(invite.accessLevel)}
                    {canManageMembers && (
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                        title="Revoke invite"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Invite Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setShowInviteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-xl p-6"
                style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                  Invite Team Member
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{
                        background: "var(--background-tertiary)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                      Access Level
                    </label>
                    <div className="space-y-2">
                      {ACCESS_LEVELS.map((level) => {
                        const Icon = level.icon;
                        return (
                          <label
                            key={level.value}
                            className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                            style={{
                              background: inviteAccessLevel === level.value ? "var(--accent-muted)" : "transparent",
                              border: `1px solid ${inviteAccessLevel === level.value ? "var(--accent)" : "var(--border)"}`,
                            }}
                          >
                            <input
                              type="radio"
                              name="accessLevel"
                              value={level.value}
                              checked={inviteAccessLevel === level.value}
                              onChange={(e) => setInviteAccessLevel(e.target.value)}
                              className="sr-only"
                            />
                            <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
                            <div>
                              <p className="font-medium" style={{ color: "var(--foreground)" }}>{level.label}</p>
                              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{level.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "var(--foreground-muted)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvite}
                    disabled={isSending || !inviteEmail}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Send Invite
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

