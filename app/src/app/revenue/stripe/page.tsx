"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Trash2,
  DollarSign,
  Repeat,
  Users,
  Key,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface StripeConnection {
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  stripeAccountId?: string;
  lastSyncAt?: { toDate: () => Date };
  lastSyncResults?: {
    payments: number;
    subscriptions: number;
    customers: number;
    products: number;
    prices: number;
    errors: string[];
  };
  isTestMode?: boolean;
  apiKeyLast4?: string;
}

interface StripeMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalCustomers: number;
  totalRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
}

export default function StripePage() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [connection, setConnection] = useState<StripeConnection | null>(null);
  const [metrics, setMetrics] = useState<StripeMetrics | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Organization ID from context
  const organizationId = currentOrg?.id || "";

  // Listen to connection status
  useEffect(() => {
    if (!organizationId) return;

    const unsubscribe = onSnapshot(
      doc(db, "stripe_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setConnection(snapshot.data() as StripeConnection);
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

  // Fetch metrics when connected
  useEffect(() => {
    if (connection?.status === "connected") {
      fetchMetrics();
    }
  }, [connection?.status]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/stripe/metrics?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  const handleConnect = async () => {
    if (!showApiKeyInput) {
      setShowApiKeyInput(true);
      return;
    }

    if (!apiKey.startsWith("sk_")) {
      setError("Please enter a valid Stripe Secret Key (starts with sk_live_ or sk_test_)");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Connect to Stripe
      const connectResponse = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          organizationId,
          userId: user?.uid,
        }),
      });

      const connectData = await connectResponse.json();

      if (!connectResponse.ok) {
        throw new Error(connectData.error || "Failed to connect to Stripe");
      }

      // Start initial sync
      setIsSyncing(true);
      const syncResponse = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          organizationId,
        }),
      });

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(syncData.error || "Failed to sync Stripe data");
      }

      setShowApiKeyInput(false);
      setApiKey("");
      
      // Fetch metrics after sync
      await fetchMetrics();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsConnecting(false);
      setIsSyncing(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const syncResponse = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(syncData.error || "Failed to sync Stripe data");
      }

      // Fetch updated metrics after sync
      await fetchMetrics();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Stripe? This will stop syncing your payment data.")) {
      return;
    }

    try {
      const response = await fetch("/api/stripe/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setMetrics(null);
    } catch (error: any) {
      setError(error.message);
    }
  };

  // Consider connected if status is 'connected' OR if we have a lastSyncAt (sync completed)
  const isConnected = connection?.status === "connected" || (connection?.lastSyncAt && connection?.status !== "disconnected");
  const isSyncingStatus = connection?.status === "syncing";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <AppLayout title="Stripe" subtitle="Connect and sync your Stripe payments">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Stripe" subtitle="Connect and sync your Stripe payments">
      <div className="max-w-4xl mx-auto space-y-6">
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
                style={{ background: "#635BFF20", color: "#635BFF" }}
              >
                <CreditCard className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    Stripe
                  </h2>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                      {connection?.isTestMode && " (Test Mode)"}
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
                    ? `Connected to account ending in ****${connection?.apiKeyLast4 || "****"}`
                    : "Connect your Stripe account to track payments, subscriptions, and MRR."}
                </p>
                {connection?.lastSyncAt && (
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                    Last synced: {connection.lastSyncAt.toDate().toLocaleString()}
                  </p>
                )}
              </div>
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing || isSyncingStatus}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "var(--foreground-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing || isSyncingStatus ? "animate-spin" : ""}`} />
                    {isSyncing || isSyncingStatus ? "Syncing..." : "Sync Now"}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "var(--error)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              ) : !showApiKeyInput ? (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                  style={{ background: "#635BFF", color: "white" }}
                >
                  <Key className="w-4 h-4" />
                  Connect Stripe
                </button>
              ) : null}
            </div>

            {/* API Key Input */}
            {showApiKeyInput && !isConnected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-6 pt-6 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                      Stripe Secret Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk_live_... or sk_test_..."
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#635BFF]/50"
                      style={{
                        background: "var(--background-tertiary)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                    <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                      Find your API key in your{" "}
                      <a
                        href="https://dashboard.stripe.com/apikeys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        style={{ color: "#635BFF" }}
                      >
                        Stripe Dashboard → Developers → API Keys
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowApiKeyInput(false);
                        setError(null);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                      style={{
                        background: "var(--background-tertiary)",
                        color: "var(--foreground-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConnect}
                      disabled={isConnecting || !apiKey}
                      className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                      style={{ background: "#635BFF", color: "white" }}
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {isSyncing ? "Syncing..." : "Connecting..."}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Connect & Sync
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>

        {/* Metrics (when connected) */}
        {isConnected && metrics && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Revenue Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>MRR</span>
                  <DollarSign className="w-4 h-4" style={{ color: "#10b981" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                  {formatCurrency(metrics.mrr)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>ARR</span>
                  <TrendingUp className="w-4 h-4" style={{ color: "#3b82f6" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
                  {formatCurrency(metrics.arr)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Subs</span>
                  <Repeat className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                  {metrics.activeSubscriptions}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Customers</span>
                  <Users className="w-4 h-4" style={{ color: "#f59e0b" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                  {metrics.totalCustomers}
                </p>
              </Card>
            </div>

            {/* Additional metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Revenue</span>
                </div>
                <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Churn Rate</span>
                </div>
                <p className="text-xl font-bold" style={{ color: metrics.churnRate > 5 ? "#ef4444" : "var(--foreground)" }}>
                  {metrics.churnRate}%
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>ARPU</span>
                </div>
                <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatCurrency(metrics.averageRevenuePerUser)}
                </p>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Sync Results (when connected and has sync results) */}
        {isConnected && connection?.lastSyncResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <h3 className="text-sm font-medium mb-3" style={{ color: "var(--foreground-muted)" }}>
                Last Sync Summary
              </h3>
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.payments}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Payments</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.subscriptions}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Subscriptions</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.customers}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Customers</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.products || 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Products</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.prices || 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Prices</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* What We Import */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            What We Import
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#10b98120", color: "#10b981" }}
                >
                  <DollarSign className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Payments</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                All successful payments with product attribution
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#3b82f620", color: "#3b82f6" }}
                >
                  <Repeat className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Subscriptions</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                MRR, ARR, churn rate, and subscription metrics
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#f59e0b20", color: "#f59e0b" }}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Products & Prices</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Product catalog, pricing tiers, and billing intervals
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                >
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Customers</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Customer count, LTV, and payment history
              </p>
            </Card>
          </div>
        </motion.div>

        {/* Security Note */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card>
              <div className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#f59e0b20", color: "#f59e0b" }}
                >
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Your API Key is Secure
                  </h4>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    We use read-only access to fetch your payment data. Your API key is encrypted and stored securely.
                    We never store card numbers or sensitive payment details. You can revoke access at any time from your Stripe dashboard.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Settings (when connected) */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Sync Settings
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Auto-sync frequency</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>How often to pull new data</p>
                  </div>
                  <select
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="realtime">Real-time (webhooks)</option>
                    <option value="1h">Every hour</option>
                    <option value="6h">Every 6 hours</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Historical data</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>How far back to import data</p>
                  </div>
                  <select
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="12m">Last 12 months</option>
                    <option value="24m">Last 24 months</option>
                    <option value="all">All available data</option>
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
