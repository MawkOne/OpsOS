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
                <p className="font-semibold">Google Gemini 3.0</p>
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
                  <span>Prioritized action items</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-purple-600 font-semibold group-hover:gap-3 transition-all">
                <span>View Insights</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>

          {/* Coming Soon - Anomaly Detection */}
          <div className="bg-white border-2 border-gray-200 rounded-xl p-8 opacity-60">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <TrendingUp className="w-8 h-8 text-gray-400" />
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                Coming Soon
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Anomaly Detection
            </h3>
            <p className="text-gray-600 mb-4">
              Real-time monitoring that automatically detects unusual patterns in your metrics
              and alerts you to potential issues or opportunities.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span>Statistical anomaly detection</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span>Real-time alerts</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span>Root cause analysis</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">1</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Data Collection</h3>
            <p className="text-sm text-gray-600">
              Pulls 90 days of marketing data from BigQuery (GA4, email, traffic sources)
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">2</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Driver Analysis</h3>
            <p className="text-sm text-gray-600">
              Random Forest model identifies which features drive your goal KPI
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">3</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Gap Analysis</h3>
            <p className="text-sm text-gray-600">
              Compares current vs benchmarks (internal best, historical best)
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-purple-600">4</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Recommendations</h3>
            <p className="text-sm text-gray-600">
              Prioritizes opportunities by impact/effort ratio with action items
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
