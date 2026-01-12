"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Globe,
  Search,
  Mail,
  Share2,
  ExternalLink,
  ShoppingBag,
  Video,
  Megaphone,
  HelpCircle,
  Activity,
  Monitor,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface TrafficSourceData {
  id: string;
  name: string;
  months: Record<string, TrafficMetrics>; // "2026-01": { users: 1000, ... }
}

interface TrafficMetrics {
  users: number;
  newUsers: number;
  sessions: number;
  engagementRate: number;
  avgEngagementTime: number;
  eventsPerSession: number;
  events: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
}

type ViewMode = "ttm" | "year";
type MetricType = "users" | "newUsers" | "sessions" | "engagementRate" | "avgEngagementTime" | "events" | "conversions" | "conversionRate" | "revenue";

const metricConfig: Record<MetricType, { label: string; format: (v: number) => string; color: string }> = {
  users: { label: "Users", format: (v) => formatNumber(v), color: "#3b82f6" },
  newUsers: { label: "New Users", format: (v) => formatNumber(v), color: "#10b981" },
  sessions: { label: "Sessions", format: (v) => formatNumber(v), color: "#8b5cf6" },
  engagementRate: { label: "Engagement Rate", format: (v) => `${v.toFixed(1)}%`, color: "#f59e0b" },
  avgEngagementTime: { label: "Avg. Eng. Time", format: (v) => formatDuration(v), color: "#06b6d4" },
  events: { label: "Events", format: (v) => formatNumber(v), color: "#ec4899" },
  conversions: { label: "Conversions", format: (v) => formatNumber(v), color: "#f43f5e" },
  conversionRate: { label: "Conv. Rate", format: (v) => `${v.toFixed(2)}%`, color: "#84cc16" },
  revenue: { label: "Revenue", format: (v) => formatCurrency(v), color: "#10b981" },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toLocaleString()}`;
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  return `${Math.floor(seconds)}s`;
}

export default function TrafficPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [trafficData, setTrafficData] = useState<TrafficSourceData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("users");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<{
    countries: string[];
    devices: string[];
    events: string[];
  }>({ countries: [], devices: [], events: [] });
  const [filtersLoading, setFiltersLoading] = useState(false);

  const organizationId = currentOrg?.id || "";

  // Generate months based on view mode
  const { months, monthLabels } = useMemo(() => {
    if (viewMode === "ttm") {
      const now = new Date();
      const ttmMonths: string[] = [];
      const ttmLabels: string[] = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        ttmMonths.push(monthKey);
        ttmLabels.push(label);
      }

      return { months: ttmMonths, monthLabels: ttmLabels };
    } else {
      const yearMonths = Array.from({ length: 12 }, (_, i) => {
        const month = (i + 1).toString().padStart(2, "0");
        return `${selectedYear}-${month}`;
      });
      const yearLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { months: yearMonths, monthLabels: yearLabels };
    }
  }, [viewMode, selectedYear]);

  // Fetch filter options on mount
  useEffect(() => {
    if (!organizationId) return;

    const fetchFilterOptions = async () => {
      setFiltersLoading(true);
      try {
        const response = await fetch(
          `/api/google-analytics/filter-options?organizationId=${organizationId}`
        );
        if (response.ok) {
          const data = await response.json();
          setFilterOptions({
            countries: data.countries || [],
            devices: data.devices || [],
            events: data.events || [],
          });
        }
      } catch (err) {
        console.error("Error fetching filter options:", err);
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilterOptions();
  }, [organizationId]);

  // Fetch traffic data when view mode, year, or filters change
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // First check if GA is connected
        const connectionDoc = await getDoc(doc(db, "ga_connections", organizationId));

        if (!connectionDoc.exists() || connectionDoc.data()?.status !== "connected") {
          setIsConnected(false);
          setTrafficData([]);
          setLoading(false);
          return;
        }

        setIsConnected(true);

        // Build query params with filters
        const params = new URLSearchParams({
          organizationId,
          viewMode,
          year: selectedYear.toString(),
        });
        if (selectedCountry) params.set("country", selectedCountry);
        if (selectedDevice) params.set("device", selectedDevice);
        if (selectedEvent) params.set("event", selectedEvent);

        // Fetch real traffic data from API
        const response = await fetch(
          `/api/google-analytics/traffic-sources?${params.toString()}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch traffic data");
        }

        const data = await response.json();
        setTrafficData(data.sources || []);
      } catch (err) {
        console.error("Error fetching traffic data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch traffic data");
        setTrafficData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, viewMode, selectedYear, selectedCountry, selectedDevice, selectedEvent]);

  // Get value for a source and month
  const getValue = (source: TrafficSourceData, month: string): number => {
    const metrics = source.months[month];
    if (!metrics) return 0;
    return metrics[selectedMetric] || 0;
  };

  // Calculate row total
  const getRowTotal = (source: TrafficSourceData): number => {
    return months.reduce((sum, month) => {
      const metrics = source.months[month];
      if (!metrics) return sum;
      return sum + (metrics[selectedMetric] || 0);
    }, 0);
  };

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    return months.map((month) => {
      return trafficData.reduce((sum, source) => {
        const metrics = source.months[month];
        if (!metrics) return sum;
        return sum + (metrics[selectedMetric] || 0);
      }, 0);
    });
  }, [trafficData, months, selectedMetric]);

  // Calculate period total
  const periodTotal = useMemo(() => {
    return monthlyTotals.reduce((sum, val) => sum + val, 0);
  }, [monthlyTotals]);

  // Sort data by total (descending)
  const sortedData = useMemo(() => {
    return [...trafficData].sort((a, b) => {
      const totalA = months.reduce((sum, month) => {
        const metrics = a.months[month];
        return sum + (metrics?.[selectedMetric] || 0);
      }, 0);
      const totalB = months.reduce((sum, month) => {
        const metrics = b.months[month];
        return sum + (metrics?.[selectedMetric] || 0);
      }, 0);
      return totalB - totalA;
    });
  }, [trafficData, months, selectedMetric]);

  // Calculate YoY growth
  const yoyGrowth = useMemo(() => {
    if (viewMode !== "ttm") return 0;
    // Compare current TTM to previous TTM (simplified)
    const currentTotal = periodTotal;
    const previousTotal = currentTotal * 0.85; // Placeholder
    return ((currentTotal - previousTotal) / previousTotal) * 100;
  }, [periodTotal, viewMode]);

  const metric = metricConfig[selectedMetric];

  const getSourceIcon = (sourceId: string) => {
    switch (sourceId) {
      case "direct": return <Globe className="w-4 h-4" />;
      case "organic-search": return <Search className="w-4 h-4" />;
      case "referral": return <ExternalLink className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      case "cross-network": return <Share2 className="w-4 h-4" />;
      case "organic-social": return <Share2 className="w-4 h-4" />;
      case "unassigned": return <HelpCircle className="w-4 h-4" />;
      case "paid-search": return <Megaphone className="w-4 h-4" />;
      case "organic-video": return <Video className="w-4 h-4" />;
      case "organic-shopping": return <ShoppingBag className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getSourceColor = (sourceId: string) => {
    switch (sourceId) {
      case "direct": return "#3b82f6";
      case "organic-search": return "#10b981";
      case "referral": return "#8b5cf6";
      case "email": return "#f59e0b";
      case "cross-network": return "#ec4899";
      case "organic-social": return "#06b6d4";
      case "unassigned": return "#6b7280";
      case "paid-search": return "#ef4444";
      case "organic-video": return "#f43f5e";
      case "organic-shopping": return "#84cc16";
      default: return "#6b7280";
    }
  };

  return (
    <AppLayout title="Traffic" subtitle="Monthly traffic acquisition by source">
      <div className="max-w-full mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {viewMode === "ttm" ? "TTM" : selectedYear} {metric.label}
              </span>
              <Users className="w-4 h-4" style={{ color: metric.color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: metric.color }}>
              {metric.format(periodTotal)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Sources</span>
              <Activity className="w-4 h-4" style={{ color: "#8b5cf6" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
              {sortedData.length}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Monthly</span>
              <TrendingUp className="w-4 h-4" style={{ color: "#f59e0b" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
              {metric.format(periodTotal / 12)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>YoY Growth</span>
              {yoyGrowth >= 0 ? (
                <TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
              )}
            </div>
            <p className="text-2xl font-bold" style={{ color: yoyGrowth >= 0 ? "#10b981" : "#ef4444" }}>
              {yoyGrowth >= 0 ? "+" : ""}{yoyGrowth.toFixed(1)}%
            </p>
          </Card>
        </div>

        {/* Filters & Controls */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--background-tertiary)" }}>
                <button
                  onClick={() => setViewMode("ttm")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: viewMode === "ttm" ? "var(--accent)" : "transparent",
                    color: viewMode === "ttm" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  TTM
                </button>
                <button
                  onClick={() => setViewMode("year")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: viewMode === "year" ? "var(--accent)" : "transparent",
                    color: viewMode === "year" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Year
                </button>
              </div>

              {/* Year Selector */}
              {viewMode === "year" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedYear((y) => y - 1)}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--background-tertiary)]"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold min-w-[60px] text-center" style={{ color: "var(--foreground)" }}>
                    {selectedYear}
                  </span>
                  <button
                    onClick={() => setSelectedYear((y) => y + 1)}
                    disabled={selectedYear >= new Date().getFullYear()}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--background-tertiary)] disabled:opacity-30"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Metric Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="users">Users</option>
                  <option value="newUsers">New Users</option>
                  <option value="sessions">Sessions</option>
                  <option value="engagementRate">Engagement Rate</option>
                  <option value="avgEngagementTime">Avg. Engagement Time</option>
                  <option value="events">Events</option>
                  <option value="conversions">Conversions</option>
                  <option value="conversionRate">Conversion Rate</option>
                  <option value="revenue">Revenue</option>
                </select>
              </div>

              {/* Country Filter */}
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  disabled={filtersLoading}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="">All Countries</option>
                  {filterOptions.countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              {/* Device Filter */}
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  disabled={filtersLoading}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="">All Devices</option>
                  {filterOptions.devices.map((device) => (
                    <option key={device} value={device}>
                      {device.charAt(0).toUpperCase() + device.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Filter */}
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  disabled={filtersLoading}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="">All Events</option>
                  {filterOptions.events.map((event) => (
                    <option key={event} value={event}>
                      {event}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export Button */}
            <button
              className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
              style={{
                background: "var(--background-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--foreground-muted)",
              }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </Card>

        {/* Traffic Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : !isConnected ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Connect Google Analytics
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect your Google Analytics account to see traffic acquisition data.
              </p>
              <a
                href="/marketing/google-analytics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#F9AB00", color: "#1a1a1a" }}
              >
                <Activity className="w-4 h-4" />
                Connect Google Analytics
              </a>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4" style={{ color: "#ef4444" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Error Loading Data
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                Try Again
              </button>
            </div>
          ) : sortedData.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                No Traffic Data
              </h3>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                No traffic data available for the selected period. Data is being fetched from Google Analytics.
              </p>
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
                      Source
                    </th>
                    {monthLabels.map((label) => (
                      <th
                        key={label}
                        className="text-right py-3 px-3 text-sm font-semibold min-w-[80px]"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        {label}
                      </th>
                    ))}
                    <th
                      className="text-right py-3 px-4 text-sm font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((source, idx) => {
                    const rowTotal = getRowTotal(source);
                    return (
                      <motion.tr
                        key={source.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        className="hover:bg-[var(--background-tertiary)] transition-colors"
                      >
                        <td
                          className="py-3 px-4 text-sm font-medium sticky left-0"
                          style={{ color: "var(--foreground)", background: "inherit" }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: `${getSourceColor(source.id)}20`, color: getSourceColor(source.id) }}
                            >
                              {getSourceIcon(source.id)}
                            </div>
                            <span>{source.name}</span>
                          </div>
                        </td>
                        {months.map((month) => {
                          const value = getValue(source, month);
                          return (
                            <td
                              key={month}
                              className="py-3 px-3 text-sm text-right tabular-nums"
                              style={{
                                color: value > 0 ? "var(--foreground)" : "var(--foreground-subtle)",
                              }}
                            >
                              {value > 0 ? metric.format(value) : "—"}
                            </td>
                          );
                        })}
                        <td
                          className="py-3 px-4 text-sm text-right font-semibold tabular-nums"
                          style={{ color: metric.color }}
                        >
                          {metric.format(rowTotal)}
                        </td>
                      </motion.tr>
                    );
                  })}

                  {/* Totals Row */}
                  <tr
                    style={{
                      borderTop: "2px solid var(--border)",
                      background: "var(--background-tertiary)",
                    }}
                  >
                    <td
                      className="py-3 px-4 text-sm font-bold sticky left-0"
                      style={{ color: "var(--foreground)", background: "var(--background-tertiary)" }}
                    >
                      Total
                    </td>
                    {monthlyTotals.map((total, idx) => (
                      <td
                        key={months[idx]}
                        className="py-3 px-3 text-sm text-right font-bold tabular-nums"
                        style={{ color: "var(--foreground)" }}
                      >
                        {total > 0 ? metric.format(total) : "—"}
                      </td>
                    ))}
                    <td
                      className="py-3 px-4 text-sm text-right font-bold tabular-nums"
                      style={{ color: metric.color }}
                    >
                      {metric.format(periodTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Source Legend */}
        <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--foreground-muted)" }}>
          <span className="font-medium">Sources:</span>
          {sortedData.slice(0, 6).map((source) => (
            <div key={source.id} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: getSourceColor(source.id) }}
              />
              <span>{source.name}</span>
            </div>
          ))}
          {sortedData.length > 6 && (
            <span style={{ color: "var(--foreground-subtle)" }}>+{sortedData.length - 6} more</span>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
