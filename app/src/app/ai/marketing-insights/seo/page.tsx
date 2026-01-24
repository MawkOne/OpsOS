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
  Globe,
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
  Minus,
} from "lucide-react";

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
  }, [currentOrg?.id]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(Math.round(num));
  };

  const getHealthColor = (score: number) => {
    if (score >= 70) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend < -5) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
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
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#3b82f620" }}>
              <Search className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>SEO Expert</h1>
              {lastUpdated && (
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Last updated: {lastUpdated.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={calculating}
            className="px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-all disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            {calculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Run Full Analysis
              </>
            )}
          </button>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <StatCard
                label="Keywords Tracked"
                value={formatNumber(metrics.totalKeywords)}
                change={`${metrics.top10Keywords} in Top 10`}
                changeType="neutral"
                icon={<Search className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatCard
                label="Organic Traffic Est."
                value={formatNumber(metrics.organicTrafficEstimate)}
                change={`${metrics.trafficTrend > 0 ? '+' : ''}${metrics.trafficTrend.toFixed(1)}%`}
                changeType={metrics.trafficTrend > 0 ? "positive" : metrics.trafficTrend < 0 ? "negative" : "neutral"}
                icon={<TrendingUp className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard
                label="Referring Domains"
                value={formatNumber(metrics.referringDomains)}
                change={`${formatNumber(metrics.totalBacklinks)} backlinks`}
                changeType="neutral"
                icon={<Link2 className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <StatCard
                label="Health Score"
                value={`${Math.round(metrics.overallHealthScore)}%`}
                change={metrics.overallHealthScore >= 70 ? "Good" : metrics.overallHealthScore >= 50 ? "Fair" : "Needs Work"}
                changeType={metrics.overallHealthScore >= 70 ? "positive" : metrics.overallHealthScore >= 50 ? "neutral" : "negative"}
                icon={<Activity className="w-5 h-5" />}
              />
            </motion.div>
          </div>
        )}

        {/* Analysis Summary */}
        {analysis?.summary && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620" }}>
                <Lightbulb className="w-5 h-5 text-purple-500" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>AI Analysis Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key Insights */}
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

              {/* Recommended Actions */}
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

            {/* Risks & Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              {/* Opportunities */}
              {analysis.summary.topOpportunities.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                    Opportunities
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

              {/* Risks */}
              {analysis.summary.topRisks.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                    Risks
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

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#ef444420" }}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Alerts</h2>
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: "#ef444420", color: "#ef4444" }}>
                {alerts.length}
              </span>
            </div>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg flex items-start gap-3"
                  style={{
                    background: alert.type === 'critical' ? '#ef444410' : 
                               alert.type === 'warning' ? '#f59e0b10' : '#3b82f610',
                    border: `1px solid ${alert.type === 'critical' ? '#ef444440' : 
                            alert.type === 'warning' ? '#f59e0b40' : '#3b82f640'}`,
                  }}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    alert.type === 'critical' ? 'bg-red-500' : 
                    alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                      Category: {alert.category}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Opportunities Section */}
        {opportunities.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#10b98120" }}>
                <Lightbulb className="w-5 h-5 text-green-500" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Opportunities</h2>
            </div>
            <div className="space-y-4">
              {opportunities.map((opp, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg"
                  style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: opp.impact === 'high' ? '#10b98120' : opp.impact === 'medium' ? '#f59e0b20' : '#3b82f620',
                        color: opp.impact === 'high' ? '#10b981' : opp.impact === 'medium' ? '#f59e0b' : '#3b82f6',
                      }}
                    >
                      {opp.impact.toUpperCase()} IMPACT
                    </span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                  {opp.keywords && opp.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {opp.keywords.slice(0, 5).map((kw, ki) => (
                        <span
                          key={ki}
                          className="px-2 py-1 rounded text-xs"
                          style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  {opp.estimatedTrafficGain && (
                    <p className="text-sm mt-2 font-medium" style={{ color: "#10b981" }}>
                      Est. traffic gain: +{formatNumber(opp.estimatedTrafficGain)}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Detailed Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keyword Distribution */}
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Search className="w-4 h-4" />
                Keyword Distribution
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Top 3 Positions</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{metrics.top3Keywords}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Top 10 Positions</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{metrics.top10Keywords}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Top 20 Positions</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{metrics.top20Keywords}</span>
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Average Position</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{metrics.avgPosition.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Search Volume</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{formatNumber(metrics.totalSearchVolume)}</span>
                </div>
              </div>
            </Card>

            {/* Page Health */}
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <FileText className="w-4 h-4" />
                Page Health
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Average Health Score</span>
                  <span className="font-semibold" style={{ color: getHealthColor(metrics.avgPageHealthScore) }}>
                    {metrics.avgPageHealthScore.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Pages with Issues</span>
                  <span className="font-semibold" style={{ color: metrics.pagesWithIssues > 0 ? "#f59e0b" : "var(--foreground)" }}>
                    {metrics.pagesWithIssues}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Critical Issues</span>
                  <span className="font-semibold" style={{ color: metrics.criticalIssues > 0 ? "#ef4444" : "var(--foreground)" }}>
                    {metrics.criticalIssues}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Keywords Improved</span>
                  <span className="font-semibold text-green-500">{metrics.keywordsImproved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Keywords Declined</span>
                  <span className="font-semibold text-red-500">{metrics.keywordsDeclined}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Impact Rankings */}
        {analysis?.impactRankings && analysis.impactRankings.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#f59e0b20" }}>
                <Target className="w-5 h-5 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Impact Rankings</h2>
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
                  {analysis.impactRankings.map((ranking, i) => (
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
