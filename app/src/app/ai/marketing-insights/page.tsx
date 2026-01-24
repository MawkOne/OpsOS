"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Brain,
  Search,
  Mail,
  Megaphone,
  FileText,
  Users,
  Layers,
  ChevronRight,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";

interface ExpertTool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  href: string;
  status: 'ready' | 'limited' | 'no_data';
  metrics?: {
    healthScore?: number;
    primaryMetric?: string;
    primaryValue?: string;
    alertCount?: number;
    opportunityCount?: number;
  };
}

const EXPERT_TOOLS: ExpertTool[] = [
  {
    id: 'seo',
    name: 'SEO Expert',
    description: 'Keyword rankings, backlinks, page health, organic traffic',
    icon: <Search className="w-6 h-6" />,
    color: '#3b82f6',
    href: '/ai/marketing-insights/seo',
    status: 'ready',
  },
  {
    id: 'email',
    name: 'Email Expert',
    description: 'Open rates, click rates, deliverability, automations',
    icon: <Mail className="w-6 h-6" />,
    color: '#ec4899',
    href: '/ai/marketing-insights/email',
    status: 'ready',
  },
  {
    id: 'ads',
    name: 'Ads Expert',
    description: 'Campaign performance, conversions, traffic quality',
    icon: <Megaphone className="w-6 h-6" />,
    color: '#f59e0b',
    href: '/ai/marketing-insights/ads',
    status: 'limited',
  },
  {
    id: 'pages',
    name: 'Pages Expert',
    description: 'Conversion rates, engagement, bounce rates, UX',
    icon: <FileText className="w-6 h-6" />,
    color: '#06b6d4',
    href: '/ai/marketing-insights/pages',
    status: 'ready',
  },
  {
    id: 'content',
    name: 'Content Expert',
    description: 'Article performance, SEO overlap, content decay',
    icon: <Layers className="w-6 h-6" />,
    color: '#8b5cf6',
    href: '/ai/marketing-insights/content',
    status: 'ready',
  },
  {
    id: 'social',
    name: 'Social Expert',
    description: 'Platform traffic, conversions, engagement quality',
    icon: <Users className="w-6 h-6" />,
    color: '#ec4899',
    href: '/ai/marketing-insights/social',
    status: 'limited',
  },
];

export default function MarketingAIPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<ExpertTool[]>(EXPERT_TOOLS);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [totalOpportunities, setTotalOpportunities] = useState(0);

  const fetchAllMetrics = async () => {
    if (!currentOrg?.id) return;

    setLoading(true);
    const updatedTools = [...EXPERT_TOOLS];
    let alerts = 0;
    let opportunities = 0;

    // Fetch metrics for each tool in parallel
    await Promise.all(
      updatedTools.map(async (tool, index) => {
        try {
          const response = await fetch(
            `/api/marketing/${tool.id}/metrics?organizationId=${currentOrg.id}`
          );
          const data = await response.json();

          if (data.hasData && data.metrics) {
            const metrics = data.metrics;
            updatedTools[index] = {
              ...tool,
              status: 'ready',
              metrics: {
                healthScore: metrics.overallHealthScore || metrics.trafficQualityScore,
                alertCount: data.alerts?.length || 0,
                opportunityCount: data.opportunities?.length || 0,
              },
            };
            alerts += data.alerts?.length || 0;
            opportunities += data.opportunities?.length || 0;
          } else {
            updatedTools[index] = { ...tool, status: 'no_data' };
          }
        } catch {
          updatedTools[index] = { ...tool, status: 'no_data' };
        }
      })
    );

    setTools(updatedTools);
    setTotalAlerts(alerts);
    setTotalOpportunities(opportunities);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const getStatusBadge = (status: string, healthScore?: number) => {
    if (status === 'no_data') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          No Data
        </span>
      );
    }
    if (status === 'limited') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
          Limited
        </span>
      );
    }
    if (healthScore !== undefined) {
      const color = healthScore >= 70 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
      return (
        <span
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{ background: `${color}20`, color }}
        >
          {healthScore}% Health
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
        Ready
      </span>
    );
  };

  return (
    <AppLayout title="Marketing AI" subtitle="AI-powered marketing analysis and recommendations">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Brain className="w-10 h-10" />
                <h1 className="text-3xl font-bold">Marketing AI</h1>
              </div>
              <p className="text-purple-100 max-w-xl">
                Six specialized AI experts analyze your marketing data, detect patterns,
                find opportunities, and generate prioritized recommendations.
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div className="px-3 py-1.5 bg-white/20 rounded-lg">
                  <p className="text-sm text-purple-100">Powered by</p>
                  <p className="font-semibold">Advanced Analytics</p>
                </div>
                <div className="px-3 py-1.5 bg-white/20 rounded-lg">
                  <p className="text-sm text-purple-100">Data Sources</p>
                  <p className="font-semibold">GA4, DataForSEO, ActiveCampaign</p>
                </div>
              </div>
            </div>
            <Sparkles className="w-20 h-20 opacity-20" />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620" }}>
                <Brain className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>6</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Expert Tools</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#ef444420" }}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{totalAlerts}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Alerts</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#10b98120" }}>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{totalOpportunities}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Opportunities</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#3b82f620" }}>
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {tools.filter(t => t.status === 'ready' && t.metrics?.healthScore).length}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Channels Active</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Expert Tools Grid */}
        <div>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>Expert Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={tool.href}>
                  <Card className="h-full hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                        style={{ background: `${tool.color}20`, color: tool.color }}
                      >
                        {tool.icon}
                      </div>
                      {getStatusBadge(tool.status, tool.metrics?.healthScore)}
                    </div>
                    <h3 className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
                      {tool.name}
                    </h3>
                    <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                      {tool.description}
                    </p>
                    
                    {tool.metrics && (
                      <div className="flex items-center gap-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                        {tool.metrics.alertCount !== undefined && tool.metrics.alertCount > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                              {tool.metrics.alertCount} alerts
                            </span>
                          </div>
                        )}
                        {tool.metrics.opportunityCount !== undefined && tool.metrics.opportunityCount > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                              {tool.metrics.opportunityCount} opportunities
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-4 text-purple-500 font-medium text-sm group-hover:gap-2 transition-all">
                      <span>View Details</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <Card>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {[
              { step: 1, title: 'Data Access', desc: 'Historical metrics to granular events' },
              { step: 2, title: 'Pattern Detection', desc: 'Trends, seasonality, anomalies' },
              { step: 3, title: 'Statistical Analysis', desc: 'Causation, KPI importance' },
              { step: 4, title: 'Initiative Awareness', desc: 'Related plans & recommendations' },
              { step: 5, title: 'Forecasting', desc: 'Project impact on revenue' },
              { step: 6, title: 'Impact Ranking', desc: 'Prioritize by value' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
                  style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                >
                  <span className="font-bold">{item.step}</span>
                </div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                  {item.title}
                </h3>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Refresh All */}
        <div className="flex justify-center">
          <button
            onClick={fetchAllMetrics}
            disabled={loading}
            className="px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-all disabled:opacity-50"
            style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh All Metrics
              </>
            )}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
