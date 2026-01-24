"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Users,
  TrendingUp,
  Target,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Activity,
  AlertCircle,
  BarChart3,
} from "lucide-react";

interface SocialMetrics {
  totalSocialSessions: number;
  totalSocialUsers: number;
  socialTrafficShare: number;
  avgBounceRate: number;
  avgSessionDuration: number;
  avgEngagementRate: number;
  pagesPerSession: number;
  totalConversions: number;
  conversionRate: number;
  platformCount: number;
  topPlatform: string;
  overallHealthScore: number;
  trafficQualityScore: number;
}

interface PlatformMetric {
  platform: string;
  sessions: number;
  users: number;
  conversions: number;
  conversionRate: number;
  bounceRate: number;
  percentOfSocial: number;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  platform?: string;
}

interface Opportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  platforms?: string[];
  estimatedLift?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877f2',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
  instagram: '#e4405f',
  youtube: '#ff0000',
  pinterest: '#bd081c',
  reddit: '#ff4500',
  tiktok: '#000000',
  other: '#6b7280',
};

export default function SocialExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<SocialMetrics | null>(null);
  const [platforms, setPlatforms] = useState<PlatformMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [dataLimitations, setDataLimitations] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/marketing/social/metrics?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (data.hasData) {
        setMetrics(data.metrics);
        setPlatforms(data.platformBreakdown || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setDataLimitations(data.dataLimitations || []);
        setLastUpdated(data.calculatedAt ? new Date(data.calculatedAt) : null);
      }
    } catch (err) {
      console.error("Error fetching social metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setCalculating(true);
      const response = await fetch("/api/marketing/social/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setPlatforms(data.platformBreakdown || []);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setDataLimitations(data.dataLimitations || []);
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

  if (loading) {
    return (
      <AppLayout title="Social Expert" subtitle="AI-powered social media analysis">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Social Expert" subtitle="AI-powered social media analysis">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#ec489920" }}>
              <Users className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Social Expert</h1>
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
            {calculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {calculating ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>

        {/* Data Limitations Warning */}
        {dataLimitations.length > 0 && (
          <div className="p-4 rounded-lg flex items-start gap-3" style={{ background: "#3b82f610", border: "1px solid #3b82f640" }}>
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Limited Data Available</p>
              <ul className="text-sm mt-1 space-y-1" style={{ color: "var(--foreground-muted)" }}>
                {dataLimitations.map((lim, i) => (
                  <li key={i}>• {lim}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <StatCard
                label="Social Sessions"
                value={formatNumber(metrics.totalSocialSessions)}
                change={`${formatPercent(metrics.socialTrafficShare)} of total`}
                changeType="neutral"
                icon={<Users className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatCard
                label="Conversions"
                value={formatNumber(metrics.totalConversions)}
                change={`${formatPercent(metrics.conversionRate)} rate`}
                changeType={metrics.conversionRate >= 1 ? "positive" : "neutral"}
                icon={<Target className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard
                label="Top Platform"
                value={metrics.topPlatform.charAt(0).toUpperCase() + metrics.topPlatform.slice(1)}
                change={`${metrics.platformCount} platforms`}
                changeType="neutral"
                icon={<TrendingUp className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <StatCard
                label="Traffic Quality"
                value={`${Math.round(metrics.trafficQualityScore)}%`}
                change={metrics.trafficQualityScore >= 50 ? "Good" : "Needs Work"}
                changeType={metrics.trafficQualityScore >= 50 ? "positive" : "negative"}
                icon={<Activity className="w-5 h-5" />}
              />
            </motion.div>
          </div>
        )}

        {/* Platform Breakdown */}
        {platforms.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-5 h-5" style={{ color: "var(--foreground)" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Platform Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Platform</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Sessions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>% of Social</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Conversions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Conv. Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other }} />
                          <span className="text-sm font-medium capitalize" style={{ color: "var(--foreground)" }}>{p.platform}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatNumber(p.sessions)}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatPercent(p.percentOfSocial)}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#10b981" }}>{p.conversions}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: p.conversionRate >= 1 ? "#10b981" : "var(--foreground-muted)" }}>
                        {formatPercent(p.conversionRate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: p.bounceRate > 60 ? "#ef4444" : "var(--foreground-muted)" }}>
                        {formatPercent(p.bounceRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
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
                    <div>
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                      {alert.platform && (
                        <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Platform: {alert.platform}</p>
                      )}
                    </div>
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
                    {opp.platforms && (
                      <div className="flex gap-2 mt-2">
                        {opp.platforms.map((p, pi) => (
                          <span key={pi} className="px-2 py-0.5 rounded text-xs capitalize" style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}>{p}</span>
                        ))}
                      </div>
                    )}
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
              <Users className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Social Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect Google Analytics to track social media traffic to your site.
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
