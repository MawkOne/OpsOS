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
  ExternalLink,
  Share2,
  Heart,
  MessageCircle,
} from "lucide-react";

// Social media benchmarks from Sprout Social/Hootsuite research
const BENCHMARKS = {
  engagementRate: { poor: 0.5, fair: 1, good: 3, excellent: 6 },
  conversionRate: { poor: 0.5, fair: 1, good: 2, excellent: 3 },
  bounceRate: { excellent: 35, good: 50, fair: 65, poor: 80 },
};

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

const PLATFORM_CONFIG: Record<string, { color: string; icon: string; bestTime: string }> = {
  facebook: { color: '#1877f2', icon: 'fb', bestTime: 'Tue-Thu 9am-1pm' },
  twitter: { color: '#1da1f2', icon: 'tw', bestTime: 'Wed 9am-3pm' },
  linkedin: { color: '#0a66c2', icon: 'li', bestTime: 'Tue-Wed 7-8am' },
  instagram: { color: '#e4405f', icon: 'ig', bestTime: 'Mon-Fri 11am-1pm' },
  youtube: { color: '#ff0000', icon: 'yt', bestTime: 'Thu-Fri 12-4pm' },
  pinterest: { color: '#bd081c', icon: 'pi', bestTime: 'Sat 8-11pm' },
  reddit: { color: '#ff4500', icon: 'rd', bestTime: 'Mon 6-8am' },
  tiktok: { color: '#000000', icon: 'tt', bestTime: 'Tue-Thu 7-9pm' },
  other: { color: '#6b7280', icon: '??', bestTime: 'Varies' },
};

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
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

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
        {/* Primary Action - Refresh Metrics Button */}
        <div 
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <p className="font-semibold">Refresh Social Metrics</p>
              <p className="text-sm opacity-80">
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleString()}` 
                  : "Click to analyze social traffic from GA4"}
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

        {/* Data Limitations - What we can vs can't measure */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg" style={{ background: "#3b82f620" }}>
              <AlertCircle className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Social Traffic Analysis (via GA4)
              </h3>
              <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>
                We're tracking traffic from social platforms to your website. For native engagement metrics 
                (likes, comments, followers), connect each platform's API directly.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg" style={{ background: "#10b98110", border: "1px solid #10b98140" }}>
                  <p className="text-xs font-medium text-green-600 mb-1">Available Metrics</p>
                  <ul className="text-xs space-y-1" style={{ color: "var(--foreground-muted)" }}>
                    <li className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Referral Traffic</li>
                    <li className="flex items-center gap-1"><Target className="w-3 h-3" /> Conversions</li>
                    <li className="flex items-center gap-1"><Activity className="w-3 h-3" /> Engagement Quality</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "#f59e0b10", border: "1px solid #f59e0b40" }}>
                  <p className="text-xs font-medium text-yellow-600 mb-1">Needs Platform APIs</p>
                  <ul className="text-xs space-y-1" style={{ color: "var(--foreground-muted)" }}>
                    <li className="flex items-center gap-1"><Heart className="w-3 h-3" /> Likes & Reactions</li>
                    <li className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Comments</li>
                    <li className="flex items-center gap-1"><Share2 className="w-3 h-3" /> Shares & Reach</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Key Insight</p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Social drives 10-15% of typical B2B traffic but influences 50-70% of purchase decisions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#ec489920" }}>
                    <Users className="w-5 h-5 text-pink-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                    {formatPercent(metrics.socialTrafficShare)} of total
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalSocialSessions)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Social Sessions</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  {formatNumber(metrics.totalSocialUsers)} unique visitors
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
                <p className="text-xs mt-2" style={{ color: metrics.conversionRate >= 1 ? "#10b981" : "var(--foreground-muted)" }}>
                  {formatPercent(metrics.conversionRate)} conversion rate
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: PLATFORM_CONFIG[metrics.topPlatform]?.color + '20' || '#6b728020' }}>
                    <TrendingUp className="w-5 h-5" style={{ color: PLATFORM_CONFIG[metrics.topPlatform]?.color || '#6b7280' }} />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--background-secondary)", color: "var(--foreground-muted)" }}>
                    {metrics.platformCount} platforms
                  </span>
                </div>
                <p className="text-2xl font-bold capitalize" style={{ color: "var(--foreground)" }}>
                  {metrics.topPlatform}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Top Platform</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Best time: {PLATFORM_CONFIG[metrics.topPlatform]?.bestTime || 'Varies'}
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
                      background: metrics.trafficQualityScore >= 50 ? "#10b98120" : "#f59e0b20",
                      color: metrics.trafficQualityScore >= 50 ? "#10b981" : "#f59e0b"
                    }}
                  >
                    {metrics.trafficQualityScore >= 50 ? "Good" : "Needs Work"}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {Math.round(metrics.trafficQualityScore)}%
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Traffic Quality</p>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
                  Based on engagement & conversions
                </p>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Platform Performance Visual */}
        {platforms.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <BarChart3 className="w-5 h-5" />
              Platform Performance Breakdown
            </h3>
            
            {/* Visual Bar Chart */}
            <div className="space-y-4 mb-6">
              {platforms.slice(0, 6).map((p, i) => {
                const config = PLATFORM_CONFIG[p.platform] || PLATFORM_CONFIG.other;
                const maxSessions = Math.max(...platforms.map(pl => pl.sessions));
                const barWidth = (p.sessions / maxSessions) * 100;
                
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: config.color }}
                      >
                        {config.icon.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize" style={{ color: "var(--foreground)" }}>
                            {p.platform}
                          </span>
                          <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                            {formatNumber(p.sessions)} sessions
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--background-secondary)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: config.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                          />
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs" style={{ color: p.conversionRate >= 1 ? "#10b981" : "var(--foreground-muted)" }}>
                            {formatPercent(p.conversionRate)} conv.
                          </span>
                          <span className="text-xs" style={{ color: p.bounceRate <= 50 ? "#10b981" : "var(--foreground-muted)" }}>
                            {formatPercent(p.bounceRate)} bounce
                          </span>
                          <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                            {formatPercent(p.percentOfSocial)} of social
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Platform Details Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Platform</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Sessions</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>% of Social</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Conversions</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Conv. Rate</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Bounce</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Best Time</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p, i) => {
                    const config = PLATFORM_CONFIG[p.platform] || PLATFORM_CONFIG.other;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: config.color }} />
                            <span className="text-sm font-medium capitalize" style={{ color: "var(--foreground)" }}>{p.platform}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatNumber(p.sessions)}</td>
                        <td className="px-4 py-2 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatPercent(p.percentOfSocial)}</td>
                        <td className="px-4 py-2 text-sm text-right" style={{ color: "#10b981" }}>{p.conversions}</td>
                        <td className="px-4 py-2 text-sm text-right" style={{ color: p.conversionRate >= 1 ? "#10b981" : "var(--foreground-muted)" }}>
                          {formatPercent(p.conversionRate)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right" style={{ color: p.bounceRate > 60 ? "#ef4444" : "var(--foreground-muted)" }}>
                          {formatPercent(p.bounceRate)}
                        </td>
                        <td className="px-4 py-2 text-xs text-center" style={{ color: "var(--foreground-muted)" }}>
                          {config.bestTime}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Traffic Quality Metrics */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Activity className="w-5 h-5" />
              Traffic Quality Indicators
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</span>
                  <PerformanceRating value={metrics.avgBounceRate} metric="bounceRate" inverse />
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.avgBounceRate <= 50 ? "#10b981" : metrics.avgBounceRate <= 65 ? "#f59e0b" : "#ef4444" }}>
                  {formatPercent(metrics.avgBounceRate)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: &lt;50%</p>
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
                <p className="text-2xl font-bold" style={{ color: metrics.pagesPerSession >= 1.5 ? "#10b981" : "#f59e0b" }}>
                  {metrics.pagesPerSession.toFixed(1)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 1.5+ pages</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Session</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.avgSessionDuration >= 45 ? "#10b981" : "#f59e0b" }}>
                  {formatTime(metrics.avgSessionDuration)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Target: 45s+</p>
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
                    style={{ background: '#f59e0b10', border: '1px solid #f59e0b40' }}
                  >
                    <div className="w-2 h-2 rounded-full mt-2 bg-yellow-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                      {alert.platform && (
                        <p className="text-xs mt-1 capitalize" style={{ color: "var(--foreground-muted)" }}>Platform: {alert.platform}</p>
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
                    <div className="flex justify-between mb-1">
                      <h3 className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#10b98120', color: '#10b981' }}>{opp.impact.toUpperCase()}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                    {opp.platforms && opp.platforms.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {opp.platforms.map((p, pi) => (
                          <span 
                            key={pi} 
                            className="px-2 py-0.5 rounded text-xs capitalize" 
                            style={{ background: PLATFORM_CONFIG[p]?.color + '20' || '#6b728020', color: PLATFORM_CONFIG[p]?.color || '#6b7280' }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {opp.estimatedLift && (
                      <p className="text-xs mt-2 font-medium" style={{ color: "#10b981" }}>{opp.estimatedLift}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Social Media Best Practices */}
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>2025 Social Media Benchmarks</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg" style={{ background: "#1877f220" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#1877f2" }}>Facebook</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>0.5-1% engagement</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Best: Tue-Thu 9am-1pm</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "#0a66c220" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#0a66c2" }}>LinkedIn</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>2-5% engagement (B2B)</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Best: Tue-Wed 7-8am</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "#e4405f20" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#e4405f" }}>Instagram</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>1-3% engagement</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Best: Mon-Fri 11am-1pm</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "#1da1f220" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#1da1f2" }}>Twitter/X</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>0.5-1% engagement</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Best: Wed 9am-3pm</p>
            </div>
          </div>
        </Card>

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
