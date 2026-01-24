"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Calendar,
  Filter,
  Download,
  BarChart3,
  Users,
  MousePointer,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface BigQueryConnection {
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSyncAt?: { toDate: () => Date };
  ga4DatasetId?: string;
  ga4PropertyId?: string;
  syncedDateRange?: {
    startDate: string;
    endDate: string;
  };
  lastSyncResults?: {
    eventsIngested: number;
    usersIngested: number;
    tablesProcessed: number;
    errors: string[];
  };
  errorMessage?: string;
}

interface DatasetInfo {
  datasetId: string;
  tables: string[];
  earliestDate?: string;
  latestDate?: string;
  estimatedEvents?: number;
}

interface SyncConfig {
  startDate: string;
  endDate: string;
  eventTypes: string[];
  excludeEvents: string[];
  sampleRate: number;
  maxEventsPerDay: number;
}

const DEFAULT_EXCLUDE_EVENTS = [
  "session_start",
  "first_visit",
  "user_engagement",
  "scroll",
];

const COMMON_EVENTS = [
  { name: "page_view", description: "Page views", icon: <MousePointer className="w-4 h-4" /> },
  { name: "purchase", description: "Purchases/conversions", icon: <BarChart3 className="w-4 h-4" /> },
  { name: "sign_up", description: "User signups", icon: <Users className="w-4 h-4" /> },
  { name: "begin_checkout", description: "Checkout starts", icon: <BarChart3 className="w-4 h-4" /> },
  { name: "add_to_cart", description: "Cart additions", icon: <BarChart3 className="w-4 h-4" /> },
  { name: "view_item", description: "Product views", icon: <MousePointer className="w-4 h-4" /> },
  { name: "click", description: "Click events", icon: <MousePointer className="w-4 h-4" /> },
  { name: "form_submit", description: "Form submissions", icon: <BarChart3 className="w-4 h-4" /> },
];

