"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
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
  RefreshCw,
  TrendingDown,
  ArrowUpRight
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

const CHANNELS = [
  { id: 'all', name: 'All Channels', icon: '📊' },
  { id: 'email', name: 'Email', icon: '📧' },
  { id: 'advertising', name: 'Advertising', icon: '📢' },
  { id: 'seo', name: 'SEO', icon: '🔍' },
  { id: 'pages', name: 'Pages', icon: '📄' },
  { id: 'traffic', name: 'Traffic', icon: '🌐' },
  { id: 'social', name: 'Social', icon: '👥' },
];

const GOALS = [
  { id: 'signups', name: 'Total Signups', icon: '👥', target: 6000 },
  { id: 'company_signups', name: 'Company Signups', icon: '👔', target: 3000 },
  { id: 'talent_signups', name: 'Talent Signups', icon: '💼', target: 3000 },
  { id: 'revenue', name: 'Revenue', icon: '💰', target: 100000 },
  { id: 'conversions', name: 'Conversions', icon: '🎯', target: 1000 },
];

export default function MarketingInsightsPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<MarketingInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedGoal, setSelectedGoal] = useState(GOALS[0]);

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
        `https://marketing-optimization-engine-bgjb4fnyeq-uc.a.run.app?organizationId=${currentOrg.id}&goalKpi=${selectedGoal.id}&targetValue=${selectedGoal.target}&channel=${selectedChannel}`
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
  }, [currentOrg?.id, selectedChannel, selectedGoal]);

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
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading insights...</p>
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
            <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
            <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>{error}</p>
            <button
              onClick={runAnalysis}
              disabled={refreshing}
              className="px-6 py-3 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 font-semibold transition-all"
              style={{ background: "var(--accent)", color: "var(--background)" }}
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Model Badge and Goal Selector */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Powered by Gemini 3 Flash Preview</span>
            </div>
            
            {/* Goal Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Optimize for:</span>
              <select
                value={selectedGoal.id}
                onChange={(e) => setSelectedGoal(GOALS.find(g => g.id === e.target.value) || GOALS[0])}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
              >
                {GOALS.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.icon} {goal.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            onClick={runAnalysis}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 text-sm font-semibold transition-all"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            {refreshing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh Analysis
              </>
            )}
          </button>
        </div>
        
        {/* Channel Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
          {CHANNELS.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setSelectedChannel(channel.id)}
              className={`px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedChannel === channel.id
                  ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{channel.icon}</span>
              {channel.name}
            </button>
          ))}
        </div>

        {/* Driver Health Section */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "#8b5cf620", color: "#8b5cf6" }}
            >
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Driver Health</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: "var(--background-secondary)", borderBottom: "1px solid var(--border)" }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Current
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Best
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Gap vs Best
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase" style={{ color: "var(--foreground-muted)" }}>
                    Importance
                  </th>
                </tr>
              </thead>
              <tbody style={{ borderTop: "1px solid var(--border)" }}>
                {insight.driverHealth.slice(0, 10).map((driver, driverIdx) => (
                  <motion.tr 
                    key={driver.feature}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: driverIdx * 0.03 }}
                    className="transition-colors hover:bg-[var(--background-tertiary)]"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {driver.rank}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: "var(--foreground)" }}>
                      {driver.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: driver.status === "excellent" ? "#00d4aa20" : 
                                     driver.status === "good" ? "#3b82f620" : 
                                     driver.status === "below_average" ? "#f59e0b20" : "#ef444420",
                          color: driver.status === "excellent" ? "#00d4aa" : 
                                driver.status === "good" ? "#3b82f6" : 
                                driver.status === "below_average" ? "#f59e0b" : "#ef4444"
                        }}
                      >
                        {driver.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right" style={{ color: "var(--foreground)" }}>
                      {driver.current_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                      {driver.internal_best.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                      {(driver.gap_vs_best * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium" style={{ color: "var(--foreground)" }}>
                      {(driver.importance * 100).toFixed(1)}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <StatCard
              label="Current Performance"
              value={formatNumber(insight.currentValue)}
              change={`${progressPct.toFixed(0)}% to goal`}
              changeType={isExceeding ? "positive" : "neutral"}
              icon={<Target className="w-5 h-5" />}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <StatCard
              label="Target Goal"
              value={formatNumber(insight.targetValue)}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <StatCard
              label={isExceeding ? "Exceeding By" : "Gap to Goal"}
              value={`${isExceeding ? "+" : ""}${formatNumber(Math.abs(insight.gap))}`}
              change={`${Math.abs(insight.gapPct).toFixed(0)}%`}
              changeType={isExceeding ? "positive" : "negative"}
              icon={isExceeding ? <CheckCircle2 className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <StatCard
              label="Opportunities"
              value={insight.recommendations.length}
              change="actionable"
              changeType="positive"
              icon={<Lightbulb className="w-5 h-5" />}
            />
          </motion.div>
        </div>

        {/* Header Metadata */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
            <Clock className="w-4 h-4" />
            Updated {formatTimestamp(insight.timestamp)}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
            <Activity className="w-4 h-4" />
            R² Score: {(insight.metadata.r_squared * 100).toFixed(1)}%
          </div>
        </div>

        {/* Goal Progress Card */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: isExceeding ? "#00d4aa20" : "#3b82f620", color: isExceeding ? "#00d4aa" : "#3b82f6" }}
                >
                  <Target className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Goal Progress</h2>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {insight.goalKpi.charAt(0).toUpperCase() + insight.goalKpi.slice(1)} Performance
              </p>
            </div>
            <div 
              className="px-4 py-2 rounded-full flex items-center gap-2"
              style={{ 
                background: isExceeding ? "#00d4aa20" : "var(--background-tertiary)",
                color: isExceeding ? "#00d4aa" : "var(--foreground-muted)"
              }}
            >
              {isExceeding ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">Goal Met</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm font-semibold">{progressPct.toFixed(0)}%</span>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div 
              className="h-4 rounded-full overflow-hidden"
              style={{ background: "var(--background-tertiary)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: isExceeding ? "#00d4aa" : "#3b82f6" }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPct, 100)}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Current</p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {formatNumber(insight.currentValue)}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Target</p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {formatNumber(insight.targetValue)}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>
                {isExceeding ? "Exceeding By" : "Remaining"}
              </p>
              <p className="text-2xl font-bold" style={{ color: isExceeding ? "#00d4aa" : "#ef4444" }}>
                {isExceeding ? "+" : ""}
                {formatNumber(Math.abs(insight.gap))}
              </p>
            </div>
          </div>
        </Card>

        {/* Recommendations Section */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "#f59e0b20", color: "#f59e0b" }}
            >
              <Lightbulb className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              Top Recommendations
            </h2>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ background: "#f59e0b20", color: "#f59e0b" }}
            >
              {insight.recommendations.length} Opportunities
            </span>
          </div>

          <div className="space-y-4">
            {insight.recommendations.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-6 rounded-xl transition-all hover:bg-[var(--background-tertiary)]"
                style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}
                      >
                        {rec.rank}
                      </div>
                      <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                        {rec.title}
                      </h3>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: rec.priority === "urgent" ? "#ef444420" : 
                                     rec.priority === "high" ? "#f59e0b20" : 
                                     rec.priority === "medium" ? "#3b82f620" : "#8b5cf620",
                          color: rec.priority === "urgent" ? "#ef4444" : 
                                rec.priority === "high" ? "#f59e0b" : 
                                rec.priority === "medium" ? "#3b82f6" : "#8b5cf6"
                        }}
                      >
                        {rec.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{rec.description}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Expected Lift</p>
                    <p className="text-2xl font-bold" style={{ color: "#00d4aa" }}>
                      +{formatNumber(rec.expected_lift)}
                    </p>
                  </div>
                </div>

                {/* Metrics */}
                <div 
                  className="grid grid-cols-4 gap-4 mb-4 py-4"
                  style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
                >
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Effort</p>
                    <p className="font-semibold capitalize text-sm" style={{ color: "var(--foreground)" }}>{rec.effort}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Confidence</p>
                    <p className="font-semibold capitalize text-sm" style={{ color: "var(--foreground)" }}>{rec.confidence}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Timeline</p>
                    <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                      {rec.timeline.results_visible_days} days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>Gap Closed</p>
                    <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                      {rec.pct_of_gap_closed > 0
                        ? `${rec.pct_of_gap_closed.toFixed(1)}%`
                        : "Goal Exceeded"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {rec.actions && rec.actions.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                      Action Items:
                    </p>
                    <ul className="space-y-2">
                      {rec.actions.map((action, actionIdx) => (
                        <li key={actionIdx} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                          <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Card>

      </div>
    </AppLayout>
  );
}
