"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Percent,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

type ViewMode = "ttm" | "year";

interface MetricCard {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  unit: "currency" | "percentage" | "number";
  trend: "up" | "down" | "neutral";
  description: string;
}

export default function MarketingMetricsPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [metrics, setMetrics] = useState<MetricCard[]>([]);

  const organizationId = currentOrg?.id || "";

  // Generate period label
  const periodLabel = useMemo(() => {
    if (viewMode === "ttm") {
      return "Last 12 Months";
    } else {
      return `${selectedYear}`;
    }
  }, [viewMode, selectedYear]);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    // TODO: Fetch real metrics from your data sources
    // For now, using placeholder data
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Placeholder metrics
        const placeholderMetrics: MetricCard[] = [
          {
            id: "cac",
            name: "Customer Acquisition Cost (CAC)",
            value: 125,
            previousValue: 145,
            unit: "currency",
            trend: "down",
            description: "Average cost to acquire a new customer",
          },
          {
            id: "ltv",
            name: "Customer Lifetime Value (LTV)",
            value: 1850,
            previousValue: 1620,
            unit: "currency",
            trend: "up",
            description: "Average revenue per customer over their lifetime",
          },
          {
            id: "ltv-cac-ratio",
            name: "LTV:CAC Ratio",
            value: 14.8,
            previousValue: 11.2,
            unit: "number",
            trend: "up",
            description: "Ratio of lifetime value to acquisition cost",
          },
          {
            id: "conversion-rate",
            name: "Conversion Rate",
            value: 3.2,
            previousValue: 2.8,
            unit: "percentage",
            trend: "up",
            description: "Percentage of visitors who convert to customers",
          },
          {
            id: "roas",
            name: "Return on Ad Spend (ROAS)",
            value: 4.5,
            previousValue: 3.8,
            unit: "number",
            trend: "up",
            description: "Revenue generated per dollar spent on advertising",
          },
          {
            id: "ctr",
            name: "Click-Through Rate (CTR)",
            value: 2.4,
            previousValue: 2.1,
            unit: "percentage",
            trend: "up",
            description: "Percentage of impressions that result in clicks",
          },
          {
            id: "bounce-rate",
            name: "Bounce Rate",
            value: 42,
            previousValue: 48,
            unit: "percentage",
            trend: "down",
            description: "Percentage of visitors who leave after one page",
          },
          {
            id: "avg-session",
            name: "Avg. Session Duration",
            value: 3.5,
            previousValue: 3.1,
            unit: "number",
            trend: "up",
            description: "Average time visitors spend on site (minutes)",
          },
          {
            id: "email-open-rate",
            name: "Email Open Rate",
            value: 24.5,
            previousValue: 22.3,
            unit: "percentage",
            trend: "up",
            description: "Percentage of emails opened",
          },
          {
            id: "email-ctr",
            name: "Email Click Rate",
            value: 3.8,
            previousValue: 3.2,
            unit: "percentage",
            trend: "up",
            description: "Percentage of emails with clicks",
          },
          {
            id: "mqls",
            name: "Marketing Qualified Leads (MQLs)",
            value: 287,
            previousValue: 245,
            unit: "number",
            trend: "up",
            description: "Number of qualified leads from marketing",
          },
          {
            id: "mql-sql-rate",
            name: "MQL to SQL Rate",
            value: 35,
            previousValue: 32,
            unit: "percentage",
            trend: "up",
            description: "Percentage of MQLs that become sales qualified",
          },
        ];

        setMetrics(placeholderMetrics);
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [organizationId, viewMode, selectedYear]);

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case "currency":
        return `$${value.toLocaleString()}`;
      case "percentage":
        return `${value.toFixed(1)}%`;
      case "number":
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getChangeColor = (trend: string) => {
    switch (trend) {
      case "up":
        return "#10b981";
      case "down":
        return "#ef4444";
      default:
        return "var(--foreground-muted)";
    }
  };

  const getChangeIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4" />;
      case "down":
        return <TrendingDown className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Group metrics by category
  const metricsByCategory = useMemo(() => {
    return {
      "Customer & Revenue": metrics.filter(m => ["cac", "ltv", "ltv-cac-ratio", "conversion-rate"].includes(m.id)),
      "Advertising": metrics.filter(m => ["roas", "ctr"].includes(m.id)),
      "Website": metrics.filter(m => ["bounce-rate", "avg-session"].includes(m.id)),
      "Email Marketing": metrics.filter(m => ["email-open-rate", "email-ctr"].includes(m.id)),
      "Lead Generation": metrics.filter(m => ["mqls", "mql-sql-rate"].includes(m.id)),
    };
  }, [metrics]);

  return (
    <AppLayout title="Marketing Metrics" subtitle="Track key marketing performance indicators">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Controls */}
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

              <div className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                {periodLabel}
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Metrics by Category */}
            {Object.entries(metricsByCategory).map(([category, categoryMetrics]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  {category}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categoryMetrics.map((metric, idx) => {
                    const change = calculateChange(metric.value, metric.previousValue);
                    const changeColor = getChangeColor(metric.trend);
                    
                    return (
                      <motion.div
                        key={metric.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card>
                          <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                                {metric.name}
                              </span>
                              <div style={{ color: changeColor }}>
                                {getChangeIcon(metric.trend)}
                              </div>
                            </div>
                            
                            {/* Value */}
                            <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                              {formatValue(metric.value, metric.unit)}
                            </div>
                            
                            {/* Change */}
                            <div className="flex items-center gap-2 text-xs">
                              <span style={{ color: changeColor }} className="font-medium">
                                {change > 0 ? "+" : ""}{change.toFixed(1)}%
                              </span>
                              <span style={{ color: "var(--foreground-muted)" }}>
                                vs previous period
                              </span>
                            </div>
                            
                            {/* Description */}
                            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                              {metric.description}
                            </p>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Coming Soon Notice */}
            <Card>
              <div className="text-center py-6">
                <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent)" }} />
                <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Real-Time Metrics Coming Soon
                </h4>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  These metrics will be calculated automatically from your connected data sources (Google Analytics, Stripe, ActiveCampaign).
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

