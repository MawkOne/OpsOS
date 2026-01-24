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
  Target,
  Activity,
  BarChart3,
  Calendar,
  Award,
  AlertCircle,
  Clock,
  Search,
  Link2,
  Users,
  Zap,
} from "lucide-react";

// Content benchmarks from Clearscope/MarketMuse research
const BENCHMARKS = {
  contentScore: { poor: 40, fair: 60, good: 75, excellent: 90 },
  avgTrafficPerArticle: { poor: 50, fair: 150, good: 500, excellent: 1000 },
  rankingKeywords: { poor: 3, fair: 10, good: 25, excellent: 50 },
  backlinksPerArticle: { poor: 1, fair: 5, good: 15, excellent: 30 },
};

interface ContentMetrics {
  totalArticles: number;
  totalContentViews: number;
  avgTrafficPerArticle: number;
  totalRankingKeywords: number;
  avgKeywordsPerArticle: number;
  totalBacklinks: number;
  avgBacklinksPerArticle: number;
  contentWithDecay: number;
  contentGrowing: number;
  contentStable: number;
  avgContentScore: number;
  topPerformingCount: number;
  underperformingCount: number;
  overallHealthScore: number;
  avgTimeOnPage: number;
  avgBounceRate: number;
  publishFrequency?: string;
  newestContent?: string;
  oldestContent?: string;
}

interface ContentItem {
  title: string;
  path: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  rankingKeywords?: number;
  backlinks?: number;
  contentScore: number;
  trend: 'growing' | 'stable' | 'decaying';
  trafficChange?: number;
  publishDate?: string;
  lastUpdated?: string;
  wordCount?: number;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  content?: string[];
}

interface Opportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  content?: string[];
  estimatedLift?: string;
}

// Content Grade component (Clearscope-style)
function ContentGrade({ score }: { score: number }) {
  let grade: string;
  let color: string;
  let bg: string;
  
  if (score >= 90) { grade = "A+"; color = "#059669"; bg = "#10b98130"; }
  else if (score >= 80) { grade = "A"; color = "#10b981"; bg = "#10b98120"; }
  else if (score >= 70) { grade = "B"; color = "#22c55e"; bg = "#22c55e20"; }
  else if (score >= 60) { grade = "C"; color = "#f59e0b"; bg = "#f59e0b20"; }
  else if (score >= 50) { grade = "D"; color = "#f97316"; bg = "#f9731620"; }
  else { grade = "F"; color = "#ef4444"; bg = "#ef444420"; }
  
  return (
    <div 
      className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg"
      style={{ background: bg, color }}
    >
      {grade}
    </div>
  );
}

// Trend indicator component
function TrendBadge({ trend, change }: { trend: 'growing' | 'stable' | 'decaying'; change?: number }) {
  const config = {
    growing: { icon: TrendingUp, color: "#10b981", bg: "#10b98120", label: "Growing" },
    stable: { icon: Activity, color: "#3b82f6", bg: "#3b82f620", label: "Stable" },
    decaying: { icon: TrendingDown, color: "#ef4444", bg: "#ef444420", label: "Decaying" },
  };
  
  const { icon: Icon, color, bg, label } = config[trend];
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" style={{ background: bg, color }}>
      <Icon className="w-3 h-3" />
      {label}
      {change !== undefined && ` ${change > 0 ? '+' : ''}${change}%`}
    </span>
  );
}

