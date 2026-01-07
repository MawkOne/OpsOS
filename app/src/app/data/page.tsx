"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Database,
  TrendingUp,
  Sparkles,
  BarChart3,
  Zap,
  ArrowRight,
  Target,
  Activity,
  Layers,
} from "lucide-react";

const analysisTools = [
  {
    title: "Team-Owned Forecasting",
    subtitle: "Build accurate forecasts",
    description: "Enable every team to understand their business drivers and forecast accurately with causal analysis and scenario modeling.",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "#00d4aa",
    href: "/data/forecasting",
    badge: "Core",
  },
  {
    title: "Monte Carlo Simulations",
    subtitle: "Risk analysis",
    description: "Run thousands of simulations to understand probability distributions and risks in your forecasts.",
    icon: <Sparkles className="w-6 h-6" />,
    color: "#3b82f6",
    href: "/data/monte-carlo",
    badge: null,
  },
  {
    title: "Scenario Modeling",
    subtitle: "What-if analysis",
    description: "Compare different scenarios side-by-side and understand the sensitivity of your plans to various inputs.",
    icon: <BarChart3 className="w-6 h-6" />,
    color: "#f59e0b",
    href: "/data/scenarios",
    badge: null,
  },
  {
    title: "Feature Analysis",
    subtitle: "Driver discovery",
    description: "Identify the key drivers that influence your business outcomes using advanced feature importance analysis.",
    icon: <Zap className="w-6 h-6" />,
    color: "#8b5cf6",
    href: "/data/features",
    badge: null,
  },
];

const recentModels = [
  { name: "Q1 Revenue Forecast", type: "Regression", accuracy: "94.2%", updated: "2 hours ago" },
  { name: "Churn Prediction", type: "Classification", accuracy: "89.7%", updated: "1 day ago" },
  { name: "Capacity Planning", type: "Time Series", accuracy: "91.3%", updated: "3 days ago" },
];

const dataStats = [
  { label: "Data Sources", value: "12", icon: <Database className="w-4 h-4" /> },
  { label: "Active Models", value: "8", icon: <Target className="w-4 h-4" /> },
  { label: "Features", value: "156", icon: <Layers className="w-4 h-4" /> },
  { label: "Predictions Today", value: "2.4k", icon: <Activity className="w-4 h-4" /> },
];

export default function DataDashboard() {
  return (
    <AppLayout title="Data & Analytics" subtitle="Advanced analysis tools">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dataStats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-xl"
              style={{
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ 
                    background: "var(--accent-muted)",
                    color: "var(--accent)",
                  }}
                >
                  {stat.icon}
                </div>
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {stat.label}
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Analysis Tools */}
        <div>
          <h2 
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Analysis Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysisTools.map((tool, idx) => (
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
                      style={{ 
                        background: `${tool.color}20`,
                        color: tool.color,
                      }}
                    >
                      {tool.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {tool.badge && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ 
                            background: "var(--accent-muted)",
                            color: "var(--accent)",
                          }}
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

                  <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    {tool.title}
                  </h3>
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

        {/* Recent Models */}
        <Card>
          <CardHeader 
            title="Recent Models" 
            subtitle="Your forecasting models"
            icon={<Target className="w-5 h-5" />}
            action={
              <button 
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ 
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                New Model
              </button>
            }
          />

          <div className="space-y-3">
            {recentModels.map((model, idx) => (
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
                    style={{ 
                      background: "var(--secondary-muted)",
                      color: "var(--secondary)",
                    }}
                  >
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>
                      {model.name}
                    </p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      {model.type} • Updated {model.updated}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p 
                    className="font-semibold"
                    style={{ color: "var(--success)" }}
                  >
                    {model.accuracy}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    Accuracy
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

