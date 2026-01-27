"use client";

import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect, useState } from "react";
import { 
  Brain, Target,
  AlertTriangle, TrendingUp, Zap, Gauge, GitCompare,
  FileText, Search, Mail, DollarSign, Filter, Clock,
  Activity, Shield, Hash
} from "lucide-react";

export default function AIPage() {
  const { currentOrg } = useOrganization();
  const [stats, setStats] = useState({
    totalOpportunities: 0,
    detectorCount: 74, // Static - actual detector count (60 + 14 new detectors)
    monthlyRecords: 0,
    metricPoints: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchStats();
    }
  }, [currentOrg]);

  async function fetchStats() {
    try {
      const response = await fetch(`/api/opportunities?organizationId=${currentOrg?.id}&limit=1000`);
      const data = await response.json();
      
      setStats({
        totalOpportunities: data.opportunities?.length || 0,
        detectorCount: 74, // 60 + 14 new detectors (5 revenue, 5 page, 4 traffic)
        monthlyRecords: data.monthlyRecords || 0, // If available from API
        metricPoints: data.metricPoints || 0 // If available from API
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }

  const analysisTypes = [
    {
      name: "🎯 All Detectors",
      href: "/ai/detectors",
      icon: Target,
      description: "132 total detectors (55 active, 77 planned) across 7 marketing areas + system health"
    },
    {
      name: "📧 Email Marketing",
      href: "/ai/email",
      icon: Mail,
      description: "11 detectors monitoring campaigns, engagement, deliverability, and list health"
    },
    {
      name: "🔍 SEO",
      href: "/ai/seo",
      icon: Search,
      description: "8 detectors tracking rankings, keywords, and technical health"
    },
    {
      name: "💰 Advertising",
      href: "/ai/advertising",
      icon: Hash,
      description: "6 detectors analyzing campaigns, spend efficiency, and performance"
    },
    {
      name: "📄 Pages",
      href: "/ai/pages",
      icon: FileText,
      description: "5 detectors monitoring page performance and conversion optimization"
    },
    {
      name: "✍️ Content",
      href: "/ai/content",
      icon: FileText,
      description: "4 detectors tracking content publishing, freshness, and performance"
    },
    {
      name: "🚦 Traffic",
      href: "/ai/traffic",
      icon: Activity,
      description: "6 detectors monitoring traffic sources, quality, and channels"
    },
    {
      name: "💵 Revenue",
      href: "/ai/revenue",
      icon: DollarSign,
      description: "6 detectors tracking revenue anomalies, forecasts, and unit economics"
    },
    {
      name: "All Opportunities",
      href: "/ai/opportunities",
      icon: Target,
      description: "View all detected opportunities across all marketing areas"
    }
  ];

  return (
    <AppLayout title="Scout AI" subtitle="74 detectors across 7 marketing areas powered by multi-timeframe analysis">
      {/* Hero Section */}
      <Card className="glass mb-8">
        <div className="flex items-start justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg" style={{ background: "var(--accent-muted)" }}>
                <Brain className="w-8 h-8" style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>Scout AI Intelligence</h1>
            </div>
            <p className="text-lg mb-6" style={{ color: "var(--foreground-muted)" }}>
              Complete marketing intelligence system with 15 analysis types and monthly trend detection
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
                  {loading ? "..." : stats.totalOpportunities}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Opportunities</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>{stats.detectorCount}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>AI Detectors</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
                  {loading ? "..." : stats.monthlyRecords > 0 ? stats.monthlyRecords.toLocaleString() : "N/A"}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Monthly Records</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
                  {loading ? "..." : stats.metricPoints > 0 ? `${Math.round(stats.metricPoints / 1000)}k` : "N/A"}
                </p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Metric Points</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Scout AI - Featured */}
      <div className="mb-8">
        <Link href="/ai/opportunities">
          <Card className="glass border-2 transition-all cursor-pointer hover:glow-accent" style={{ borderColor: "var(--accent)" }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg" style={{ background: "var(--accent-muted)" }}>
                  <Target className="w-8 h-8" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    All Opportunities
                    <span className="ml-3 text-sm font-normal" style={{ color: "var(--accent)" }}>⭐ Start Here</span>
                  </h3>
                  <p className="mt-1" style={{ color: "var(--foreground-muted)" }}>
                    View all {loading ? "..." : stats.totalOpportunities} opportunities across 15 analysis types with monthly trends, acceleration detection, and cross-channel insights.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{
                  background: "var(--success)",
                  color: "var(--background)"
                }}>
                  Live
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)"
                }}>
                  {loading ? "..." : `${stats.totalOpportunities} Found`}
                </span>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* 15 Analysis Types Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>15 Analysis Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {analysisTypes.map((analysis) => {
            const Icon = analysis.icon;
            return (
              <Link key={analysis.href} href={analysis.href}>
                <Card className="glass border transition-all cursor-pointer hover:border-[var(--accent)]" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ background: "var(--accent-muted)" }}>
                      <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
                    </div>
                    <h3 className="font-bold" style={{ color: "var(--foreground)" }}>{analysis.name}</h3>
                  </div>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {analysis.description}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Stats */}
      <Card className="glass mt-12">
        <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>System Intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--accent)" }}>{stats.detectorCount}</div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>AI Detectors</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>16 original + 7 multi-timeframe</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--accent)" }}>
              {loading ? "..." : stats.totalOpportunities}
            </div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Opportunities</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Across 15 analysis types</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--success)" }}>100%</div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>Filtered</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Only real content analyzed</div>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
