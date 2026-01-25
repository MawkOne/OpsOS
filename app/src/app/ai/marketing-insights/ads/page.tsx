"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Megaphone,
  DollarSign,
  MousePointerClick,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Target,
  Activity,
  BarChart3,
  AlertCircle,
  Zap,
} from "lucide-react";

// Google Ads benchmarks from 2025 research
const BENCHMARKS = {
  conversionRate: { poor: 2, fair: 3, good: 5, excellent: 10 },
  bounceRate: { excellent: 30, good: 45, fair: 60, poor: 75 },
  roas: { poor: 2, fair: 3, good: 4, excellent: 8 },
  ctr: { poor: 1, fair: 2, good: 3, excellent: 5 },
  qualityScore: { poor: 5, fair: 6, good: 7, excellent: 9 },
};

interface AdsMetrics {
  totalPaidSessions: number;
  totalPaidUsers: number;
  paidTrafficShare: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  avgBounceRate: number;
  avgSessionDuration: number;
  avgEngagementRate: number;
  pagesPerSession: number;
  totalCampaigns: number;
  activeCampaigns: number;
  topCampaignByConversions: string;
  topCampaignByRevenue: string;
  trafficQualityScore: number;
  hasCostData: boolean;
  // Google Ads cost metrics (from GA4 linked data)
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
  spendTrend?: number;
  conversionsTrend?: number;
}

interface CampaignMetric {
  campaign: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  bounceRate: number;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
}

interface Opportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  campaigns?: string[];
  estimatedLift?: string;
}