export default function BigQueryPage() {
  const { currentOrg } = useOrganization();
  const [connection, setConnection] = useState<BigQueryConnection | null>(null);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  // Sync configuration
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    startDate: "2025-01-01",
    endDate: new Date().toISOString().split("T")[0],
    eventTypes: [], // Empty = all events
    excludeEvents: DEFAULT_EXCLUDE_EVENTS,
    sampleRate: 100, // 100% = no sampling
    maxEventsPerDay: 100000,
  });

  const organizationId = currentOrg?.id || "";

  // Listen to connection status
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "bigquery_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setConnection(snapshot.data() as BigQueryConnection);
        } else {
          // BigQuery is always "available" since we use Firebase project
          setConnection({
            status: "disconnected",
          });
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

  const handleDiscoverDatasets = async () => {
    if (!organizationId) return;

    setDiscovering(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/bigquery/datasets?organizationId=${organizationId}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to discover datasets");
      }

      setDatasets(data.datasets || []);
      if (data.datasets?.length > 0) {
        setSelectedDataset(data.datasets[0].datasetId);
      }
      setSuccess(`Found ${data.datasets?.length || 0} GA4 dataset(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleSync = async () => {
    if (!organizationId || !selectedDataset) {
      setError("Please select a dataset first");
      return;
    }

    setSyncing(true);
    setError(null);
    setSyncProgress("Starting sync...");

    try {
      const response = await fetch("/api/bigquery/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          datasetId: selectedDataset,
          config: syncConfig,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSuccess(
        `Synced ${data.eventsIngested?.toLocaleString() || 0} events from ${
          data.tablesProcessed || 0
        } days`
      );
      setSyncProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  };

  const handleEventToggle = (eventName: string, isExclude: boolean) => {
    if (isExclude) {
      setSyncConfig((prev) => ({
        ...prev,
        excludeEvents: prev.excludeEvents.includes(eventName)
          ? prev.excludeEvents.filter((e) => e !== eventName)
          : [...prev.excludeEvents, eventName],
      }));
    } else {
      setSyncConfig((prev) => ({
        ...prev,
        eventTypes: prev.eventTypes.includes(eventName)
          ? prev.eventTypes.filter((e) => e !== eventName)
          : [...prev.eventTypes, eventName],
      }));
    }
  };

  const selectedDatasetInfo = datasets.find((d) => d.datasetId === selectedDataset);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <AppLayout title="BigQuery" subtitle="Import GA4 event data from BigQuery">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="BigQuery" subtitle="Import GA4 event data from BigQuery">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg flex items-center gap-2"
            style={{
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
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
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: "#4285F420", color: "#4285F4" }}
              >
                <Database className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    BigQuery (GA4 Export)
                  </h2>
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Available
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Import raw GA4 event data from your native BigQuery export for advanced analytics.
                </p>
                {connection?.lastSyncAt && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--foreground-subtle)" }}
                  >
                    Last synced: {connection.lastSyncAt.toDate().toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={handleDiscoverDatasets}
                disabled={discovering}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                style={{ background: "#4285F4", color: "white" }}
              >
                <RefreshCw
                  className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`}
                />
                {discovering ? "Discovering..." : "Discover Datasets"}
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Dataset Selection */}
        {datasets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Select GA4 Dataset
              </h3>
              <div className="space-y-3">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.datasetId}
                    onClick={() => setSelectedDataset(dataset.datasetId)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedDataset === dataset.datasetId
                        ? "ring-2 ring-blue-500"
                        : ""
                    }`}
                    style={{
                      background:
                        selectedDataset === dataset.datasetId
                          ? "rgba(66, 133, 244, 0.1)"
                          : "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className="font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {dataset.datasetId}
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {dataset.tables?.length || 0} event tables available
                        </p>
                      </div>
                      {dataset.earliestDate && dataset.latestDate && (
                        <div className="text-right">
                          <p
                            className="text-sm"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {dataset.earliestDate} → {dataset.latestDate}
                          </p>
                          {dataset.estimatedEvents && (
                            <p
                              className="text-xs"
                              style={{ color: "var(--foreground-subtle)" }}
                            >
                              ~{formatNumber(dataset.estimatedEvents)} events
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Sync Configuration */}
        {selectedDataset && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Configure Import
              </h3>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={syncConfig.startDate}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <Calendar className="w-4 h-4 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={syncConfig.endDate}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() =>
                    setSyncConfig((prev) => ({
                      ...prev,
                      startDate: "2025-01-01",
                      endDate: new Date().toISOString().split("T")[0],
                    }))
                  }
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-muted)",
                  }}
                >
                  All of 2025
                </button>
                <button
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setMonth(start.getMonth() - 3);
                    setSyncConfig((prev) => ({
                      ...prev,
                      startDate: start.toISOString().split("T")[0],
                      endDate: end.toISOString().split("T")[0],
                    }));
                  }}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-muted)",
                  }}
                >
                  Last 3 Months
                </button>
                <button
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setMonth(start.getMonth() - 1);
                    setSyncConfig((prev) => ({
                      ...prev,
                      startDate: start.toISOString().split("T")[0],
                      endDate: end.toISOString().split("T")[0],
                    }));
                  }}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-muted)",
                  }}
                >
                  Last Month
                </button>
              </div>

              {/* Event Filtering */}
              <div className="mb-6">
                <label
                  className="block text-sm font-medium mb-3"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <Filter className="w-4 h-4 inline mr-1" />
                  Events to Include (leave empty for all)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {COMMON_EVENTS.map((event) => (
                    <button
                      key={event.name}
                      onClick={() => handleEventToggle(event.name, false)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                        syncConfig.eventTypes.includes(event.name)
                          ? "ring-2 ring-green-500"
                          : ""
                      }`}
                      style={{
                        background: syncConfig.eventTypes.includes(event.name)
                          ? "rgba(16, 185, 129, 0.2)"
                          : "var(--background-tertiary)",
                        border: "1px solid var(--border)",
                        color: syncConfig.eventTypes.includes(event.name)
                          ? "#10b981"
                          : "var(--foreground-muted)",
                      }}
                    >
                      {event.icon}
                      {event.name}
                    </button>
                  ))}
                </div>
                {syncConfig.eventTypes.length === 0 && (
                  <p
                    className="text-xs mt-2"
                    style={{ color: "var(--foreground-subtle)" }}
                  >
                    All events will be included (except excluded ones below)
                  </p>
                )}
              </div>

              {/* Advanced Options */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium mb-4"
                style={{ color: "var(--foreground-muted)" }}
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Advanced Options
              </button>

              {showAdvanced && (
                <div
                  className="space-y-4 p-4 rounded-lg mb-6"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  {/* Exclude Events */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Events to Exclude (reduce database size)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "session_start",
                        "first_visit",
                        "user_engagement",
                        "scroll",
                        "page_view",
                        "click",
                      ].map((event) => (
                        <button
                          key={event}
                          onClick={() => handleEventToggle(event, true)}
                          className={`px-2 py-1 rounded text-xs ${
                            syncConfig.excludeEvents.includes(event)
                              ? "bg-red-500/20 text-red-400"
                              : ""
                          }`}
                          style={{
                            background: syncConfig.excludeEvents.includes(event)
                              ? undefined
                              : "var(--background-secondary)",
                            color: syncConfig.excludeEvents.includes(event)
                              ? undefined
                              : "var(--foreground-muted)",
                          }}
                        >
                          {syncConfig.excludeEvents.includes(event) ? "✕ " : ""}
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sample Rate */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Sample Rate: {syncConfig.sampleRate}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={syncConfig.sampleRate}
                      onChange={(e) =>
                        setSyncConfig((prev) => ({
                          ...prev,
                          sampleRate: parseInt(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--foreground-subtle)" }}
                    >
                      Lower = smaller database, but less complete data
                    </p>
                  </div>

                  {/* Max Events Per Day */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Max Events Per Day
                    </label>
                    <select
                      value={syncConfig.maxEventsPerDay}
                      onChange={(e) =>
                        setSyncConfig((prev) => ({
                          ...prev,
                          maxEventsPerDay: parseInt(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: "var(--background-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      <option value={10000}>10,000 (conservative)</option>
                      <option value={50000}>50,000 (moderate)</option>
                      <option value={100000}>100,000 (recommended)</option>
                      <option value={500000}>500,000 (high volume)</option>
                      <option value={-1}>Unlimited (use with caution)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Estimated Impact */}
              <div
                className="p-4 rounded-lg mb-6 flex items-start gap-3"
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                }}
              >
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-400 mb-1">
                    Estimated Import
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Date range:{" "}
                    {Math.ceil(
                      (new Date(syncConfig.endDate).getTime() -
                        new Date(syncConfig.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}{" "}
                    days
                    <br />
                    Events filter:{" "}
                    {syncConfig.eventTypes.length > 0
                      ? `Only ${syncConfig.eventTypes.join(", ")}`
                      : "All events"}
                    <br />
                    Excluding: {syncConfig.excludeEvents.join(", ") || "None"}
                    <br />
                    Sample rate: {syncConfig.sampleRate}%
                  </p>
                </div>
              </div>

              {/* Sync Button */}
              <button
                onClick={handleSync}
                disabled={syncing || !selectedDataset}
                className="w-full px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                style={{ background: "#4285F4", color: "white" }}
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {syncProgress || "Importing..."}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Import Events to Firestore
                  </>
                )}
              </button>
            </Card>
          </motion.div>
        )}

        {/* Last Sync Results */}
        {connection?.lastSyncResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Last Import Results
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div
                  className="text-center p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <p
                    className="text-2xl font-bold"
                    style={{ color: "#4285F4" }}
                  >
                    {formatNumber(connection.lastSyncResults.eventsIngested)}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Events Imported
                  </p>
                </div>
                <div
                  className="text-center p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <p
                    className="text-2xl font-bold"
                    style={{ color: "#10b981" }}
                  >
                    {formatNumber(connection.lastSyncResults.usersIngested)}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Unique Users
                  </p>
                </div>
                <div
                  className="text-center p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <p
                    className="text-2xl font-bold"
                    style={{ color: "#8b5cf6" }}
                  >
                    {connection.lastSyncResults.tablesProcessed}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Days Processed
                  </p>
                </div>
              </div>
              {connection.lastSyncResults.errors?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-400 mb-2">
                    Import Errors:
                  </p>
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

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <div className="flex gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#4285F420", color: "#4285F4" }}
              >
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4
                  className="font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  About BigQuery Import
                </h4>
                <ul
                  className="text-sm space-y-2"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <li>
                    • Imports raw GA4 event data directly from your native BigQuery
                    export
                  </li>
                  <li>
                    • Enables user journey analysis, attribution modeling, and funnel
                    analysis
                  </li>
                  <li>
                    • Data is stored in Firestore for fast querying from your app
                  </li>
                  <li>
                    • Use filters to control database size and costs
                  </li>
                  <li>
                    • Historical data from 2025 can be backfilled in batches
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
