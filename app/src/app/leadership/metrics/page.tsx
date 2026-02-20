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
  { key: "sessions", label: "Traffic", format: "number" as MetricFormat },
  { key: "new_users", label: "New Visitors", format: "number" as MetricFormat },
  { key: "talent_signups", label: "Talent Signups", format: "number" as MetricFormat },
  { key: "talent_signup_rate_pct", label: "Talent Conv Rate", format: "pct" as MetricFormat },
  { key: "company_signups", label: "Company Signups", format: "number" as MetricFormat },
  { key: "company_signup_rate_pct", label: "Company Conv Rate", format: "pct" as MetricFormat },
  { key: "jobs_posted", label: "New Job Posts", format: "number" as MetricFormat },
  { key: "stripe_revenue", label: "Revenue (Stripe)", format: "currency" as MetricFormat },
  { key: "purchases", label: "Purchases", format: "number" as MetricFormat },
  { key: "job_views", label: "Job Views", format: "number" as MetricFormat },
  { key: "applications", label: "Applications", format: "number" as MetricFormat },
  { key: "apps_per_job", label: "Applications per Job", format: "number" as MetricFormat },
  { key: "hires", label: "Hires", format: "number" as MetricFormat },
  { key: "app_to_hire_pct", label: "Hire Rate", format: "pct" as MetricFormat },
];