// Performance rating component (Google Ads style)
function PerformanceRating({ value, metric, inverse = false }: { value: number; metric: keyof typeof BENCHMARKS; inverse?: boolean }) {
  const benchmark = BENCHMARKS[metric];
  let rating: string;
  let color: string;
  
  if (inverse) {
    if (value <= benchmark.excellent) { rating = "Excellent"; color = "#10b981"; }
    else if (value <= benchmark.good) { rating = "Good"; color = "#22c55e"; }
    else if (value <= benchmark.fair) { rating = "Fair"; color = "#f59e0b"; }
    else { rating = "Poor"; color = "#ef4444"; }
  } else {
    if (value >= benchmark.excellent) { rating = "Excellent"; color = "#10b981"; }
    else if (value >= benchmark.good) { rating = "Good"; color = "#22c55e"; }
    else if (value >= benchmark.fair) { rating = "Fair"; color = "#f59e0b"; }
    else { rating = "Poor"; color = "#ef4444"; }
  }
  
  return (
    <span 
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${color}20`, color }}
    >
      {rating}
    </span>
  );
}

export default function AdsExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<AdsMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [_dataLimitations, setDataLimitations] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/marketing/ads/metrics?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (data.hasData) {
        setMetrics(data.metrics);
        setCampaigns(data.campaignBreakdown || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setDataLimitations(data.dataLimitations || []);
        setLastUpdated(data.calculatedAt ? new Date(data.calculatedAt) : null);
      }
    } catch (err) {
      console.error("Error fetching ads metrics:", err);
      setError("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) {
      setError("No organization selected");
      return;
    }

    try {
      setCalculating(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch("/api/marketing/ads/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `API error: ${response.status}`);
        return;
      }

      if (data.success) {
        setMetrics(data.metrics);
        setCampaigns(data.campaignBreakdown || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setDataLimitations(data.dataLimitations || []);
        setLastUpdated(new Date());
        setSuccess(`Analysis complete! Found ${data.metrics?.totalPaidSessions || 0} paid sessions.`);
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Error running analysis:", err);
      setError(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(Math.round(num));
  const formatPercent = (num: number) => `${num.toFixed(1)}%`;
  const formatCurrency = (num: number) => `$${formatNumber(num)}`;

  if (loading) {
    return (
      <AppLayout title="Ads Expert" subtitle="AI-powered advertising analysis">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ads Expert" subtitle="AI-powered advertising analysis">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Primary Action - Refresh Metrics Button */}
        <div 
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          <div className="flex items-center gap-3">
            <Megaphone className="w-6 h-6" />
            <div>
              <p className="font-semibold">Refresh Advertising Metrics</p>
              <p className="text-sm opacity-80">
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleString()}` 
                  : "Click to analyze your paid traffic data"}
              </p>
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={calculating}
            className="px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all disabled:opacity-50"
            style={{ background: "var(--background)", color: "var(--accent)" }}
          >
            {calculating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {calculating ? "Analyzing..." : "Refresh Metrics"}
          </button>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: "#ef444420", border: "1px solid #ef4444" }}>
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: "#10b98120", border: "1px solid #10b981" }}>
            <Activity className="w-5 h-5 text-green-500" />
            <p className="text-sm" style={{ color: "#10b981" }}>{success}</p>
          </div>
        )}

        {/* Data Status - What We Have vs What We Need */}
        {metrics && !metrics.hasCostData && (
          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg" style={{ background: "#3b82f620" }}>
                <AlertCircle className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Limited Data - Connect Google Ads for Full Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div className="p-3 rounded-lg" style={{ background: "#10b98110", border: "1px solid #10b98140" }}>
                    <p className="text-xs font-medium text-green-600 mb-1">Available (GA4)</p>
                    <ul className="text-xs space-y-1" style={{ color: "var(--foreground-muted)" }}>
                      <li>• Sessions & Users</li>
                      <li>• Conversions</li>
                      <li>• Revenue</li>
                      <li>• Bounce Rate</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "#ef444410", border: "1px solid #ef444440" }}>
                    <p className="text-xs font-medium text-red-600 mb-1">Missing (Need Ads API)</p>
                    <ul className="text-xs space-y-1" style={{ color: "var(--foreground-muted)" }}>
                      <li>• CTR</li>
                      <li>• CPC / CPA</li>
                      <li>• ROAS</li>
                      <li>• Quality Score</li>
                    </ul>
                  </div>
                  <div className="col-span-2 p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                    <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground)" }}>Why It Matters</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      ROAS, CPC, and Quality Score are critical for optimizing ad spend. 
                      A 1-point Quality Score increase can reduce CPC by up to 16%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Key Performance Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#3b82f620" }}>
                    <MousePointerClick className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                    {formatPercent(metrics.paidTrafficShare)} of total
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalPaidSessions)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Paid Sessions</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  {formatNumber(metrics.totalPaidUsers)} unique users
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#10b98120" }}>
                    <Target className="w-5 h-5 text-green-500" />
                  </div>
                  <PerformanceRating value={metrics.conversionRate} metric="conversionRate" />
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalConversions)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversions</p>
                <p className="text-xs mt-2" style={{ color: metrics.conversionRate >= 3 ? "#10b981" : "var(--foreground-muted)" }}>
                  {formatPercent(metrics.conversionRate)} conversion rate
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#8b5cf620" }}>
                    <DollarSign className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#10b98120", color: "#10b981" }}>
                    Revenue
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>From Paid Traffic</p>
                {metrics.totalConversions > 0 && (
                  <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                    {formatCurrency(metrics.totalRevenue / metrics.totalConversions)} per conversion
                  </p>
                )}
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#f59e0b20" }}>
                    <Activity className="w-5 h-5 text-yellow-500" />
                  </div>
                  <span 
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      background: metrics.trafficQualityScore >= 60 ? "#10b98120" : "#f59e0b20",
                      color: metrics.trafficQualityScore >= 60 ? "#10b981" : "#f59e0b"
                    }}
                  >
                    {metrics.trafficQualityScore >= 60 ? "Good" : "Needs Work"}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {Math.round(metrics.trafficQualityScore)}%
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Traffic Quality Score</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Based on engagement & conversions
                </p>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Google Ads Cost Metrics - Only show when we have cost data */}
        {metrics && metrics.hasCostData && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <DollarSign className="w-5 h-5 text-green-500" />
              Google Ads Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>Total Spend</p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatCurrency(metrics.totalSpend || 0)}
                </p>
                {metrics.spendTrend !== undefined && metrics.spendTrend !== 0 && (
                  <p className="text-xs" style={{ color: metrics.spendTrend > 0 ? "#f59e0b" : "#10b981" }}>
                    {metrics.spendTrend > 0 ? "↑" : "↓"} {Math.abs(metrics.spendTrend).toFixed(1)}% MoM
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>ROAS</span>
                  <PerformanceRating value={metrics.roas || 0} metric="roas" />
                </div>
                <p className="text-2xl font-bold" style={{ color: (metrics.roas || 0) >= 4 ? "#10b981" : (metrics.roas || 0) >= 2 ? "#f59e0b" : "#ef4444" }}>
                  {(metrics.roas || 0).toFixed(2)}x
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 4x+</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>CTR</span>
                  <PerformanceRating value={metrics.ctr || 0} metric="ctr" />
                </div>
                <p className="text-2xl font-bold" style={{ color: (metrics.ctr || 0) >= 3 ? "#10b981" : (metrics.ctr || 0) >= 2 ? "#f59e0b" : "#ef4444" }}>
                  {formatPercent(metrics.ctr || 0)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {metrics.totalImpressions ? formatNumber(metrics.totalImpressions) + ' impressions' : 'Target: 3%+'}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>CPC</p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  ${(metrics.cpc || 0).toFixed(2)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {metrics.totalClicks ? formatNumber(metrics.totalClicks) + ' clicks' : ''}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>CPA</p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  ${(metrics.cpa || 0).toFixed(2)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Cost per conversion
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Traffic Quality Breakdown */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Zap className="w-5 h-5" />
              Traffic Quality Indicators
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</span>
                  <PerformanceRating value={metrics.avgBounceRate} metric="bounceRate" inverse />
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.avgBounceRate <= 45 ? "#10b981" : metrics.avgBounceRate <= 60 ? "#f59e0b" : "#ef4444" }}>
                  {formatPercent(metrics.avgBounceRate)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: &lt;45%</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Engagement Rate</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.avgEngagementRate >= 50 ? "#10b981" : "#f59e0b" }}>
                  {formatPercent(metrics.avgEngagementRate)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 50%+</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Pages/Session</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.pagesPerSession >= 2 ? "#10b981" : "#f59e0b" }}>
                  {metrics.pagesPerSession.toFixed(1)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 2+ pages</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Session</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.avgSessionDuration >= 60 ? "#10b981" : "#f59e0b" }}>
                  {Math.floor(metrics.avgSessionDuration / 60)}m {Math.round(metrics.avgSessionDuration % 60)}s
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 1+ min</p>
              </div>
            </div>
          </Card>
        )}

        {/* Alerts & Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {alerts.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Alerts ({alerts.length})</h2>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-lg flex items-start gap-3"
                    style={{
                      background: alert.type === 'critical' ? '#ef444410' : alert.type === 'warning' ? '#f59e0b10' : '#3b82f610',
                      border: `1px solid ${alert.type === 'critical' ? '#ef444440' : alert.type === 'warning' ? '#f59e0b40' : '#3b82f640'}`,
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      alert.type === 'critical' ? 'bg-red-500' : alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                      <p className="text-xs mt-1 capitalize" style={{ color: "var(--foreground-muted)" }}>
                        {alert.category}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}

          {opportunities.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Opportunities ({opportunities.length})</h2>
              </div>
              <div className="space-y-3">
                {opportunities.map((opp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-lg"
                    style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: opp.impact === 'high' ? '#10b98120' : '#f59e0b20',
                          color: opp.impact === 'high' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {opp.impact.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                    {opp.estimatedLift && (
                      <p className="text-xs mt-2 font-medium" style={{ color: "#10b981" }}>
                        {opp.estimatedLift}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Campaign Performance Table */}
        {campaigns.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <BarChart3 className="w-5 h-5" />
                Campaign Performance
              </h3>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--background-secondary)", color: "var(--foreground-muted)" }}>
                {campaigns.length} campaigns
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Campaign</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Sessions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Conversions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Conv. Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Bounce</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 10).map((c, i) => {
                    // Calculate campaign score
                    let score = 0;
                    if (c.conversionRate >= 5) score += 2;
                    else if (c.conversionRate >= 2) score += 1;
                    if (c.bounceRate <= 45) score += 2;
                    else if (c.bounceRate <= 60) score += 1;
                    const rating = score >= 3 ? "A" : score >= 2 ? "B" : score >= 1 ? "C" : "D";
                    const ratingColor = score >= 3 ? "#10b981" : score >= 2 ? "#22c55e" : score >= 1 ? "#f59e0b" : "#ef4444";
                    
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: ratingColor }} />
                            <span className="text-sm max-w-xs truncate" style={{ color: "var(--foreground)" }}>{c.campaign}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                          {formatNumber(c.sessions)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium" style={{ color: "#10b981" }}>
                          {c.conversions}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span style={{ color: c.conversionRate >= 3 ? "#10b981" : c.conversionRate >= 2 ? "#f59e0b" : "var(--foreground-muted)" }}>
                            {formatPercent(c.conversionRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground)" }}>
                          {formatCurrency(c.revenue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span style={{ color: c.bounceRate <= 45 ? "#10b981" : c.bounceRate <= 60 ? "#f59e0b" : "#ef4444" }}>
                            {formatPercent(c.bounceRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            className="inline-block w-6 h-6 rounded text-xs font-bold flex items-center justify-center"
                            style={{ background: `${ratingColor}20`, color: ratingColor }}
                          >
                            {rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {metrics && !metrics.hasCostData && (
              <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: "#f59e0b10", border: "1px solid #f59e0b40" }}>
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Connect Google Ads API to see CPC, CPA, ROAS, and Quality Score for each campaign.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Industry Benchmarks Reference */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <BarChart3 className="w-5 h-5" />
              2025 Industry Benchmarks
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Conversion Rate</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "#ef4444" }}>Poor</span><span>&lt;{BENCHMARKS.conversionRate.poor}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#22c55e" }}>Good</span><span>{BENCHMARKS.conversionRate.good}%+</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#10b981" }}>Excellent</span><span>{BENCHMARKS.conversionRate.excellent}%+</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "#ef4444" }}>Poor</span><span>&gt;{BENCHMARKS.bounceRate.poor}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#22c55e" }}>Good</span><span>&lt;{BENCHMARKS.bounceRate.good}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#10b981" }}>Excellent</span><span>&lt;{BENCHMARKS.bounceRate.excellent}%</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>CTR (Search Ads)</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "#ef4444" }}>Poor</span><span>&lt;{BENCHMARKS.ctr.poor}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#22c55e" }}>Good</span><span>{BENCHMARKS.ctr.good}%+</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#10b981" }}>Excellent</span><span>{BENCHMARKS.ctr.excellent}%+</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>ROAS</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "#ef4444" }}>Poor</span><span>&lt;{BENCHMARKS.roas.poor}:1</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#22c55e" }}>Good</span><span>{BENCHMARKS.roas.good}:1+</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#10b981" }}>Excellent</span><span>{BENCHMARKS.roas.excellent}:1+</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* No Data State */}
        {!metrics && !loading && (
          <Card>
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Advertising Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect Google Analytics and run campaigns to see your ad performance.
              </p>
              <button
                onClick={runAnalysis}
                disabled={calculating}
                className="px-4 py-2 rounded-lg font-semibold"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                Run Analysis
              </button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
