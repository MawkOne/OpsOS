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
    title: "Campaign Performance",
    subtitle: "Marketing broadcasts and promotional emails",
    icon: <Mail className="w-5 h-5" />,
    metrics: [
      { key: "marketing_campaigns_launched", label: "Campaigns launched", format: "number" },
      { key: "marketing_sends", label: "Sends", format: "number" },
      { key: "marketing_opens", label: "Opens", format: "number" },
      { key: "marketing_clicks", label: "Clicks", format: "number" },
      { key: "marketing_avg_open_rate", label: "Open rate %", format: "pct" },
      { key: "marketing_avg_ctr", label: "Click rate %", format: "pct" },
    ],
  },
  {
    id: "email_automation",
    title: "Automation Performance",
    subtitle: "Triggered sequences and transactional emails",
    icon: <Mail className="w-5 h-5" />,
    metrics: [
      { key: "automation_campaigns_launched", label: "Automations active", format: "number" },
      { key: "automation_sends", label: "Sends", format: "number" },
      { key: "automation_opens", label: "Opens", format: "number" },
      { key: "automation_clicks", label: "Clicks", format: "number" },
      { key: "automation_avg_open_rate", label: "Open rate %", format: "pct" },
      { key: "automation_avg_ctr", label: "Click rate %", format: "pct" },
      { key: "email_traffic_sessions", label: "Email referral traffic", format: "number" },
    ],
  },
  {
    id: "email_lists",
    title: "List Growth & Health",
    subtitle: "Email list subscribers and contact management",
    icon: <Mail className="w-5 h-5" />,
    metrics: [
      { key: "email_contacts_total", label: "Total contacts", format: "number" },
      { key: "email_list_subscribers_total", label: "Total subscribers", format: "number" },
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
  const [activeTab, setActiveTab] = useState<"campaigns" | "automations" | "lists">("automations");
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [startDate, setStartDate] = useState(() => daysAgoISO(90));
  const [endDate, setEndDate] = useState(todayISO);
  const [rows, setRows] = useState<ReportingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
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

  // Fetch campaign-level data for Automations tab
  useEffect(() => {
    if (activeTab !== "automations") {
      setCampaigns([]);
      return;
    }
    
    setCampaignsLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/bigquery/automation-campaigns?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      })
      .catch((err) => {
        console.error("Failed to load campaigns:", err);
        setCampaigns([]);
      })
      .finally(() => setCampaignsLoading(false));
  }, [activeTab, startDate, endDate]);

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
      val = row.week_start ?? row.week_num;
    } else {
      val = row.month_start ?? row.month_num;
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
        {/* Controls */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--background-tertiary)" }}>
                <button
                  onClick={() => setActiveTab("automations")}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: activeTab === "automations" ? "var(--accent)" : "transparent",
                    color: activeTab === "automations" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Automations
                </button>
                <button
                  onClick={() => setActiveTab("campaigns")}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: activeTab === "campaigns" ? "var(--accent)" : "transparent",
                    color: activeTab === "campaigns" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Campaigns
                </button>
                <button
                  onClick={() => setActiveTab("lists")}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: activeTab === "lists" ? "var(--accent)" : "transparent",
                    color: activeTab === "lists" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Lists
                </button>
              </div>

              {/* Date range buttons */}
              <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--background-tertiary)" }}>
                <button
                  onClick={() => {
                    setGranularity("daily");
                    setStartDate(daysAgoISO(30));
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: granularity === "daily" ? "var(--accent)" : "transparent",
                    color: granularity === "daily" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Last 30d
                </button>
                <button
                  onClick={() => {
                    setGranularity("weekly");
                    setStartDate(daysAgoISO(90));
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: granularity === "weekly" ? "var(--accent)" : "transparent",
                    color: granularity === "weekly" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Last 90d
                </button>
                <button
                  onClick={() => {
                    setGranularity("monthly");
                    setStartDate(daysAgoISO(365));
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: granularity === "monthly" ? "var(--accent)" : "transparent",
                    color: granularity === "monthly" ? "var(--background)" : "var(--foreground-muted)",
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
          EMAIL_SECTIONS.filter(section => {
            if (activeTab === "campaigns") return section.id === "email_marketing";
            if (activeTab === "automations") return section.id === "email_automation";
            if (activeTab === "lists") return section.id === "email_lists";
            return false;
          }).map((section, sectionIdx) => {
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
                    <table className="w-full" style={{ minWidth: Math.max(dateColumns.length * 100 + 200, 800) }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th className="text-left py-3 px-4 text-sm font-semibold sticky left-0 z-10" style={{ color: "var(--foreground)", background: "var(--background-secondary)", minWidth: 200 }}>
                            KPI
                          </th>
                          {dateColumns.map((d) => (
                            <th key={d} className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground-muted)", minWidth: 100 }}>
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
                              <td className="py-2.5 px-4 text-sm font-medium sticky left-0 z-10 group-hover:bg-[var(--background-tertiary)]" style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}>
                                {m.label}
                              </td>
                              {dateColumns.map((d) => (
                                <td key={d} className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
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

        {/* Campaign-level breakdown for Automations */}
        {activeTab === "automations" && !loading && !error && (
          <Card>
            <CardHeader 
              title="Individual Automations" 
              subtitle="Performance breakdown by automation campaign"
              icon={<Mail className="w-5 h-5" />}
            />
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
                No automation campaigns found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Campaign
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        Sends
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        Opens
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        Clicks
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        Open Rate
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        CTR
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign, idx) => (
                      <motion.tr
                        key={campaign.campaign_id}
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        className="group hover:bg-[var(--background-tertiary)] transition-colors"
                      >
                        <td className="py-2.5 px-4 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          {campaign.campaign_name || `Campaign ${campaign.campaign_id}`}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatValue(campaign.total_sends, "number")}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatValue(campaign.total_opens, "number")}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatValue(campaign.total_clicks, "number")}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatValue(campaign.avg_open_rate, "pct")}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatValue(campaign.avg_ctr, "pct")}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground-muted)" }}>
                          {campaign.last_active_date?.value || campaign.last_active_date || '—'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
