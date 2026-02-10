"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "recharts";
import { LineChart } from "lucide-react";

type Granularity = "daily" | "weekly" | "monthly";

interface ReportingRow {
  date?: string;
  week_num?: string;
  week_start?: string;
  month_num?: string;
  month_start?: string;
  sessions?: number;
  stripe_revenue?: number;
  talent_signups?: number;
  company_signups?: number;
  purchases?: number;
  applications?: number;
  jobs_posted?: number;
  [key: string]: unknown;
}

export default function LeadershipMetricsPage() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [rows, setRows] = useState<ReportingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/bigquery/reporting-metrics?granularity=${granularity}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error && data.rows?.length === 0) {
          setError(data.error);
        } else {
          setError(null);
        }
        setRows(Array.isArray(data.rows) ? data.rows : []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load metrics");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [granularity]);

  const periodKey = granularity === "daily" ? "date" : granularity === "weekly" ? "week_start" : "month_start";
  const periodLabel = (row: ReportingRow) => {
    if (granularity === "daily") return row.date ?? "";
    if (granularity === "weekly") return row.week_num ?? row.week_start ?? "";
    return row.month_num ?? row.month_start ?? "";
  };

  const chartData = useMemo(() => {
    const ordered = [...rows].reverse();
    return ordered.map((row) => ({
      period: periodLabel(row),
      sessions: Number(row.sessions) || 0,
      stripe_revenue: Number(row.stripe_revenue) || 0,
      talent_signups: Number(row.talent_signups) || 0,
      company_signups: Number(row.company_signups) || 0,
      purchases: Number(row.purchases) || 0,
    }));
  }, [rows, granularity]);

  return (
    <AppLayout title="Leadership Metrics" subtitle="Master metrics by day, week, or month">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Granularity toggle - same pattern as marketing metrics */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center rounded-lg p-0.5"
                style={{ background: "var(--background-tertiary)" }}
              >
                <button
                  onClick={() => setGranularity("daily")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: granularity === "daily" ? "var(--accent)" : "transparent",
                    color: granularity === "daily" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Daily
                </button>
                <button
                  onClick={() => setGranularity("weekly")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: granularity === "weekly" ? "var(--accent)" : "transparent",
                    color: granularity === "weekly" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setGranularity("monthly")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: granularity === "monthly" ? "var(--accent)" : "transparent",
                    color: granularity === "monthly" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Monthly
                </button>
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                {granularity === "daily" ? "Daily metrics" : granularity === "weekly" ? "Weekly metrics" : "Monthly metrics"}
              </div>
            </div>
          </div>
        </Card>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader
              title="Sessions & Revenue"
              subtitle={`${granularity} trend`}
              icon={<LineChart className="w-5 h-5" />}
            />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="period"
                    stroke="var(--foreground-muted)"
                    tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--foreground-muted)"
                    tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--foreground-muted)"
                    tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                    tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--background-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                    formatter={(value: number | undefined, name: string) => [
                      name === "stripe_revenue" ? `$${Number(value ?? 0).toLocaleString()}` : Number(value ?? 0).toLocaleString(),
                      name === "stripe_revenue" ? "Revenue" : name === "sessions" ? "Sessions" : name,
                    ]}
                    labelFormatter={(label) => `Period: ${label}`}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="sessions"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorSessions)"
                    name="sessions"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="stripe_revenue"
                    stroke="#00d4aa"
                    strokeWidth={2}
                    dot={false}
                    name="stripe_revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader
            title="Metrics table"
            subtitle={`${granularity} data from reporting dataset`}
          />
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"
              />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
              No data for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th
                      className="text-left py-3 px-4 text-sm font-semibold sticky left-0"
                      style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}
                    >
                      {granularity === "daily" ? "Date" : granularity === "weekly" ? "Week" : "Month"}
                    </th>
                    <th
                      className="text-right py-3 px-3 text-sm font-semibold min-w-[90px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Sessions
                    </th>
                    <th
                      className="text-right py-3 px-3 text-sm font-semibold min-w-[90px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Revenue
                    </th>
                    <th
                      className="text-right py-3 px-3 text-sm font-semibold min-w-[80px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Talent
                    </th>
                    <th
                      className="text-right py-3 px-3 text-sm font-semibold min-w-[80px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Companies
                    </th>
                    <th
                      className="text-right py-3 px-3 text-sm font-semibold min-w-[80px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Purchases
                    </th>
                    <th
                      className="text-right py-3 px-3 text-sm font-semibold min-w-[80px]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Applications
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <motion.tr
                      key={row[periodKey] ?? idx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      className="hover:bg-[var(--background-tertiary)] transition-colors"
                    >
                      <td
                        className="py-3 px-4 text-sm font-medium sticky left-0"
                        style={{ color: "var(--foreground)", background: "inherit" }}
                      >
                        {periodLabel(row)}
                      </td>
                      <td className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {Number(row.sessions ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        ${Number(row.stripe_revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {Number(row.talent_signups ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {Number(row.company_signups ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {Number(row.purchases ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {Number(row.applications ?? 0).toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
