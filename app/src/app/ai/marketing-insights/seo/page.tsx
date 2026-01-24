"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Link2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Target,
  Lightbulb,
  BarChart3,
  Activity,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Clock,
  MousePointerClick,
} from "lucide-react";

// SEO Benchmarks from Ahrefs/SEMrush research
const BENCHMARKS = {
  organicCTR: { poor: 2, fair: 5, good: 8, excellent: 12 },
  bounceRate: { excellent: 30, good: 45, fair: 60, poor: 75 },
  avgSessionDuration: { poor: 60, fair: 120, good: 180, excellent: 240 },
  domainAuthority: { poor: 20, fair: 40, good: 60, excellent: 80 },
};

interface SEOMetrics {
  totalKeywords: number;
  top3Keywords: number;
  top10Keywords: number;
  top20Keywords: number;
  avgPosition: number;
  totalSearchVolume: number;
  organicTrafficEstimate: number;
  trafficTrend: number;
  totalBacklinks: number;
  referringDomains: number;
  dofollowBacklinks: number;
  avgPageHealthScore: number;
  pagesWithIssues: number;
  criticalIssues: number;
  overallHealthScore: number;
  keywordsImproved: number;
  keywordsDeclined: number;
  // New metrics from GA4
  organicBounceRate?: number;
  avgSessionDuration?: number;
  organicConversionRate?: number;
  pagesPerSession?: number;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
}

interface Opportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  keywords?: string[];
  estimatedTrafficGain?: number;
}

interface AnalysisSummary {
  keyInsights: string[];
  topOpportunities: string[];
  topRisks: string[];
  recommendedActions: string[];
}

interface ImpactRanking {
  rank: number;
  item: string;
  type: string;
  category: string;
  impactScore: number;
  recommendation: string;
}

// Performance rating component (Ahrefs-style)
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

// Health score gauge component
function HealthGauge({ score, label }: { score: number; label: string }) {
  const getColor = (s: number) => {
    if (s >= 80) return "#10b981";
    if (s >= 60) return "#22c55e";
    if (s >= 40) return "#f59e0b";
    return "#ef4444";
  };
  
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-2">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke={getColor(score)}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${(score / 100) * 220} 220`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color: getColor(score) }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</p>
    </div>
  );
}