// Content health visualization
function ContentHealthRing({ growing, stable, decaying }: { growing: number; stable: number; decaying: number }) {
  const total = growing + stable + decaying;
  if (total === 0) return null;
  
  const growingPct = (growing / total) * 100;
  const stablePct = (stable / total) * 100;
  const decayingPct = (decaying / total) * 100;
  
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90">
          {/* Decaying */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#ef4444"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${(decayingPct / 100) * 251.2} 251.2`}
          />
          {/* Stable */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#3b82f6"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${(stablePct / 100) * 251.2} 251.2`}
            strokeDashoffset={`${-((decayingPct / 100) * 251.2)}`}
          />
          {/* Growing */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#10b981"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${(growingPct / 100) * 251.2} 251.2`}
            strokeDashoffset={`${-((decayingPct + stablePct) / 100 * 251.2)}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{total}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm" style={{ color: "var(--foreground)" }}>{growing} Growing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm" style={{ color: "var(--foreground)" }}>{stable} Stable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm" style={{ color: "var(--foreground)" }}>{decaying} Decaying</span>
        </div>
      </div>
    </div>
  );
}

export default function ContentExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<ContentMetrics | null>(null);
  const [topContent, setTopContent] = useState<ContentItem[]>([]);
  const [underperformingContent, setUnderperformingContent] = useState<ContentItem[]>([]);
  const [decayingContent, setDecayingContent] = useState<ContentItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/marketing/content/metrics?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (data.hasData) {
        setMetrics(data.metrics);
        setTopContent(data.topContent || []);
        setUnderperformingContent(data.underperformingContent || []);
        setDecayingContent(data.decayingContent || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setLastUpdated(data.calculatedAt ? new Date(data.calculatedAt) : null);
      }
    } catch (err) {
      console.error("Error fetching content metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setCalculating(true);
      const response = await fetch("/api/marketing/content/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setTopContent(data.topContent || []);
        setUnderperformingContent(data.underperformingContent || []);
        setDecayingContent(data.decayingContent || []);
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
      <AppLayout title="Content Expert" subtitle="AI-powered content optimization analysis">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Content Expert" subtitle="AI-powered content optimization analysis">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Primary Action - Refresh Metrics Button */}
        <div 
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <p className="font-semibold">Refresh Content Metrics</p>
              <p className="text-sm opacity-80">
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleString()}` 
                  : "Click to analyze your content performance"}
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
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                    {formatNumber(metrics.totalContentViews)} views
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalArticles)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Articles</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  {formatNumber(metrics.avgTrafficPerArticle)} avg views/article
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#8b5cf620" }}>
                    <Search className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#8b5cf620", color: "#8b5cf6" }}>
                    {metrics.avgKeywordsPerArticle.toFixed(1)}/article
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalRankingKeywords)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Ranking Keywords</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Across all content
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#10b98120" }}>
                    <Link2 className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#10b98120", color: "#10b981" }}>
                    {metrics.avgBacklinksPerArticle.toFixed(1)}/article
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalBacklinks)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Backlinks</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Content attracting links
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#f59e0b20" }}>
                    <Award className="w-5 h-5 text-yellow-500" />
                  </div>
                  <span 
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      background: metrics.avgContentScore >= 70 ? "#10b98120" : metrics.avgContentScore >= 50 ? "#f59e0b20" : "#ef444420",
                      color: metrics.avgContentScore >= 70 ? "#10b981" : metrics.avgContentScore >= 50 ? "#f59e0b" : "#ef4444"
                    }}
                  >
                    {metrics.avgContentScore >= 70 ? "Good" : metrics.avgContentScore >= 50 ? "Fair" : "Needs Work"}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {Math.round(metrics.avgContentScore)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Content Score</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Target: 75+
                </p>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Content Health Overview */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Zap className="w-5 h-5" />
              Content Health Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                  Content Lifecycle Status
                </p>
                <ContentHealthRing 
                  growing={metrics.contentGrowing} 
                  stable={metrics.contentStable} 
                  decaying={metrics.contentWithDecay} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg text-center" style={{ background: "var(--background-secondary)" }}>
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.topPerformingCount}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Top Performers</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ background: "var(--background-secondary)" }}>
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.underperformingCount}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Need Attention</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ background: "var(--background-secondary)" }}>
                  <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                  <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{formatTime(metrics.avgTimeOnPage)}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Avg Read Time</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ background: "var(--background-secondary)" }}>
                  <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: metrics.avgBounceRate <= 55 ? "#10b981" : "#f59e0b" }} />
                  <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{formatPercent(metrics.avgBounceRate)}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</p>
                </div>
              </div>
            </div>
            
            {/* Content decay warning */}
            {metrics.contentWithDecay > 0 && (
              <div className="mt-6 p-3 rounded-lg flex items-start gap-3" style={{ background: "#f59e0b10", border: "1px solid #f59e0b40" }}>
                <TrendingDown className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {metrics.contentWithDecay} piece{metrics.contentWithDecay !== 1 ? 's' : ''} of content showing traffic decay
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                    Content decay is normal after 12-18 months. Consider updating these pieces with fresh data and insights.
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Alerts & Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {alerts.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Content Alerts ({alerts.length})</h2>
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
                      <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{alert.category}</p>
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
                        style={{ background: opp.impact === 'high' ? '#10b98120' : '#f59e0b20', color: opp.impact === 'high' ? '#10b981' : '#f59e0b' }}
                      >
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

        {/* Top Performing Content */}
        {topContent.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Award className="w-5 h-5 text-green-500" />
                Top Performing Content
              </h3>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#10b98120", color: "#10b981" }}>
                {topContent.length} articles
              </span>
            </div>
            <div className="space-y-3">
              {topContent.slice(0, 5).map((content, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg flex items-start gap-4"
                  style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
                >
                  <ContentGrade score={content.contentScore} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>
                          {content.title || content.path}
                        </h4>
                        <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>{content.path}</p>
                      </div>
                      <TrendBadge trend={content.trend} change={content.trafficChange} />
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        <Users className="w-3 h-3 inline mr-1" />
                        {formatNumber(content.pageviews)} views
                      </span>
                      <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatTime(content.avgTimeOnPage)}
                      </span>
                      {content.rankingKeywords !== undefined && (
                        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          <Search className="w-3 h-3 inline mr-1" />
                          {content.rankingKeywords} keywords
                        </span>
                      )}
                      {content.backlinks !== undefined && (
                        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          <Link2 className="w-3 h-3 inline mr-1" />
                          {content.backlinks} links
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Decaying Content */}
        {decayingContent.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <TrendingDown className="w-5 h-5 text-red-500" />
                Content Decay Detected
              </h3>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#ef444420", color: "#ef4444" }}>
                {decayingContent.length} articles
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
              These articles are losing traffic. Update them with fresh information to reverse the trend.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Article</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Grade</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Current Views</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Change</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {decayingContent.slice(0, 5).map((content, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3">
                        <p className="text-sm truncate max-w-xs" style={{ color: "var(--foreground)" }}>{content.title || content.path}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold"
                          style={{ 
                            background: content.contentScore >= 70 ? "#10b98120" : content.contentScore >= 50 ? "#f59e0b20" : "#ef444420",
                            color: content.contentScore >= 70 ? "#10b981" : content.contentScore >= 50 ? "#f59e0b" : "#ef4444"
                          }}
                        >
                          {content.contentScore >= 70 ? "B+" : content.contentScore >= 50 ? "C" : "D"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                        {formatNumber(content.pageviews)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#ef4444" }}>
                        {content.trafficChange !== undefined ? `${content.trafficChange}%` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded text-xs" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                          Update content
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Content Benchmarks */}
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>2025 Content Marketing Benchmarks</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Content Score</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>A Grade</span><span>80+</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>B Grade</span><span>70-79</span></div>
                <div className="flex justify-between"><span style={{ color: "#f59e0b" }}>C Grade</span><span>60-69</span></div>
                <div className="flex justify-between"><span style={{ color: "#ef4444" }}>F Grade</span><span>&lt;50</span></div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Traffic/Article</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>Excellent</span><span>1000+</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>Good</span><span>500+</span></div>
                <div className="flex justify-between"><span style={{ color: "#f59e0b" }}>Fair</span><span>150+</span></div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Keywords/Article</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: "#10b981" }}>Excellent</span><span>50+</span></div>
                <div className="flex justify-between"><span style={{ color: "#22c55e" }}>Good</span><span>25+</span></div>
                <div className="flex justify-between"><span style={{ color: "#f59e0b" }}>Fair</span><span>10+</span></div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Content Refresh</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />Every 6-12 months</div>
                <div className="flex items-center gap-1"><TrendingDown className="w-3 h-3" />When traffic drops 20%+</div>
                <div className="flex items-center gap-1"><Clock className="w-3 h-3" />After major updates</div>
              </div>
            </div>
          </div>
        </Card>

        {/* No Data State */}
        {!metrics && !loading && (
          <Card>
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Content Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect Google Analytics and DataForSEO to analyze your content performance.
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
