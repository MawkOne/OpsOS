"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Users, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { createOrganization, organizations, loading: orgLoading } = useOrganization();
  const [step, setStep] = useState<"welcome" | "create">("welcome");
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already has an org
  useEffect(() => {
    if (!orgLoading && organizations.length > 0) {
      router.push("/growth/metrics");
    }
  }, [orgLoading, organizations, router]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Show nothing while redirecting
  if (!authLoading && !user) {
    return null;
  }

  if (!orgLoading && organizations.length > 0) {
    return null;
  }

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      setError("Please enter an organization name");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createOrganization(orgName.trim());
      router.push("/growth/metrics");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
      setCreating(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--background)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {step === "welcome" && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              <Sparkles className="w-10 h-10" />
            </motion.div>
            
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Welcome to OpsOS
            </h1>
            <p className="text-lg mb-8" style={{ color: "var(--foreground-muted)" }}>
              Hi {user?.displayName || user?.email?.split("@")[0]}! Let&apos;s get you set up.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => setStep("create")}
                className="w-full p-4 rounded-xl flex items-center gap-4 text-left transition-all hover:scale-[1.02]"
                style={{ 
                  background: "var(--background-secondary)", 
                  border: "1px solid var(--border)",
                }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ background: "#10b98120", color: "#10b981" }}
                >
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                    Create an Organization
                  </h3>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Set up a new workspace for your company or team
                  </p>
                </div>
                <ArrowRight className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
              </button>

              <div 
                className="w-full p-4 rounded-xl flex items-center gap-4 text-left opacity-50 cursor-not-allowed"
                style={{ 
                  background: "var(--background-secondary)", 
                  border: "1px solid var(--border)",
                }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ background: "#3b82f620", color: "#3b82f6" }}
                >
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                    Join an Organization
                  </h3>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Accept an invite from your team (check your email)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "create" && (
          <div>
            <button
              onClick={() => setStep("welcome")}
              className="text-sm mb-6 flex items-center gap-1 hover:underline"
              style={{ color: "var(--foreground-muted)" }}
            >
              ← Back
            </button>

            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center mb-6"
              style={{ background: "#10b98120", color: "#10b981" }}
            >
              <Building2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              Create Your Organization
            </h2>
            <p className="mb-6" style={{ color: "var(--foreground-muted)" }}>
              This is your company or team workspace. You can invite others later.
            </p>

            {error && (
              <div 
                className="px-4 py-3 rounded-lg mb-4 text-sm"
                style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}
              >
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-4 py-3 rounded-lg text-base outline-none transition-all focus:ring-2 focus:ring-[var(--accent)]/50"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateOrg();
                  }}
                />
              </div>

              <button
                onClick={handleCreateOrg}
                disabled={creating || !orgName.trim()}
                className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Organization
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

