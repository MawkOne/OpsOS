"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Eye,
  Target,
  Activity,
  BarChart3,
  ArrowDown,
  ArrowUp,
  Users,
  Timer,
  AlertCircle,
  Zap,
} from "lucide-react";

// Page performance benchmarks from Hotjar/Crazy Egg research
const BENCHMARKS = {
  bounceRate: { excellent: 25, good: 40, fair: 55, poor: 70 },
  avgTimeOnPage: { poor: 30, fair: 60, good: 120, excellent: 180 },
  exitRate: { excellent: 20, good: 35, fair: 50, poor: 70 },
  conversionRate: { poor: 1, fair: 2, good: 3, excellent: 5 },
};

interface PagesMetrics {
  totalPages: number;
  totalPageviews: number;
  totalUniquePageviews?: number;
  uniquePageviews?: number; // API uses this name
  avgTimeOnPage: number;
  avgBounceRate: number;
  avgExitRate?: number;
  avgEngagementRate?: number; // API uses this name
  topPagesCount?: number;
  topPages?: number; // API uses this name
  underperformingCount?: number;
  underperformingPages?: number; // API uses this name
  avgScrollDepth?: number;
  overallHealthScore: number;
  conversionRate: number;
  engagementScore: number;
  pagesPerSession: number;
  totalEntrances?: number;
  totalExits?: number;
  totalSessions?: number; // API uses this name
}

interface PageData {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  exitRate: number;
  entrances: number;
  exits: number;
  conversions?: number;
  conversionRate?: number;
  scrollDepth?: number;
  issue?: string;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  pages?: string[];
}

interface Opportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  pages?: string[];
  estimatedLift?: string;
}

// Performance rating component
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

// Mini heatmap indicator (Hotjar-inspired)
function HeatmapIndicator({ value, max, label }: { value: number; max: number; label: string }) {
  const intensity = Math.min(100, (value / max) * 100);
  const hue = 120 - (intensity * 1.2); // Green to red
  const color = `hsl(${Math.max(0, hue)}, 70%, 50%)`;
  
  return (
    <div className="text-center">
      <div 
        className="w-16 h-16 rounded-lg mx-auto mb-1 flex items-center justify-center text-white font-bold"
        style={{ 
          background: `linear-gradient(135deg, ${color}40, ${color})`,
          border: `2px solid ${color}` 
        }}
      >
        {Math.round(value)}%
      </div>
      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{label}</p>
    </div>
  );
}

