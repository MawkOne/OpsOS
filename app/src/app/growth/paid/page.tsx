"use client";

import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { LineChart, BarChart3, Megaphone } from "lucide-react";

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
}

const CHART_COLORS = ["#3b82f6", "#00d4aa", "#f59e0b", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6", "#f97316"];

const PAID_SECTIONS: SectionConfig[] = [
  {
    id: "paid_channels",
    title: "Paid Channels Performance",
    subtitle: "Google Ads (Search, PMax) and paid traffic",
    icon: <Megaphone className="w-5 h-5" />,
    metrics: [
      { key: "paid_search_sessions", label: "Paid search sessions", format: "number" },
      { key: "paid_pmax_sessions", label: "PMax sessions", format: "number" },
      { key: "total_paid_sessions", label: "Total paid sessions", format: "number" },
      { key: "paid_pct", label: "Paid traffic %", format: "pct" },
      { key: "gads_sessions", label: "Google Ads sessions", format: "number" },
      { key: "gads_conversions", label: "Google Ads conversions", format: "number" },
      { key: "gads_revenue", label: "Google Ads revenue", format: "currency" },
      { key: "gads_revenue_pct", label: "Google Ads % of total revenue", format: "pct" },
      { key: "gads_pmax_sessions", label: "Google Ads PMax", format: "number" },
      { key: "gads_search_sessions", label: "Google Ads Search", format: "number" },
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

export default function PaidChannelsPage() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [startDate, setStartDate] = useState(() => daysAgoISO(30));
  const [endDate, setEndDate] = useState(todayISO);
  const [rows, setRows] = useState<ReportingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const sectionScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ granularity, startDate, endDate });
    fetch(`/api/bigquery/reporting-metrics?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setRows([]);
        } else {
          const rawRows = Array.isArray(data.rows) ? data.rows : [];
          // Calculate Google Ads revenue as % of Stripe revenue
          const enrichedRows = rawRows.map(row => {
            const gadsRevenue = Number(row.gads_revenue) || 0;
            const stripeRevenue = Number(row.stripe_revenue) || 0;
            const gadsRevenuePct = stripeRevenue > 0 ? (gadsRevenue / stripeRevenue) * 100 : 0;
            return {
              ...row,
              gads_revenue_pct: gadsRevenuePct
            };
          });
          setRows(enrichedRows);
        }
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setError("Failed to load metrics");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [granularity, startDate, endDate]);

  useEffect(() => {
    if (!loading && rows.length > 0) {
      setTimeout(() => {
        sectionScrollRefs.current.forEach((el) => {
          if (el) el.scrollLeft = el.scrollWidth;
        });
      }, 100);
    }
  }, [loading, rows]);

  const periodLabel = (r: ReportingRow): string => {
    if (granularity === "weekly") {
      const val = r.week_start;
      if (val && typeof val === "object" && "value" in val) {
        return String((val as any).value);
      }
      return val != null ? String(val) : "";
    }
    if (granularity === "monthly") {
      const val = r.month_start;
      if (val && typeof val === "object" && "value" in val) {
        return String((val as any).value);
      }
      return val != null ? String(val) : "";
    }
    
    const val = r.date;
    if (val && typeof val === "object" && "value" in val) {
      return String((val as any).value);
    }
    return val != null ? String(val) : "";
  };

  const dateColumns = (() => {
    const oldestFirst = [...rows].reverse();
    return oldestFirst.map((r) => periodLabel(r)).filter(Boolean);
  })();

  const byPeriod = new Map<string, ReportingRow>();
  rows.forEach((r) => {
    const p = periodLabel(r);
    if (p) byPeriod.set(p, r);
  });

  return (
    <AppLayout 
      title="Paid Channels" 
      subtitle="Track performance across Google Ads, influencer marketing, sponsorships, and Meta Ads"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Controls */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Date range buttons */}
              <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--background-tertiary)" }}>
                <button
                  onClick={() => {
                    setGranularity("daily");
                    setStartDate(daysAgoISO(30));
                    setEndDate(todayISO());
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: granularity === "daily" && startDate === daysAgoISO(30) ? "var(--accent)" : "transparent",
                    color: granularity === "daily" && startDate === daysAgoISO(30) ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Last 30d
                </button>
                <button
                  onClick={() => {
                    setGranularity("daily");
                    setStartDate(daysAgoISO(90));
                    setEndDate(todayISO());
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: granularity === "daily" && startDate === daysAgoISO(90) ? "var(--accent)" : "transparent",
                    color: granularity === "daily" && startDate === daysAgoISO(90) ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Last 90d
                </button>
                <button
                  onClick={() => {
                    setGranularity("daily");
                    setStartDate(daysAgoISO(365));
                    setEndDate(todayISO());
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: granularity === "daily" && startDate === daysAgoISO(365) ? "var(--accent)" : "transparent",
                    color: granularity === "daily" && startDate === daysAgoISO(365) ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Last 12M
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
        </Card>

        {/* Paid channel sections */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <Card>
            <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>{error}</div>
          </Card>
        ) : (
          PAID_SECTIONS.map((section, sectionIdx) => {
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

                  {/* Metrics Table */}
                  <div
                    ref={(el) => {
                      if (el) sectionScrollRefs.current.set(section.id, el);
                    }}
                    className="overflow-x-auto"
                  >
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th className="text-left py-3 px-4 text-sm font-semibold sticky left-0 z-20" style={{ color: "var(--foreground)", background: "var(--background-secondary)", minWidth: 200 }}>
                            Metric
                          </th>
                          {dateColumns.map((d) => (
                            <th key={d} className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)", minWidth: 100 }}>
                              {d}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.metrics.map((m, idx) => (
                          <motion.tr
                            key={m.key}
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                            style={{ borderBottom: "1px solid var(--border)" }}
                            className="group hover:bg-[var(--background-tertiary)] transition-colors"
                          >
                            <td className="py-2.5 px-4 text-sm font-medium sticky left-0 z-10 group-hover:bg-[var(--background-tertiary)]" style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}>
                              {m.label}
                            </td>
                            {dateColumns.map((d) => (
                              <td key={d} className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                                {formatValue(byPeriod.get(d)?.[m.key], m.format)}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
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