export default function SEOExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<SEOMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [analysis, setAnalysis] = useState<{
    summary?: AnalysisSummary;
    impactRankings?: ImpactRanking[];
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/marketing/seo/metrics?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (data.hasData) {
        setMetrics(data.metrics);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setLastUpdated(data.calculatedAt ? new Date(data.calculatedAt) : null);
      }
    } catch (err) {
      console.error("Error fetching SEO metrics:", err);
      setError("Failed to load SEO metrics");
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setCalculating(true);
      const response = await fetch("/api/marketing/seo/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          organizationId: currentOrg.id,
          runFullAnalysis: true,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setAnalysis(data.analysis || null);
        setLastUpdated(new Date());
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Error running analysis:", err);
      setError("Failed to run analysis");
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(Math.round(num));
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  if (loading) {
    return (
      <AppLayout title="SEO Expert" subtitle="AI-powered SEO analysis and recommendations">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="SEO Expert" subtitle="AI-powered SEO analysis and recommendations">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Primary Action - Refresh Metrics Button */}
        <div 
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6" />
            <div>
              <p className="font-semibold">Refresh SEO Metrics</p>
              <p className="text-sm opacity-80">
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleString()}` 
                  : "Click to analyze your SEO data from DataForSEO"}
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

        {/* Key Metrics with Performance Indicators */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#3b82f620" }}>
                    <Search className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                    {metrics.top10Keywords} in Top 10
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalKeywords)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Keywords Tracked</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#10b98120", color: "#10b981" }}>
                    {metrics.top3Keywords} top 3
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#f59e0b20", color: "#f59e0b" }}>
                    {metrics.top20Keywords} top 20
                  </span>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: metrics.trafficTrend >= 0 ? "#10b98120" : "#ef444420" }}>
                    {metrics.trafficTrend >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <span 
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      background: metrics.trafficTrend >= 10 ? "#10b98120" : metrics.trafficTrend >= 0 ? "#f59e0b20" : "#ef444420",
                      color: metrics.trafficTrend >= 10 ? "#10b981" : metrics.trafficTrend >= 0 ? "#f59e0b" : "#ef4444"
                    }}
                  >
                    {metrics.trafficTrend > 0 ? '+' : ''}{metrics.trafficTrend.toFixed(1)}%
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.organicTrafficEstimate)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Organic Traffic Est.</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  {formatNumber(metrics.totalSearchVolume)} monthly search volume
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#8b5cf620" }}>
                    <Link2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#8b5cf620", color: "#8b5cf6" }}>
                    {metrics.dofollowBacklinks} dofollow
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.referringDomains)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Referring Domains</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  {formatNumber(metrics.totalBacklinks)} total backlinks
                </p>
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
                      background: metrics.overallHealthScore >= 70 ? "#10b98120" : metrics.overallHealthScore >= 50 ? "#f59e0b20" : "#ef444420",
                      color: metrics.overallHealthScore >= 70 ? "#10b981" : metrics.overallHealthScore >= 50 ? "#f59e0b" : "#ef4444"
                    }}
                  >
                    {metrics.overallHealthScore >= 70 ? "Healthy" : metrics.overallHealthScore >= 50 ? "Fair" : "At Risk"}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {Math.round(metrics.overallHealthScore)}%
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Health Score</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Avg position: {metrics.avgPosition.toFixed(1)}
                </p>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Health Score Breakdown */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Site Health Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <HealthGauge score={metrics.overallHealthScore} label="Overall" />
              <HealthGauge score={metrics.avgPageHealthScore} label="Page Health" />
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ background: metrics.criticalIssues > 0 ? "#ef444420" : "#10b98120" }}>
                  {metrics.criticalIssues > 0 ? (
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  )}
                </div>
                <p className="text-xl font-bold" style={{ color: metrics.criticalIssues > 0 ? "#ef4444" : "#10b981" }}>
                  {metrics.criticalIssues}
                </p>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Critical Issues</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ background: "#10b98120" }}>
                  <ArrowUpRight className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-xl font-bold text-green-500">{metrics.keywordsImproved}</p>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Improved</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ background: "#ef444420" }}>
                  <ArrowDownRight className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-xl font-bold text-red-500">{metrics.keywordsDeclined}</p>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Declined</p>
              </div>
            </div>
          </Card>
        )}

        {/* Engagement Metrics (from GA4) */}
        {metrics && (metrics.organicBounceRate !== undefined || metrics.avgSessionDuration !== undefined) && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Globe className="w-5 h-5" />
              Organic Traffic Quality
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                From GA4
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {metrics.organicBounceRate !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</span>
                    <PerformanceRating value={metrics.organicBounceRate} metric="bounceRate" inverse />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: metrics.organicBounceRate <= 45 ? "#10b981" : metrics.organicBounceRate <= 60 ? "#f59e0b" : "#ef4444" }}>
                    {metrics.organicBounceRate.toFixed(1)}%
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: &lt;45%</p>
                </div>
              )}
              {metrics.avgSessionDuration !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Session</span>
                    <PerformanceRating value={metrics.avgSessionDuration} metric="avgSessionDuration" />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: metrics.avgSessionDuration >= 120 ? "#10b981" : "#f59e0b" }}>
                    {formatTime(metrics.avgSessionDuration)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 2+ min</p>
                </div>
              )}
              {metrics.pagesPerSession !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Pages/Session</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: metrics.pagesPerSession >= 2 ? "#10b981" : "#f59e0b" }}>
                    {metrics.pagesPerSession.toFixed(1)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 2+ pages</p>
                </div>
              )}
              {metrics.organicConversionRate !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversion Rate</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: metrics.organicConversionRate >= 2 ? "#10b981" : "#f59e0b" }}>
                    {metrics.organicConversionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 2%+</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* AI Analysis Summary */}
        {analysis?.summary && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620" }}>
                <Lightbulb className="w-5 h-5 text-purple-500" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>AI Analysis Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Key Insights
                </h3>
                <ul className="space-y-2">
                  {analysis.summary.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <Target className="w-4 h-4 text-green-500" />
                  Recommended Actions
                </h3>
                <ul className="space-y-2">
                  {analysis.summary.recommendedActions.slice(0, 4).map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              {analysis.summary.topOpportunities.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                    Top Opportunities
                  </h3>
                  <ul className="space-y-2">
                    {analysis.summary.topOpportunities.map((opp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
                        {opp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.summary.topRisks.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                    Risks to Watch
                  </h3>
                  <ul className="space-y-2">
                    {analysis.summary.topRisks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                      background: alert.type === 'critical' ? '#ef444410' : 
                                 alert.type === 'warning' ? '#f59e0b10' : '#3b82f610',
                      border: `1px solid ${alert.type === 'critical' ? '#ef444440' : 
                              alert.type === 'warning' ? '#f59e0b40' : '#3b82f640'}`,
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      alert.type === 'critical' ? 'bg-red-500' : 
                      alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{alert.message}</p>
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
                          background: opp.impact === 'high' ? '#10b98120' : opp.impact === 'medium' ? '#f59e0b20' : '#3b82f620',
                          color: opp.impact === 'high' ? '#10b981' : opp.impact === 'medium' ? '#f59e0b' : '#3b82f6',
                        }}
                      >
                        {opp.impact.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                    {opp.keywords && opp.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {opp.keywords.slice(0, 3).map((kw, ki) => (
                          <span
                            key={ki}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    {opp.estimatedTrafficGain && (
                      <p className="text-xs mt-2 font-medium" style={{ color: "#10b981" }}>
                        Est. traffic gain: +{formatNumber(opp.estimatedTrafficGain)}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Keyword Position Distribution */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Search className="w-5 h-5" />
              Keyword Position Distribution
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg" style={{ background: "#10b98110" }}>
                <p className="text-3xl font-bold text-green-500">{metrics.top3Keywords}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Position 1-3</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Featured snippets</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: "#22c55e10" }}>
                <p className="text-3xl font-bold" style={{ color: "#22c55e" }}>{metrics.top10Keywords - metrics.top3Keywords}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Position 4-10</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Page 1</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: "#f59e0b10" }}>
                <p className="text-3xl font-bold text-yellow-500">{metrics.top20Keywords - metrics.top10Keywords}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Position 11-20</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Page 2</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--foreground-muted)" }}>{metrics.totalKeywords - metrics.top20Keywords}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Position 21+</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Opportunity zone</p>
              </div>
            </div>
          </Card>
        )}

        {/* Impact Rankings */}
        {analysis?.impactRankings && analysis.impactRankings.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Impact Rankings</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Impact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.impactRankings.slice(0, 10).map((ranking, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 font-bold" style={{ color: "var(--foreground)" }}>#{ranking.rank}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground)" }}>{ranking.item}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded-full text-xs"
                          style={{
                            background: ranking.type === 'opportunity' ? '#10b98120' : ranking.type === 'risk' ? '#ef444420' : '#3b82f620',
                            color: ranking.type === 'opportunity' ? '#10b981' : ranking.type === 'risk' ? '#ef4444' : '#3b82f6',
                          }}
                        >
                          {ranking.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${ranking.impactScore}%`,
                                background: ranking.impactScore > 70 ? '#10b981' : ranking.impactScore > 40 ? '#f59e0b' : '#3b82f6',
                              }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{ranking.impactScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate" style={{ color: "var(--foreground-muted)" }}>
                        {ranking.recommendation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* No Data State */}
        {!metrics && !loading && (
          <Card>
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No SEO Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect DataForSEO and run a sync to see your SEO metrics.
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