const SECTIONS: SectionConfig[] = [
  {
    id: "paid",
    title: "Paid channels",
    subtitle: "Google Ads (Search, PMax) and paid traffic",
    icon: <Megaphone className="w-5 h-5" />,
    metrics: [
      { key: "paid_search_sessions", label: "Paid search", format: "number" },
      { key: "paid_pmax_sessions", label: "PMax", format: "number" },
      { key: "total_paid_sessions", label: "Total paid", format: "number" },
      { key: "paid_pct", label: "Paid %", format: "pct" },
      { key: "gads_sessions", label: "GAds sessions", format: "number" },
      { key: "gads_conversions", label: "GAds conversions", format: "number" },
      { key: "gads_revenue", label: "GAds revenue", format: "currency" },
      { key: "gads_pmax_sessions", label: "GAds PMax", format: "number" },
      { key: "gads_search_sessions", label: "GAds search", format: "number" },
    ],
  },
  {
    id: "organic",
    title: "Organic / SEO & content",
    subtitle: "Organic search and direct",
    icon: <Search className="w-5 h-5" />,
    metrics: [
      { key: "organic_sessions", label: "Organic sessions", format: "number" },
      { key: "organic_pct", label: "Organic %", format: "pct" },
      { key: "organic_engaged_sessions", label: "Organic engaged", format: "number" },
      { key: "organic_engagement_rate", label: "Organic eng. rate %", format: "pct" },
      { key: "direct_sessions", label: "Direct", format: "number" },
      { key: "direct_pct", label: "Direct %", format: "pct" },
    ],
  },
  {
    id: "social",
    title: "Social",
    subtitle: "Social media traffic",
    icon: <Share2 className="w-5 h-5" />,
    metrics: [
      { key: "social_sessions", label: "Social sessions", format: "number" },
    ],
  },
  {
    id: "referral",
    title: "Referral / collaborative",
    subtitle: "Referral and affiliate traffic",
    icon: <Share2 className="w-5 h-5" />,
    metrics: [
      { key: "referral_sessions", label: "Referral sessions", format: "number" },
      { key: "referral_pct", label: "Referral %", format: "pct" },
    ],
  },
  {
    id: "email",
    title: "Email marketing",
    subtitle: "Daily email campaign activity",
    icon: <Mail className="w-5 h-5" />,
    metrics: [
      { key: "campaigns_launched", label: "Campaigns launched", format: "number" },
      { key: "campaign_lifetime_sends", label: "Daily sends", format: "number" },
      { key: "campaign_lifetime_opens", label: "Daily opens", format: "number" },
      { key: "campaign_lifetime_clicks", label: "Daily clicks", format: "number" },
      { key: "campaign_avg_open_rate", label: "Avg open rate %", format: "pct" },
      { key: "email_traffic_sessions", label: "Email referral traffic", format: "number" },
    ],
  },
  {
    id: "talent",
    title: "Talent funnel",
    subtitle: "Supply side: signups → applications → hires",
    icon: <Users className="w-5 h-5" />,
    metrics: [
      { key: "talent_signups", label: "Talent signups", format: "number" },
      { key: "talent_signup_rate_pct", label: "Signup rate %", format: "pct" },
      { key: "applications", label: "Applications", format: "number" },
      { key: "profile_views", label: "Profile views", format: "number" },
      { key: "reviews", label: "Reviews", format: "number" },
      { key: "hires", label: "Hires", format: "number" },
      { key: "app_to_hire_pct", label: "App→hire %", format: "pct" },
      { key: "match_rate_pct", label: "Match rate %", format: "pct" },
    ],
    funnelSteps: [
      { key: "talent_signups", label: "Signups" },
      { key: "applications", label: "Applications" },
      { key: "hires", label: "Hires" },
    ],
  },
  {
    id: "company",
    title: "Company funnel",
    subtitle: "Demand side: signups → purchases",
    icon: <Building2 className="w-5 h-5" />,
    metrics: [
      { key: "company_signups", label: "Company signups", format: "number" },
      { key: "company_signup_rate_pct", label: "Signup rate %", format: "pct" },
      { key: "cumulative_company_signups", label: "Cum. companies", format: "number" },
      { key: "purchases", label: "Purchases", format: "number" },
      { key: "company_purchase_conversion_pct", label: "Purchase conv. %", format: "pct" },
      { key: "purchasing_customers", label: "Purchasing customers", format: "number" },
      { key: "avg_purchases_per_company", label: "Avg purchases/company", format: "number" },
    ],
    funnelSteps: [
      { key: "company_signups", label: "Signups" },
      { key: "purchases", label: "Purchases" },
    ],
  },
  {
    id: "jobs",
    title: "Jobs / marketplace",
    subtitle: "Job posts, views, applications per job",
    icon: <Briefcase className="w-5 h-5" />,
    metrics: [
      { key: "jobs_posted", label: "Jobs posted", format: "number" },
      { key: "job_views", label: "Job views", format: "number" },
      { key: "applications", label: "Applications", format: "number" },
      { key: "apps_per_job", label: "Apps per job", format: "number" },
    ],
  },
  {
    id: "revenue",
    title: "Revenue (Stripe - Source of Truth)",
    subtitle: "All revenue tracked from Stripe payments",
    icon: <DollarSign className="w-5 h-5" />,
    metrics: [
      { key: "stripe_revenue", label: "💰 Total Revenue (Stripe)", format: "currency" },
      { key: "purchases", label: "Total Purchases", format: "number" },
      { key: "purchasing_customers", label: "Paying Customers", format: "number" },
      { key: "failed_transactions", label: "Failed Transactions", format: "number" },
      { key: "mrr", label: "MRR (Subscriptions)", format: "currency" },
      { key: "arr", label: "ARR (Subscriptions)", format: "currency" },
      { key: "active_subscriptions", label: "Active Subs", format: "number" },
      { key: "churned_subscriptions", label: "Churned Subs", format: "number" },
      { key: "churn_rate_pct", label: "Churn Rate %", format: "pct" },
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

export default function LeadershipMetricsPage() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [startDate, setStartDate] = useState(() => daysAgoISO(30));
  const [endDate, setEndDate] = useState(todayISO);
  const [rows, setRows] = useState<ReportingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKPIs, setSelectedKPIs] = useState<Set<string>>(new Set(["sessions", "stripe_revenue"]));
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const snapshotScrollRef = useRef<HTMLDivElement>(null);
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
        // Scroll snapshot table
        if (snapshotScrollRef.current) {
          snapshotScrollRef.current.scrollLeft = snapshotScrollRef.current.scrollWidth;
        }
        // Scroll all section tables
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
    <AppLayout title="Leadership Metrics" subtitle="Metrics by area: marketing first, then funnels and revenue">
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
        {!loading && !error && dateColumns.length > 0 && (
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
