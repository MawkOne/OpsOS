"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  LineChart as RechartsLineChart,
  Legend,
  BarChart as RechartsBarChart,
  Bar,
} from "recharts";
import { LineChart, BarChart3, Megaphone, Search, Share2, Mail, Users, Building2, Briefcase, DollarSign } from "lucide-react";

type Granularity = "daily" | "weekly" | "monthly";

interface ReportingRow {
  date?: string;
  week_num?: string;
  week_start?: string;
  month_num?: string;
  month_start?: string;
  [key: string]: unknown;
}

type MetricFormat = "number" | "currency" | "pct";

interface MetricConfig {
  key: string;
  label: string;
  format?: MetricFormat;
}

interface SectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  metrics: MetricConfig[];
  funnelSteps?: { key: string; label: string }[];
}

const CHART_COLORS = ["#3b82f6", "#00d4aa", "#f59e0b", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6", "#f97316"];

const SNAPSHOT_KPIS = [
  { key: "stripe_revenue", label: "Total Revenue", format: "currency" as MetricFormat },
  { key: "purchases", label: "Purchases", format: "number" as MetricFormat },
  { key: "purchasing_customers", label: "Paying Customers", format: "number" as MetricFormat },
  { key: "avg_purchase_value", label: "Avg Purchase Value", format: "currency" as MetricFormat },
];

const SECTIONS: SectionConfig[] = [
  {
    id: "revenue",
    title: "Revenue Overview (Stripe)",
    subtitle: "All revenue tracked from Stripe payments",
    icon: <DollarSign className="w-5 h-5" />,
    metrics: [
      { key: "stripe_revenue", label: "💰 Total Revenue", format: "currency" },
      { key: "purchases", label: "Total Purchases", format: "number" },
      { key: "purchasing_customers", label: "Paying Customers", format: "number" },
      { key: "avg_purchase_value", label: "Avg Purchase Value", format: "currency" },
    ],
    funnelSteps: [
      { key: "sessions", label: "Sessions" },
      { key: "purchases", label: "Purchases" },
      { key: "stripe_revenue", label: "Revenue" },
    ],
  },
];

function formatValue(val: unknown, format?: MetricFormat): string {
  const n = Number(val);
  if (Number.isNaN(n)) return "—";
  if (format === "currency") return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (format === "pct") return `${n.toFixed(1)}%`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function RevenueMetricsPage() {
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [startDate, setStartDate] = useState(() => daysAgoISO(365));
  const [endDate, setEndDate] = useState(todayISO);
  const [rows, setRows] = useState<ReportingRow[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [productDateColumns, setProductDateColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKPIs, setSelectedKPIs] = useState<Set<string>>(new Set(["stripe_revenue", "purchases"]));
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const snapshotScrollRef = useRef<HTMLDivElement>(null);
  const sectionScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const productScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ granularity, startDate, endDate });
    
    // Fetch metrics including product breakdown
    fetch(`/api/bigquery/reporting-metrics?${params}`)
      .then(res => res.json())
      .then((data) => {
        if (data.error && data.rows?.length === 0) setError(data.error);
        else setError(null);
        setRows(Array.isArray(data.rows) ? data.rows : []);
        
        // Product data is now included in the same response
        console.log('[Revenue] Product data received:', data.products);
        if (data.products) {
          console.log('[Revenue] Setting product data, count:', data.products.length);
          setProductData(data.products);
          setProductDateColumns(data.productDateColumns || []);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load metrics");
        setRows([]);
        setProductData([]);
      })
      .finally(() => setLoading(false));
  }, [granularity, startDate, endDate]);

  // Auto-scroll tables to right to show newest data first
  useEffect(() => {
    if (!loading && rows.length > 0) {
      setTimeout(() => {
        // Scroll snapshot table
        if (snapshotScrollRef.current) {
          snapshotScrollRef.current.scrollLeft = snapshotScrollRef.current.scrollWidth;
        }
        // Scroll all section tables
        sectionScrollRefs.current.forEach((el) => {
          if (el) el.scrollLeft = el.scrollWidth;
        });
        // Scroll product table
        if (productScrollRef.current) {
          productScrollRef.current.scrollLeft = productScrollRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [loading, rows.length]);

  const periodLabel = (row: ReportingRow): string => {
    let val: any;
    if (granularity === "daily") {
      val = row.date;
    } else if (granularity === "weekly") {
      val = row.week_num ?? row.week_start;
    } else {
      val = row.month_num ?? row.month_start;
    }
    
    // BigQuery returns dates as objects like { value: "2026-01-31" }
    if (val && typeof val === "object" && "value" in val) {
      return String(val.value);
    }
    return val != null ? String(val) : "";
  };

  const chartData = useMemo(() => {
    const ordered = [...rows].reverse();
    return ordered.map((row) => {
      const point: Record<string, string | number> = { period: periodLabel(row) };
      selectedKPIs.forEach((key) => {
        point[key] = Number(row[key]) || 0;
      });
      return point;
    });
  }, [rows, granularity, selectedKPIs]);

  // Pivot: columns = dates (oldest to newest, left to right), rows = KPIs
  const { dateColumns, byPeriod } = useMemo(() => {
    // API returns newest first, so reverse to show oldest→newest (left→right)
    const oldestFirst = [...rows].reverse();
    const cols = oldestFirst.map((r) => periodLabel(r)).filter(Boolean);
    const map = new Map<string, ReportingRow>();
    rows.forEach((r) => {
      const p = periodLabel(r);
      if (p) map.set(p, r);
    });
    return { dateColumns: cols, byPeriod: map };
  }, [rows, granularity]);

  return (
    <AppLayout title="Revenue Dashboard" subtitle="Track revenue, subscriptions, and customer payments">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Granularity + date range */}
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--background-tertiary)" }}>
                {(["daily", "weekly", "monthly"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                    style={{
                      background: granularity === g ? "var(--accent)" : "transparent",
                      color: granularity === g ? "var(--background)" : "var(--foreground-muted)",
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                {granularity === "daily" ? "Daily" : granularity === "weekly" ? "Weekly" : "Monthly"} metrics
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setChartType("line")}
                  className="p-1.5 rounded-md transition-all"
                  style={{
                    background: chartType === "line" ? "var(--accent)" : "var(--background-tertiary)",
                    color: chartType === "line" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                  title="Line chart"
                >
                  <LineChart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className="p-1.5 rounded-md transition-all"
                  style={{
                    background: chartType === "bar" ? "var(--accent)" : "var(--background-tertiary)",
                    color: chartType === "bar" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                  title="Bar chart"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium mr-1" style={{ color: "var(--foreground-muted)" }}>Quick:</span>
              <button
                onClick={() => {
                  setEndDate(todayISO());
                  setStartDate(daysAgoISO(30));
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ background: "var(--background-tertiary)", color: "var(--foreground)" }}
              >
                Last 30
              </button>
              <button
                onClick={() => {
                  setEndDate(todayISO());
                  setStartDate(daysAgoISO(90));
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ background: "var(--background-tertiary)", color: "var(--foreground)" }}
              >
                Last 90
              </button>
              <button
                onClick={() => {
                  setEndDate(todayISO());
                  setStartDate(daysAgoISO(365));
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ background: "var(--background-tertiary)", color: "var(--foreground)" }}
              >
                Last 12M
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border px-2.5 py-1.5 text-sm tabular-nums"
                  style={{ borderColor: "var(--border)", background: "var(--background-secondary)", color: "var(--foreground)" }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md border px-2.5 py-1.5 text-sm tabular-nums"
                  style={{ borderColor: "var(--border)", background: "var(--background-secondary)", color: "var(--foreground)" }}
                />
              </label>
            </div>
          </div>
        </Card>

        {/* Overview chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader title="KPI Trends" subtitle={`Select KPIs to plot (${granularity})`} icon={<LineChart className="w-5 h-5" />} />
            <div className="mb-4 flex flex-wrap gap-2">
              {SNAPSHOT_KPIS.map((kpi) => (
                <button
                  key={kpi.key}
                  onClick={() => {
                    const newSet = new Set(selectedKPIs);
                    if (newSet.has(kpi.key)) newSet.delete(kpi.key);
                    else newSet.add(kpi.key);
                    setSelectedKPIs(newSet);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: selectedKPIs.has(kpi.key) ? "var(--accent)" : "var(--background-tertiary)",
                    color: selectedKPIs.has(kpi.key) ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  {kpi.label}
                </button>
              ))}
            </div>
            <div style={{ width: "100%", minWidth: 0, height: 320 }}>
              <ResponsiveContainer width="100%" height={320}>
                {chartType === "line" ? (
                  <RechartsLineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                    <YAxis stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "var(--background-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length || label == null) return null;
                        return (
                          <div className="rounded-lg border p-3 shadow" style={{ background: "var(--background-secondary)", borderColor: "var(--border)" }}>
                            <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Period: {String(label)}</p>
                            {payload.map((entry) => {
                              const kpi = SNAPSHOT_KPIS.find((k) => k.key === entry.dataKey);
                              const val = entry.value != null ? Number(entry.value) : 0;
                              const display = kpi?.format === "currency" ? `$${val.toLocaleString()}` : val.toLocaleString();
                              return (
                                <p key={String(entry.dataKey)} className="text-sm tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                                  {kpi?.label ?? entry.dataKey}: {display}
                                </p>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <Legend formatter={(value) => SNAPSHOT_KPIS.find((k) => k.key === value)?.label ?? value} />
                    {Array.from(selectedKPIs).map((key, i) => (
                      <Line
                        key={key}
                        type="linear"
                        dataKey={key}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        name={key}
                      />
                    ))}
                  </RechartsLineChart>
                ) : (
                  <RechartsBarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                    <YAxis stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "var(--background-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length || label == null) return null;
                        return (
                          <div className="rounded-lg border p-3 shadow" style={{ background: "var(--background-secondary)", borderColor: "var(--border)" }}>
                            <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Period: {String(label)}</p>
                            {payload.map((entry) => {
                              const kpi = SNAPSHOT_KPIS.find((k) => k.key === entry.dataKey);
                              const val = entry.value != null ? Number(entry.value) : 0;
                              const display = kpi?.format === "currency" ? `$${val.toLocaleString()}` : val.toLocaleString();
                              return (
                                <p key={String(entry.dataKey)} className="text-sm tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                                  {kpi?.label ?? entry.dataKey}: {display}
                                </p>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <Legend formatter={(value) => SNAPSHOT_KPIS.find((k) => k.key === value)?.label ?? value} />
                    {Array.from(selectedKPIs).map((key, i) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        name={key}
                      />
                    ))}
                  </RechartsBarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Company Snapshot */}
        {!loading && !error && (
          dateColumns.length > 0 ? (
            <Card>
              <CardHeader title="Company Snapshot" subtitle="High-level KPIs" icon={<LineChart className="w-5 h-5" />} />
              <div ref={snapshotScrollRef} className="overflow-x-auto">
                <table className="w-full table-fixed" style={{ minWidth: dateColumns.length * 90 + 180 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-3 px-4 text-sm font-semibold sticky left-0 z-10 w-44 min-w-[180px]" style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}>
                        KPI
                      </th>
                      {dateColumns.map((d) => (
                        <th key={d} className="text-right py-3 px-2 text-sm font-semibold tabular-nums" style={{ color: "var(--foreground-muted)", width: 90 }}>
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SNAPSHOT_KPIS.map((kpi, idx) => (
                      <motion.tr
                        key={kpi.key}
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        className="group hover:bg-[var(--background-tertiary)] transition-colors"
                      >
                        <td className="py-2.5 px-4 text-sm font-medium sticky left-0 z-10 bg-[var(--background-secondary)] group-hover:bg-[var(--background-tertiary)]" style={{ color: "var(--foreground)" }}>
                          {kpi.label}
                        </td>
                        {dateColumns.map((d) => (
                          <td key={d} className="py-2.5 px-2 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                            {formatValue(byPeriod.get(d)?.[kpi.key], kpi.format)}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
                No {granularity} data available for this date range
              </div>
            </Card>
          )
        )}

        {/* Product Revenue Table */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader 
                title="Revenue by Product" 
                subtitle={productData.length > 0 ? `Product-level revenue breakdown (${productData.length} products)` : "Loading product data..."} 
                icon={<DollarSign className="w-5 h-5" />} 
              />
              {productData.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
                  No product data available for this date range
                </div>
              ) : (
              <div ref={productScrollRef} className="overflow-x-auto" style={{ maxHeight: "600px" }}>
                <table className="w-full border-collapse">
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--background-secondary)" }}>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold sticky left-0 z-20" style={{ color: "var(--foreground-muted)", background: "var(--background-secondary)", minWidth: "200px" }}>
                        Product
                      </th>
                      <th className="py-2.5 px-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)", minWidth: "100px" }}>
                        Total Revenue
                      </th>
                      <th className="py-2.5 px-2 text-right text-xs font-semibold" style={{ color: "var(--foreground-muted)", minWidth: "80px" }}>
                        Total Purchases
                      </th>
                      {productDateColumns.map((d) => (
                        <th key={d} className="py-2.5 px-2 text-right text-xs font-semibold whitespace-nowrap" style={{ color: "var(--foreground-muted)", minWidth: "90px" }}>
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productData.map((product, idx) => (
                      <motion.tr
                        key={product.product}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td className="py-2.5 px-3 text-sm font-medium sticky left-0 z-10" style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}>
                          {product.product}
                        </td>
                        <td className="py-2.5 px-2 text-sm text-right tabular-nums font-semibold" style={{ color: "var(--accent)" }}>
                          ${(product.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2.5 px-2 text-sm text-right tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                          {(product.totalPurchases || 0).toLocaleString()}
                        </td>
                        {productDateColumns.map((d) => {
                          const value = product[d] || 0;
                          return (
                            <td key={d} className="py-2.5 px-2 text-sm text-right tabular-nums" style={{ color: value > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}>
                              {value > 0 ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                            </td>
                          );
                        })}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Grouped sections: marketing first, then funnels & revenue */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <Card>
            <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>{error}</div>
          </Card>
        ) : (
          SECTIONS.map((section, sectionIdx) => {
            const latestRow = rows[0];
            const hasFunnel = section.funnelSteps && section.funnelSteps.length > 0 && latestRow;
            const chartMetrics = section.metrics.slice(0, 5);
            const sectionChartData = dateColumns.map((period) => {
              const row = byPeriod.get(period);
              const point: Record<string, string | number> = { period };
              chartMetrics.forEach((m) => {
                point[m.key] = Number(row?.[m.key]) || 0;
              });
              return point;
            });

            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sectionIdx * 0.05 }}
              >
                <Card>
                  <CardHeader title={section.title} subtitle={section.subtitle} icon={section.icon} />
                  {hasFunnel && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg py-3 px-4" style={{ background: "var(--background-tertiary)" }}>
                      <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>Funnel (latest period):</span>
                      {section.funnelSteps!.map((step, i) => {
                        const v = Number(latestRow[step.key]) || 0;
                        const prev = i > 0 ? (Number(latestRow[section.funnelSteps![i - 1].key]) || 0) : 0;
                        const pct = prev > 0 ? ((v / prev) * 100).toFixed(1) : null;
                        return (
                          <span key={step.key} className="flex items-center gap-2 text-sm">
                            {i > 0 && <span style={{ color: "var(--foreground-muted)" }}>→</span>}
                            <span style={{ color: "var(--foreground)" }}>{step.label}: <strong>{v.toLocaleString()}</strong></span>
                            {pct != null && i > 0 && <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>({pct}%)</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {sectionChartData.length > 0 && chartMetrics.length > 0 && (
                    <div className="mb-4" style={{ width: "100%", minWidth: 0, height: 220 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        {chartType === "line" ? (
                          <RechartsLineChart data={sectionChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="period" stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                            <YAxis stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{ background: "var(--background-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length || label == null) return null;
                                const metricByKey = new Map(section.metrics.map((m) => [m.key, m]));
                                return (
                                  <div className="rounded-lg border p-3 shadow" style={{ background: "var(--background-secondary)", borderColor: "var(--border)" }}>
                                    <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>{String(label)}</p>
                                    {payload.map((entry) => {
                                      const m = metricByKey.get(String(entry.dataKey));
                                      const display = formatValue(entry.value, m?.format);
                                      return (
                                        <p key={String(entry.dataKey)} className="text-sm tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                                          {m?.label ?? entry.dataKey}: {display}
                                        </p>
                                      );
                                    })}
                                  </div>
                                );
                              }}
                            />
                            <Legend formatter={(value) => section.metrics.find((m) => m.key === value)?.label ?? value} />
                            {chartMetrics.map((m, i) => (
                              <Line
                                key={m.key}
                                type="linear"
                                dataKey={m.key}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                name={m.label}
                              />
                            ))}
                          </RechartsLineChart>
                        ) : (
                          <RechartsBarChart data={sectionChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="period" stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                            <YAxis stroke="var(--foreground-muted)" tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{ background: "var(--background-secondary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length || label == null) return null;
                                const metricByKey = new Map(section.metrics.map((m) => [m.key, m]));
                                return (
                                  <div className="rounded-lg border p-3 shadow" style={{ background: "var(--background-secondary)", borderColor: "var(--border)" }}>
                                    <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>{String(label)}</p>
                                    {payload.map((entry) => {
                                      const m = metricByKey.get(String(entry.dataKey));
                                      const display = formatValue(entry.value, m?.format);
                                      return (
                                        <p key={String(entry.dataKey)} className="text-sm tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                                          {m?.label ?? entry.dataKey}: {display}
                                        </p>
                                      );
                                    })}
                                  </div>
                                );
                              }}
                            />
                            <Legend formatter={(value) => section.metrics.find((m) => m.key === value)?.label ?? value} />
                            {chartMetrics.map((m, i) => (
                              <Bar
                                key={m.key}
                                dataKey={m.key}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                name={m.label}
                              />
                            ))}
                          </RechartsBarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div 
                    ref={(el) => {
                      if (el) sectionScrollRefs.current.set(section.id, el);
                    }}
                    className="overflow-x-auto"
                  >
                    <table className="w-full table-fixed" style={{ minWidth: dateColumns.length * 90 + 180 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th className="text-left py-3 px-4 text-sm font-semibold sticky left-0 z-10 w-44 min-w-[180px]" style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}>
                            KPI
                          </th>
                          {dateColumns.map((d) => (
                            <th key={d} className="text-right py-3 px-2 text-sm font-semibold tabular-nums" style={{ color: "var(--foreground-muted)", width: 90 }}>
                              {d}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dateColumns.length === 0 ? (
                          <tr><td colSpan={dateColumns.length + 1} className="py-6 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>No data</td></tr>
                        ) : (
                          section.metrics.map((m, idx) => (
                            <motion.tr
                              key={m.key}
                              initial={{ opacity: 0, y: 2 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                              style={{ borderBottom: "1px solid var(--border)" }}
                              className="group hover:bg-[var(--background-tertiary)] transition-colors"
                            >
                              <td className="py-2.5 px-4 text-sm font-medium sticky left-0 z-10 bg-[var(--background-secondary)] group-hover:bg-[var(--background-tertiary)]" style={{ color: "var(--foreground)" }}>
                                {m.label}
                              </td>
                              {dateColumns.map((d) => (
                                <td key={d} className="py-2.5 px-2 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                                  {formatValue(byPeriod.get(d)?.[m.key], m.format)}
                                </td>
                              ))}
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
