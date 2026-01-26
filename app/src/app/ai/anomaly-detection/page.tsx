"use client";

import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  priority: string;
  evidence: any;
  metrics: any;
  confidence_score: number;
  potential_impact_score: number;
  urgency_score: number;
}

export default function AnomalyDetectionPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, high: 0, critical: 0 });

  useEffect(() => {
    if (currentOrg?.id) {
      fetchAnomalies();
    }
  }, [currentOrg]);

  async function fetchAnomalies() {
    try {
      const response = await fetch(
        `/api/opportunities?organizationId=${currentOrg?.id}&limit=100`
      );
      const data = await response.json();

      // Filter for anomaly-related opportunities
      const anomalies = data.opportunities?.filter(
        (opp: Opportunity) =>
          opp.category === "anomaly" ||
          opp.category === "revenue_anomaly" ||
          opp.type?.includes("anomaly") ||
          opp.description?.toLowerCase().includes("spike") ||
          opp.description?.toLowerCase().includes("drop") ||
          opp.description?.toLowerCase().includes("deviation")
      ) || [];

      setOpportunities(anomalies);

      // Calculate stats
      const high = anomalies.filter((o: Opportunity) => o.priority === "high").length;
      const critical = anomalies.filter(
        (o: Opportunity) => o.urgency_score >= 85
      ).length;

      setStats({ total: anomalies.length, high, critical });
    } catch (error) {
      console.error("Error fetching anomalies:", error);
    } finally {
      setLoading(false);
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-500/10 text-red-400 border-red-500/20",
      medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      low: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  return (
    <AppLayout
      title="Anomaly Detection"
      subtitle="Sudden changes and unusual patterns in your metrics"
    >
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Anomalies</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{stats.total}</p>
            </div>
            <Activity className="w-12 h-12" style={{ color: "var(--accent)", opacity: 0.2 }} />
          </div>
        </Card>

        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>High Priority</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">{stats.high}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-orange-400" style={{ opacity: 0.2 }} />
          </div>
        </Card>

        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Critical Urgency</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{stats.critical}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-400" style={{ opacity: 0.2 }} />
          </div>
        </Card>
      </div>

      {/* What This Detects */}
      <Card className="glass mb-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>What Anomaly Detection Finds</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Revenue Anomalies</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>±20% deviations from 7d/28d baseline</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Traffic Spikes/Drops</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Sessions 40%+ above/below baseline</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Conversion Rate Changes</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>CVR 30%+ deviation from normal</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Cost Anomalies</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Spend 50%+ deviation from expected</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Opportunities List */}
      <Card className="glass">
        <div className="mb-6">
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Detected Anomalies</h2>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Sudden changes flagged in the last 7 days
          </p>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "var(--accent)" }}></div>
              <p className="mt-4" style={{ color: "var(--foreground-muted)" }}>Loading anomalies...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-subtle)" }} />
              <p className="text-lg font-medium" style={{ color: "var(--foreground-muted)" }}>No anomalies detected</p>
              <p className="text-sm mt-2" style={{ color: "var(--foreground-subtle)" }}>
                Your metrics are performing within normal ranges
              </p>
            </div>
          ) : (
            opportunities.map((opp) => (
              <Link
                key={opp.id}
                href={`/ai/opportunities?id=${opp.id}`}
                className="block p-6 rounded-lg transition-all border"
                style={{
                  background: "var(--background-secondary)",
                  borderColor: "var(--border)"
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {opp.evidence?.delta_pct > 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    )}
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(opp.priority)}`}>
                      {opp.priority}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{
                      background: "var(--accent-muted)",
                      color: "var(--accent)",
                      borderColor: "var(--accent)"
                    }}>
                      {Math.round(opp.confidence_score * 100)}% conf
                    </span>
                  </div>
                </div>
                <p className="mb-3" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                {opp.evidence && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {opp.evidence.current !== undefined && (
                      <span style={{ color: "var(--foreground-muted)" }}>
                        <strong>Current:</strong> {opp.evidence.current.toLocaleString()}
                      </span>
                    )}
                    {opp.evidence.baseline && (
                      <span style={{ color: "var(--foreground-muted)" }}>
                        <strong>Baseline:</strong> {opp.evidence.baseline.toLocaleString()}
                      </span>
                    )}
                    {opp.evidence.delta_pct !== undefined && (
                      <span className={`font-semibold ${
                        opp.evidence.delta_pct > 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {opp.evidence.delta_pct > 0 ? "+" : ""}
                        {opp.evidence.delta_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
