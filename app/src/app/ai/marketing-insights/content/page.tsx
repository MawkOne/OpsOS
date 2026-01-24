"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  FileText,
  Clock,
  Search,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface ContentMetrics {
  totalArticles: number;
  totalPageviews: number;
  totalOrganicSessions: number;
  avgTimeOnPage: number;
  avgBounceRate: number;
  avgEngagementRate: number;
  totalKeywordsRanking: number;
  avgKeywordsPerArticle: number;
  totalBacklinks: number;
  avgBacklinksPerArticle: number;
  topPerformingArticles: number;
  underperformingArticles: number;
  decayingArticles: number;
  overallHealthScore: number;
  engagementScore: number;
  seoScore: number;
}

interface ContentItem {
  title: string;
  path: string;
  pageviews: number;
  avgTimeOnPage?: number;
  bounceRate?: number;
  keywords?: number;
  backlinks?: number;
  issue?: string;
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
  estimatedLift?: string;
}

export default function ContentExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<ContentMetrics | null>(null);
  const [topContent, setTopContent] = useState<ContentItem[]>([]);
  const [underperformingContent, setUnderperformingContent] = useState<ContentItem[]>([]);
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
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  if (loading) {
    return (
      <AppLayout title="Content Expert" subtitle="AI-powered content performance analysis">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Content Expert" subtitle="AI-powered content performance analysis">
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
                  : "Click to analyze content from GA4 and DataForSEO"}
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

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <StatCard
                label="Total Articles"
                value={formatNumber(metrics.totalArticles)}
                change={`${formatNumber(metrics.totalPageviews)} views`}
                changeType="neutral"
                icon={<FileText className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatCard
                label="Avg Time on Page"
                value={formatTime(metrics.avgTimeOnPage)}
                change={metrics.avgTimeOnPage >= 120 ? "Good" : "Below avg"}
                changeType={metrics.avgTimeOnPage >= 120 ? "positive" : "negative"}
                icon={<Clock className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard
                label="Keywords Ranking"
                value={formatNumber(metrics.totalKeywordsRanking)}
                change={`${metrics.avgKeywordsPerArticle.toFixed(1)} per article`}
                changeType="neutral"
                icon={<Search className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <StatCard
                label="Health Score"
                value={`${Math.round(metrics.overallHealthScore)}%`}
                change={metrics.overallHealthScore >= 60 ? "Healthy" : "Needs Work"}
                changeType={metrics.overallHealthScore >= 60 ? "positive" : "negative"}
                icon={<Activity className="w-5 h-5" />}
              />
            </motion.div>
          </div>
        )}

        {/* Score Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1" style={{ color: metrics.engagementScore >= 50 ? "#10b981" : "#f59e0b" }}>
                  {Math.round(metrics.engagementScore)}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Engagement Score</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Time on page, bounce rate</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1" style={{ color: metrics.seoScore >= 50 ? "#10b981" : "#f59e0b" }}>
                  {Math.round(metrics.seoScore)}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>SEO Score</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Keywords, backlinks</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1" style={{ color: metrics.totalBacklinks > 0 ? "#10b981" : "#f59e0b" }}>
                  {formatNumber(metrics.totalBacklinks)}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Backlinks</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{metrics.avgBacklinksPerArticle.toFixed(1)} per article</p>
              </div>
            </Card>
          </div>
        )}

        {/* Alerts & Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {alerts.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Alerts</h2>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, i) => (
                  <div key={i} className="p-3 rounded-lg flex items-start gap-2" style={{ background: '#f59e0b10' }}>
                    <div className="w-2 h-2 rounded-full mt-2 bg-yellow-500" />
                    <p className="text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {opportunities.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Opportunities</h2>
              </div>
              <div className="space-y-3">
                {opportunities.map((opp, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
                    <div className="flex justify-between">
                      <h3 className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#10b98120', color: '#10b981' }}>{opp.impact}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                    {opp.estimatedLift && (
                      <p className="text-xs mt-1 font-medium" style={{ color: "#10b981" }}>{opp.estimatedLift}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Top & Underperforming Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topContent.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>Top Performing Content</h3>
              </div>
              <div className="space-y-3">
                {topContent.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--background-secondary)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{item.title}</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {formatNumber(item.pageviews)} views • {item.keywords || 0} keywords
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{item.backlinks || 0}</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>backlinks</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {underperformingContent.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>Content Needing Attention</h3>
              </div>
              <div className="space-y-3">
                {underperformingContent.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--background-secondary)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{item.title}</p>
                      <p className="text-xs text-red-400">{item.issue}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{formatNumber(item.pageviews)}</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>views</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* No Data State */}
        {!metrics && !loading && (
          <Card>
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Content Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect Google Analytics and sync your blog/content pages to see metrics.
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
