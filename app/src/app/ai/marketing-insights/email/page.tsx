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
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Target,
  Lightbulb,
  BarChart3,
  Send,
  Eye,
  UserPlus,
  Activity,
} from "lucide-react";

interface EmailMetrics {
  totalCampaigns: number;
  totalContacts: number;
  activeContacts: number;
  totalLists: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgDeliveryRate: number;
  avgBounceRate: number;
  listGrowthRate: number;
  unsubscribeRate: number;
  totalAutomations: number;
  activeAutomations: number;
  avgAutomationCompletionRate: number;
  overallHealthScore: number;
  engagementScore: number;
  deliverabilityScore: number;
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

export default function EmailExpertPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<any[]>([]);
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
        setMetrics(data.metrics);
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
        setMetrics(data.metrics);
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
  }, [currentOrg?.id]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(Math.round(num));
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#ec489920" }}>
              <Mail className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Email Expert</h1>
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
                Run Analysis
              </>
            )}
          </button>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <StatCard
                label="Open Rate"
                value={formatPercent(metrics.avgOpenRate)}
                change={metrics.avgOpenRate >= 20 ? "Good" : "Below avg"}
                changeType={metrics.avgOpenRate >= 20 ? "positive" : "negative"}
                icon={<Eye className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatCard
                label="Click Rate"
                value={formatPercent(metrics.avgClickRate)}
                change={metrics.avgClickRate >= 2.5 ? "Good" : "Below avg"}
                changeType={metrics.avgClickRate >= 2.5 ? "positive" : "negative"}
                icon={<MousePointerClick className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard
                label="Active Contacts"
                value={formatNumber(metrics.activeContacts)}
                change={`${formatNumber(metrics.totalContacts)} total`}
                changeType="neutral"
                icon={<Users className="w-5 h-5" />}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <StatCard
                label="Health Score"
                value={`${Math.round(metrics.overallHealthScore)}%`}
                change={metrics.overallHealthScore >= 70 ? "Healthy" : "Needs Work"}
                changeType={metrics.overallHealthScore >= 70 ? "positive" : "negative"}
                icon={<Activity className="w-5 h-5" />}
              />
            </motion.div>
          </div>
        )}

        {/* Score Breakdown */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" style={{ color: metrics.engagementScore >= 70 ? "#10b981" : metrics.engagementScore >= 50 ? "#f59e0b" : "#ef4444" }}>
                  {Math.round(metrics.engagementScore)}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Engagement Score</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Opens, clicks, responses</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" style={{ color: metrics.deliverabilityScore >= 70 ? "#10b981" : metrics.deliverabilityScore >= 50 ? "#f59e0b" : "#ef4444" }}>
                  {Math.round(metrics.deliverabilityScore)}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Deliverability Score</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Delivery rate, bounces</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" style={{ color: metrics.listGrowthRate >= 2 ? "#10b981" : metrics.listGrowthRate >= 0 ? "#f59e0b" : "#ef4444" }}>
                  {metrics.listGrowthRate > 0 ? '+' : ''}{metrics.listGrowthRate.toFixed(1)}%
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>List Growth Rate</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Net subscribers/month</p>
              </div>
            </Card>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Alerts</h2>
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
                      {alert.category}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Lightbulb className="w-5 h-5 text-green-500" />
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
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
                  {opp.estimatedLift && (
                    <p className="text-sm mt-2 font-medium" style={{ color: "#10b981" }}>
                      {opp.estimatedLift}
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
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Send className="w-4 h-4" />
                Campaign Performance
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Campaigns</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{formatNumber(metrics.totalCampaigns)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Delivery Rate</span>
                  <span className="font-semibold" style={{ color: metrics.avgDeliveryRate >= 95 ? "#10b981" : "#f59e0b" }}>
                    {formatPercent(metrics.avgDeliveryRate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Bounce Rate</span>
                  <span className="font-semibold" style={{ color: metrics.avgBounceRate <= 2 ? "#10b981" : "#ef4444" }}>
                    {formatPercent(metrics.avgBounceRate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Unsubscribe Rate</span>
                  <span className="font-semibold" style={{ color: metrics.unsubscribeRate <= 0.5 ? "#10b981" : "#f59e0b" }}>
                    {formatPercent(metrics.unsubscribeRate)}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Activity className="w-4 h-4" />
                Automations
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Automations</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{metrics.totalAutomations}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Automations</span>
                  <span className="font-semibold text-green-500">{metrics.activeAutomations}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Completion Rate</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    {formatPercent(metrics.avgAutomationCompletionRate)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Lists</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{metrics.totalLists}</span>
                </div>
              </div>
            </Card>
          </div>
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
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Recipients</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.slice(0, 5).map((campaign, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground)" }}>{campaign.name}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#10b981" }}>{formatPercent(campaign.openRate)}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#3b82f6" }}>{formatPercent(campaign.clickRate)}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>{formatNumber(campaign.recipients)}</td>
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
