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
  Trash2,
  DollarSign,
  Repeat,
  Users,
  TrendingUp,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface StripeConnection {
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  stripeAccountId?: string;
  stripeAccountName?: string;
  lastSyncAt?: { toDate: () => Date };
  lastSyncResults?: {
    // Old format (from Vercel route)
    payments?: number;
    paymentIntents?: number;
    subscriptions?: number;
    customers?: number;
    products?: number;
    prices?: number;
    cleanedRecords?: number;
    errors?: string[];
    // New format (from Cloud Function)
    charges?: number;
    bigqueryRows?: number;
  };
  isTestMode?: boolean;
  apiKeyLast4?: string;
  errorMessage?: string;
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
  useAuth(); // Ensure user is authenticated
  const { currentOrg } = useOrganization();
  const [connection, setConnection] = useState<StripeConnection | null>(null);
  const [metrics, setMetrics] = useState<StripeMetrics | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = currentOrg?.id || "";

  // Check for URL params (success/error from OAuth)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get("connected");
    const errorParam = urlParams.get("error");

    if (connected === "true") {
      setSuccess("Successfully connected to Stripe!");
      window.history.replaceState({}, "", "/sources/stripe");
    }

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        missing_organization: "Organization ID is missing. Please try again.",
        stripe_not_configured: "Stripe is not configured. Please contact support.",
        missing_code: "Authorization failed. Please try again.",
        token_exchange_failed: "Failed to connect to Stripe. Please try again.",
        access_denied: "Access was denied. Please try again.",
      };
      setError(errorMessages[errorParam] || decodeURIComponent(errorParam));
      window.history.replaceState({}, "", "/sources/stripe");
    }
  }, []);

  // Listen to connection status
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

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

  const fetchMetrics = async () => {
    if (!organizationId) return;
    try {
      const response = await fetch(`/api/stripe/metrics?organizationId=${organizationId}`);
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

  const handleConnect = () => {
    if (!organizationId) {
      setError("Please select an organization first");
      return;
    }
    // Redirect to Stripe OAuth
    window.location.href = `/api/stripe/auth?organizationId=${organizationId}`;
  };

  const handleSync = async (mode: 'update' | 'full') => {
    // Confirm for full re-sync
    if (mode === 'full') {
      const confirmed = confirm(
        "Re-sync will fetch ALL historical Stripe data (up to 2 years) and replace existing data. This may take several minutes. Continue?"
      );
      if (!confirmed) return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      // Call Cloud Function directly - syncs from Stripe API to BigQuery (bypasses Firestore)
      console.log(`Syncing Stripe data to BigQuery (mode=${mode})...`);
      const syncResponse = await fetch("https://us-central1-opsos-864a1.cloudfunctions.net/stripe-bigquery-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, mode }),
      });

      const syncData = await syncResponse.json();

      if (!syncResponse.ok || !syncData.success) {
        throw new Error(syncData.error || "Failed to sync Stripe data");
      }

      await fetchMetrics();
      const modeLabel = mode === 'full' ? 'Full re-sync' : 'Incremental sync';
      const message = `${modeLabel} complete: ${syncData.charges_processed || 0} charges, ${syncData.subscriptions_processed || 0} subscriptions, ${syncData.rows_inserted || 0} rows to BigQuery.`;
      
      setSuccess(message);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
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
      setSuccess("Stripe disconnected successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

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
                    ? connection?.stripeAccountName 
                      ? `Connected to ${connection.stripeAccountName}`
                      : `Connected to Stripe account`
                    : "Connect your Stripe account to track payments, subscriptions, and MRR."}
                </p>
                {connection?.lastSyncAt && (
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                    Last synced: {connection.lastSyncAt.toDate().toLocaleString()}
                  </p>
                )}
              </div>
              {isConnected || isSyncingStatus ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync('update')}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                    style={{
                      background: "#635BFF",
                      color: "white",
                    }}
                    title="Sync recent Stripe data (last 30 days)"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Syncing..." : "Sync New Data"}
                  </button>
                  <button
                    onClick={() => handleSync('full')}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border)",
                    }}
                    title="Re-sync all historical data (up to 2 years)"
                  >
                    Re-sync Data
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
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 hover:opacity-90"
                  style={{ background: "#635BFF", color: "white" }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Connect with Stripe
                </button>
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
                  {(metrics.activeSubscriptions || 0).toLocaleString()}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Customers</span>
                  <Users className="w-4 h-4" style={{ color: "#f59e0b" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                  {(metrics.totalCustomers || 0).toLocaleString()}
                </p>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Sync Results */}
        {isConnected && connection?.lastSyncResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Last Sync Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.charges || connection.lastSyncResults.payments || 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Charges</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.subscriptions || 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Subscriptions</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.customers || 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Customers</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "#635BFF" }}>
                    {connection.lastSyncResults.bigqueryRows || 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>BigQuery Rows</p>
                </div>
              </div>
              {(connection.lastSyncResults?.errors?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-400 mb-2">Sync Errors:</p>
                  <ul className="text-sm text-red-400 space-y-1">
                    {connection.lastSyncResults?.errors?.map((err: string, idx: number) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Empty State */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <div className="text-center py-8">
                <div 
                  className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#635BFF20", color: "#635BFF" }}
                >
                  <CreditCard className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Connect Your Stripe Account
                </h3>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--foreground-muted)" }}>
                  Securely connect your Stripe account to automatically sync payments, subscriptions, 
                  and calculate your MRR, ARR, and other key metrics.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleConnect}
                    className="px-6 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto transition-all duration-200 hover:opacity-90"
                    style={{ background: "#635BFF", color: "white" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Connect with Stripe
                  </button>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    You&apos;ll be redirected to Stripe to authorize read-only access
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
