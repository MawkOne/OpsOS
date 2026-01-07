"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Plus,
  Settings,
  Play,
  Download,
  Share2,
  ChevronDown,
  Target,
  Zap,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from "recharts";

// Sample forecast data
const forecastData = [
  { month: "Jan", actual: 420, forecast: null, lower: null, upper: null },
  { month: "Feb", actual: 485, forecast: null, lower: null, upper: null },
  { month: "Mar", actual: 510, forecast: null, lower: null, upper: null },
  { month: "Apr", actual: 548, forecast: null, lower: null, upper: null },
  { month: "May", actual: 590, forecast: null, lower: null, upper: null },
  { month: "Jun", actual: 620, forecast: 620, lower: 610, upper: 630 },
  { month: "Jul", actual: null, forecast: 658, lower: 635, upper: 681 },
  { month: "Aug", actual: null, forecast: 702, lower: 670, upper: 734 },
  { month: "Sep", actual: null, forecast: 745, lower: 700, upper: 790 },
  { month: "Oct", actual: null, forecast: 798, lower: 740, upper: 856 },
  { month: "Nov", actual: null, forecast: 852, lower: 780, upper: 924 },
  { month: "Dec", actual: null, forecast: 910, lower: 820, upper: 1000 },
];

const keyDrivers = [
  { name: "Marketing Spend", impact: 35, direction: "positive", change: "+12%" },
  { name: "Sales Team Size", impact: 25, direction: "positive", change: "+8%" },
  { name: "Product Releases", impact: 20, direction: "positive", change: "+15%" },
  { name: "Churn Rate", impact: -15, direction: "negative", change: "-3%" },
  { name: "Seasonality", impact: 5, direction: "neutral", change: "Cyclic" },
];

const scenarios = [
  { id: "base", name: "Base Case", probability: "60%", outcome: "$910K", color: "#00d4aa" },
  { id: "optimistic", name: "Optimistic", probability: "25%", outcome: "$1.1M", color: "#3b82f6" },
  { id: "pessimistic", name: "Pessimistic", probability: "15%", outcome: "$780K", color: "#f59e0b" },
];

const recentForecasts = [
  { name: "Q1 Revenue", accuracy: "94.2%", lastRun: "2 hours ago", status: "completed" },
  { name: "Customer Growth", accuracy: "89.7%", lastRun: "1 day ago", status: "completed" },
  { name: "Capacity Planning", accuracy: "91.3%", lastRun: "Running...", status: "running" },
];

const directionColors: Record<string, string> = {
  positive: "#00d4aa",
  negative: "#ef4444",
  neutral: "#8b5cf6",
};

