"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { LineChart, BarChart3, Mail } from "lucide-react";

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

const EMAIL_SECTIONS: SectionConfig[] = [
  {
    id: "email_marketing",
    title: "Email - Marketing Campaigns",
    subtitle: "Manual broadcast emails (status=5)",
    icon: <Mail className="w-5 h-5" />,
    metrics: [
      { key: "marketing_campaigns_launched", label: "Campaigns launched", format: "number" },
      { key: "marketing_sends", label: "Daily sends", format: "number" },
      { key: "marketing_opens", label: "Daily opens", format: "number" },
      { key: "marketing_clicks", label: "Daily clicks", format: "number" },
      { key: "marketing_avg_open_rate", label: "Avg open rate %", format: "pct" },
      { key: "marketing_avg_ctr", label: "Avg click rate %", format: "pct" },
    ],
  },
  {
    id: "email_automation",
    title: "Email - Automation",
    subtitle: "Triggered & transactional emails (status=1)",
    icon: <Mail className="w-5 h-5" />,
    metrics: [
      { key: "automation_campaigns_launched", label: "Campaigns launched", format: "number" },
      { key: "automation_sends", label: "Daily sends", format: "number" },
      { key: "automation_opens", label: "Daily opens", format: "number" },
      { key: "automation_clicks", label: "Daily clicks", format: "number" },
      { key: "automation_avg_open_rate", label: "Avg open rate %", format: "pct" },
      { key: "automation_avg_ctr", label: "Avg click rate %", format: "pct" },
      { key: "email_traffic_sessions", label: "Email referral traffic", format: "number" },
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

export default function EmailMarketingPage() {
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
        if (data.error && data.rows?.length === 0) setError(data.error);
        else setError(null);
        setRows(Array.isArray(data.rows) ? data.rows : []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load metrics");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [granularity, startDate, endDate]);

  // Auto-scroll tables to right to show newest data first
  useEffect(() => {
    if (!loading && rows.length > 0) {
      setTimeout(() => {
        sectionScrollRefs.current.forEach((el) => {
          if (el) el.scrollLeft = el.scrollWidth;
        });
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
    <AppLayout 
      title="Email Marketing" 
      subtitle="Track email campaigns, automation sequences, and engagement metrics"
    >
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

        {/* Email sections */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <Card>
            <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>{error}</div>
          </Card>
        ) : (
          EMAIL_SECTIONS.map((section, sectionIdx) => {
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
