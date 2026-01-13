"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  DollarSign,
  FileText,
  Users,
  Receipt,
  Loader2,
  ExternalLink,
  Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface QuickBooksConnection {
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  realmId?: string;
  companyName?: string;
  lastSyncAt?: { toDate: () => Date };
  lastSyncResults?: {
    invoices: number;
    payments: number;
    customers: number;
    accounts: number;
    items: number;
    expenses: number;
    errors: string[];
  };
  errorMessage?: string;
}

interface QuickBooksMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  accountsReceivable: number;
  accountsPayable: number;
  customerCount: number;
}

export default function QuickBooksPage() {
  useAuth(); // Ensure user is authenticated
  const { currentOrg } = useOrganization();
  const [connection, setConnection] = useState<QuickBooksConnection | null>(null);
  const [metrics, setMetrics] = useState<QuickBooksMetrics | null>(null);
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
      setSuccess("Successfully connected to QuickBooks!");
      window.history.replaceState({}, "", "/revenue/quickbooks");
    }

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        missing_organization: "Organization ID is missing. Please try again.",
        quickbooks_not_configured: "QuickBooks is not configured. Please contact support.",
        missing_code: "Authorization failed. Please try again.",
        missing_realm_id: "Company ID missing. Please try again.",
        token_exchange_failed: "Failed to connect to QuickBooks. Please try again.",
        access_denied: "Access was denied. Please try again.",
        invalid_state: "Invalid session. Please try again.",
      };
      setError(errorMessages[errorParam] || decodeURIComponent(errorParam));
      window.history.replaceState({}, "", "/revenue/quickbooks");
    }
  }, []);

  // Listen to connection status
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    console.log("🔍 QuickBooks Debug:");
    console.log(`   Organization ID: ${organizationId}`);

    const unsubscribe = onSnapshot(
      doc(db, "quickbooks_connections", organizationId),
      (snapshot) => {
        console.log(`   Connection document exists: ${snapshot.exists()}`);
        if (snapshot.exists()) {
          const data = snapshot.data() as QuickBooksConnection;
          console.log(`   Status: ${data.status}`);
          console.log(`   Company: ${data.companyName}`);
          console.log(`   Last Sync: ${data.lastSyncAt?.toDate?.().toLocaleString() || 'Never'}`);
          if (data.lastSyncResults) {
            console.log(`   Last Sync Results:`, data.lastSyncResults);
          }
          setConnection(data);
        } else {
          console.log(`   No connection document found`);
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
      const response = await fetch(`/api/quickbooks/metrics?organizationId=${organizationId}`);
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
    // Redirect to QuickBooks OAuth
    window.location.href = `/api/quickbooks/auth?organizationId=${organizationId}`;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    console.log("🔄 Starting QuickBooks sync...");

    try {
      const syncResponse = await fetch("/api/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const syncData = await syncResponse.json();
      
      console.log("📊 Sync response:", syncData);

      if (!syncResponse.ok) {
        throw new Error(syncData.error || "Failed to sync QuickBooks data");
      }

      console.log("✅ Sync completed:", syncData.results);

      await fetchMetrics();
      setSuccess("Sync completed successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("❌ Sync error:", err);
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect QuickBooks? This will stop syncing your accounting data.")) {
      return;
    }

    try {
      const response = await fetch("/api/quickbooks/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setMetrics(null);
      setSuccess("QuickBooks disconnected successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

  const isConnected = connection?.status === "connected" || (connection?.lastSyncAt && connection?.status !== "disconnected");
  const isSyncingStatus = connection?.status === "syncing";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <AppLayout title="QuickBooks" subtitle="Connect and sync your QuickBooks accounting data">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="QuickBooks" subtitle="Connect and sync your QuickBooks accounting data">
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
                style={{ background: "#2CA01C20", color: "#2CA01C" }}
              >
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    QuickBooks
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
                    ? connection?.companyName 
                      ? `Connected to ${connection.companyName}`
                      : `Connected to QuickBooks`
                    : "Connect your QuickBooks account to sync invoices, payments, and expenses."}
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
                      color: "#ef4444",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 hover:opacity-90"
                  style={{ background: "#2CA01C", color: "white" }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Connect with QuickBooks
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
              Financial Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Revenue</span>
                  <DollarSign className="w-4 h-4" style={{ color: "#10b981" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Expenses</span>
                  <Receipt className="w-4 h-4" style={{ color: "#ef4444" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
                  {formatCurrency(metrics.totalExpenses)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Net Income</span>
                  <Building2 className="w-4 h-4" style={{ color: "#3b82f6" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.netIncome >= 0 ? "#10b981" : "#ef4444" }}>
                  {formatCurrency(metrics.netIncome)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Receivables</span>
                  <FileText className="w-4 h-4" style={{ color: "#f59e0b" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                  {formatCurrency(metrics.accountsReceivable)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Payables</span>
                  <Receipt className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                  {formatCurrency(metrics.accountsPayable)}
                </p>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Customers</span>
                  <Users className="w-4 h-4" style={{ color: "#06b6d4" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#06b6d4" }}>
                  {metrics.customerCount.toLocaleString()}
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
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.invoices}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Invoices</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.payments}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Payments</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.customers}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Customers</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.items}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Items</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.expenses}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Expenses</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {connection.lastSyncResults.accounts}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Accounts</p>
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
                  style={{ background: "#2CA01C20", color: "#2CA01C" }}
                >
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Connect Your QuickBooks Account
                </h3>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--foreground-muted)" }}>
                  Securely connect your QuickBooks Canada account to automatically sync invoices, 
                  payments, expenses, and generate comprehensive financial reports.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleConnect}
                    className="px-6 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto transition-all duration-200 hover:opacity-90"
                    style={{ background: "#2CA01C", color: "white" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Connect with QuickBooks
                  </button>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    You&apos;ll be redirected to Intuit to authorize read-only access
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* What gets synced */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                What Gets Synced
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2CA01C20" }}>
                    <FileText className="w-4 h-4" style={{ color: "#2CA01C" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Invoices</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>All invoice data</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2CA01C20" }}>
                    <DollarSign className="w-4 h-4" style={{ color: "#2CA01C" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Payments</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Payment records</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2CA01C20" }}>
                    <Users className="w-4 h-4" style={{ color: "#2CA01C" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Customers</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Customer list</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2CA01C20" }}>
                    <Receipt className="w-4 h-4" style={{ color: "#2CA01C" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Expenses</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Bills & purchases</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2CA01C20" }}>
                    <Building2 className="w-4 h-4" style={{ color: "#2CA01C" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Accounts</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Chart of accounts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2CA01C20" }}>
                    <BookOpen className="w-4 h-4" style={{ color: "#2CA01C" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Items</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Products & services</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
