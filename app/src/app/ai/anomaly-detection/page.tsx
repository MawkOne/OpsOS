"use client";

import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Activity, ChevronRight } from "lucide-react";
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
  const { currentOrganization } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, high: 0, critical: 0 });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAnomalies();
    }
  }, [currentOrganization]);

  async function fetchAnomalies() {
    try {
      const response = await fetch(
        `/api/opportunities?organizationId=${currentOrganization?.id}&limit=100`
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

  return (
    <AppLayout
      title="Anomaly Detection"
      subtitle="Identifies sudden changes and unusual patterns in your metrics"
    >
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Anomalies</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <Activity className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Priority</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.high}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-orange-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Urgency</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.critical}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* What This Detects */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">What Anomaly Detection Finds</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Revenue Anomalies</p>
              <p className="text-sm text-gray-600">±20% deviations from 7d/28d baseline</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Traffic Spikes/Drops</p>
              <p className="text-sm text-gray-600">Sessions 40%+ above/below baseline</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Conversion Rate Changes</p>
              <p className="text-sm text-gray-600">CVR 30%+ deviation from normal</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Cost Anomalies</p>
              <p className="text-sm text-gray-600">Spend 50%+ deviation from expected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Detected Anomalies</h2>
          <p className="text-sm text-gray-600 mt-1">
            Sudden changes flagged in the last 7 days
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading anomalies...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">No anomalies detected</p>
              <p className="text-gray-500 text-sm mt-2">
                Your metrics are performing within normal ranges
              </p>
            </div>
          ) : (
            opportunities.map((opp) => (
              <Link
                key={opp.id}
                href={`/ai/opportunities?id=${opp.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {opp.evidence?.delta_pct > 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    )}
                    <h3 className="font-semibold text-gray-900">{opp.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        opp.priority === "high"
                          ? "bg-red-100 text-red-700"
                          : opp.priority === "medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {opp.priority}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {Math.round(opp.confidence_score * 100)}% conf
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 mb-3">{opp.description}</p>
                {opp.evidence && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {opp.evidence.current !== undefined && (
                      <span className="text-gray-600">
                        <strong>Current:</strong> {opp.evidence.current.toLocaleString()}
                      </span>
                    )}
                    {opp.evidence.baseline && (
                      <span className="text-gray-600">
                        <strong>Baseline:</strong> {opp.evidence.baseline.toLocaleString()}
                      </span>
                    )}
                    {opp.evidence.delta_pct !== undefined && (
                      <span
                        className={`font-semibold ${
                          opp.evidence.delta_pct > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
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
      </div>
    </AppLayout>
  );
}
