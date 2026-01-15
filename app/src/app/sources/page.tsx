"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Activity,
  CreditCard,
  Receipt,
  Mail,
  Search,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface SourceStatus {
  name: string;
  type: "financial" | "marketing";
  status: "connected" | "disconnected" | "error";
  icon: React.ReactNode;
  color: string;
  href: string;
  lastSyncAt?: Date;
  description: string;
}

interface ConnectionData {
  status?: string;
  lastSyncAt?: {
    toDate?: () => Date;
  };
}

export default function SourcesPage() {
  const { currentOrg } = useOrganization();
  const [sources, setSources] = useState<SourceStatus[]>([]);

  const organizationId = currentOrg?.id || "";

  const getSourceConfig = useCallback((sourceName: string, data: ConnectionData | null): SourceStatus => {
    const rawStatus = data?.status || "disconnected";
    const status: "connected" | "disconnected" | "error" = 
      rawStatus === "connected" || rawStatus === "error" ? rawStatus : "disconnected";
    const lastSyncAt = data?.lastSyncAt?.toDate?.();

    const configs: Record<string, Omit<SourceStatus, "status" | "lastSyncAt">> = {
      stripe: {
        name: "Stripe",
        type: "financial",
        icon: <CreditCard className="w-6 h-6" />,
        color: "#635BFF",
        href: "/sources/stripe",
        description: "Payment processing and subscriptions",
      },
      quickbooks: {
        name: "QuickBooks",
        type: "financial",
        icon: <Receipt className="w-6 h-6" />,
        color: "#2CA01C",
        href: "/sources/quickbooks",
        description: "Accounting and financial management",
      },
      "google-analytics": {
        name: "Google Analytics",
        type: "marketing",
        icon: <Activity className="w-6 h-6" />,
        color: "#E37400",
        href: "/sources/google-analytics",
        description: "Website traffic and user analytics",
      },
      activecampaign: {
        name: "ActiveCampaign",
        type: "marketing",
        icon: <Mail className="w-6 h-6" />,
        color: "#356AE6",
        href: "/sources/activecampaign",
        description: "Email marketing and automation",
      },
      dataforseo: {
        name: "DataForSEO",
        type: "marketing",
        icon: <Search className="w-6 h-6" />,
        color: "#0066FF",
        href: "/sources/dataforseo",
        description: "SEO data and rankings",
      },
    };

    const config = configs[sourceName] || configs.stripe;
    return { ...config, status, lastSyncAt };
  }, []);

  const updateSourceStatus = useCallback((sourceName: string, data: ConnectionData | null) => {
    setSources((prev) => {
      const existing = prev.find((s) => s.href.includes(sourceName));
      const newSource = getSourceConfig(sourceName, data);

      if (existing) {
        return prev.map((s) => (s.href.includes(sourceName) ? newSource : s));
      } else {
        return [...prev, newSource];
      }
    });
  }, [getSourceConfig]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    // Listen to Stripe connection
    const stripeUnsubscribe = onSnapshot(
      doc(db, "stripe_connections", organizationId),
      (snapshot) => {
        updateSourceStatus("stripe", snapshot.exists() ? snapshot.data() as ConnectionData : null);
      }
    );

    // Listen to QuickBooks connection
    const qbUnsubscribe = onSnapshot(
      doc(db, "quickbooks_connections", organizationId),
      (snapshot) => {
        updateSourceStatus("quickbooks", snapshot.exists() ? snapshot.data() as ConnectionData : null);
      }
    );

    // Listen to Google Analytics connection
    const gaUnsubscribe = onSnapshot(
      doc(db, "ga4_connections", organizationId),
      (snapshot) => {
        updateSourceStatus("google-analytics", snapshot.exists() ? snapshot.data() as ConnectionData : null);
      }
    );

    // Listen to ActiveCampaign connection
    const acUnsubscribe = onSnapshot(
      doc(db, "activecampaign_connections", organizationId),
      (snapshot) => {
        updateSourceStatus("activecampaign", snapshot.exists() ? snapshot.data() as ConnectionData : null);
      }
    );

    // Listen to DataForSEO connection
    const seoUnsubscribe = onSnapshot(
      doc(db, "dataforseo_connections", organizationId),
      (snapshot) => {
        updateSourceStatus("dataforseo", snapshot.exists() ? snapshot.data() as ConnectionData : null);
      }
    );

    return () => {
      stripeUnsubscribe();
      qbUnsubscribe();
      gaUnsubscribe();
      acUnsubscribe();
      seoUnsubscribe();
    };
  }, [organizationId, updateSourceStatus]);

  const financialSources = sources.filter((s) => s.type === "financial");
  const marketingSources = sources.filter((s) => s.type === "marketing");

  const connectedCount = sources.filter((s) => s.status === "connected").length;
  const totalCount = 5; // Total number of available sources

  return (
    <AppLayout title="Sources" subtitle="Manage your data connections">
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Connected Sources
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connectedCount} / {totalCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" }}
                >
                  <Zap className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Financial Sources
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {financialSources.filter((s) => s.status === "connected").length} / {2}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Marketing Sources
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {marketingSources.filter((s) => s.status === "connected").length} / {3}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                >
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Financial Sources */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Financial Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {financialSources.map((source) => (
              <Link key={source.href} href={source.href}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${source.color}15`, color: source.color }}
                    >
                      {source.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                          {source.name}
                        </h3>
                        {source.status === "connected" ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                        )}
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--foreground-muted)" }}>
                        {source.description}
                      </p>
                      {source.lastSyncAt && (
                        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          Last synced: {source.lastSyncAt.toLocaleString()}
                        </p>
                      )}
                      {!source.lastSyncAt && source.status !== "connected" && (
                        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          Not connected
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Marketing Sources */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Marketing Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {marketingSources.map((source) => (
              <Link key={source.href} href={source.href}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ background: `${source.color}15`, color: source.color }}
                      >
                        {source.icon}
                      </div>
                      {source.status === "connected" ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                        {source.name}
                      </h3>
                      <p className="text-xs mb-2" style={{ color: "var(--foreground-muted)" }}>
                        {source.description}
                      </p>
                      {source.lastSyncAt && (
                        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          Last synced: {source.lastSyncAt.toLocaleString()}
                        </p>
                      )}
                      {!source.lastSyncAt && source.status !== "connected" && (
                        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          Not connected
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
