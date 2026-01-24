"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Megaphone,
  DollarSign,
  MousePointerClick,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  Target,
  Activity,
  BarChart3,
  AlertCircle,
} from "lucide-react";

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

export default function AdsExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<AdsMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [dataLimitations, setDataLimitations] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentOrg?.id) return;

    try {
      setCalculating(true);
      const response = await fetch("/api/marketing/ads/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      });
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setCampaigns(data.campaignBreakdown || []);
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#f59e0b20" }}>
              <Megaphone className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Ads Expert</h1>
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
                {dataLimitations.slice(0, 2).map((lim, i) => (
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
                label="Paid Sessions"
                value={formatNumber(metrics.totalPaidSessions)}
                change={`${formatPercent(metrics.paidTrafficShare)} of total`}
                changeType="neutral"
                icon={<MousePointerClick className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatCard
                label="Conversions"
                value={formatNumber(metrics.totalConversions)}
                change={`${formatPercent(metrics.conversionRate)} rate`}
                changeType={metrics.conversionRate >= 2 ? "positive" : "neutral"}
                icon={<Target className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard
                label="Revenue"
                value={formatCurrency(metrics.totalRevenue)}
                change="From paid traffic"
                changeType="positive"
                icon={<DollarSign className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <StatCard
                label="Traffic Quality"
                value={`${Math.round(metrics.trafficQualityScore)}%`}
                change={metrics.trafficQualityScore >= 60 ? "Good" : "Needs Work"}
                changeType={metrics.trafficQualityScore >= 60 ? "positive" : "negative"}
                icon={<Activity className="w-5 h-5" />}
              />
            </motion.div>
          </div>
        )}

        {/* Alerts & Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alerts */}
          {alerts.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Alerts</h2>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg flex items-start gap-2"
                    style={{
                      background: alert.type === 'critical' ? '#ef444410' : alert.type === 'warning' ? '#f59e0b10' : '#3b82f610',
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      alert.type === 'critical' ? 'bg-red-500' : alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <p className="text-sm" style={{ color: "var(--foreground)" }}>{alert.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Opportunities */}
          {opportunities.length > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Opportunities</h2>
              </div>
              <div className="space-y-3">
                {opportunities.map((opp, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          background: opp.impact === 'high' ? '#10b98120' : '#f59e0b20',
                          color: opp.impact === 'high' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {opp.impact}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Campaign Breakdown */}
        {campaigns.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <BarChart3 className="w-4 h-4" />
              Campaign Performance
            </h3>
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
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 10).map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 text-sm max-w-xs truncate" style={{ color: "var(--foreground)" }}>{c.campaign}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatNumber(c.sessions)}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#10b981" }}>{c.conversions}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: c.conversionRate >= 2 ? "#10b981" : "var(--foreground-muted)" }}>
                        {formatPercent(c.conversionRate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground)" }}>{formatCurrency(c.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: c.bounceRate > 60 ? "#ef4444" : "var(--foreground-muted)" }}>
                        {formatPercent(c.bounceRate)}
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
