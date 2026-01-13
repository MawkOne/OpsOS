"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Users,
  DollarSign,
  Target,
  Zap,
  TrendingUp,
  Loader2,
  Send,
  MousePointerClick,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface ActiveCampaignConnection {
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  apiUrl?: string;
  apiKey?: string;
  accountName?: string;
  accountEmail?: string;
  lastSyncAt?: { toDate: () => Date };
  lastSyncResults?: {
    contacts: number;
    deals: number;
    pipelines: number;
    campaigns: number;
    automations: number;
    lists: number;
    errors: string[];
  };
  errorMessage?: string;
}

interface ActiveCampaignMetrics {
  contacts: {
    total: number;
    active: number;
  };
  deals: {
    total: number;
    open: number;
    won: number;
    lost: number;
    pipelineValue: number;
    wonValue: number;
    winRate: number;
  };
  campaigns: {
    total: number;
    totalSent: number;
    openRate: number;
    clickRate: number;
  };
  automations: {
    active: number;
    totalEntered: number;
  };
  subscribers: number;
}

export default function ActiveCampaignPage() {
  useAuth(); // Ensure user is authenticated
  const { currentOrg } = useOrganization();
  const [connection, setConnection] = useState<ActiveCampaignConnection | null>(null);
  const [metrics, setMetrics] = useState<ActiveCampaignMetrics | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const organizationId = currentOrg?.id || "";

  // Listen to connection status
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "activecampaign_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setConnection(snapshot.data() as ActiveCampaignConnection);
        } else {
          setConnection(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to connection:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  const fetchMetrics = async () => {
    if (!organizationId) return;
    try {
      const response = await fetch(`/api/activecampaign/metrics?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Error fetching metrics:", err);
    }
  };

  // Fetch metrics when connected
  useEffect(() => {
    if (connection?.status === "connected") {
      fetchMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.status, organizationId]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationId) {
      setError("Please select an organization first");
      return;
    }

    if (!apiUrl || !apiKey) {
      setError("Please enter both API URL and API Key");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/activecampaign/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, apiUrl, apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect");
      }

      setSuccess("Successfully connected to ActiveCampaign!");
      setApiUrl("");
      setApiKey("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const syncResponse = await fetch("/api/activecampaign/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(syncData.error || "Failed to sync ActiveCampaign data");
      }

      await fetchMetrics();
      setSuccess("Sync completed successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect ActiveCampaign? This will stop syncing your marketing data.")) {
      return;
    }

    try {
      const response = await fetch("/api/activecampaign/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setMetrics(null);
      setSuccess("ActiveCampaign disconnected successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

  // Consider connected if status is connected, syncing, or if we have credentials saved
  const isConnected = connection?.status === "connected" || 
                      connection?.status === "syncing" || 
                      (connection?.apiUrl && connection?.status !== "disconnected");
  const isSyncingStatus = connection?.status === "syncing";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <AppLayout title="ActiveCampaign" subtitle="Connect and sync your marketing automation data">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="ActiveCampaign" subtitle="Connect and sync your marketing automation data">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Success Alert */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg"
            style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.3)" }}
          >
            <p className="text-sm text-green-400">{success}</p>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg"
            style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.3)" }}
          >
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: "#356AE620", color: "#356AE6" }}
              >
                <Mail className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    ActiveCampaign
                  </h2>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                  ) : isSyncingStatus ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Syncing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                      <AlertCircle className="w-3 h-3" />
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {isConnected
                    ? connection?.accountName 
                      ? `Connected as ${connection.accountName}`
                      : `Connected to ActiveCampaign`
                    : "Connect your ActiveCampaign account to sync contacts, deals, and campaigns."}
                </p>
                {connection?.lastSyncAt && (
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                    Last synced: {connection.lastSyncAt.toDate().toLocaleString()}
                  </p>
                )}
              </div>
              {isConnected && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "var(--foreground-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Syncing..." : isSyncingStatus ? "Retry Sync" : "Sync Now"}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "#ef4444",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* Connection Error */}
            {connection?.status === "error" && connection?.errorMessage && (
              <div 
                className="mt-4 px-4 py-3 rounded-lg"
                style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
              >
                <p className="text-sm text-red-400">{connection.errorMessage}</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Connection Form (when not connected) */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Connect ActiveCampaign
              </h3>
              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    API URL
                  </label>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://youraccountname.api-us1.com"
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#356AE6]/50"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                    Found in Settings → Developer → API Access
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your API key"
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#356AE6]/50"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isConnecting || !apiUrl || !apiKey}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#356AE6", color: "white" }}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
              </form>
            </Card>
          </motion.div>
        )}

        {/* Metrics (when connected) */}
        {isConnected && metrics && (
          <>
            {/* Contacts & Deals */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                CRM Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Contacts</span>
                    <Users className="w-4 h-4" style={{ color: "#356AE6" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#356AE6" }}>
                    {metrics.contacts.total.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {metrics.contacts.active.toLocaleString()} active
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Pipeline Value</span>
                    <DollarSign className="w-4 h-4" style={{ color: "#10b981" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                    {formatCurrency(metrics.deals.pipelineValue)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {metrics.deals.open} open deals
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Won Revenue</span>
                    <TrendingUp className="w-4 h-4" style={{ color: "#f59e0b" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                    {formatCurrency(metrics.deals.wonValue)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {metrics.deals.won} deals won
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Win Rate</span>
                    <Target className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                    {formatPercent(metrics.deals.winRate)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {metrics.deals.lost} deals lost
                  </p>
                </Card>
              </div>
            </motion.div>

            {/* Email Marketing */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Email Marketing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Campaigns</span>
                    <Mail className="w-4 h-4" style={{ color: "#356AE6" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#356AE6" }}>
                    {metrics.campaigns.total}
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Emails Sent</span>
                    <Send className="w-4 h-4" style={{ color: "#06b6d4" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#06b6d4" }}>
                    {metrics.campaigns.totalSent.toLocaleString()}
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Open Rate</span>
                    <Mail className="w-4 h-4" style={{ color: "#10b981" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                    {formatPercent(metrics.campaigns.openRate)}
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Click Rate</span>
                    <MousePointerClick className="w-4 h-4" style={{ color: "#f59e0b" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                    {formatPercent(metrics.campaigns.clickRate)}
                  </p>
                </Card>
              </div>
            </motion.div>

            {/* Automations */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Automations
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Automations</span>
                    <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                    {metrics.automations.active}
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Entered</span>
                    <Users className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                    {metrics.automations.totalEntered.toLocaleString()}
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Subscribers</span>
                    <Users className="w-4 h-4" style={{ color: "#06b6d4" }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#06b6d4" }}>
                    {metrics.subscribers.toLocaleString()}
                  </p>
                </Card>
              </div>
            </motion.div>
          </>
        )}

        {/* Sync Results */}
        {isConnected && connection?.lastSyncResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Last Sync Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.contacts}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Contacts</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.deals}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Deals</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.campaigns}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Campaigns</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.automations}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Automations</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.lists}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Lists</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.pipelines}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Pipelines</p>
                </div>
              </div>
              {connection.lastSyncResults.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-400 mb-2">Sync Errors:</p>
                  <ul className="text-sm text-red-400 space-y-1">
                    {connection.lastSyncResults.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

