"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import {
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  LogIn,
  Shield,
  Edit2,
  Eye,
} from "lucide-react";
import Link from "next/link";

interface InviteDetails {
  valid: boolean;
  organizationName?: string;
  email?: string;
  accessLevel?: string;
  invitedBy?: string;
  status?: string;
  error?: string;
}

const ACCESS_LEVEL_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="w-5 h-5" />,
  editor: <Edit2 className="w-5 h-5" />,
  viewer: <Eye className="w-5 h-5" />,
};

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = params.token as string;

  // Fetch invite details
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/org/invite/accept?token=${token}`);
        const data = await res.json();
        setInviteDetails(data);
      } catch (err) {
        setInviteDetails({ valid: false, error: "Failed to load invite" });
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch("/api/org/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      setSuccess(true);
      
      // Redirect to the organization after a short delay
      setTimeout(() => {
        router.push("/growth/metrics");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // Invalid or expired invite
  if (!inviteDetails?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-500/10">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            Invalid Invite
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
            {inviteDetails?.error || "This invite link is invalid or has expired."}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500/10">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            Welcome to {inviteDetails.organizationName}!
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
            You&apos;ve joined as {inviteDetails.accessLevel}. Redirecting...
          </p>
          <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--accent)" }} />
        </motion.div>
      </div>
    );
  }

  // Email mismatch warning
  const emailMismatch = user && user.email?.toLowerCase() !== inviteDetails.email?.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-500/10">
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            You&apos;re Invited!
          </h1>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            {inviteDetails.invitedBy} invited you to join
          </p>
          <p className="text-lg font-semibold mt-1" style={{ color: "var(--accent)" }}>
            {inviteDetails.organizationName}
          </p>
        </div>

        {/* Invite Details */}
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
              {ACCESS_LEVEL_ICONS[inviteDetails.accessLevel || "viewer"]}
            </div>
            <div>
              <p className="font-medium capitalize" style={{ color: "var(--foreground)" }}>
                {inviteDetails.accessLevel} Access
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                Invite sent to {inviteDetails.email}
              </p>
            </div>
          </div>
        </div>

        {/* Email Mismatch Warning */}
        {emailMismatch && (
          <div className="rounded-lg p-4 mb-6 bg-yellow-500/10 text-yellow-600">
            <p className="text-sm">
              ⚠️ This invite was sent to <strong>{inviteDetails.email}</strong>, but you&apos;re logged in as <strong>{user?.email}</strong>. 
              Please log in with the correct account.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg p-4 mb-6 bg-red-500/10 text-red-500 flex items-center gap-2">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        {user ? (
          <button
            onClick={handleAccept}
            disabled={accepting || !!emailMismatch}
            className="w-full px-6 py-3 rounded-lg font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {accepting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Accept Invite
              </>
            )}
          </button>
        ) : (
          <Link
            href={`/login?redirect=/invite/${token}`}
            className="w-full px-6 py-3 rounded-lg font-medium text-white flex items-center justify-center gap-2"
            style={{ background: "var(--accent)" }}
          >
            <LogIn className="w-5 h-5" />
            Log In to Accept
          </Link>
        )}

        <p className="text-xs text-center mt-4" style={{ color: "var(--foreground-subtle)" }}>
          By accepting, you agree to join this organization with the access level shown above.
        </p>
      </motion.div>
    </div>
  );
}

