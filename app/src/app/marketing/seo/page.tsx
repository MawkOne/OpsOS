"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  MousePointer,
  Eye,
  Target,
  Activity,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface SearchQueryData {
  id: string;
  query: string;
  months: Record<string, SearchMetrics>;
}

interface SearchMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

type ViewMode = "ttm" | "year";
type MetricType = "clicks" | "impressions" | "ctr" | "position";

const metricConfig: Record<MetricType, { label: string; format: (v: number) => string; color: string; invertSort?: boolean }> = {
  clicks: { label: "Clicks", format: (v) => formatNumber(v), color: "#3b82f6" },
  impressions: { label: "Impressions", format: (v) => formatNumber(v), color: "#8b5cf6" },
  ctr: { label: "CTR", format: (v) => `${v.toFixed(2)}%`, color: "#10b981" },
  position: { label: "Avg. Position", format: (v) => v.toFixed(1), color: "#f59e0b", invertSort: true },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

export default function SEOPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [searchData, setSearchData] = useState<SearchQueryData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("clicks");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

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

  // Fetch search data
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const connectionDoc = await getDoc(doc(db, "ga_connections", organizationId));

        if (!connectionDoc.exists() || connectionDoc.data()?.status !== "connected") {
          setIsConnected(false);
          setSearchData([]);
          setLoading(false);
          return;
        }

        setIsConnected(true);

        const response = await fetch(
          `/api/google-analytics/search-console?organizationId=${organizationId}&viewMode=${viewMode}&year=${selectedYear}`
        );

        const data = await response.json();

        if (!response.ok) {
          if (data.needsReconnect) {
            setNeedsReconnect(true);
          }
          throw new Error(data.error || "Failed to fetch search data");
        }

        setNeedsReconnect(false);
        setSearchData(data.queries || []);
      } catch (err) {
        console.error("Error fetching search data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch search data");
        setSearchData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, viewMode, selectedYear]);

  // Get value for a query and month
  const getValue = (query: SearchQueryData, month: string): number => {
    const metrics = query.months[month];
    if (!metrics) return 0;
    return metrics[selectedMetric] || 0;
  };

  // Calculate row total/average
  const getRowAggregate = (query: SearchQueryData): number => {
    const values = months.map(month => getValue(query, month)).filter(v => v > 0);
    if (values.length === 0) return 0;
    
    // For position and CTR, return average; for clicks/impressions, return sum
    if (selectedMetric === "position" || selectedMetric === "ctr") {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    return values.reduce((sum, v) => sum + v, 0);
  };

  // Calculate monthly totals/averages
  const monthlyAggregates = useMemo(() => {
    return months.map((month) => {
      const values = searchData
        .map(query => query.months[month]?.[selectedMetric] || 0)
        .filter(v => v > 0);
      
      if (values.length === 0) return 0;
      
      if (selectedMetric === "position" || selectedMetric === "ctr") {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      }
      return values.reduce((sum, v) => sum + v, 0);
    });
  }, [searchData, months, selectedMetric]);

  // Calculate period total/average
  const periodAggregate = useMemo(() => {
    const values = monthlyAggregates.filter(v => v > 0);
    if (values.length === 0) return 0;
    
    if (selectedMetric === "position" || selectedMetric === "ctr") {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    return values.reduce((sum, v) => sum + v, 0);
  }, [monthlyAggregates, selectedMetric]);

  // Sort data
  const sortedData = useMemo(() => {
    const invertSort = metricConfig[selectedMetric].invertSort;
    return [...searchData].sort((a, b) => {
      const aggA = getRowAggregate(a);
      const aggB = getRowAggregate(b);
      return invertSort ? aggA - aggB : aggB - aggA;
    });
  }, [searchData, months, selectedMetric]);

  const metric = metricConfig[selectedMetric];

  // Calculate total clicks for summary
  const totalClicks = useMemo(() => {
    return searchData.reduce((sum, query) => {
      return sum + months.reduce((mSum, month) => mSum + (query.months[month]?.clicks || 0), 0);
    }, 0);
  }, [searchData, months]);

  const totalImpressions = useMemo(() => {
    return searchData.reduce((sum, query) => {
      return sum + months.reduce((mSum, month) => mSum + (query.months[month]?.impressions || 0), 0);
    }, 0);
  }, [searchData, months]);

  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <AppLayout title="SEO" subtitle="Search Console performance by keyword">
      <div className="max-w-full mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {viewMode === "ttm" ? "TTM" : selectedYear} Clicks
              </span>
              <MousePointer className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
              {formatNumber(totalClicks)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Impressions</span>
              <Eye className="w-4 h-4" style={{ color: "#8b5cf6" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
              {formatNumber(totalImpressions)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg CTR</span>
              <Target className="w-4 h-4" style={{ color: "#10b981" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {avgCTR.toFixed(2)}%
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Keywords Tracked</span>
              <Search className="w-4 h-4" style={{ color: "#f59e0b" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
              {sortedData.length}
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
                  <option value="clicks">Clicks</option>
                  <option value="impressions">Impressions</option>
                  <option value="ctr">CTR</option>
                  <option value="position">Avg. Position</option>
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

        {/* Search Queries Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : !isConnected ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Connect Google Analytics
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect your Google Analytics account to see Search Console data.
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
              <Search className="w-12 h-12 mx-auto mb-4" style={{ color: "#ef4444" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                {needsReconnect ? "Search Console Access Required" : "Error Loading Data"}
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                {error}
              </p>
              {needsReconnect ? (
                <a
                  href={`/api/google-analytics/auth?organizationId=${organizationId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "#F9AB00", color: "#1a1a1a" }}
                >
                  <Activity className="w-4 h-4" />
                  Reconnect Google Account
                </a>
              ) : (
                <>
                  <p className="text-xs mb-4" style={{ color: "var(--foreground-subtle)" }}>
                    Make sure Search Console is linked to your Google account.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          ) : sortedData.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                No Search Data
              </h3>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                No search query data available. Make sure Search Console is linked to your GA4 property.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th
                      className="text-left py-3 px-4 text-sm font-semibold sticky left-0"
                      style={{ color: "var(--foreground)", background: "var(--background-secondary)", minWidth: "250px" }}
                    >
                      Search Query
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
                      {selectedMetric === "position" || selectedMetric === "ctr" ? "Avg" : "Total"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((query, idx) => {
                    const rowAggregate = getRowAggregate(query);
                    return (
                      <motion.tr
                        key={query.id}
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
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: "#3b82f620", color: "#3b82f6" }}
                            >
                              <Search className="w-4 h-4" />
                            </div>
                            <span className="truncate max-w-[200px]" title={query.query}>
                              {query.query}
                            </span>
                          </div>
                        </td>
                        {months.map((month) => {
                          const value = getValue(query, month);
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
                          {metric.format(rowAggregate)}
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
                      {selectedMetric === "position" || selectedMetric === "ctr" ? "Average" : "Total"}
                    </td>
                    {monthlyAggregates.map((agg, idx) => (
                      <td
                        key={months[idx]}
                        className="py-3 px-3 text-sm text-right font-bold tabular-nums"
                        style={{ color: "var(--foreground)" }}
                      >
                        {agg > 0 ? metric.format(agg) : "—"}
                      </td>
                    ))}
                    <td
                      className="py-3 px-4 text-sm text-right font-bold tabular-nums"
                      style={{ color: metric.color }}
                    >
                      {metric.format(periodAggregate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