// Funnel step component
function FunnelStep({ label, value, total, color, icon: Icon }: { label: string; value: number; total: number; color: string; icon: React.ElementType }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</span>
          <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{value.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--background-secondary)" }}>
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PagesExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<PagesMetrics | null>(null);
  const [topPages, setTopPages] = useState<PageData[]>([]);
  const [underperformingPages, setUnderperformingPages] = useState<PageData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/marketing/pages/metrics?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (data.hasData) {
        setMetrics(data.metrics);
        setTopPages(data.topPerformingPages || data.topPages || []);
        setUnderperformingPages(data.underperformingPages || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setLastUpdated(data.calculatedAt ? new Date(data.calculatedAt) : null);
      }
    } catch (err) {
      console.error("Error fetching pages metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setCalculating(true);
      const response = await fetch("/api/marketing/pages/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setTopPages(data.topPerformingPages || data.topPages || []);
        setUnderperformingPages(data.underperformingPages || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Error running analysis:", err);
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
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  if (loading) {
    return (
      <AppLayout title="Pages Expert" subtitle="AI-powered page performance analysis">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Pages Expert" subtitle="AI-powered page performance analysis">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Primary Action - Refresh Metrics Button */}
        <div 
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <p className="font-semibold">Refresh Page Metrics</p>
              <p className="text-sm opacity-80">
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleString()}` 
                  : "Click to analyze page performance from GA4"}
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

        {/* Key Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#3b82f620" }}>
                    <Eye className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                    {metrics.totalPages || 0} pages
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalPageviews || 0)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Pageviews</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  {formatNumber(metrics.totalUniquePageviews || metrics.uniquePageviews || 0)} unique
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: (metrics.avgBounceRate || 0) <= 40 ? "#10b98120" : "#ef444420" }}>
                    <ArrowUp className="w-5 h-5" style={{ color: (metrics.avgBounceRate || 0) <= 40 ? "#10b981" : "#ef4444" }} />
                  </div>
                  <PerformanceRating value={metrics.avgBounceRate || 0} metric="bounceRate" inverse />
                </div>
                <p className="text-2xl font-bold" style={{ color: (metrics.avgBounceRate || 0) <= 40 ? "#10b981" : (metrics.avgBounceRate || 0) <= 55 ? "#f59e0b" : "#ef4444" }}>
                  {formatPercent(metrics.avgBounceRate || 0)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Bounce Rate</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Target: &lt;40%
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: (metrics.avgExitRate || metrics.avgEngagementRate || 0) <= 35 ? "#10b98120" : "#f59e0b20" }}>
                    <ArrowDown className="w-5 h-5" style={{ color: (metrics.avgExitRate || metrics.avgEngagementRate || 0) <= 35 ? "#10b981" : "#f59e0b" }} />
                  </div>
                  <PerformanceRating value={metrics.avgExitRate || metrics.avgEngagementRate || 0} metric="exitRate" inverse />
                </div>
                <p className="text-2xl font-bold" style={{ color: (metrics.avgExitRate || metrics.avgEngagementRate || 0) <= 35 ? "#10b981" : (metrics.avgExitRate || metrics.avgEngagementRate || 0) <= 50 ? "#f59e0b" : "#ef4444" }}>
                  {formatPercent(metrics.avgExitRate || metrics.avgEngagementRate || 0)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Exit Rate</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Target: &lt;35%
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#f59e0b20" }}>
                    <Timer className="w-5 h-5 text-yellow-500" />
                  </div>
                  <PerformanceRating value={metrics.avgTimeOnPage} metric="avgTimeOnPage" />
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatTime(metrics.avgTimeOnPage)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Time on Page</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Target: 2+ min
                </p>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Visitor Flow Funnel (Hotjar-inspired) */}
        {metrics && (() => {
          const totalEntrances = metrics.totalEntrances || metrics.totalSessions || 1;
          const avgExitRate = metrics.avgExitRate || metrics.avgEngagementRate || 0;
          const totalExits = metrics.totalExits || Math.round(totalEntrances * (avgExitRate / 100)) || 0;
          const avgBounceRate = metrics.avgBounceRate || 0;
          const pagesPerSession = metrics.pagesPerSession || 1;
          const engagementScore = metrics.engagementScore || 0;
          
          return (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Zap className="w-5 h-5" />
              Visitor Flow Funnel
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <FunnelStep 
                  label="Entrances" 
                  value={totalEntrances} 
                  total={totalEntrances} 
                  color="#3b82f6" 
                  icon={Users} 
                />
                <FunnelStep 
                  label="Pageviews" 
                  value={metrics.totalPageviews || 0} 
                  total={totalEntrances * 3} 
                  color="#8b5cf6" 
                  icon={Eye} 
                />
                <FunnelStep 
                  label="Exits" 
                  value={totalExits} 
                  total={totalEntrances} 
                  color="#ef4444" 
                  icon={ArrowDown} 
                />
              </div>
              
              {/* Heatmap-style indicators */}
              <div className="col-span-2 flex items-center justify-center gap-8">
                <HeatmapIndicator value={avgBounceRate} max={100} label="Bounce Rate" />
                <HeatmapIndicator value={avgExitRate} max={100} label="Exit Rate" />
                <HeatmapIndicator value={100 - avgBounceRate} max={100} label="Engagement" />
                <div className="text-center">
                  <div 
                    className="w-16 h-16 rounded-lg mx-auto mb-1 flex items-center justify-center font-bold"
                    style={{ 
                      background: engagementScore >= 60 ? "#10b98140" : "#f59e0b40",
                      border: `2px solid ${engagementScore >= 60 ? "#10b981" : "#f59e0b"}`,
                      color: engagementScore >= 60 ? "#10b981" : "#f59e0b"
                    }}
                  >
                    {Math.round(engagementScore)}
                  </div>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Health Score</p>
                </div>
              </div>
            </div>
            
            {/* Key insight */}
            <div className="mt-6 p-3 rounded-lg flex items-start gap-3" style={{ background: "#3b82f610", border: "1px solid #3b82f640" }}>
              <Lightbulb className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Pages per session: {pagesPerSession.toFixed(1)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {pagesPerSession >= 2 
                    ? "Good engagement! Users are exploring multiple pages." 
                    : "Users are viewing few pages. Consider improving internal linking and content recommendations."}
                </p>
              </div>
            </div>
          </Card>
        );
        })()}

        {/* Engagement Quality Section */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Activity className="w-5 h-5" />
              Engagement Quality Indicators
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-3xl font-bold" style={{ color: (metrics.topPagesCount || metrics.topPages || 0) >= 5 ? "#10b981" : "#f59e0b" }}>
                  {metrics.topPagesCount || metrics.topPages || 0}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>High Performers</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Low bounce, high time</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-3xl font-bold" style={{ color: (metrics.underperformingCount || metrics.underperformingPages || 0) <= 5 ? "#10b981" : "#ef4444" }}>
                  {metrics.underperformingCount || metrics.underperformingPages || 0}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Need Attention</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>High bounce or exit</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-3xl font-bold" style={{ color: (metrics.conversionRate || 0) >= 2 ? "#10b981" : "#f59e0b" }}>
                  {formatPercent(metrics.conversionRate || 0)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversion Rate</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 2%+</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatPercent(metrics.avgScrollDepth || 50)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Scroll Depth</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {(metrics.avgScrollDepth || 50) >= 50 ? "Content engaging" : "Improve above fold"}
                </p>
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
                      background: alert.type === 'critical' ? '#ef444410' : '#f59e0b10',
                      border: `1px solid ${alert.type === 'critical' ? '#ef444440' : '#f59e0b40'}`
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${alert.type === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                      {alert.pages && alert.pages.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {alert.pages.slice(0, 2).map((p, pi) => (
                            <span key={pi} className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--background-secondary)", color: "var(--foreground-muted)" }}>
                              {p}
                            </span>
                          ))}
                          {alert.pages.length > 2 && (
                            <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>+{alert.pages.length - 2} more</span>
                          )}
                        </div>
                      )}
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
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: opp.impact === 'high' ? '#10b98120' : '#f59e0b20', color: opp.impact === 'high' ? '#10b981' : '#f59e0b' }}>
                        {opp.impact.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                    {opp.estimatedLift && (
                      <p className="text-xs mt-2 font-medium" style={{ color: "#10b981" }}>{opp.estimatedLift}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Top Performing Pages */}
        {topPages.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <TrendingUp className="w-5 h-5 text-green-500" />
                Top Performing Pages
              </h3>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#10b98120", color: "#10b981" }}>
                {topPages.length} pages
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Page</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Views</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Time</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Bounce</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Exit</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.slice(0, 10).map((page: any, i) => {
                    // Handle different API response formats
                    const pagePath = page.pagePath || page.path || '';
                    const pageTitle = page.pageTitle || page.title || pagePath;
                    const pageviews = page.pageviews || 0;
                    const avgTimeOnPage = page.avgTimeOnPage || 0;
                    const bounceRate = page.bounceRate || 0;
                    const exitRate = page.exitRate || page.engagementRate || 0;
                    
                    // Calculate page grade
                    let score = 0;
                    if (bounceRate <= 40) score += 2;
                    else if (bounceRate <= 55) score += 1;
                    if (avgTimeOnPage >= 120) score += 2;
                    else if (avgTimeOnPage >= 60) score += 1;
                    if (exitRate <= 35) score += 1;
                    const grade = score >= 4 ? "A" : score >= 3 ? "B" : score >= 2 ? "C" : "D";
                    const gradeColor = score >= 4 ? "#10b981" : score >= 3 ? "#22c55e" : score >= 2 ? "#f59e0b" : "#ef4444";
                    
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium truncate max-w-xs" style={{ color: "var(--foreground)" }}>
                              {pageTitle}
                            </p>
                            <p className="text-xs truncate max-w-xs" style={{ color: "var(--foreground-muted)" }}>{pagePath}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatNumber(pageviews)}</td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: avgTimeOnPage >= 60 ? "#10b981" : "var(--foreground-muted)" }}>
                          {formatTime(avgTimeOnPage)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: bounceRate <= 40 ? "#10b981" : bounceRate <= 55 ? "#f59e0b" : "#ef4444" }}>
                          {formatPercent(bounceRate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: exitRate <= 35 ? "#10b981" : "var(--foreground-muted)" }}>
                          {formatPercent(exitRate)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                            style={{ background: `${gradeColor}20`, color: gradeColor }}
                          >
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Underperforming Pages */}
        {underperformingPages.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <TrendingDown className="w-5 h-5 text-red-500" />
                Pages Needing Attention
              </h3>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#ef444420", color: "#ef4444" }}>
                {underperformingPages.length} pages
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Page</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Views</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Bounce</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Exit</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {underperformingPages.slice(0, 5).map((page: any, i) => {
                    const pagePath = page.pagePath || page.path || '';
                    const pageviews = page.pageviews || 0;
                    const bounceRate = page.bounceRate || 0;
                    const exitRate = page.exitRate || page.engagementRate || 0;
                    const issue = page.issue || (bounceRate > 55 ? "High Bounce" : "High Exit");
                    
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <p className="text-sm truncate max-w-xs" style={{ color: "var(--foreground)" }}>{pagePath}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatNumber(pageviews)}</td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: bounceRate > 55 ? "#ef4444" : "var(--foreground-muted)" }}>
                          {formatPercent(bounceRate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: exitRate > 50 ? "#ef4444" : "var(--foreground-muted)" }}>
                          {formatPercent(exitRate)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>
                            {issue}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Industry Benchmarks */}
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>2025 Page Performance Benchmarks</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>Excellent</span><span>&lt;25%</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>Good</span><span>&lt;40%</span></div>
                <div className="flex justify-between"><span style={{ color: "#ef4444" }}>Poor</span><span>&gt;70%</span></div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Time on Page</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>Excellent</span><span>3+ min</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>Good</span><span>2+ min</span></div>
                <div className="flex justify-between"><span style={{ color: "#ef4444" }}>Poor</span><span>&lt;30s</span></div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Exit Rate</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>Excellent</span><span>&lt;20%</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>Good</span><span>&lt;35%</span></div>
                <div className="flex justify-between"><span style={{ color: "#ef4444" }}>Poor</span><span>&gt;70%</span></div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Conversion</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>Excellent</span><span>5%+</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>Good</span><span>3%+</span></div>
                <div className="flex justify-between"><span style={{ color: "#ef4444" }}>Poor</span><span>&lt;1%</span></div>
              </div>
            </div>
          </div>
        </Card>

        {/* No Data State */}
        {!metrics && !loading && (
          <Card>
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Page Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect Google Analytics to track page performance.
              </p>
              <button onClick={runAnalysis} disabled={calculating} className="px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "var(--background)" }}>
                Run Analysis
              </button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
