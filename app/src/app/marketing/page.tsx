"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Megaphone,
  Activity,
  Users,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  BarChart3,
  Globe,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface GoogleAnalyticsConnection {
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSyncAt?: { toDate: () => Date };
  propertyId?: string;
  propertyName?: string;
}

interface ActiveCampaignConnection {
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSyncAt?: { toDate: () => Date };
  accountName?: string;
}

interface MarketingMetrics {
  totalVisitors: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  newUsers: number;
  returningUsers: number;
}

export default function MarketingDashboard() {
  const { currentOrg } = useOrganization();
  const [gaConnection, setGaConnection] = useState<GoogleAnalyticsConnection | null>(null);
  const [acConnection, setAcConnection] = useState<ActiveCampaignConnection | null>(null);
  const [metrics, setMetrics] = useState<MarketingMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = currentOrg?.id || "";

  // Listen to Google Analytics connection
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribeGA = onSnapshot(
      doc(db, "ga_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setGaConnection(snapshot.data() as GoogleAnalyticsConnection);
        } else {
          setGaConnection(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to GA connection:", error);
        setLoading(false);
      }
    );

    // Listen to ActiveCampaign connection
    const unsubscribeAC = onSnapshot(
      doc(db, "activecampaign_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setAcConnection(snapshot.data() as ActiveCampaignConnection);
        } else {
          setAcConnection(null);
        }
      },
      (error) => {
        console.error("Error listening to AC connection:", error);
      }
    );

    return () => {
      unsubscribeGA();
      unsubscribeAC();
    };
  }, [organizationId]);

  const isGAConnected = gaConnection?.status === "connected";
  const isACConnected = acConnection?.status === "connected";
  const connectedSourcesCount = (isGAConnected ? 1 : 0) + (isACConnected ? 1 : 0);
  const totalSourcesCount = 2; // Google Analytics + ActiveCampaign

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <AppLayout title="Marketing" subtitle="Track and analyze your marketing performance">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <MetricCard
              label="Total Visitors"
              value={metrics?.totalVisitors ? formatNumber(metrics.totalVisitors) : "—"}
              icon={<Users className="w-5 h-5" />}
              color="#ec4899"
              subtitle={isGAConnected ? "last 30 days" : "Connect GA to track"}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <MetricCard
              label="Page Views"
              value={metrics?.pageViews ? formatNumber(metrics.pageViews) : "—"}
              icon={<Eye className="w-5 h-5" />}
              color="#3b82f6"
              subtitle="last 30 days"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MetricCard
              label="Avg. Session Duration"
              value={metrics?.avgSessionDuration ? formatDuration(metrics.avgSessionDuration) : "—"}
              icon={<Clock className="w-5 h-5" />}
              color="#8b5cf6"
              subtitle="engagement time"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <MetricCard
              label="Connected Sources"
              value={`${connectedSourcesCount}/${totalSourcesCount}`}
              icon={<CheckCircle className="w-5 h-5" />}
              color="#f59e0b"
            />
          </motion.div>
        </div>

        {/* Secondary Metrics */}
        {isGAConnected && metrics && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                label="Bounce Rate"
                value={metrics.bounceRate ? `${metrics.bounceRate.toFixed(1)}%` : "—"}
                icon={<MousePointer className="w-5 h-5" />}
                color="#ef4444"
              />
              <MetricCard
                label="New Users"
                value={formatNumber(metrics.newUsers)}
                icon={<Users className="w-5 h-5" />}
                color="#10b981"
              />
              <MetricCard
                label="Returning Users"
                value={formatNumber(metrics.returningUsers)}
                icon={<Users className="w-5 h-5" />}
                color="#06b6d4"
              />
            </div>
          </motion.div>
        )}

        {/* Marketing Sources */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Data Sources
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Analytics Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <SourceCard
                name="Google Analytics"
                description="Track website traffic, user behavior, and conversion metrics"
                icon={<Activity className="w-6 h-6" />}
                color="#F9AB00"
                status={isGAConnected ? "connected" : gaConnection?.status || "disconnected"}
                href="/sources/google-analytics"
                lastSync={gaConnection?.lastSyncAt?.toDate()}
                propertyName={gaConnection?.propertyName}
              />
            </motion.div>

            {/* ActiveCampaign Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <SourceCard
                name="ActiveCampaign"
                description="Sync contacts, deals, campaigns, and marketing automations"
                icon={<Mail className="w-6 h-6" />}
                color="#356AE6"
                status={isACConnected ? "connected" : acConnection?.status || "disconnected"}
                href="/sources/activecampaign"
                lastSync={acConnection?.lastSyncAt?.toDate()}
                propertyName={acConnection?.accountName}
              />
            </motion.div>
          </div>
        </div>

        {/* Getting Started */}
        {connectedSourcesCount === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <div className="text-center py-8">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#ec489920", color: "#ec4899" }}
                >
                  <Megaphone className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Connect Google Analytics
                </h3>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--foreground-muted)" }}>
                  Connect your Google Analytics account to track website traffic, user behavior, and marketing performance all in one place.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/sources/google-analytics"
                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                    style={{ background: "#F9AB00", color: "#1a1a1a" }}
                  >
                    <Activity className="w-4 h-4" />
                    Connect Google Analytics
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        {isGAConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/marketing/analytics">
                <Card className="hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "#3b82f620", color: "#3b82f6" }}
                    >
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        Analytics
                      </h4>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        View detailed marketing analytics
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
              <Link href="/sources/google-analytics">
                <Card className="hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "#F9AB0020", color: "#F9AB00" }}
                    >
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        Google Analytics
                      </h4>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Manage your GA connection
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
              <Link href="/sources/activecampaign">
                <Card className="hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "#356AE620", color: "#356AE6" }}
                    >
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        ActiveCampaign
                      </h4>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Email marketing & CRM
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function MetricCard({ label, value, icon, color, subtitle }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{subtitle}</p>
      )}
    </Card>
  );
}

interface SourceCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  href: string;
  lastSync?: Date;
  propertyName?: string;
}

function SourceCard({ name, description, icon, color, status, href, lastSync, propertyName }: SourceCardProps) {
  return (
    <Link href={href}>
      <Card className="h-full hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}20`, color }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{name}</h3>
              {status === "connected" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )}
              {status === "syncing" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Syncing
                </span>
              )}
              {status === "disconnected" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                  <AlertCircle className="w-3 h-3" />
                  Not Connected
                </span>
              )}
              {status === "error" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  Error
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{description}</p>
            {propertyName && (
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                Property: {propertyName}
              </p>
            )}
            {lastSync && (
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                Last synced: {lastSync.toLocaleString()}
              </p>
            )}
          </div>
          <ExternalLink
            className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: "var(--foreground-muted)" }}
          />
        </div>
      </Card>
    </Link>
  );
}

