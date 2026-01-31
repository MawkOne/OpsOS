"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Globe,
  Activity,
  FileText,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Zap,
  TrendingUp,
  Link2,
  Search,
  Calendar,
  Eye,
} from "lucide-react";

interface ConnectionStatus {
  status: "disconnected" | "connected" | "syncing" | "crawling" | "error";
  domain?: string;
  balance?: number;
  summary?: {
    pagesAnalyzed: number;
    averageScore: number;
    issues: {
      critical: number;
      warnings: number;
      notices: number;
    };
    taskId: string;
  };
  keywordsSummary?: {
    totalKeywords: number;
    totalSearchVolume: number;
    top3Keywords: number;
    top10Keywords: number;
    lastSyncAt?: Date;
  };
  backlinksSummary?: {
    totalBacklinks: number;
    referringDomains: number;
    rank: number;
    lastSyncAt?: Date;
  };
  historicalSummary?: {
    monthsOfData: number;
    dateRange?: {
      from: string;
      to: string;
    };
    latestMetrics?: {
      organicTraffic: number;
      organicKeywords: number;
      top10Keywords: number;
    };
    trends?: {
      trafficChange: number;
      keywordsChange: number;
    };
    lastSyncAt?: Date;
  };
  lastSyncAt?: Date;
}

