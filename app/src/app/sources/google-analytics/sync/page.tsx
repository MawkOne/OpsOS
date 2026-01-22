"use client";

import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { useOrganization } from "@/contexts/OrganizationContext";
import { RefreshCw, CheckCircle, AlertCircle, Database } from "lucide-react";

export default function GASync() {
  const { currentOrg } = useOrganization();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (months: number) => {
    if (!currentOrg?.id) return;

    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/google-analytics/sync?organizationId=${currentOrg.id}&months=${months}`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync");
      }

      setResult(data);
    } catch (err) {
      console.error("Sync error:", err);
      setError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppLayout
      title="Google Analytics Sync"
      subtitle="Sync GA4 data to Firestore (and BigQuery)"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Info Card */}
        <Card>
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: "#F9AB0020", color: "#F9AB00" }}
            >
              <Database className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                How It Works
              </h3>
              <ul className="text-sm space-y-2" style={{ color: "var(--foreground-muted)" }}>
                <li>• Fetches GA4 data via API (traffic sources, campaigns, events, pages)</li>
                <li>• Stores in Firestore collections: ga_traffic_sources, ga_campaigns, ga_events, ga_pages</li>
                <li>• Automatically syncs to BigQuery via Firestore BigQuery Export extension</li>
                <li>• Enables historical analysis and marketing causation</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Sync Controls */}
        <Card>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Manual Sync
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleSync(1)}
              disabled={syncing || !currentOrg}
              className="px-6 py-4 rounded-lg text-left transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: "var(--background-secondary)",
                border: "2px solid var(--border)",
              }}
            >
              <RefreshCw className={`w-5 h-5 mb-2 ${syncing ? 'animate-spin' : ''}`} style={{ color: "#3b82f6" }} />
              <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Current Month
              </div>
              <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Sync this month only
              </div>
            </button>

            <button
              onClick={() => handleSync(3)}
              disabled={syncing || !currentOrg}
              className="px-6 py-4 rounded-lg text-left transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: "var(--background-secondary)",
                border: "2px solid var(--border)",
              }}
            >
              <RefreshCw className={`w-5 h-5 mb-2 ${syncing ? 'animate-spin' : ''}`} style={{ color: "#f59e0b" }} />
              <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Last 3 Months
              </div>
              <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Quick backfill
              </div>
            </button>

            <button
              onClick={() => handleSync(12)}
              disabled={syncing || !currentOrg}
              className="px-6 py-4 rounded-lg text-left transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: "var(--background-secondary)",
                border: "2px solid var(--border)",
              }}
            >
              <RefreshCw className={`w-5 h-5 mb-2 ${syncing ? 'animate-spin' : ''}`} style={{ color: "#10b981" }} />
              <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Last 12 Months
              </div>
              <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Full historical backfill
              </div>
            </button>
          </div>
        </Card>

        {/* Loading State */}
        {syncing && (
          <Card>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mr-3" style={{ color: "var(--accent)" }} />
              <span className="text-lg" style={{ color: "var(--foreground)" }}>
                Syncing GA4 data to Firestore...
              </span>
            </div>
          </Card>
        )}

        {/* Success Result */}
        {result && !error && (
          <Card>
            <div className="flex items-start gap-4">
              <CheckCircle className="w-6 h-6 mt-1" style={{ color: "#10b981" }} />
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2" style={{ color: "#10b981" }}>
                  Sync Completed Successfully!
                </h3>
                <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                  {result.message}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div
                    className="px-4 py-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
                      {result.results.trafficSources}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                      Traffic Sources
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                      {result.results.campaigns}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                      Campaigns
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                      {result.results.events}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                      Events
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div className="text-2xl font-bold" style={{ color: "#10b981" }}>
                      {result.results.pages}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                      Pages
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card>
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 mt-1" style={{ color: "#ef4444" }} />
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2" style={{ color: "#ef4444" }}>
                  Sync Failed
                </h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {error}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Next Steps */}
        <Card>
          <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Next Steps
          </h3>
          <ul className="text-sm space-y-2" style={{ color: "var(--foreground-muted)" }}>
            <li>
              ✅ <strong>Data in Firestore:</strong> Check collections: ga_traffic_sources, ga_campaigns, ga_events, ga_pages
            </li>
            <li>
              ✅ <strong>Auto-sync to BigQuery:</strong> Data will appear in BigQuery firestore_export dataset within minutes
            </li>
            <li>
              🔄 <strong>Schedule daily syncs:</strong> Set up Cloud Scheduler to run this sync automatically
            </li>
            <li>
              📊 <strong>Build causation analysis:</strong> Query BigQuery to join GA data with Stripe customers
            </li>
          </ul>
        </Card>
      </div>
    </AppLayout>
  );
}
