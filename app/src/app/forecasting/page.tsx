"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  TrendingUp,
  Sparkles,
  BarChart3,
  Zap,
  ArrowRight,
  Target,
  Database,
  Layers,
  Play,
  Clock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

const forecastingTools = [
  {
    title: "Build Forecast",
    subtitle: "Create new forecasts",
    description: "Build accurate forecasts with AI-powered insights, causal analysis, and scenario modeling.",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "#00d4aa",
    href: "/forecasting/build",
    badge: "Core",
  },
  {
    title: "Monte Carlo Simulations",
    subtitle: "Probabilistic analysis",
    description: "Run thousands of simulations to understand probability distributions and risk profiles.",
    icon: <Sparkles className="w-6 h-6" />,
    color: "#3b82f6",
    href: "/forecasting/monte-carlo",
    badge: null,
  },
  {
    title: "Scenario Modeling",
    subtitle: "What-if analysis",
    description: "Compare different scenarios side-by-side and understand sensitivity to various inputs.",
    icon: <BarChart3 className="w-6 h-6" />,
    color: "#f59e0b",
    href: "/forecasting/scenarios",
    badge: null,
  },
  {
    title: "Causal Analysis",
    subtitle: "Understand drivers",
    description: "Discover the key factors that influence your outcomes using advanced causal inference.",
    icon: <Zap className="w-6 h-6" />,
    color: "#8b5cf6",
    href: "/forecasting/causal",
    badge: null,
  },
];

const recentForecasts = [
  { name: "Q1 Revenue Forecast", type: "Revenue", accuracy: "94.2%", lastRun: "2 hours ago", status: "completed" },
  { name: "Customer Growth Model", type: "Growth", accuracy: "89.7%", lastRun: "1 day ago", status: "completed" },
  { name: "Capacity Planning", type: "Operations", accuracy: "91.3%", lastRun: "Running...", status: "running" },
  { name: "Churn Prediction", type: "Retention", accuracy: "87.5%", lastRun: "3 days ago", status: "completed" },
];

const capabilities = [
  { icon: <Target className="w-5 h-5" />, label: "Causal Analysis", description: "Understand what drives outcomes" },
  { icon: <Layers className="w-5 h-5" />, label: "Segmentation", description: "Break down by cohorts" },
  { icon: <Database className="w-5 h-5" />, label: "Feature-Based", description: "ML-powered predictions" },
  { icon: <Sparkles className="w-5 h-5" />, label: "Monte Carlo", description: "Probabilistic simulations" },
];

export default function ForecastingOverview() {
  return (
    <AppLayout title="Team-Owned Forecasting" subtitle="Enable every team to understand their business drivers">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Section */}
        <div 
          className="p-8 rounded-2xl relative overflow-hidden"
          style={{ 
            background: "linear-gradient(135deg, rgba(0, 212, 170, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span 
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                Module 04
              </span>
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Team-Owned Forecasting & Data Science
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Become Your Own Data Science Team
            </h2>
            <p className="text-base mb-6" style={{ color: "var(--foreground-muted)" }}>
              Run forecasts, simulate scenarios, and understand what truly drives your business outcomes—without needing a dedicated data scientist.
            </p>
            <div className="flex items-center gap-3">
              <Link 
                href="/forecasting/build"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                <Play className="w-4 h-4" />
                Start Forecasting
              </Link>
              <button 
                className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground-muted)",
                }}
              >
                Learn More
              </button>
            </div>
          </div>
          
          {/* Background decoration */}
          <div 
            className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-30"
            style={{ background: "radial-gradient(circle, #00d4aa 0%, transparent 70%)" }}
          />
        </div>

        {/* Capabilities */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {capabilities.map((cap, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-xl text-center"
              style={{
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {cap.icon}
              </div>
              <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                {cap.label}
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                {cap.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Tools Grid */}
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Forecasting Tools
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forecastingTools.map((tool, idx) => (
              <Link key={idx} href={tool.href}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.01 }}
                  className="p-5 rounded-xl cursor-pointer group h-full"
                  style={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{ background: `${tool.color}20`, color: tool.color }}
                    >
                      {tool.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {tool.badge && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                        >
                          {tool.badge}
                        </span>
                      )}
                      <ArrowRight 
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        style={{ color: tool.color }}
                      />
                    </div>
                  </div>
                  <h4 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    {tool.title}
                  </h4>
                  <p className="text-sm mb-2" style={{ color: tool.color }}>
                    {tool.subtitle}
                  </p>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {tool.description}
                  </p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Forecasts */}
        <Card>
          <CardHeader 
            title="Recent Forecasts" 
            subtitle="Your forecast models"
            icon={<Target className="w-5 h-5" />}
            action={
              <Link 
                href="/forecasting/build"
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                <TrendingUp className="w-4 h-4" />
                New Forecast
              </Link>
            }
          />

          <div className="space-y-3">
            {recentForecasts.map((forecast, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 rounded-lg cursor-pointer hover:bg-[var(--background-tertiary)] transition-all duration-150"
                style={{ background: "var(--background-tertiary)" }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--secondary-muted)", color: "var(--secondary)" }}
                  >
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>
                      {forecast.name}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--background-secondary)", color: "var(--foreground-muted)" }}>
                        {forecast.type}
                      </span>
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-subtle)" }}>
                        <Clock className="w-3 h-3" />
                        {forecast.lastRun}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold" style={{ color: "var(--success)" }}>
                      {forecast.accuracy}
                    </p>
                    <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                      Accuracy
                    </p>
                  </div>
                  {forecast.status === "running" ? (
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--warning)" }} />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" style={{ color: "var(--success)" }} />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

