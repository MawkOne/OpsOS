"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  DollarSign,
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
  Megaphone,
  BarChart3,
  Percent,
  ShoppingCart,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface CampaignData {
  id: string;
  name: string;
  months: Record<string, CampaignMetrics>;
}

interface CampaignMetrics {
  clicks: number;
  impressions: number;
  spend: number;
  cpc: number;
  sessions: number;
  conversions: number;
  revenue: number;
  ctr: number;
  conversionRate: number;
  roas: number;
  newUsers?: number;
  engagedSessions?: number;
}

type ViewMode = "ttm" | "year";
type MetricType = "spend" | "clicks" | "impressions" | "conversions" | "revenue" | "ctr" | "cpc" | "conversionRate" | "roas" | "sessions";

const metricConfig: Record<MetricType, { label: string; format: (v: number) => string; color: string; aggregate: "sum" | "avg" }> = {
  spend: { label: "Spend", format: (v) => formatCurrency(v), color: "#ef4444", aggregate: "sum" },
  clicks: { label: "Clicks", format: (v) => formatNumber(v), color: "#3b82f6", aggregate: "sum" },
  impressions: { label: "Impressions", format: (v) => formatNumber(v), color: "#8b5cf6", aggregate: "sum" },
  sessions: { label: "Sessions", format: (v) => formatNumber(v), color: "#06b6d4", aggregate: "sum" },
  conversions: { label: "Conversions", format: (v) => formatNumber(v), color: "#10b981", aggregate: "sum" },
  revenue: { label: "Revenue", format: (v) => formatCurrency(v), color: "#22c55e", aggregate: "sum" },
  ctr: { label: "CTR", format: (v) => `${v.toFixed(2)}%`, color: "#f59e0b", aggregate: "avg" },
  cpc: { label: "CPC", format: (v) => `$${v.toFixed(2)}`, color: "#ec4899", aggregate: "avg" },
  conversionRate: { label: "Conv. Rate", format: (v) => `${v.toFixed(2)}%`, color: "#84cc16", aggregate: "avg" },
  roas: { label: "ROAS", format: (v) => `${v.toFixed(2)}x`, color: "#14b8a6", aggregate: "avg" },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AdsPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [campaignData, setCampaignData] = useState<CampaignData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("spend");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch campaign data
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
          setCampaignData([]);
          setLoading(false);
          return;
        }

        setIsConnected(true);

        const response = await fetch(
          `/api/google-analytics/ads?organizationId=${organizationId}&viewMode=${viewMode}&year=${selectedYear}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch ads data");
        }

        const data = await response.json();
        setCampaignData(data.campaigns || []);
      } catch (err) {
        console.error("Error fetching ads data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch ads data");
        setCampaignData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, viewMode, selectedYear]);

  // Get value for a campaign and month
  const getValue = (campaign: CampaignData, month: string): number => {
    const metrics = campaign.months[month];
    if (!metrics) return 0;
    return metrics[selectedMetric] || 0;
  };

  // Calculate row aggregate
  const getRowAggregate = (campaign: CampaignData): number => {
    const values = months.map(month => getValue(campaign, month)).filter(v => v > 0);
    if (values.length === 0) return 0;
    
    const config = metricConfig[selectedMetric];
    if (config.aggregate === "avg") {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    return values.reduce((sum, v) => sum + v, 0);
  };

  // Calculate monthly aggregates
  const monthlyAggregates = useMemo(() => {
    return months.map((month) => {
      const values = campaignData
        .map(campaign => campaign.months[month]?.[selectedMetric] || 0)
        .filter(v => v > 0);
      
      if (values.length === 0) return 0;
      
      const config = metricConfig[selectedMetric];
      if (config.aggregate === "avg") {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      }
      return values.reduce((sum, v) => sum + v, 0);
    });
  }, [campaignData, months, selectedMetric]);

  // Calculate period aggregate
  const periodAggregate = useMemo(() => {
    const values = monthlyAggregates.filter(v => v > 0);
    if (values.length === 0) return 0;
    
    const config = metricConfig[selectedMetric];
    if (config.aggregate === "avg") {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    return values.reduce((sum, v) => sum + v, 0);
  }, [monthlyAggregates, selectedMetric]);

  // Filter and sort data - exclude campaigns with no data for selected metric
  const sortedData = useMemo(() => {
    return [...campaignData]
      .filter((campaign) => {
        // Filter out campaigns with zero value for the selected metric
        const totalForMetric = months.reduce((sum, month) => {
          const metrics = campaign.months[month];
          if (!metrics) return sum;
          return sum + (metrics[selectedMetric] || 0);
        }, 0);
        return totalForMetric > 0;
      })
      .sort((a, b) => {
        const aggA = getRowAggregate(a);
        const aggB = getRowAggregate(b);
        return aggB - aggA;
      });
  }, [campaignData, months, selectedMetric]);

  const metric = metricConfig[selectedMetric];

  // Calculate totals for summary cards
  const totalSpend = useMemo(() => {
    return campaignData.reduce((sum, campaign) => {
      return sum + months.reduce((mSum, month) => mSum + (campaign.months[month]?.spend || 0), 0);
    }, 0);
  }, [campaignData, months]);

  const totalConversions = useMemo(() => {
    return campaignData.reduce((sum, campaign) => {
      return sum + months.reduce((mSum, month) => mSum + (campaign.months[month]?.conversions || 0), 0);
    }, 0);
  }, [campaignData, months]);

  const totalRevenue = useMemo(() => {
    return campaignData.reduce((sum, campaign) => {
      return sum + months.reduce((mSum, month) => mSum + (campaign.months[month]?.revenue || 0), 0);
    }, 0);
  }, [campaignData, months]);

  const overallROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <AppLayout title="Advertising" subtitle="Campaign performance by month">
      <div className="max-w-full mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {viewMode === "ttm" ? "TTM" : selectedYear} Ad Spend
              </span>
              <DollarSign className="w-4 h-4" style={{ color: "#ef4444" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
              {formatCurrency(totalSpend)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversions</span>
              <Target className="w-4 h-4" style={{ color: "#10b981" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {formatNumber(totalConversions)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Revenue</span>
              <ShoppingCart className="w-4 h-4" style={{ color: "#22c55e" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>
              {formatCurrency(totalRevenue)}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>ROAS</span>
              {overallROAS >= 1 ? (
                <TrendingUp className="w-4 h-4" style={{ color: "#14b8a6" }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: "#f59e0b" }} />
              )}
            </div>
            <p className="text-2xl font-bold" style={{ color: overallROAS >= 1 ? "#14b8a6" : "#f59e0b" }}>
              {overallROAS.toFixed(2)}x
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
                  <option value="spend">Ad Spend</option>
                  <option value="clicks">Clicks</option>
                  <option value="impressions">Impressions</option>
                  <option value="sessions">Sessions</option>
                  <option value="conversions">Conversions</option>
                  <option value="revenue">Revenue</option>
                  <option value="ctr">CTR</option>
                  <option value="cpc">CPC</option>
                  <option value="conversionRate">Conv. Rate</option>
                  <option value="roas">ROAS</option>
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

        {/* Campaigns Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : !isConnected ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Connect Google Analytics
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Connect your Google Analytics account to see advertising data.
              </p>
              <a
                href="/sources/google-analytics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#F9AB00", color: "#1a1a1a" }}
              >
                <Activity className="w-4 h-4" />
                Connect Google Analytics
              </a>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 mx-auto mb-4" style={{ color: "#ef4444" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Error Loading Data
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                {error}
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--foreground-subtle)" }}>
                Make sure Google Ads is linked to your GA4 property.
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
              <Megaphone className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                No Campaign Data
              </h3>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                No advertising campaign data found. Make sure you have campaigns running and Google Ads is linked to GA4.
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
                      Campaign
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
                      {metric.aggregate === "avg" ? "Avg" : "Total"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((campaign, idx) => {
                    const rowAggregate = getRowAggregate(campaign);
                    return (
                      <motion.tr
                        key={campaign.id}
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
                              style={{ background: "#ec489920", color: "#ec4899" }}
                            >
                              <Megaphone className="w-4 h-4" />
                            </div>
                            <span className="truncate max-w-[200px]" title={campaign.name}>
                              {campaign.name}
                            </span>
                          </div>
                        </td>
                        {months.map((month) => {
                          const value = getValue(campaign, month);
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
                      {metric.aggregate === "avg" ? "Average" : "Total"}
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

        {/* Info Note */}
        {isConnected && sortedData.length > 0 && (
          <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            <p>
              <strong>Note:</strong> This data is pulled from Google Analytics 4. For complete Google Ads data including 
              ad groups, keywords, and ad copy performance, link Google Ads directly in your GA4 property settings.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

