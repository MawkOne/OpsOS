"use client";

import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { 
  Brain, Target,
  AlertTriangle, TrendingUp, Zap, Gauge, GitCompare,
  FileText, Search, Mail, DollarSign, Filter, Clock,
  Activity, Shield, Hash
} from "lucide-react";

export default function AIPage() {
  const analysisTypes = [
    {
      name: "Anomaly Detection",
      href: "/ai/anomaly-detection",
      icon: AlertTriangle,
      description: "Sudden changes (±20-40%) in revenue, traffic, or conversions"
    },
    {
      name: "Trend Analysis",
      href: "/ai/trend-analysis",
      icon: TrendingUp,
      description: "Multi-month patterns: 2-4+ consecutive months, acceleration/deceleration"
    },
    {
      name: "Performance Analysis",
      href: "/ai/performance-analysis",
      icon: Zap,
      description: "Scale winners, fix losers, top/bottom performers"
    },
    {
      name: "Efficiency Analysis",
      href: "/ai/efficiency-analysis",
      icon: Gauge,
      description: "Cost inefficiency, waste, ROAS deterioration"
    },
    {
      name: "Cross-Channel Analysis",
      href: "/ai/cross-channel-analysis",
      icon: GitCompare,
      description: "Channel gaps, misalignment, synergy opportunities"
    },
    {
      name: "Content Analysis",
      href: "/ai/content-analysis",
      icon: FileText,
      description: "Content decay, high traffic low CVR, engagement decay"
    },
    {
      name: "SEO Analysis",
      href: "/ai/seo-analysis",
      icon: Search,
      description: "Rank drops, striking distance, position trends"
    },
    {
      name: "Email Analysis",
      href: "/ai/email-analysis",
      icon: Mail,
      description: "Engagement trends, open/click patterns, deliverability"
    },
    {
      name: "Revenue Analysis",
      href: "/ai/revenue-analysis",
      icon: DollarSign,
      description: "Revenue patterns, MRR trends, AOV optimization"
    },
    {
      name: "Funnel Analysis",
      href: "/ai/funnel-analysis",
      icon: Filter,
      description: "Stage-to-stage conversion, drop-offs, channel efficiency"
    },
    {
      name: "Historical Analysis",
      href: "/ai/historical-analysis",
      icon: Clock,
      description: "All-time peaks, best/worst months, recovery potential"
    },
    {
      name: "Volatility Analysis",
      href: "/ai/volatility-analysis",
      icon: Activity,
      description: "Stability scoring, predictability, risk assessment"
    },
    {
      name: "Lookback Analysis",
      href: "/ai/lookback-analysis",
      icon: Activity,
      description: "Daily, 7d, 30d, 60d, 90d, monthly, all-time comparisons"
    },
    {
      name: "Confidence Scoring",
      href: "/ai/confidence-scoring",
      icon: Shield,
      description: "Reliability assessment, data volume, statistical significance"
    },
    {
      name: "Pattern Classification",
      href: "/ai/pattern-classification",
      icon: Hash,
      description: "Categorizes 30+ pattern types across all channels"
    }
  ];

  return (
    <AppLayout title="Scout AI" subtitle="15 intelligent analysis types powered by monthly trends">
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
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>104</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Opportunities</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>23</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>AI Detectors</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>7,482</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Monthly Records</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>265k</p>
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
                    View all 104 opportunities across 15 analysis types with monthly trends, acceleration detection, and cross-channel insights.
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
                  104 Found
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--accent)" }}>23</div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>AI Detectors</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>16 original + 7 multi-timeframe</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--accent)" }}>7,482</div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>Monthly Records</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>4 tables × 5 months</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--accent)" }}>265k</div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>Monthly Metrics</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Complete trend intelligence</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
            <div className="text-4xl font-bold mb-2" style={{ color: "var(--success)" }}>42%</div>
            <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>Spec Coverage</div>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Was 16%, now 42%</div>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
