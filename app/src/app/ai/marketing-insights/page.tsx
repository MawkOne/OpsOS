"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { useOrganization } from "@/contexts/OrganizationContext";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase-db";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Sparkles, 
  Clock, 
  Zap,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  Activity,
  BarChart3,
  RefreshCw
} from "lucide-react";

interface Recommendation {
  id: string;
  rank: number;
  priority: string;
  driver: string;
  type: string;
  title: string;
  description: string;
  rationale: string;
  expected_lift: number;
  pct_of_gap_closed: number;
  effort: string;
  confidence: string;
  current_value: number;
  target_value: number;
  gap_pct: number;
  actions: string[];
  timeline: {
    implementation_days: number;
    testing_days: number;
    results_visible_days: number;
    phase: string;
  };
}

interface DriverHealth {
  feature: string;
  importance: number;
  direction: string;
  current_value: number;
  historical_avg: number;
  internal_best: number;
  gap_vs_best: number;
  trend: string;
  trend_pct: number;
  status: string;
  rank: number;
}

interface MarketingInsight {
  id: string;
  organizationId: string;
  timestamp: any;
  goalKpi: string;
  currentValue: number;
  targetValue: number;
  gap: number;
  gapPct: number;
  driverHealth: DriverHealth[];
  recommendations: Recommendation[];
  metadata: {
    lookback_days: number;
    num_observations: number;
    num_features: number;
    r_squared: number;
    execution_time_seconds: number;
  };
  status: string;
}

export default function MarketingInsightsPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<MarketingInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLatestInsight = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      setError(null);

      const insightsRef = collection(db, "marketing_insights");
      const q = query(
        insightsRef,
        where("organizationId", "==", currentOrg.id),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setInsight({
          id: doc.id,
          ...doc.data(),
        } as MarketingInsight);
      } else {
        setError("No insights available yet. Click 'Run Analysis' to generate insights.");
      }
    } catch (err: any) {
      console.error("Error fetching insights:", err);
      setError(err.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(
        `https://marketing-optimization-engine-bgjb4fnyeq-uc.a.run.app?organizationId=${currentOrg.id}&goalKpi=signups&targetValue=6000`
      );

      if (!response.ok) {
        throw new Error("Failed to run analysis");
      }

      const result = await response.json();

      if (result.status === "success") {
        // Refresh the insights after a short delay
        setTimeout(() => {
          fetchLatestInsight();
        }, 2000);
      } else {
        throw new Error(result.error || "Analysis failed");
      }
    } catch (err: any) {
      console.error("Error running analysis:", err);
      setError(err.message || "Failed to run analysis");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLatestInsight();
  }, [currentOrg?.id]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "text-green-600 bg-green-50";
      case "good":
        return "text-blue-600 bg-blue-50";
      case "below_average":
        return "text-yellow-600 bg-yellow-50";
      case "critical":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(Math.round(num));
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  if (loading) {
    return (
      <AppLayout title="Marketing Insights" subtitle="AI-powered optimization recommendations">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading insights...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !insight) {
    return (
      <AppLayout title="Marketing Insights" subtitle="AI-powered optimization recommendations">
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={runAnalysis}
              disabled={refreshing}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!insight) return null;

  const progressPct = (insight.currentValue / insight.targetValue) * 100;
  const isExceeding = progressPct >= 100;

  return (
    <AppLayout title="Marketing Insights" subtitle="AI-powered optimization recommendations">
      {/* Header Actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            Last updated: {formatTimestamp(insight.timestamp)}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity className="w-4 h-4" />
            R² Score: {(insight.metadata.r_squared * 100).toFixed(1)}%
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={refreshing}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2 text-sm"
        >
          {refreshing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Goal Progress Card */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-8 mb-8 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Goal Progress</h2>
            </div>
            <p className="text-purple-100">
              {insight.goalKpi.charAt(0).toUpperCase() + insight.goalKpi.slice(1)} Performance
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full ${isExceeding ? "bg-green-500/20" : "bg-white/10"}`}>
            {isExceeding ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <TrendingUp className="w-6 h-6" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-purple-200 text-sm mb-1">Current</p>
            <p className="text-3xl font-bold">{formatNumber(insight.currentValue)}</p>
          </div>
          <div>
            <p className="text-purple-200 text-sm mb-1">Target</p>
            <p className="text-3xl font-bold">{formatNumber(insight.targetValue)}</p>
          </div>
          <div>
            <p className="text-purple-200 text-sm mb-1">
              {isExceeding ? "Exceeding By" : "Gap"}
            </p>
            <p className="text-3xl font-bold">
              {isExceeding ? "+" : ""}
              {formatNumber(Math.abs(insight.gap))}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-purple-100">Progress</span>
            <span className="text-sm font-semibold">
              {progressPct.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isExceeding ? "bg-green-400" : "bg-white"
              }`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            Top Recommendations
          </h2>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            {insight.recommendations.length} Opportunities
          </span>
        </div>

        <div className="space-y-4">
          {insight.recommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold text-gray-400">
                      #{rec.rank}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900">
                      {rec.title}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(
                        rec.priority
                      )}`}
                    >
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600">{rec.description}</p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm text-gray-500 mb-1">Expected Lift</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{formatNumber(rec.expected_lift)}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-4 py-4 border-t border-b border-gray-100">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Effort</p>
                  <p className="font-semibold capitalize">{rec.effort}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Confidence</p>
                  <p className="font-semibold capitalize">{rec.confidence}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Timeline</p>
                  <p className="font-semibold">
                    {rec.timeline.results_visible_days} days
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Gap Closed</p>
                  <p className="font-semibold">
                    {rec.pct_of_gap_closed > 0
                      ? `${rec.pct_of_gap_closed.toFixed(1)}%`
                      : "Goal Exceeded"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {rec.actions && rec.actions.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Action Items:
                  </p>
                  <ul className="space-y-2">
                    {rec.actions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        <ChevronRight className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Driver Health Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900">Driver Health</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Current
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Best
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Gap vs Best
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Importance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {insight.driverHealth.slice(0, 10).map((driver) => (
                  <tr key={driver.feature} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {driver.rank}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {driver.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          driver.status
                        )}`}
                      >
                        {driver.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {driver.current_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">
                      {driver.internal_best.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">
                      {(driver.gap_vs_best * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {(driver.importance * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
