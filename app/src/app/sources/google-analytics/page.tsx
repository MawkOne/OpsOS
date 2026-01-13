"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  Eye,
  Clock,
  MousePointer,
  ExternalLink,
  Loader2,
  BarChart3,
  TrendingUp,
  Globe,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";

interface GAProperty {
  id: string;
  displayName: string;
  accountId: string;
  accountName?: string;
}

interface GoogleAnalyticsConnection {
  status: "connected" | "disconnected" | "syncing" | "error";
  userEmail?: string;
  userName?: string;
  properties?: GAProperty[];
  selectedPropertyId?: string;
  selectedPropertyName?: string;
  lastSyncAt?: { toDate: () => Date };
  lastSyncResults?: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  errorMessage?: string;
}

interface GAMetrics {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  engagedSessions: number;
}

function GoogleAnalyticsContent() {
  const { currentOrg } = useOrganization();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<GoogleAnalyticsConnection | null>(null);
  const [metrics, setMetrics] = useState<GAMetrics | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChangingProperty, setIsChangingProperty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const organizationId = currentOrg?.id || "";

  // Check for URL params (success/error from OAuth)
  useEffect(() => {
    const connected = searchParams.get("connected");
    const errorParam = searchParams.get("error");

    if (connected === "true") {
      setSuccess("Successfully connected to Google Analytics!");
      // Clear URL params
      window.history.replaceState({}, "", "/sources/google-analytics");
    }

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, "", "/sources/google-analytics");
    }
  }, [searchParams]);

  // Listen to connection status
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    let initialLoad = true;

    const unsubscribe = onSnapshot(
      doc(db, "ga_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GoogleAnalyticsConnection;
          setConnection(data);
          
          // Only fetch metrics on initial load to prevent infinite loop
          // (The API updates lastSyncAt which would trigger another onSnapshot)
          if (initialLoad && data.status === "connected" && data.selectedPropertyId) {
            initialLoad = false;
            fetchMetrics();
          }
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
    
    setMetricsLoading(true);
    try {
      const response = await fetch(`/api/google-analytics/data?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch metrics:", errorData);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleConnect = () => {
    if (!organizationId) {
      setError("No organization selected");
      return;
    }
    // Redirect to OAuth flow
    window.location.href = `/api/google-analytics/auth?organizationId=${organizationId}`;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    await fetchMetrics();
    setIsSyncing(false);
  };

  const handlePropertyChange = async (propertyId: string) => {
    if (!organizationId) return;
    
    setIsChangingProperty(true);
    try {
      const property = connection?.properties?.find(p => p.id === propertyId);
      const connectionRef = doc(db, "ga_connections", organizationId);
      await setDoc(connectionRef, {
        selectedPropertyId: propertyId,
        selectedPropertyName: property?.displayName || propertyId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      // Fetch new metrics for the selected property
      await fetchMetrics();
    } catch (error) {
      console.error("Error changing property:", error);
      setError("Failed to change property");
    } finally {
      setIsChangingProperty(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Analytics? This will remove all stored data.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "ga_connections", organizationId));
      setMetrics(null);
      setSuccess("Disconnected from Google Analytics");
    } catch (error) {
      console.error("Error disconnecting:", error);
      setError("Failed to disconnect");
    }
  };

  const isConnected = connection?.status === "connected";
  const hasError = connection?.status === "error";

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <AppLayout title="Google Analytics" subtitle="Connect and sync your website analytics">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Google Analytics" subtitle="Connect and sync your website analytics">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg flex items-center gap-2"
            style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.3)" }}
          >
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-sm text-green-400">{success}</p>
            <button 
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-400 hover:text-green-300"
            >
              ×
            </button>
          </motion.div>
        )}

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
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </motion.div>
        )}

        {/* Connection Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: "#F9AB0020", color: "#F9AB00" }}
              >
                <Activity className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    Google Analytics
                  </h2>
                  {isConnected && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                  )}
                  {hasError && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      Error
                    </span>
                  )}
                  {!isConnected && !hasError && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                      <AlertCircle className="w-3 h-3" />
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {isConnected
                    ? `Connected as ${connection?.userEmail || connection?.userName}`
                    : hasError
                    ? connection?.errorMessage || "Connection error. Please reconnect."
                    : "Connect your Google Analytics account to track website performance."}
                </p>
                {isConnected && connection?.selectedPropertyName && (
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                    Property: {connection.selectedPropertyName}
                  </p>
                )}
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
                    disabled={isSyncing || metricsLoading}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                    style={{
                      background: "var(--background-tertiary)",
                      color: "var(--foreground-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing || metricsLoading ? "animate-spin" : ""}`} />
                    {isSyncing || metricsLoading ? "Syncing..." : "Sync Now"}
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
              ) : (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                  style={{ background: "#F9AB00", color: "#1a1a1a" }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Connect with Google
                </button>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Property Selector */}
        {isConnected && connection?.properties && connection.properties.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium" style={{ color: "var(--foreground)" }}>Select Property</h3>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Choose which GA4 property to display data for
                  </p>
                </div>
                <select
                  value={connection.selectedPropertyId || ""}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  disabled={isChangingProperty}
                  className="px-3 py-2 rounded-lg text-sm min-w-[280px]"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {connection.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.accountName ? `${property.accountName} → ${property.displayName}` : property.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Metrics */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Last 30 Days
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-5 h-5" style={{ color: "#ec4899" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#ec4899" }}>
                  {metricsLoading ? "..." : metrics ? formatNumber(metrics.activeUsers) : "—"}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Users</p>
              </Card>
              <Card className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Eye className="w-5 h-5" style={{ color: "#3b82f6" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
                  {metricsLoading ? "..." : metrics ? formatNumber(metrics.pageViews) : "—"}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Page Views</p>
              </Card>
              <Card className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5" style={{ color: "#8b5cf6" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                  {metricsLoading ? "..." : metrics ? formatDuration(metrics.avgSessionDuration) : "—"}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Duration</p>
              </Card>
              <Card className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <MousePointer className="w-5 h-5" style={{ color: "#10b981" }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                  {metricsLoading ? "..." : metrics ? `${metrics.bounceRate.toFixed(1)}%` : "—"}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</p>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Additional Metrics */}
        {isConnected && metrics && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "#06b6d420", color: "#06b6d4" }}
                  >
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                      {formatNumber(metrics.newUsers)}
                    </p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>New Users</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "#f59e0b20", color: "#f59e0b" }}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                      {formatNumber(metrics.sessions)}
                    </p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Sessions</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "#22c55e20", color: "#22c55e" }}
                  >
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                      {formatNumber(metrics.engagedSessions)}
                    </p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Engaged Sessions</p>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* What We Track */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            What We Track
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#ec489920", color: "#ec4899" }}
                >
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Visitors</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Active users, new vs returning, and user demographics
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#3b82f620", color: "#3b82f6" }}
                >
                  <Eye className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Page Views</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Top pages, traffic sources, and user navigation flow
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                >
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Engagement</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Session duration, bounce rate, and engagement metrics
              </p>
            </Card>
          </div>
        </motion.div>

        {/* Setup Instructions */}
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
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    How It Works
                  </h4>
                  <ol className="text-sm space-y-2" style={{ color: "var(--foreground-muted)" }}>
                    <li>1. Click &quot;Connect with Google&quot; above</li>
                    <li>2. Sign in with your Google account that has access to Google Analytics</li>
                    <li>3. Grant OpsOS permission to read your analytics data</li>
                    <li>4. Select which GA4 property to track</li>
                    <li>5. Your analytics data will sync automatically</li>
                  </ol>
                  <p className="text-xs mt-4" style={{ color: "var(--foreground-subtle)" }}>
                    We only request read-only access to your analytics data. We never modify your Google Analytics settings.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Settings */}
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
                  Settings
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
                    <option value="1h">Every hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="24h">Daily</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Default date range</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Reporting period for dashboard</p>
                  </div>
                  <select
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
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

function LoadingFallback() {
  return (
    <AppLayout title="Google Analytics">
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F9AB00" }} />
      </div>
    </AppLayout>
  );
}

export default function GoogleAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GoogleAnalyticsContent />
    </Suspense>
  );
}
