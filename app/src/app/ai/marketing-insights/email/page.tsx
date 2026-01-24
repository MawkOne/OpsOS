"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Mail,
  MousePointerClick,
  Users,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Send,
  Eye,
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Industry benchmarks from Klaviyo/Mailchimp research
const BENCHMARKS = {
  openRate: { poor: 15, fair: 20, good: 25, excellent: 30 },
  clickRate: { poor: 1, fair: 2, good: 3, excellent: 5 },
  clickToOpenRate: { poor: 5, fair: 10, good: 15, excellent: 20 },
  bounceRate: { excellent: 0.5, good: 1, fair: 2, poor: 5 },
  unsubscribeRate: { excellent: 0.1, good: 0.3, fair: 0.5, poor: 1 },
  listGrowthRate: { poor: 2, fair: 5, good: 8, excellent: 10 },
};

interface EmailMetrics {
  totalCampaigns: number;
  totalContacts: number;
  activeContacts: number;
  totalLists: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate?: number;
  deliveryRate: number;
  bounceRate: number;
  listGrowthRate: number;
  unsubscribeRate: number;
  totalAutomations: number;
  activeAutomations: number;
  automationCompletionRate: number;
  overallHealthScore: number;
  engagementScore: number;
  deliverabilityScore: number;
  totalRevenue?: number;
  revenuePerRecipient?: number;
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

// Performance rating badge component (Klaviyo-style)
function PerformanceRating({ value, metric, inverse = false }: { value: number; metric: keyof typeof BENCHMARKS; inverse?: boolean }) {
  const benchmark = BENCHMARKS[metric];
  let rating: string;
  let color: string;
  
  if (inverse) {
    // Lower is better (bounce, unsubscribe)
    if (value <= benchmark.excellent) { rating = "Excellent"; color = "#10b981"; }
    else if (value <= benchmark.good) { rating = "Good"; color = "#22c55e"; }
    else if (value <= benchmark.fair) { rating = "Fair"; color = "#f59e0b"; }
    else { rating = "Poor"; color = "#ef4444"; }
  } else {
    // Higher is better
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

export default function EmailExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<Array<{ name: string; openRate: number; clickRate: number; recipients: number }>>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/marketing/email/metrics?organizationId=${currentOrg.id}`
      );
      const data = await response.json();

      if (data.hasData) {
        // Calculate CTOR if not provided
        const metricsData = data.metrics;
        if (!metricsData.clickToOpenRate && metricsData.openRate > 0) {
          metricsData.clickToOpenRate = (metricsData.clickRate / metricsData.openRate) * 100;
        }
        setMetrics(metricsData);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setTopCampaigns(data.topCampaigns || []);
        setLastUpdated(data.calculatedAt ? new Date(data.calculatedAt) : null);
      }
    } catch (err) {
      console.error("Error fetching email metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setCalculating(true);
      const response = await fetch("/api/marketing/email/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
      const data = await response.json();

      if (data.success) {
        const metricsData = data.metrics;
        if (!metricsData.clickToOpenRate && metricsData.openRate > 0) {
          metricsData.clickToOpenRate = (metricsData.clickRate / metricsData.openRate) * 100;
        }
        setMetrics(metricsData);
        setAlerts(data.alerts || []);
        setOpportunities(data.opportunities || []);
        setTopCampaigns(data.topCampaigns || []);
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
  const formatCurrency = (num: number) => `$${num.toFixed(2)}`;

  if (loading) {
    return (
      <AppLayout title="Email Expert" subtitle="AI-powered email marketing analysis">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Email Expert" subtitle="AI-powered email marketing analysis">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Primary Action - Refresh Metrics Button */}
        <div 
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6" />
            <div>
              <p className="font-semibold">Refresh Email Metrics</p>
              <p className="text-sm opacity-80">
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleString()}` 
                  : "Click to analyze your ActiveCampaign data"}
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

        {/* Key Engagement Metrics with Performance Ratings */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#3b82f620" }}>
                    <Eye className="w-5 h-5 text-blue-500" />
                  </div>
                  <PerformanceRating value={metrics.openRate} metric="openRate" />
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatPercent(metrics.openRate)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Open Rate</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  Benchmark: {BENCHMARKS.openRate.good}%+
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#8b5cf620" }}>
                    <MousePointerClick className="w-5 h-5 text-purple-500" />
                  </div>
                  <PerformanceRating value={metrics.clickRate} metric="clickRate" />
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatPercent(metrics.clickRate)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Click Rate (CTR)</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  Benchmark: {BENCHMARKS.clickRate.good}%+
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ background: "#10b98120" }}>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <PerformanceRating value={metrics.clickToOpenRate || 0} metric="clickToOpenRate" />
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatPercent(metrics.clickToOpenRate || 0)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Click-to-Open (CTOR)</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  Benchmark: {BENCHMARKS.clickToOpenRate.good}%+
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
                  {Math.round(metrics.overallHealthScore)}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Health Score</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  Engagement + Deliverability
                </p>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Score Breakdown + Revenue (if available) */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="text-center">
                <div 
                  className="text-4xl font-bold mb-2" 
                  style={{ color: metrics.engagementScore >= 70 ? "#10b981" : metrics.engagementScore >= 50 ? "#f59e0b" : "#ef4444" }}
                >
                  {Math.round(metrics.engagementScore)}
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Engagement</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Opens + Clicks</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div 
                  className="text-4xl font-bold mb-2" 
                  style={{ color: metrics.deliverabilityScore >= 70 ? "#10b981" : metrics.deliverabilityScore >= 50 ? "#f59e0b" : "#ef4444" }}
                >
                  {Math.round(metrics.deliverabilityScore)}
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Deliverability</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Delivery - Bounces</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-2">
                  {metrics.listGrowthRate >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-500" />
                  )}
                  <span 
                    className="text-4xl font-bold" 
                    style={{ color: metrics.listGrowthRate >= 2 ? "#10b981" : metrics.listGrowthRate >= 0 ? "#f59e0b" : "#ef4444" }}
                  >
                    {metrics.listGrowthRate > 0 ? '+' : ''}{metrics.listGrowthRate.toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>List Growth</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Monthly net change</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Users className="w-6 h-6" style={{ color: "var(--accent)" }} />
                  <span className="text-4xl font-bold" style={{ color: "var(--foreground)" }}>
                    {formatNumber(metrics.activeContacts)}
                  </span>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Active Contacts</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  of {formatNumber(metrics.totalContacts)} total
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Deliverability Metrics Row */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Send className="w-5 h-5" />
              Deliverability Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Delivery Rate</span>
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ 
                      background: metrics.deliveryRate >= 98 ? "#10b98120" : "#f59e0b20",
                      color: metrics.deliveryRate >= 98 ? "#10b981" : "#f59e0b"
                    }}
                  >
                    {metrics.deliveryRate >= 98 ? "Good" : "Needs Work"}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.deliveryRate >= 95 ? "#10b981" : "#f59e0b" }}>
                  {formatPercent(metrics.deliveryRate)}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</span>
                  <PerformanceRating value={metrics.bounceRate} metric="bounceRate" inverse />
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.bounceRate <= 2 ? "#10b981" : "#ef4444" }}>
                  {formatPercent(metrics.bounceRate)}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Unsubscribe Rate</span>
                  <PerformanceRating value={metrics.unsubscribeRate} metric="unsubscribeRate" inverse />
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.unsubscribeRate <= 0.5 ? "#10b981" : "#f59e0b" }}>
                  {formatPercent(metrics.unsubscribeRate)}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Campaigns</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalCampaigns)}
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
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Alerts ({alerts.length})
                </h2>
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
                        {alert.category.replace('_', ' ')}
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
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Opportunities ({opportunities.length})
                </h2>
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

        {/* Automations Section */}
        {metrics && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Activity className="w-5 h-5" />
              Automations
              {metrics.totalAutomations > 0 && metrics.activeAutomations < 3 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600">
                  Low automation usage
                </span>
              )}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.totalAutomations}</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Total Automations</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-2xl font-bold text-green-500">{metrics.activeAutomations}</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Active</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatPercent(metrics.automationCompletionRate)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Completion Rate</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.totalLists}</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Total Lists</p>
              </div>
            </div>
            {metrics.totalAutomations === 0 && (
              <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: "#3b82f610", border: "1px solid #3b82f640" }}>
                <Lightbulb className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    Flows generate 18x more revenue per recipient than campaigns
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                    Consider setting up welcome series, abandoned cart, and re-engagement automations.
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Top Campaigns */}
        {topCampaigns.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Top Performing Campaigns</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Campaign</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Open Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Click Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>CTOR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Recipients</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.slice(0, 5).map((campaign, i) => {
                    const ctor = campaign.openRate > 0 ? (campaign.clickRate / campaign.openRate) * 100 : 0;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground)" }}>{campaign.name}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span style={{ color: campaign.openRate >= 20 ? "#10b981" : "var(--foreground-muted)" }}>
                            {formatPercent(campaign.openRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span style={{ color: campaign.clickRate >= 2.5 ? "#10b981" : "var(--foreground-muted)" }}>
                            {formatPercent(campaign.clickRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span style={{ color: ctor >= 10 ? "#10b981" : "var(--foreground-muted)" }}>
                            {formatPercent(ctor)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                          {formatNumber(campaign.recipients)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* No Data State */}
        {!metrics && !loading && (
          <Card>
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Email Data Yet</h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect ActiveCampaign and sync your data to see email metrics.
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
