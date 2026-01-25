"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { Brain, Lightbulb, TrendingUp, ChevronRight, Sparkles } from "lucide-react";

export default function AIPage() {
  return (
    <AppLayout title="AI" subtitle="Intelligent insights and optimization">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-12 mb-8 text-white">
        <div className="flex items-start justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-12 h-12" />
              <h1 className="text-4xl font-bold">AI-Powered Insights</h1>
            </div>
            <p className="text-xl text-purple-100 mb-6">
              Unlock growth opportunities with intelligent analysis and automated recommendations
            </p>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-white/20 rounded-lg">
                <p className="text-sm text-purple-100">Powered by</p>
                <p className="font-semibold">Gemini 3 Flash Preview</p>
              </div>
              <div className="px-4 py-2 bg-white/20 rounded-lg">
                <p className="text-sm text-purple-100">Deployed on</p>
                <p className="font-semibold">Cloud Functions</p>
              </div>
            </div>
          </div>
          <Sparkles className="w-24 h-24 opacity-20" />
        </div>
      </div>

      {/* Available Tools */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scout AI - FEATURED */}
          <Link href="/ai/opportunities">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-xl p-8 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-start justify-between mb-4 relative">
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Target className="w-8 h-8 text-purple-600" />
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Live
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium animate-pulse">
                    30 Found
                  </span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 relative">
                Scout AI
                <span className="ml-2 text-sm font-normal text-purple-600">⭐ Featured</span>
              </h3>
              <p className="text-gray-700 mb-4 relative font-medium">
                Automatically detects marketing opportunities across all channels. 
                Scale winners, fix losers, and prevent revenue loss.
              </p>
              <div className="space-y-2 mb-6 relative">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span><strong>30 opportunities</strong> detected (153k metrics analyzed)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span>7 AI detectors running daily</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span>Evidence-based recommendations with action steps</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span>Impact scoring: Prioritize what matters</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-purple-600 font-bold group-hover:gap-3 transition-all relative">
                <span>View Opportunities</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>

          {/* Marketing Insights Card */}
          <Link href="/ai/marketing-insights">
            <div className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Lightbulb className="w-8 h-8 text-purple-600" />
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Live
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Marketing Insights
              </h3>
              <p className="text-gray-600 mb-4">
                AI-powered driver analysis that identifies optimization opportunities and generates
                prioritized recommendations for marketing performance.
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span>Feature importance analysis (R² ~0.83)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span>Gap analysis vs benchmarks</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                  <span>Channel-specific insights</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-purple-600 font-semibold group-hover:gap-3 transition-all">
                <span>View Insights</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* How Scout AI Works */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">How Scout AI Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">1</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Entity Mapping</h3>
            <p className="text-sm text-gray-600">
              Links 5,844 entities across platforms (pages, campaigns, keywords, products)
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">2</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Daily Metrics</h3>
            <p className="text-sm text-gray-600">
              Aggregates 153k+ daily metrics from GA4, Google Ads, DataForSEO, Stripe
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">3</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">AI Detection</h3>
            <p className="text-sm text-gray-600">
              7 specialized detectors find scale winners, fix losers, declining performers, gaps
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">4</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Action Items</h3>
            <p className="text-sm text-gray-600">
              Ranks by impact score (0-100) with evidence, hypothesis, and specific next steps
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-12 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-8 border border-purple-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">30</div>
            <div className="text-sm text-gray-600">Opportunities Detected</div>
            <div className="text-xs text-gray-500 mt-1">High: 20 | Medium: 10</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">153k</div>
            <div className="text-sm text-gray-600">Daily Metrics</div>
            <div className="text-xs text-gray-500 mt-1">90 days of history</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">5,844</div>
            <div className="text-sm text-gray-600">Entities Mapped</div>
            <div className="text-xs text-gray-500 mt-1">Cross-channel linking</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">7/7</div>
            <div className="text-sm text-gray-600">Detectors Active</div>
            <div className="text-xs text-gray-500 mt-1">Fully operational</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