export default function DataForSEOPage() {
  const { currentOrg } = useOrganization();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "disconnected",
  });
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingAction, setSyncingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<{
    pagesCrawled: number;
    pagesInQueue: number;
    maxPages: number;
  } | null>(null);
  const [syncAllProgress, setSyncAllProgress] = useState<{
    current: string;
    completed: string[];
    total: number;
  } | null>(null);

  // Listen for connection status changes
  useEffect(() => {
    if (!currentOrg?.id) return;

    const connectionRef = doc(db, "dataforseo_connections", currentOrg.id);
    const unsubscribe = onSnapshot(connectionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConnectionStatus({
          status: data.status || "disconnected",
          domain: data.domain,
          balance: data.balance,
          summary: data.summary,
          keywordsSummary: data.keywordsSummary ? {
            ...data.keywordsSummary,
            lastSyncAt: data.keywordsSummary.lastSyncAt?.toDate?.(),
          } : undefined,
          backlinksSummary: data.backlinksSummary ? {
            ...data.backlinksSummary,
            lastSyncAt: data.backlinksSummary.lastSyncAt?.toDate?.(),
          } : undefined,
          historicalSummary: data.historicalSummary ? {
            ...data.historicalSummary,
            lastSyncAt: data.historicalSummary.lastSyncAt?.toDate?.(),
          } : undefined,
          lastSyncAt: data.lastSyncAt?.toDate?.(),
        });
        if (data.domain) {
          setDomain(data.domain);
        }
      } else {
        setConnectionStatus({ status: "disconnected" });
      }
    });

    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Poll for crawl progress when crawling
  useEffect(() => {
    if (connectionStatus.status !== "crawling") {
      setCrawlProgress(null);
      return;
    }

    const checkProgress = async () => {
      try {
        const response = await fetch("/api/dataforseo/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: currentOrg?.id,
            action: "check_status",
          }),
        });

        const data = await response.json();

        if (data.status === "in_progress") {
          setCrawlProgress({
            pagesCrawled: data.pagesCrawled,
            pagesInQueue: data.pagesInQueue,
            maxPages: data.maxPages,
          });
        } else if (data.success) {
          setCrawlProgress(null);
          setIsSyncing(false);
        }
      } catch (err) {
        console.error("Error checking crawl progress:", err);
      }
    };

    const interval = setInterval(checkProgress, 5000);
    checkProgress();

    return () => clearInterval(interval);
  }, [connectionStatus.status, currentOrg?.id]);

  const handleConnect = async () => {
    if (!currentOrg?.id || !login || !password || !domain) {
      setError("Please fill in all fields");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/dataforseo/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          login,
          password,
          domain,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect");
      }

      setLogin("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentOrg?.id) return;

    try {
      await fetch("/api/dataforseo/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  const handleSync = useCallback(async (action: string) => {
    if (!currentOrg?.id) {
      setError("No organization selected. Please refresh the page.");
      console.error("handleSync: No organization ID");
      return;
    }

    console.log(`Starting sync: ${action} for org ${currentOrg.id}`);
    setIsSyncing(true);
    setSyncingAction(action);
    setError(null);

    try {
      const response = await fetch("/api/dataforseo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          action,
        }),
      });

      console.log(`Sync response status: ${response.status}`);
      const data = await response.json();
      console.log(`Sync response data:`, data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to run ${action}`);
      }
      
      // Check for subscription requirement
      if (data.requiresSubscription) {
        setError(`${action === "sync_backlinks" ? "Backlinks" : "This"} API requires a separate DataForSEO subscription. Visit app.dataforseo.com to upgrade.`);
        return;
      }
      
      // Show success feedback
      if (data.success) {
        console.log(`Sync ${action} completed successfully`);
        // Connection status auto-updates via onSnapshot listener
      }
    } catch (err) {
      console.error(`Sync error:`, err);
      setError(err instanceof Error ? err.message : `Failed to run ${action}`);
    } finally {
      // Don't clear syncing state for crawl as it runs in background
      if (action !== "start_crawl") {
        setIsSyncing(false);
        setSyncingAction(null);
      }
    }
  }, [currentOrg?.id]);

  const handleStartCrawl = useCallback(() => handleSync("start_crawl"), [handleSync]);

  const handleSyncAll = useCallback(async (mode: 'update' | 'full' = 'update') => {
    if (!currentOrg?.id) {
      setError("No organization selected");
      return;
    }

    // Confirm for full re-sync
    if (mode === 'full') {
      const confirmed = confirm(
        "Re-sync will fetch ALL DataForSEO historical data and replace existing data. This may take several minutes. Continue?"
      );
      if (!confirmed) return;
    }

    setIsSyncing(true);
    setError(null);
    
    const modeLabel = mode === 'full' ? 'Full re-sync' : 'Incremental sync';
    setSyncAllProgress({
      current: `${modeLabel} to BigQuery`,
      completed: [],
      total: 1,
    });

    try {
      // Call Cloud Function directly - syncs from DataForSEO API to BigQuery (bypasses Firestore)
      console.log(`Syncing DataForSEO data to BigQuery (mode=${mode})...`);
      const response = await fetch("https://us-central1-opsos-864a1.cloudfunctions.net/dataforseo-bigquery-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          mode,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }
      
      console.log("BigQuery sync success:", data);

      // Complete
      setSyncAllProgress({
        current: `${modeLabel} complete: ${data.rows_inserted || 0} rows`,
        completed: ["BigQuery Sync"],
        total: 1,
      });

      // Clear progress after 3 seconds
      setTimeout(() => {
        setSyncAllProgress(null);
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }, [currentOrg?.id]);

  const checkCrawlStatus = useCallback(async () => {
    if (!currentOrg?.id) return;
    
    try {
      const response = await fetch("/api/dataforseo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          action: "check_status",
        }),
      });
      
      const data = await response.json();
      console.log("Crawl status:", data);
      
      if (data.progress) {
        setCrawlProgress({
          pagesCrawled: data.progress.pagesCrawled || 0,
          pagesInQueue: data.progress.pagesInQueue || 0,
          maxPages: data.progress.maxPages || 500,
        });
      }
      
      if (data.status === "complete" || data.status === "finished") {
        setCrawlProgress(null);
        // Connection status auto-updates via onSnapshot listener
      }
      
      return data;
    } catch (err) {
      console.error("Error checking crawl status:", err);
    }
  }, [currentOrg?.id]);

  const isConnected = connectionStatus.status === "connected" || connectionStatus.status === "crawling" || connectionStatus.status === "syncing";

  return (
    <AppLayout title="DataForSEO" subtitle="Site health analysis and SEO monitoring">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Connection Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 mb-6"
          style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Connection Status
            </h2>
            <div className="flex items-center gap-2">
              {connectionStatus.status === "connected" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-green-500/10 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              )}
              {connectionStatus.status === "crawling" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-blue-500/10 text-blue-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Crawling
                </span>
              )}
              {connectionStatus.status === "syncing" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-yellow-500/10 text-yellow-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Syncing
                </span>
              )}
              {connectionStatus.status === "error" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-red-500/10 text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </span>
              )}
              {connectionStatus.status === "disconnected" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-gray-500/10 text-gray-500">
                  <XCircle className="w-4 h-4" />
                  Not Connected
                </span>
              )}
            </div>
          </div>

          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Connect your DataForSEO account to analyze your site&apos;s health and SEO performance.
                Get your API credentials from{" "}
                <a
                  href="https://app.dataforseo.com/api-dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline inline-flex items-center gap-1"
                >
                  DataForSEO Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Login (Email)
                  </label>
                  <input
                    type="email"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/50"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    API Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your API password"
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/50"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Domain to Analyze
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/50"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={isConnecting || !login || !password || !domain}
                className="px-6 py-2.5 rounded-lg font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  "Connect DataForSEO"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>
                    {connectionStatus.domain}
                  </span>
                  {connectionStatus.lastSyncAt && (
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      · Last sync: {connectionStatus.lastSyncAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-red-500/10 text-red-500"
                  style={{ border: "1px solid rgba(239, 68, 68, 0.3)" }}
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Manual Sync Section */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-6"
            style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Data Sync
            </h2>
            <div className="mb-4">
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                SEO data updates weekly. Sync manually when you need fresh data.
              </p>
            </div>
            
            {/* Sync Buttons */}
            <div className="mb-6 flex gap-3">
              <button
                onClick={() => handleSyncAll('update')}
                disabled={isSyncing}
                className="flex-1 px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                style={{ 
                  background: isSyncing 
                    ? "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)" 
                    : "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  boxShadow: "0 4px 20px rgba(37, 99, 235, 0.3)"
                }}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Sync New Data
                  </>
                )}
              </button>
              <button
                onClick={() => handleSyncAll('full')}
                disabled={isSyncing}
                className="px-6 py-4 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
                style={{ 
                  background: "var(--background-tertiary)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)"
                }}
              >
                Re-sync Data
              </button>
            </div>

            {/* Sync All Progress */}
            {syncAllProgress && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {syncAllProgress.current}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                    {syncAllProgress.completed.length} / {syncAllProgress.total}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full mb-3" style={{ background: "var(--background-secondary)" }}>
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(syncAllProgress.completed.length / syncAllProgress.total) * 100}%`,
                      background: "linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)",
                    }}
                  />
                </div>

                {/* Completed steps */}
                {syncAllProgress.completed.length > 0 && (
                  <div className="space-y-1">
                    {syncAllProgress.completed.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs text-center" style={{ color: "var(--foreground-muted)" }}>
                Or sync individual data sources below
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Keywords Sync */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                    Keywords
                  </span>
                </div>
                {connectionStatus.keywordsSummary ? (
                  <div className="mb-3">
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                      {connectionStatus.keywordsSummary.totalKeywords}
                    </p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      {connectionStatus.keywordsSummary.totalSearchVolume.toLocaleString()} monthly searches
                    </p>
                  </div>
                ) : (
                  <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>Not synced yet</p>
                )}
                <button
                  onClick={() => handleSync("sync_keywords")}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {syncingAction === "sync_keywords" ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" /> Sync Keywords</>
                  )}
                </button>
              </div>

              {/* Backlinks Sync */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                    Backlinks
                  </span>
                </div>
                {connectionStatus.backlinksSummary ? (
                  <div className="mb-3">
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                      {connectionStatus.backlinksSummary.totalBacklinks.toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      {connectionStatus.backlinksSummary.referringDomains} referring domains
                    </p>
                  </div>
                ) : (
                  <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>Not synced yet</p>
                )}
                <button
                  onClick={() => handleSync("sync_backlinks")}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {syncingAction === "sync_backlinks" ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" /> Sync Backlinks</>
                  )}
                </button>
              </div>

              {/* Historical Rankings Sync */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                    Rank History
                  </span>
                </div>
                {connectionStatus.historicalSummary ? (
                  <div className="mb-3">
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                      {connectionStatus.historicalSummary.monthsOfData} months
                    </p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      {connectionStatus.historicalSummary.latestMetrics?.organicKeywords || 0} current keywords
                    </p>
                  </div>
                ) : (
                  <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>Not synced yet</p>
                )}
                <button
                  onClick={() => handleSync("sync_historical_serps")}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {syncingAction === "sync_historical_serps" ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" /> Sync History</>
                  )}
                </button>
              </div>

              {/* Page Health Sync */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                    Page Health
                  </span>
                </div>
                {connectionStatus.summary ? (
                  <div className="mb-3">
                    <p className="text-xl font-bold" style={{ 
                      color: connectionStatus.summary.averageScore >= 80 ? "#10b981" : 
                             connectionStatus.summary.averageScore >= 60 ? "#f59e0b" : "#ef4444" 
                    }}>
                      {connectionStatus.summary.averageScore}%
                    </p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      {connectionStatus.summary.pagesAnalyzed} pages analyzed
                    </p>
                  </div>
                ) : (
                  <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>Not crawled yet</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleStartCrawl}
                    disabled={isSyncing || connectionStatus.status === "crawling"}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    {connectionStatus.status === "crawling" ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Crawling...</>
                    ) : (
                      <><Zap className="w-3 h-3" /> Start Crawl</>
                    )}
                  </button>
                  <button
                    onClick={checkCrawlStatus}
                    disabled={isSyncing}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center"
                    style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    title="Check crawl status"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Crawl Progress */}
            {crawlProgress && (
              <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    Crawl Progress
                  </span>
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {crawlProgress.pagesCrawled} / {crawlProgress.maxPages} pages
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${(crawlProgress.pagesCrawled / crawlProgress.maxPages) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </motion.div>
        )}

        {/* Summary Cards */}
        {isConnected && connectionStatus.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
          >
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Pages Analyzed
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {connectionStatus.summary.pagesAnalyzed}
              </p>
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
                  <Activity className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Health Score
                </span>
              </div>
              <p
                className="text-2xl font-bold"
                style={{
                  color:
                    connectionStatus.summary.averageScore >= 80
                      ? "#10b981"
                      : connectionStatus.summary.averageScore >= 60
                      ? "#f59e0b"
                      : "#ef4444",
                }}
              >
                {connectionStatus.summary.averageScore}%
              </p>
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Critical Issues
                </span>
              </div>
              <p className="text-2xl font-bold text-red-500">
                {connectionStatus.summary.issues.critical}
              </p>
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-500/10">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Warnings
                </span>
              </div>
              <p className="text-2xl font-bold text-yellow-500">
                {connectionStatus.summary.issues.warnings}
              </p>
            </div>
          </motion.div>
        )}

        {/* Features Info */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {[
              {
                icon: <Activity className="w-5 h-5" />,
                title: "Site Health Analysis",
                description: "Get detailed on-page SEO scores and performance metrics for every page",
              },
              {
                icon: <AlertTriangle className="w-5 h-5" />,
                title: "Issue Detection",
                description: "Identify critical SEO issues, warnings, and optimization opportunities",
              },
              {
                icon: <FileText className="w-5 h-5" />,
                title: "Page-Level Insights",
                description: "Analyze meta tags, headings, load times, and technical SEO factors",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="rounded-xl p-5"
                style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500 mb-3">
                  {feature.icon}
                </div>
                <h3 className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  {feature.title}
                </h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

