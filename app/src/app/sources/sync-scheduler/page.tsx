"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  Activity,
  Database,
  Loader2,
  Play,
  Moon,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface ConnectionStatus {
  source: string;
  displayName: string;
  icon: string;
  connected: boolean;
  lastSync?: Date;
  status?: string;
}

const SOURCE_CONFIG = [
  { collection: "ga_connections", displayName: "Google Analytics", icon: "📊" },
  { collection: "activecampaign_connections", displayName: "ActiveCampaign", icon: "📧" },
  { collection: "stripe_connections", displayName: "Stripe", icon: "💳" },
  { collection: "quickbooks_connections", displayName: "QuickBooks", icon: "📒" },
  { collection: "google_ads_connections", displayName: "Google Ads", icon: "📢" },
  { collection: "dataforseo_connections", displayName: "DataForSEO", icon: "🔍" },
];

export default function SyncSchedulerPage() {
  const { currentOrg } = useOrganization();
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const organizationId = currentOrg?.id || "";

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchConnectionStatuses();
  }, [organizationId]);

  const fetchConnectionStatuses = async () => {
    setLoading(true);
    const statuses: ConnectionStatus[] = [];

    for (const source of SOURCE_CONFIG) {
      try {
        const docRef = await getDocs(
          query(collection(db, source.collection), where("__name__", "==", organizationId))
        );

        if (!docRef.empty) {
          const data = docRef.docs[0].data();
          statuses.push({
            source: source.collection,
            displayName: source.displayName,
            icon: source.icon,
            connected: data.status === "connected",
            lastSync: data.lastSyncAt?.toDate(),
            status: data.status,
          });
        } else {
          statuses.push({
            source: source.collection,
            displayName: source.displayName,
            icon: source.icon,
            connected: false,
          });
        }
      } catch (err) {
        statuses.push({
          source: source.collection,
          displayName: source.displayName,
          icon: source.icon,
          connected: false,
        });
      }
    }

    setConnections(statuses);
    setLoading(false);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch(
        "https://us-central1-opsos-864a1.cloudfunctions.net/nightly-sync-scheduler",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncResult(data);
        // Refresh connection statuses
        await fetchConnectionStatuses();
      } else {
        setError(data.error || "Sync failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger sync");
    } finally {
      setSyncing(false);
    }
  };

  const connectedCount = connections.filter((c) => c.connected).length;
  const nextSyncTime = new Date();
  nextSyncTime.setHours(24, 0, 0, 0); // Next midnight

  if (loading) {
    return (
      <AppLayout title="Sync Scheduler" subtitle="Automated nightly data syncs">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Sync Scheduler" subtitle="Automated nightly data syncs">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg flex items-center gap-2"
            style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.3)" }}
          >
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              ×
            </button>
          </motion.div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg flex items-center gap-2"
            style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.3)" }}
          >
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-sm text-green-400">
              {syncResult.message} — {syncResult.successful} successful, {syncResult.failed} failed
            </p>
            <button onClick={() => setSyncResult(null)} className="ml-auto text-green-400 hover:text-green-300">
              ×
            </button>
          </motion.div>
        )}

        {/* Schedule Overview Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: "#6366f120", color: "#6366f1" }}
              >
                <Moon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    Nightly Sync Scheduler
                  </h2>
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Automatically syncs all connected data sources every night at midnight Pacific.
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                  Next sync: {nextSyncTime.toLocaleString()} (Pacific Time)
                </p>
              </div>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                style={{
                  background: "#6366f1",
                  color: "#ffffff",
                }}
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing All...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Now
                  </>
                )}
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Database className="w-5 h-5" style={{ color: "#10b981" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                {connectedCount}
              </p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Connected Sources</p>
            </Card>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5" style={{ color: "#6366f1" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#6366f1" }}>
                12:00 AM
              </p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Sync Time (PT)</p>
            </Card>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <RefreshCw className="w-5 h-5" style={{ color: "#f59e0b" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                30 days
              </p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Sync Window</p>
            </Card>
          </div>
        </motion.div>

        {/* Connected Sources */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Data Sources
          </h3>
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.source}>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    {conn.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium" style={{ color: "var(--foreground)" }}>
                        {conn.displayName}
                      </h4>
                      {conn.connected ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                          <AlertCircle className="w-3 h-3" />
                          Not Connected
                        </span>
                      )}
                    </div>
                    {conn.lastSync && (
                      <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                        Last synced: {conn.lastSync.toLocaleString()}
                      </p>
                    )}
                  </div>
                  {conn.connected && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: "#10b981" }}
                      title="Will be synced tonight"
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <div className="flex gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#6366f120", color: "#6366f1" }}
              >
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  How Nightly Sync Works
                </h4>
                <ol className="text-sm space-y-2" style={{ color: "var(--foreground-muted)" }}>
                  <li>1. At midnight Pacific, the scheduler checks all connected sources</li>
                  <li>2. For each connected source, an incremental sync is triggered (last 30 days)</li>
                  <li>3. Data is synced directly to BigQuery, bypassing intermediate storage</li>
                  <li>4. Scout AI detectors run on the fresh data to find insights</li>
                </ol>
                <p className="text-xs mt-4" style={{ color: "var(--foreground-subtle)" }}>
                  Incremental syncs are fast and cost-effective. Use &quot;Full Re-sync&quot; on individual source pages for complete historical data.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
