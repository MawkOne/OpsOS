"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { 
  Brain, Target, ChevronRight, Sparkles,
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
      color: "red",
      description: "Sudden changes (±20-40%) in revenue, traffic, or conversions"
    },
    {
      name: "Trend Analysis",
      href: "/ai/trend-analysis",
      icon: TrendingUp,
      color: "purple",
      description: "Multi-month patterns: 2-4+ consecutive months, acceleration/deceleration"
    },
    {
      name: "Performance Analysis",
      href: "/ai/performance-analysis",
      icon: Zap,
      color: "green",
      description: "Scale winners, fix losers, top/bottom performers"
    },
    {
      name: "Efficiency Analysis",
      href: "/ai/efficiency-analysis",
      icon: Gauge,
      color: "orange",
      description: "Cost inefficiency, waste, ROAS deterioration"
    },
    {
      name: "Cross-Channel Analysis",
      href: "/ai/cross-channel-analysis",
      icon: GitCompare,
      color: "blue",
      description: "Channel gaps, misalignment, synergy opportunities"
    },
    {
      name: "Content Analysis",
      href: "/ai/content-analysis",
      icon: FileText,
      color: "indigo",
      description: "Content decay, high traffic low CVR, engagement decay"
    },
    {
      name: "SEO Analysis",
      href: "/ai/seo-analysis",
      icon: Search,
      color: "teal",
      description: "Rank drops, striking distance, position trends"
    },
    {
      name: "Email Analysis",
      href: "/ai/email-analysis",
      icon: Mail,
      color: "pink",
      description: "Engagement trends, open/click patterns, deliverability"
    },
    {
      name: "Revenue Analysis",
      href: "/ai/revenue-analysis",
      icon: DollarSign,
      color: "emerald",
      description: "Revenue patterns, MRR trends, AOV optimization"
    },
    {
      name: "Funnel Analysis",
      href: "/ai/funnel-analysis",
      icon: Filter,
      color: "cyan",
      description: "Stage-to-stage conversion, drop-offs, channel efficiency"
    },
    {
      name: "Historical Analysis",
      href: "/ai/historical-analysis",
      icon: Clock,
      color: "amber",
      description: "All-time peaks, best/worst months, recovery potential"
    },
    {
      name: "Volatility Analysis",
      href: "/ai/volatility-analysis",
      icon: Activity,
      color: "rose",
      description: "Stability scoring, predictability, risk assessment"
    },
    {
      name: "Lookback Analysis",
      href: "/ai/lookback-analysis",
      icon: Activity,
      color: "violet",
      description: "Daily, 7d, 30d, 60d, 90d, monthly, all-time comparisons"
    },
    {
      name: "Confidence Scoring",
      href: "/ai/confidence-scoring",
      icon: Shield,
      color: "sky",
      description: "Reliability assessment, data volume, statistical significance"
    },
    {
      name: "Pattern Classification",
      href: "/ai/pattern-classification",
      icon: Hash,
      color: "fuchsia",
      description: "Categorizes 30+ pattern types across all channels"
    }
  ];

  return (
    <AppLayout title="AI" subtitle="15 intelligent analysis types powered by monthly trends">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-12 mb-8 text-white">
        <div className="flex items-start justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-12 h-12" />
              <h1 className="text-4xl font-bold">Scout AI Intelligence</h1>
            </div>
            <p className="text-xl text-purple-100 mb-6">
              Complete marketing intelligence system with 15 analysis types and monthly trend detection
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="px-4 py-3 bg-white/20 rounded-lg">
                <p className="text-3xl font-bold">104</p>
                <p className="text-sm text-purple-100">Opportunities</p>
              </div>
              <div className="px-4 py-3 bg-white/20 rounded-lg">
                <p className="text-3xl font-bold">23</p>
                <p className="text-sm text-purple-100">AI Detectors</p>
              </div>
              <div className="px-4 py-3 bg-white/20 rounded-lg">
                <p className="text-3xl font-bold">7,482</p>
                <p className="text-sm text-purple-100">Monthly Records</p>
              </div>
              <div className="px-4 py-3 bg-white/20 rounded-lg">
                <p className="text-3xl font-bold">265k</p>
                <p className="text-sm text-purple-100">Metric Points</p>
              </div>
            </div>
          </div>
          <Sparkles className="w-24 h-24 opacity-20" />
        </div>
      </div>

      {/* Scout AI - Featured */}
      <div className="mb-12">
        <Link href="/ai/opportunities">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-xl p-8 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-110 transition-transform"></div>
            <div className="flex items-start justify-between mb-4 relative">
              <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Target className="w-10 h-10 text-purple-600" />
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Live
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  104 Found
                </span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-2 relative">
              All Opportunities
              <span className="ml-3 text-lg font-normal text-purple-600">⭐ Start Here</span>
            </h3>
            <p className="text-gray-700 mb-4 relative font-medium text-lg">
              View all 104 opportunities across 15 analysis types with monthly trends, acceleration detection, and cross-channel insights.
            </p>
            <div className="flex items-center gap-2 text-purple-600 font-bold text-lg group-hover:gap-3 transition-all relative">
              <span>View All Opportunities</span>
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        </Link>
      </div>

      {/* 15 Analysis Types Grid */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">15 Analysis Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {analysisTypes.map((analysis) => {
            const Icon = analysis.icon;
            return (
              <Link key={analysis.href} href={analysis.href}>
                <div className={`bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-${analysis.color}-300 hover:shadow-lg transition-all cursor-pointer group`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 bg-${analysis.color}-100 rounded-lg group-hover:bg-${analysis.color}-200 transition-colors`}>
                      <Icon className={`w-6 h-6 text-${analysis.color}-600`} />
                    </div>
                    <h3 className="font-bold text-gray-900">{analysis.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {analysis.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Stats */}
      <div className="mt-12 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-8 border border-purple-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">System Intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">23</div>
            <div className="text-sm text-gray-600">AI Detectors</div>
            <div className="text-xs text-gray-500 mt-1">16 original + 7 multi-timeframe</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">7,482</div>
            <div className="text-sm text-gray-600">Monthly Records</div>
            <div className="text-xs text-gray-500 mt-1">4 tables × 5 months</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">265k</div>
            <div className="text-sm text-gray-600">Monthly Metrics</div>
            <div className="text-xs text-gray-500 mt-1">Complete trend intelligence</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">42%</div>
            <div className="text-sm text-gray-600">Spec Coverage</div>
            <div className="text-xs text-gray-500 mt-1">Was 16%, now 42%</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
