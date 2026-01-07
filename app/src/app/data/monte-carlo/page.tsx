"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { motion } from "framer-motion";
import {
  Sparkles,
  Play,
  Settings,
  Download,
  RefreshCw,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  BarChart3,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";

// Generate distribution data
const generateDistribution = () => {
  const data = [];
  const mean = 850;
  const stdDev = 120;
  
  for (let x = 500; x <= 1200; x += 25) {
    const z = (x - mean) / stdDev;
    const probability = Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
    data.push({
      value: x,
      probability: probability * 1000,
      cumulative: 0.5 * (1 + erf(z / Math.sqrt(2))) * 100,
    });
  }
  return data;
};

// Error function approximation
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return sign * y;
}

const distributionData = generateDistribution();

// Histogram data
const histogramData = [
  { range: "500-575", count: 45, color: "#ef4444" },
  { range: "575-650", count: 120, color: "#f59e0b" },
  { range: "650-725", count: 280, color: "#f59e0b" },
  { range: "725-800", count: 450, color: "#00d4aa" },
  { range: "800-875", count: 520, color: "#00d4aa" },
  { range: "875-950", count: 380, color: "#00d4aa" },
  { range: "950-1025", count: 150, color: "#3b82f6" },
  { range: "1025-1100", count: 48, color: "#3b82f6" },
  { range: "1100-1175", count: 7, color: "#8b5cf6" },
];

const percentiles = [
  { label: "P10 (10th percentile)", value: "$680K", description: "10% chance of falling below" },
  { label: "P50 (Median)", value: "$850K", description: "50% chance of exceeding" },
  { label: "P90 (90th percentile)", value: "$1.02M", description: "90% chance of falling below" },
];

const riskMetrics = [
  { label: "Expected Value", value: "$852K", color: "#00d4aa" },
  { label: "Standard Deviation", value: "$118K", color: "#3b82f6" },
  { label: "Coefficient of Variation", value: "13.8%", color: "#f59e0b" },
  { label: "Value at Risk (95%)", value: "$658K", color: "#ef4444" },
];

const inputVariables = [
  { name: "Marketing ROI", min: 2.5, max: 4.5, mean: 3.5, distribution: "Normal" },
  { name: "Sales Conversion", min: 8, max: 18, mean: 12, distribution: "Triangular" },
  { name: "Customer Churn", min: 2, max: 8, mean: 5, distribution: "Uniform" },
  { name: "Market Growth", min: 5, max: 25, mean: 15, distribution: "Normal" },
];

export default function MonteCarloPage() {
  const [simulations, setSimulations] = useState(10000);
  const [isRunning, setIsRunning] = useState(false);

  const runSimulation = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  };

  return (
    <AppLayout title="Monte Carlo Simulations" subtitle="Probabilistic risk analysis">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                Revenue Risk Analysis
              </h2>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {simulations.toLocaleString()} simulations • Last run 5 minutes ago
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Iterations:</span>
              <select 
                value={simulations}
                onChange={(e) => setSimulations(Number(e.target.value))}
                className="bg-transparent text-sm font-medium outline-none cursor-pointer"
                style={{ color: "var(--foreground)" }}
              >
                <option value={1000}>1,000</option>
                <option value={10000}>10,000</option>
                <option value={50000}>50,000</option>
                <option value={100000}>100,000</option>
              </select>
            </div>
            <button 
              onClick={runSimulation}
              disabled={isRunning}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{ 
                background: "var(--accent)",
                color: "var(--background)",
              }}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {riskMetrics.map((metric, idx) => (
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
              <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>
                {metric.label}
              </p>
              <p className="text-2xl font-bold" style={{ color: metric.color }}>
                {metric.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Distribution Chart */}
          <div className="lg:col-span-2">
            <Card padding="lg">
              <CardHeader 
                title="Probability Distribution" 
                subtitle="Outcome likelihood across simulations"
                icon={<BarChart3 className="w-5 h-5" />}
              />

              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="range" 
                      stroke="var(--foreground-subtle)"
                      tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="var(--foreground-subtle)"
                      tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: "var(--background-secondary)", 
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--foreground)",
                      }}
                      formatter={(value) => [`${value ?? 0} simulations`, "Count"]}
                    />
                    <ReferenceLine x="800-875" stroke="#00d4aa" strokeDasharray="5 5" label={{ value: "Expected", fill: "#00d4aa", fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {histogramData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Color Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: "#ef4444" }} />
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>High Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: "#f59e0b" }} />
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Moderate Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: "#00d4aa" }} />
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Expected Range</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: "#3b82f6" }} />
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Upside</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Percentiles */}
          <Card>
            <CardHeader 
              title="Key Percentiles" 
              subtitle="Probability thresholds"
              icon={<Target className="w-5 h-5" />}
            />

            <div className="space-y-4">
              {percentiles.map((percentile, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {percentile.label}
                    </span>
                    <span 
                      className="text-lg font-bold"
                      style={{ color: idx === 1 ? "var(--accent)" : "var(--foreground)" }}
                    >
                      {percentile.value}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {percentile.description}
                  </p>
                </motion.div>
              ))}
            </div>

            <div 
              className="mt-4 p-3 rounded-lg flex items-start gap-2"
              style={{ background: "var(--secondary-muted)" }}
            >
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--secondary)" }} />
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                There&apos;s an 80% probability the outcome will fall between P10 and P90.
              </p>
            </div>
          </Card>
        </div>

        {/* Input Variables */}
        <Card>
          <CardHeader 
            title="Input Variables" 
            subtitle="Parameters driving the simulation"
            icon={<Sliders className="w-5 h-5" />}
            action={
              <button 
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{ 
                  background: "var(--background-tertiary)",
                  color: "var(--foreground-muted)",
                }}
              >
                <Settings className="w-4 h-4" />
                Configure
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {inputVariables.map((variable, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-lg"
                style={{ background: "var(--background-tertiary)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>
                    {variable.name}
                  </span>
                  <span 
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ 
                      background: "var(--secondary-muted)",
                      color: "var(--secondary)",
                    }}
                  >
                    {variable.distribution}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--foreground-subtle)" }}>Min</span>
                    <span style={{ color: "var(--foreground-muted)" }}>{variable.min}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--foreground-subtle)" }}>Mean</span>
                    <span style={{ color: "var(--accent)" }}>{variable.mean}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--foreground-subtle)" }}>Max</span>
                    <span style={{ color: "var(--foreground-muted)" }}>{variable.max}%</span>
                  </div>
                </div>

                {/* Mini distribution visual */}
                <div className="mt-3 h-2 rounded-full overflow-hidden flex" style={{ background: "var(--background-secondary)" }}>
                  <div className="h-full" style={{ width: "20%", background: "#ef4444", opacity: 0.5 }} />
                  <div className="h-full" style={{ width: "60%", background: "#00d4aa" }} />
                  <div className="h-full" style={{ width: "20%", background: "#3b82f6", opacity: 0.5 }} />
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Sensitivity Analysis Link */}
        <div 
          className="p-6 rounded-xl flex items-center justify-between"
          style={{ 
            background: "linear-gradient(135deg, rgba(0, 212, 170, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Sensitivity Analysis
              </h3>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Understand which inputs have the greatest impact on your forecast
              </p>
            </div>
          </div>
          <button 
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ 
              background: "var(--accent)",
              color: "var(--background)",
            }}
          >
            Run Analysis
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

