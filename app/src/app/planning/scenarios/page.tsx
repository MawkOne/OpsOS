"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { motion } from "framer-motion";
import {
  BarChart3,
  Plus,
  Copy,
  Trash2,
  Play,
  Download,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit3,
  Check,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface Scenario {
  id: string;
  name: string;
  description: string;
  color: string;
  revenue: number;
  costs: number;
  headcount: number;
  marketGrowth: number;
  churnRate: number;
  isActive: boolean;
}

const initialScenarios: Scenario[] = [
  {
    id: "base",
    name: "Base Case",
    description: "Current trajectory with existing plans",
    color: "#00d4aa",
    revenue: 850,
    costs: 620,
    headcount: 250,
    marketGrowth: 12,
    churnRate: 5,
    isActive: true,
  },
  {
    id: "aggressive",
    name: "Aggressive Growth",
    description: "Accelerated hiring and marketing investment",
    color: "#3b82f6",
    revenue: 1100,
    costs: 820,
    headcount: 320,
    marketGrowth: 18,
    churnRate: 6,
    isActive: true,
  },
  {
    id: "conservative",
    name: "Conservative",
    description: "Focus on profitability and efficiency",
    color: "#f59e0b",
    revenue: 720,
    costs: 480,
    headcount: 220,
    marketGrowth: 8,
    churnRate: 4,
    isActive: true,
  },
  {
    id: "downturn",
    name: "Market Downturn",
    description: "Recession scenario with reduced demand",
    color: "#ef4444",
    revenue: 580,
    costs: 520,
    headcount: 200,
    marketGrowth: -5,
    churnRate: 8,
    isActive: false,
  },
];

const comparisonMetrics = [
  { key: "revenue", label: "Revenue", unit: "K", prefix: "$" },
  { key: "costs", label: "Costs", unit: "K", prefix: "$" },
  { key: "headcount", label: "Headcount", unit: "", prefix: "" },
  { key: "marketGrowth", label: "Market Growth", unit: "%", prefix: "" },
  { key: "churnRate", label: "Churn Rate", unit: "%", prefix: "" },
];

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [selectedMetric, setSelectedMetric] = useState("revenue");
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeScenarios = scenarios.filter(s => s.isActive);

  const chartData = comparisonMetrics.map(metric => {
    const data: Record<string, number | string> = { metric: metric.label };
    activeScenarios.forEach(scenario => {
      data[scenario.name] = scenario[metric.key as keyof Scenario] as number;
    });
    return data;
  });

  const toggleScenario = (id: string) => {
    setScenarios(prev => prev.map(s => 
      s.id === id ? { ...s, isActive: !s.isActive } : s
    ));
  };

  const getMetricDiff = (scenario: Scenario, metricKey: string) => {
    const base = scenarios.find(s => s.id === "base");
    if (!base || scenario.id === "base") return null;
    
    const baseValue = base[metricKey as keyof Scenario] as number;
    const scenarioValue = scenario[metricKey as keyof Scenario] as number;
    const diff = ((scenarioValue - baseValue) / baseValue) * 100;
    
    return diff;
  };

  return (
    <AppLayout title="Scenario Modeling" subtitle="Compare what-if analyses">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
              }}
            >
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Strategic Scenarios
              </h2>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {activeScenarios.length} active scenarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground-muted)",
              }}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button 
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200"
              style={{ 
                background: "var(--accent)",
                color: "var(--background)",
              }}
            >
              <Plus className="w-4 h-4" />
              New Scenario
            </button>
          </div>
        </div>

        {/* Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenarios.map((scenario, idx) => (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${!scenario.isActive ? 'opacity-50' : ''}`}
              style={{
                background: "var(--background-secondary)",
                border: `2px solid ${scenario.isActive ? scenario.color : "var(--border)"}`,
              }}
              onClick={() => toggleScenario(scenario.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ background: scenario.color }}
                />
                <div className="flex items-center gap-1">
                  <button 
                    className="p-1 rounded hover:bg-[var(--background-tertiary)]"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Copy className="w-3 h-3" style={{ color: "var(--foreground-subtle)" }} />
                  </button>
                  <button 
                    className="p-1 rounded hover:bg-[var(--background-tertiary)]"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Edit3 className="w-3 h-3" style={{ color: "var(--foreground-subtle)" }} />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                {scenario.name}
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                {scenario.description}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>Revenue</span>
                  <span className="text-sm font-semibold" style={{ color: scenario.color }}>
                    ${scenario.revenue}K
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>Margin</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {Math.round((1 - scenario.costs / scenario.revenue) * 100)}%
                  </span>
                </div>
              </div>

              {/* Toggle indicator */}
              <div 
                className="mt-4 pt-3 border-t flex items-center justify-center gap-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div 
                  className={`w-8 h-4 rounded-full transition-all duration-200 relative ${scenario.isActive ? '' : 'opacity-50'}`}
                  style={{ background: scenario.isActive ? scenario.color : "var(--background-tertiary)" }}
                >
                  <div 
                    className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all duration-200"
                    style={{ left: scenario.isActive ? '18px' : '2px' }}
                  />
                </div>
                <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {scenario.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comparison Chart */}
        <Card padding="lg">
          <CardHeader 
            title="Scenario Comparison" 
            subtitle="Side-by-side metric analysis"
            action={
              <div className="flex items-center gap-2">
                {comparisonMetrics.slice(0, 3).map((metric) => (
                  <button
                    key={metric.key}
                    onClick={() => setSelectedMetric(metric.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{
                      background: selectedMetric === metric.key ? "var(--accent-muted)" : "var(--background-tertiary)",
                      color: selectedMetric === metric.key ? "var(--accent)" : "var(--foreground-muted)",
                    }}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            }
          />

          <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData.filter(d => d.metric === comparisonMetrics.find(m => m.key === selectedMetric)?.label)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  type="number" 
                  stroke="var(--foreground-subtle)"
                  tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                />
                <YAxis 
                  type="category" 
                  dataKey="metric"
                  stroke="var(--foreground-subtle)"
                  tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: "var(--background-secondary)", 
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                  }}
                />
                <Legend />
                {activeScenarios.map((scenario) => (
                  <Bar 
                    key={scenario.id}
                    dataKey={scenario.name} 
                    fill={scenario.color}
                    radius={[0, 4, 4, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Detailed Comparison Table */}
        <Card>
          <CardHeader 
            title="Detailed Comparison" 
            subtitle="All metrics across scenarios"
          />

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                    Metric
                  </th>
                  {activeScenarios.map((scenario) => (
                    <th 
                      key={scenario.id}
                      className="text-right py-3 px-4 text-sm font-medium"
                      style={{ color: scenario.color }}
                    >
                      {scenario.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonMetrics.map((metric, idx) => (
                  <motion.tr 
                    key={metric.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {metric.label}
                    </td>
                    {activeScenarios.map((scenario) => {
                      const value = scenario[metric.key as keyof Scenario] as number;
                      const diff = getMetricDiff(scenario, metric.key);
                      
                      return (
                        <td key={scenario.id} className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                              {metric.prefix}{value}{metric.unit}
                            </span>
                            {diff !== null && (
                              <span 
                                className="text-xs flex items-center gap-0.5"
                                style={{ 
                                  color: diff > 0 
                                    ? (metric.key === "churnRate" || metric.key === "costs" ? "var(--error)" : "var(--success)")
                                    : diff < 0
                                    ? (metric.key === "churnRate" || metric.key === "costs" ? "var(--success)" : "var(--error)")
                                    : "var(--foreground-muted)"
                                }}
                              >
                                {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(diff).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Summary Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { 
              title: "Best Revenue",
              scenario: "Aggressive Growth",
              value: "$1.1M",
              diff: "+29%",
              color: "#3b82f6",
              positive: true,
            },
            { 
              title: "Best Margin",
              scenario: "Conservative",
              value: "33%",
              diff: "+6pts",
              color: "#f59e0b",
              positive: true,
            },
            { 
              title: "Lowest Risk",
              scenario: "Conservative",
              value: "4% churn",
              diff: "-20%",
              color: "#00d4aa",
              positive: true,
            },
          ].map((insight, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-5 rounded-xl"
              style={{
                background: `${insight.color}10`,
                border: `1px solid ${insight.color}30`,
              }}
            >
              <p className="text-sm mb-2" style={{ color: "var(--foreground-muted)" }}>
                {insight.title}
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold mb-1" style={{ color: insight.color }}>
                    {insight.value}
                  </p>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {insight.scenario}
                  </p>
                </div>
                <span 
                  className="text-sm font-medium flex items-center gap-1"
                  style={{ color: insight.positive ? "var(--success)" : "var(--error)" }}
                >
                  {insight.positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {insight.diff}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