export default function ForecastingPage() {
  const [selectedScenario, setSelectedScenario] = useState("base");
  const [timeHorizon, setTimeHorizon] = useState("6mo");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <AppLayout title="Team-Owned Forecasting" subtitle="Build accurate forecasts with AI-powered insights">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)",
              }}
            >
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Revenue Forecast
              </h2>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Last updated 2 hours ago • 94.2% accuracy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground-muted)",
              }}
            >
              <Settings className="w-4 h-4" />
              Configure
            </button>
            <button 
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200"
              style={{ 
                background: "var(--accent)",
                color: "var(--background)",
              }}
            >
              <Play className="w-4 h-4" />
              Run Forecast
            </button>
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div className="flex items-center gap-2">
          {["3mo", "6mo", "12mo", "24mo"].map((horizon) => (
            <button
              key={horizon}
              onClick={() => setTimeHorizon(horizon)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: timeHorizon === horizon ? "var(--accent-muted)" : "var(--background-secondary)",
                color: timeHorizon === horizon ? "var(--accent)" : "var(--foreground-muted)",
                border: `1px solid ${timeHorizon === horizon ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {horizon}
            </button>
          ))}
        </div>

        {/* Main Chart */}
        <Card padding="lg">
          <CardHeader 
            title="Forecast Visualization" 
            subtitle="Historical data with projected values and confidence intervals"
            action={
              <div className="flex items-center gap-2">
                <button 
                  className="p-2 rounded-lg transition-all duration-200"
                  style={{ 
                    background: "var(--background-tertiary)",
                    color: "var(--foreground-muted)",
                  }}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  className="p-2 rounded-lg transition-all duration-200"
                  style={{ 
                    background: "var(--background-tertiary)",
                    color: "var(--foreground-muted)",
                  }}
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            }
          />

          <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="month" 
                  stroke="var(--foreground-subtle)"
                  tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                />
                <YAxis 
                  stroke="var(--foreground-subtle)"
                  tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                  tickFormatter={(value) => `$${value}K`}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: "var(--background-secondary)", 
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                  }}
                  formatter={(value: number) => [`$${value}K`, ""]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="url(#colorConfidence)"
                  name="Upper Bound"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="var(--background)"
                  name="Lower Bound"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#00d4aa"
                  strokeWidth={3}
                  dot={{ fill: "#00d4aa", strokeWidth: 2, r: 4 }}
                  name="Actual"
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                  name="Forecast"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "#00d4aa" }} />
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Historical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "#3b82f6" }} />
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Forecast</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 rounded" style={{ background: "rgba(59, 130, 246, 0.2)" }} />
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>95% Confidence</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key Drivers */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader 
                title="Key Drivers" 
                subtitle="Factors influencing your forecast"
                icon={<Zap className="w-5 h-5" />}
                action={
                  <button 
                    className="flex items-center gap-1 text-sm"
                    style={{ color: "var(--accent)" }}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Analysis
                  </button>
                }
              />

              <div className="space-y-4">
                {keyDrivers.map((driver, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>
                          {driver.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-sm font-medium"
                            style={{ color: directionColors[driver.direction] }}
                          >
                            {driver.change}
                          </span>
                          {driver.direction === "positive" ? (
                            <ArrowUpRight className="w-4 h-4" style={{ color: directionColors.positive }} />
                          ) : driver.direction === "negative" ? (
                            <ArrowDownRight className="w-4 h-4" style={{ color: directionColors.negative }} />
                          ) : null}
                        </div>
                      </div>
                      <div className="relative">
                        <div 
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: "var(--background-tertiary)" }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.abs(driver.impact)}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: directionColors[driver.direction] }}
                          />
                        </div>
                      </div>
                    </div>
                    <div 
                      className="w-12 text-right font-semibold"
                      style={{ color: directionColors[driver.direction] }}
                    >
                      {driver.impact > 0 ? "+" : ""}{driver.impact}%
                    </div>
                  </motion.div>
                ))}
              </div>

              <div 
                className="mt-6 p-4 rounded-lg flex items-start gap-3"
                style={{ background: "var(--accent-muted)" }}
              >
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--accent)" }}>
                    AI Insight
                  </p>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Marketing spend shows the highest correlation with revenue growth. Consider increasing Q3 budget by 15% to maximize impact during peak season.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Scenarios */}
          <Card>
            <CardHeader 
              title="Scenarios" 
              subtitle="Probability-weighted outcomes"
              icon={<BarChart3 className="w-5 h-5" />}
            />

            <div className="space-y-3">
              {scenarios.map((scenario, idx) => (
                <motion.button
                  key={scenario.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedScenario(scenario.id)}
                  className="w-full p-4 rounded-lg text-left transition-all duration-200"
                  style={{
                    background: selectedScenario === scenario.id 
                      ? `${scenario.color}15`
                      : "var(--background-tertiary)",
                    border: `1px solid ${selectedScenario === scenario.id 
                      ? scenario.color 
                      : "transparent"}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>
                      {scenario.name}
                    </span>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: scenario.color }}
                    >
                      {scenario.probability}
                    </span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: scenario.color }}>
                    {scenario.outcome}
                  </p>
                </motion.button>
              ))}
            </div>

            <button 
              className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
              style={{ 
                background: "var(--background-tertiary)",
                color: "var(--foreground-muted)",
                border: "1px solid var(--border)",
              }}
            >
              <Plus className="w-4 h-4" />
              Add Scenario
            </button>
          </Card>
        </div>

        {/* Recent Forecasts */}
        <Card>
          <CardHeader 
            title="Your Forecasts" 
            subtitle="Saved forecast models"
            icon={<Target className="w-5 h-5" />}
            action={
              <button 
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{ 
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                <Plus className="w-4 h-4" />
                New Forecast
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentForecasts.map((forecast, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-4 rounded-lg cursor-pointer hover:bg-[var(--background-tertiary)] transition-all duration-150"
                style={{ background: "var(--background-tertiary)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: "var(--secondary-muted)",
                      color: "var(--secondary)",
                    }}
                  >
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  {forecast.status === "running" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "var(--warning)" }} />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
                  )}
                </div>
                <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  {forecast.name}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--success)" }}>
                    {forecast.accuracy}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-subtle)" }}>
                    <Clock className="w-3 h-3" />
                    {forecast.lastRun}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

