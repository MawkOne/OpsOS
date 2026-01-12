"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Divide,
  RefreshCw,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { CustomMetric } from "@/types/custom-metrics";
import MetricBuilderModal from "@/components/MetricBuilderModal";

type ViewMode = "ttm" | "year";

export default function MarketingMetricsPage() {
  const { currentOrg } = useOrganization();
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [showMetricBuilder, setShowMetricBuilder] = useState(false);
  const [calculatingMetric, setCalculatingMetric] = useState<string | null>(null);

  const organizationId = currentOrg?.id || "";

  // Generate period label
  const periodLabel = useMemo(() => {
    if (viewMode === "ttm") {
      return "Last 12 Months";
    } else {
      return `${selectedYear}`;
    }
  }, [viewMode, selectedYear]);

  // Calculate months for table headers
  const months = useMemo(() => {
    const now = new Date();
    const result: string[] = [];
    
    if (viewMode === "ttm") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`);
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const monthDate = new Date(selectedYear, m, 1);
        if (monthDate <= now) {
          result.push(`${selectedYear}-${(m + 1).toString().padStart(2, "0")}`);
        }
      }
    }
    
    return result;
  }, [viewMode, selectedYear]);

  // Calculate month labels
  const monthLabels = useMemo(() => {
    return months.map(month => {
      const [year, monthNum] = month.split("-");
      const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      return date.toLocaleDateString("en-US", { month: "short" });
    });
  }, [months]);

  // Fetch custom metrics from Firestore
  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const metricsQuery = query(
      collection(db, "custom_metrics"),
      where("organizationId", "==", organizationId),
      where("section", "==", "marketing")
    );

    const unsubscribe = onSnapshot(metricsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomMetric));
      setCustomMetrics(data);
    });

    return () => unsubscribe();
  }, [organizationId]);

  // Calculate metric values
  const handleCalculateMetric = async (metricId: string) => {
    setCalculatingMetric(metricId);
    try {
      const response = await fetch("/api/custom-metrics/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricId,
          organizationId,
          viewMode,
          year: selectedYear,
        }),
      });

      if (!response.ok) {
        console.error("Failed to calculate metric");
      }
    } catch (error) {
      console.error("Error calculating metric:", error);
    } finally {
      setCalculatingMetric(null);
    }
  };



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

        {/* Monthly Metrics Table */}
        {customMetrics.length > 0 && (
          <Card>
            <CardHeader
              title="Monthly Conversion Rates"
              subtitle="Track your custom metrics over time"
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold sticky left-0"
                      style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}
                    >
                      Metric Name
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
                      Average
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customMetrics.map((metric, idx) => {
                    const monthlyValues = metric.monthlyValues || {};
                    const values = months.map(m => monthlyValues[m] || 0);
                    const avgValue = values.filter(v => v > 0).length > 0
                      ? values.filter(v => v > 0).reduce((a, b) => a + b, 0) / values.filter(v => v > 0).length
                      : 0;

                    return (
                      <motion.tr
                        key={metric.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        className="hover:bg-[var(--background-tertiary)] transition-colors"
                      >
                        <td 
                          className="py-3 px-4 text-sm font-medium sticky left-0"
                          style={{ color: "var(--foreground)", background: "inherit" }}
                        >
                          <div>
                            <div className="font-semibold">{metric.name}</div>
                            {metric.description && (
                              <div className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                                {metric.description}
                              </div>
                            )}
                          </div>
                        </td>
                        {months.map(month => {
                          const value = monthlyValues[month] || 0;
                          return (
                            <td 
                              key={month}
                              className="py-3 px-3 text-sm text-right tabular-nums"
                              style={{ color: value > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}
                            >
                              {value > 0 ? `${value.toFixed(2)}%` : "—"}
                            </td>
                          );
                        })}
                        <td 
                          className="py-3 px-4 text-sm text-right font-bold tabular-nums"
                          style={{ color: "var(--accent)" }}
                        >
                          {avgValue > 0 ? `${avgValue.toFixed(2)}%` : "—"}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Custom Conversion Metrics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Custom Conversion Metrics
            </h3>
            <button
              onClick={() => setShowMetricBuilder(true)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all"
              style={{
                background: "var(--accent)",
                color: "#ffffff",
              }}
            >
              <Plus className="w-4 h-4" />
              New Metric
            </button>
          </div>

          {customMetrics.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Divide className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} />
                <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  No Custom Metrics Yet
                </h4>
                <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                  Create your first conversion metric to track performance
                </p>
                <button
                  onClick={() => setShowMetricBuilder(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--background-secondary)",
                    color: "var(--accent)",
                  }}
                >
                  Create Metric
                </button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customMetrics.map((metric, idx) => {
                const monthlyValues = metric.monthlyValues || {};
                const values = Object.values(monthlyValues).filter(v => v > 0);
                const avgValue = values.length > 0
                  ? values.reduce((a, b) => a + b, 0) / values.length
                  : 0;

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
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                              {metric.name}
                            </h4>
                            {metric.description && (
                              <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                                {metric.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleCalculateMetric(metric.id)}
                            disabled={calculatingMetric === metric.id}
                            className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] transition-colors disabled:opacity-50"
                            title="Recalculate"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${calculatingMetric === metric.id ? "animate-spin" : ""}`}
                              style={{ color: "var(--accent)" }}
                            />
                          </button>
                        </div>

                        {/* Formula Preview */}
                        <div
                          className="p-2 rounded text-xs"
                          style={{
                            background: "var(--background-tertiary)",
                            color: "var(--foreground-muted)",
                          }}
                        >
                          <div className="flex items-center gap-2 justify-center">
                            <span style={{ color: "#10b981" }}>
                              {metric.numerator.metricType === "event"
                                ? metric.numerator.gaEventName
                                : (metric.numerator.source === "advertising" ? metric.numerator.adMetric : metric.numerator.gaMetric)}
                            </span>
                            <span>/</span>
                            <span style={{ color: "#3b82f6" }}>
                              {metric.denominator.metricType === "event"
                                ? metric.denominator.gaEventName
                                : (metric.denominator.source === "advertising" ? metric.denominator.adMetric : metric.denominator.gaMetric)}
                            </span>
                          </div>
                        </div>

                        {/* Value */}
                        {avgValue > 0 ? (
                          <>
                            <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
                              {avgValue.toFixed(2)}%
                            </div>
                            <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                              Average conversion rate
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <button
                              onClick={() => handleCalculateMetric(metric.id)}
                              disabled={calculatingMetric === metric.id}
                              className="text-xs text-accent hover:underline disabled:opacity-50"
                              style={{ color: "var(--accent)" }}
                            >
                              {calculatingMetric === metric.id ? "Calculating..." : "Calculate Values"}
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>


        {/* Metric Builder Modal */}
        {showMetricBuilder && (
          <MetricBuilderModal
            organizationId={organizationId}
            section="marketing"
            onClose={() => setShowMetricBuilder(false)}
            onSave={(metric) => {
              // Automatically calculate the new metric
              handleCalculateMetric(metric.id);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

