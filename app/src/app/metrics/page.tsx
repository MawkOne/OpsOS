"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  Plus,
  X,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { CustomMetric } from "@/types/custom-metrics";
import Link from "next/link";

interface Metric {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category: "conversion" | "revenue" | "customer" | "marketing" | "product" | "other";
  value: number;
  unit: "percentage" | "currency" | "number" | "ratio";
  target?: number;
  previousValue?: number;
  lastUpdated?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface ConversionMetricRow {
  id: string;
  name: string;
  description: string;
  months: Record<string, number>; // month key -> percentage
  average: number;
  unit: "percentage" | "number" | "currency";
}

type ViewMode = "ttm" | "year" | "all";

const metricCategories = [
  { value: "conversion", label: "Conversion", color: "#00d4aa" },
  { value: "revenue", label: "Revenue", color: "#10b981" },
  { value: "customer", label: "Customer", color: "#3b82f6" },
  { value: "marketing", label: "Marketing", color: "#ec4899" },
  { value: "product", label: "Product", color: "#8b5cf6" },
  { value: "other", label: "Other", color: "#f59e0b" },
];

export default function MetricsPage() {
  const { currentOrg } = useOrganization();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [conversionData, setConversionData] = useState<ConversionMetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const organizationId = currentOrg?.id || "";

  // Generate months based on view mode
  const { months, monthLabels, isAllTime } = useMemo(() => {
    if (viewMode === "all") {
      // All time - generate years from 2018 to current year
      const currentYear = new Date().getFullYear();
      const allYears: string[] = [];
      const allLabels: string[] = [];
      
      for (let year = 2018; year <= currentYear; year++) {
        allYears.push(year.toString());
        allLabels.push(year.toString());
      }
      
      return { months: allYears, monthLabels: allLabels, isAllTime: true };
    } else if (viewMode === "ttm") {
      // Trailing 12 COMPLETE months (excluding current partial month)
      const now = new Date();
      const ttmMonths: string[] = [];
      const ttmLabels: string[] = [];
      
      // Start from 12 months ago, end at LAST month (not current month)
      for (let i = 12; i >= 1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        ttmMonths.push(monthKey);
        ttmLabels.push(label);
      }
      
      return { months: ttmMonths, monthLabels: ttmLabels, isAllTime: false };
    } else {
      // Calendar year
      const yearMonths = Array.from({ length: 12 }, (_, i) => {
        const month = (i + 1).toString().padStart(2, "0");
        return `${selectedYear}-${month}`;
      });
      const yearLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { months: yearMonths, monthLabels: yearLabels, isAllTime: false };
    }
  }, [viewMode, selectedYear]);

  // Function to fetch conversion data
  const fetchConversionData = useCallback(async () => {
    setTableLoading(true);
    try {
      const monthsSet = new Set(months);
      
      // Data structures to hold monthly data
      const monthlyData: Record<string, {
        sessions: number;
        users: number;
        newUsers: number;
        customers: number;
        newCustomers: number;
        subscriptions: number;
        paidSubscriptions: number;
        payments: number;
        revenue: number;
        purchases: number;
      }> = {};

      // Initialize all months
      months.forEach(month => {
        monthlyData[month] = {
          sessions: 0,
          users: 0,
          newUsers: 0,
          customers: 0,
          newCustomers: 0,
          subscriptions: 0,
          paidSubscriptions: 0,
          payments: 0,
          revenue: 0,
          purchases: 0,
        };
      });

      // Fetch Stripe Customers
      const customersQuery = query(
        collection(db, "stripe_customers"),
        where("organizationId", "==", organizationId)
      );
      const customersSnap = await getDocs(customersQuery);
      
      customersSnap.docs.forEach(doc => {
        const customer = doc.data();
        const createdDate = customer.created?.toDate?.() || new Date();
        const periodKey = isAllTime 
          ? createdDate.getFullYear().toString()
          : `${createdDate.getFullYear()}-${(createdDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (monthsSet.has(periodKey)) {
          monthlyData[periodKey].newCustomers++;
        }
      });

      // Cumulative customer count
      let cumulativeCustomers = 0;
      months.forEach(month => {
        cumulativeCustomers += monthlyData[month].newCustomers;
        monthlyData[month].customers = cumulativeCustomers;
      });

      // Fetch Stripe Subscriptions
      const subscriptionsQuery = query(
        collection(db, "stripe_subscriptions"),
        where("organizationId", "==", organizationId)
      );
      const subscriptionsSnap = await getDocs(subscriptionsQuery);
      
      subscriptionsSnap.docs.forEach(doc => {
        const sub = doc.data();
        const createdDate = sub.created?.toDate?.() || new Date();
        const periodKey = isAllTime 
          ? createdDate.getFullYear().toString()
          : `${createdDate.getFullYear()}-${(createdDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (monthsSet.has(periodKey)) {
          monthlyData[periodKey].subscriptions++;
          if (sub.status === 'active' || sub.status === 'trialing') {
            monthlyData[periodKey].paidSubscriptions++;
          }
        }
      });

      // Fetch Stripe Payments
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId)
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      
      paymentsSnap.docs.forEach(doc => {
        const payment = doc.data();
        if (payment.status !== 'succeeded') return;
        
        const createdDate = payment.created?.toDate?.() || new Date();
        const periodKey = isAllTime 
          ? createdDate.getFullYear().toString()
          : `${createdDate.getFullYear()}-${(createdDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (monthsSet.has(periodKey)) {
          monthlyData[periodKey].payments++;
          monthlyData[periodKey].purchases++;
          monthlyData[periodKey].revenue += (payment.amount || 0) / 100;
        }
      });

      // TODO: Fetch Google Analytics data when API is set up
      // For now, we'll use placeholder or estimate from existing data
      
      // Calculate conversion metrics
      const conversionMetrics: ConversionMetricRow[] = [
        {
          id: "visitor-to-customer",
          name: "Visitor → Customer",
          description: "New customers / Total sessions",
          months: {},
          average: 0,
          unit: "percentage",
        },
        {
          id: "session-to-purchase",
          name: "Session → Purchase",
          description: "Purchases / Total sessions",
          months: {},
          average: 0,
          unit: "percentage",
        },
        {
          id: "trial-to-paid",
          name: "Trial → Paid",
          description: "Paid subscriptions / Total subscriptions",
          months: {},
          average: 0,
          unit: "percentage",
        },
        {
          id: "customer-ltv",
          name: "Customer LTV",
          description: "Total revenue / Total customers",
          months: {},
          average: 0,
          unit: "currency",
        },
        {
          id: "avg-order-value",
          name: "Avg Order Value",
          description: "Total revenue / Total purchases",
          months: {},
          average: 0,
          unit: "currency",
        },
        {
          id: "new-customers",
          name: "New Customers",
          description: "New customers acquired this month",
          months: {},
          average: 0,
          unit: "number",
        },
        {
          id: "new-subscriptions",
          name: "New Subscriptions",
          description: "New subscriptions started this month",
          months: {},
          average: 0,
          unit: "number",
        },
        {
          id: "revenue",
          name: "Total Revenue",
          description: "Total revenue from all sources",
          months: {},
          average: 0,
          unit: "currency",
        },
      ];

      // Calculate values for each month
      months.forEach(month => {
        const data = monthlyData[month];
        
        // Visitor to Customer (using sessions as proxy for visitors)
        conversionMetrics[0].months[month] = data.sessions > 0 
          ? (data.newCustomers / data.sessions) * 100 
          : 0;
        
        // Session to Purchase
        conversionMetrics[1].months[month] = data.sessions > 0 
          ? (data.purchases / data.sessions) * 100 
          : 0;
        
        // Trial to Paid
        conversionMetrics[2].months[month] = data.subscriptions > 0 
          ? (data.paidSubscriptions / data.subscriptions) * 100 
          : 0;
        
        // Customer LTV (cumulative)
        conversionMetrics[3].months[month] = data.customers > 0 
          ? data.revenue / data.customers 
          : 0;
        
        // Avg Order Value
        conversionMetrics[4].months[month] = data.purchases > 0 
          ? data.revenue / data.purchases 
          : 0;
        
        // New Customers (count)
        conversionMetrics[5].months[month] = data.newCustomers;
        
        // New Subscriptions (count)
        conversionMetrics[6].months[month] = data.subscriptions;
        
        // Revenue
        conversionMetrics[7].months[month] = data.revenue;
      });

      // Calculate averages
      conversionMetrics.forEach(metric => {
        const values = Object.values(metric.months).filter(v => v > 0);
        metric.average = values.length > 0 
          ? values.reduce((a, b) => a + b, 0) / values.length 
          : 0;
      });

      setConversionData(conversionMetrics);
      setTableLoading(false);
    } catch (error) {
      console.error("Error fetching conversion data:", error);
      setTableLoading(false);
    }
  }, [organizationId, months, isAllTime]);

  // Load metrics from Firestore
  useEffect(() => {
    if (!currentOrg?.id) {
      return;
    }

    const metricsQuery = query(
      collection(db, "metrics"), 
      where("organizationId", "==", currentOrg.id)
    );

    const unsubscribe = onSnapshot(metricsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Metric));
      setMetrics(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Load custom metrics from all sections
  useEffect(() => {
    if (!currentOrg?.id) {
      return;
    }

    const customMetricsQuery = query(
      collection(db, "custom_metrics"),
      where("organizationId", "==", currentOrg.id)
    );

    const unsubscribe = onSnapshot(customMetricsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomMetric));
      setCustomMetrics(data);
    });

    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Load conversion metrics table data
  useEffect(() => {
    if (!organizationId) {
      return;
    }
    
    // Data fetching is a valid use case for async calls in effects
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConversionData();
  }, [organizationId, fetchConversionData]);

  // Filter metrics by category
  const filteredMetrics = filterCategory === "all" 
    ? metrics 
    : metrics.filter(m => m.category === filterCategory);

  // Group metrics by category
  const metricsByCategory = filteredMetrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = [];
    }
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, Metric[]>);

  // Calculate summary stats
  const totalMetrics = metrics.length;
  const metricsOnTarget = metrics.filter(m => 
    m.target && m.value >= m.target
  ).length;
  const metricsImproved = metrics.filter(m => 
    m.previousValue !== undefined && m.value > m.previousValue
  ).length;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this metric?")) return;
    try {
      await deleteDoc(doc(db, "metrics", id));
    } catch (error) {
      console.error("Error deleting metric:", error);
    }
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case "percentage":
        return `${value.toFixed(2)}%`;
      case "currency":
        return `$${value.toLocaleString()}`;
      case "ratio":
        return `${value.toFixed(2)}:1`;
      default:
        return value.toLocaleString();
    }
  };

  const getChangeColor = (metric: Metric) => {
    if (metric.previousValue === undefined) return "var(--foreground-muted)";
    const change = metric.value - metric.previousValue;
    return change > 0 ? "#00d4aa" : change < 0 ? "#ef4444" : "var(--foreground-muted)";
  };

  const getChangeIcon = (metric: Metric) => {
    if (metric.previousValue === undefined) return null;
    const change = metric.value - metric.previousValue;
    return change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : null;
  };

  if (loading) {
    return (
      <AppLayout title="Metrics" subtitle="Track key business metrics">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Loading metrics...
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Metrics" subtitle="Track conversion rates and key performance indicators">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Metrics" 
            value={totalMetrics}
            change={`${metricsByCategory.conversion?.length || 0} conversion`}
            changeType="neutral"
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard 
            label="On Target" 
            value={metricsOnTarget}
            change={`${Math.round((metricsOnTarget / totalMetrics) * 100)}% of metrics`}
            changeType="positive"
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard 
            label="Improved" 
            value={metricsImproved}
            change="vs previous period"
            changeType="positive"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard 
            label="Categories" 
            value={Object.keys(metricsByCategory).length}
            change={`${metricCategories.length} available`}
            changeType="neutral"
            icon={<Percent className="w-5 h-5" />}
          />
        </div>

        {/* Custom Conversion Metrics from All Sections */}
        {customMetrics.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Custom Conversion Metrics
                </h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Custom metrics from Marketing, Revenue, and other sections
                </p>
              </div>
            </div>

            {/* Group by Section */}
            {["marketing", "revenue", "leadership", "custom"].map(section => {
              const sectionMetrics = customMetrics.filter(m => m.section === section);
              if (sectionMetrics.length === 0) return null;

              const sectionColors: Record<string, string> = {
                marketing: "#ec4899",
                revenue: "#10b981",
                leadership: "#8b5cf6",
                custom: "#00d4aa",
              };

              const sectionLabels: Record<string, string> = {
                marketing: "Marketing",
                revenue: "Revenue",
                leadership: "Leadership",
                custom: "Custom",
              };

              return (
                <div key={section}>
                  <h4 
                    className="text-sm font-semibold mb-3 flex items-center gap-2"
                    style={{ color: sectionColors[section] }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ background: sectionColors[section] }}
                    />
                    {sectionLabels[section]}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {sectionMetrics.map((metric, idx) => {
                      const monthlyValues = metric.monthlyValues || {};
                      const values = Object.values(monthlyValues).filter(v => v > 0);
                      const avgValue = values.length > 0
                        ? values.reduce((a, b) => a + b, 0) / values.length
                        : 0;

                      const sectionPath = section === "custom" ? "metrics" : section;

                      return (
                        <motion.div
                          key={metric.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <Link href={`/${sectionPath}/metrics`}>
                            <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer">
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
                                        : metric.numerator.gaMetric}
                                    </span>
                                    <span>/</span>
                                    <span style={{ color: "#3b82f6" }}>
                                      {metric.denominator.metricType === "event"
                                        ? metric.denominator.gaEventName
                                        : metric.denominator.gaMetric}
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
                                    <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                                      No data yet
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Card>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Monthly Conversion Table */}
        <Card>
          <CardHeader
            title="Monthly Conversion Metrics"
            subtitle="Track conversion rates and key metrics over time"
            action={
              <div className="flex items-center gap-3">
              {/* View Mode Selector */}
              <div className="flex rounded-lg p-1" style={{ background: "var(--background-secondary)" }}>
                <button
                  onClick={() => setViewMode("ttm")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: viewMode === "ttm" ? "var(--accent)" : "transparent",
                    color: viewMode === "ttm" ? "#ffffff" : "var(--foreground-muted)",
                  }}
                >
                  TTM
                </button>
                <button
                  onClick={() => setViewMode("year")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: viewMode === "year" ? "var(--accent)" : "transparent",
                    color: viewMode === "year" ? "#ffffff" : "var(--foreground-muted)",
                  }}
                >
                  Year
                </button>
                <button
                  onClick={() => setViewMode("all")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: viewMode === "all" ? "var(--accent)" : "transparent",
                    color: viewMode === "all" ? "#ffffff" : "var(--foreground-muted)",
                  }}
                >
                  All Time
                </button>
              </div>

              {/* Year selector (only for year view) */}
              {viewMode === "year" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedYear(prev => prev - 1)}
                    className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium px-2">{selectedYear}</span>
                  <button
                    onClick={() => setSelectedYear(prev => prev + 1)}
                    disabled={selectedYear >= new Date().getFullYear()}
                    className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              </div>
            }
          />

          <div className="overflow-x-auto">
            {tableLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Loading conversion data...
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left p-3 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                      Metric
                    </th>
                    {monthLabels.map((label, idx) => (
                      <th key={idx} className="text-right p-3 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        {label}
                      </th>
                    ))}
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                      Avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conversionData.map((row, rowIdx) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: rowIdx * 0.05 }}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      className="hover:bg-[var(--background-secondary)] transition-colors"
                    >
                      <td className="p-3">
                        <div>
                          <div className="text-sm font-medium">{row.name}</div>
                          <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                            {row.description}
                          </div>
                        </div>
                      </td>
                      {months.map((month, idx) => {
                        const value = row.months[month] || 0;
                        return (
                          <td key={idx} className="p-3 text-right text-sm font-medium">
                            {value === 0 ? (
                              <span style={{ color: "var(--foreground-muted)" }}>-</span>
                            ) : (
                              formatValue(value, row.unit)
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-right text-sm font-semibold">
                        {row.average === 0 ? (
                          <span style={{ color: "var(--foreground-muted)" }}>-</span>
                        ) : (
                          formatValue(row.average, row.unit)
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Actions & Filters */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            <Plus className="w-4 h-4" />
            New Metric
          </button>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All Categories</option>
            {metricCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Metrics by Category */}
        {Object.keys(metricsByCategory).length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--foreground-muted)" }} />
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                No metrics yet. Track your key performance indicators!
              </p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Your First Metric
              </button>
            </div>
          </Card>
        ) : (
          Object.entries(metricsByCategory).map(([category, categoryMetrics]) => {
            const categoryConfig = metricCategories.find(c => c.value === category);
            return (
              <Card key={category}>
                <CardHeader 
                  title={categoryConfig?.label || category}
                  subtitle={`${categoryMetrics.length} metric${categoryMetrics.length !== 1 ? 's' : ''}`}
                  icon={<Activity className="w-5 h-5" style={{ color: categoryConfig?.color }} />}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryMetrics.map((metric, idx) => (
                    <motion.div
                      key={metric.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-xl group relative"
                      style={{ background: "var(--background-tertiary)" }}
                    >
                      {/* Actions */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => setEditingMetric(metric)}
                          className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)]"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(metric.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)]"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Metric Name */}
                      <h4 className="font-semibold mb-1 pr-12" style={{ color: "var(--foreground)" }}>
                        {metric.name}
                      </h4>
                      {metric.description && (
                        <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
                          {metric.description}
                        </p>
                      )}

                      {/* Value */}
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-2xl font-bold" style={{ color: categoryConfig?.color }}>
                          {formatValue(metric.value, metric.unit)}
                        </span>
                        {getChangeIcon(metric) && (
                          <span className="flex items-center gap-1 text-sm" style={{ color: getChangeColor(metric) }}>
                            {getChangeIcon(metric)}
                            {metric.previousValue !== undefined && (
                              <span>{Math.abs(metric.value - metric.previousValue).toFixed(1)}</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Target */}
                      {metric.target !== undefined && (
                        <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          Target: {formatValue(metric.target, metric.unit)}
                          {metric.value >= metric.target && (
                            <span className="ml-2" style={{ color: "#00d4aa" }}>✓ On track</span>
                          )}
                        </div>
                      )}

                      {/* Last Updated */}
                      {metric.lastUpdated && (
                        <div className="text-xs mt-2 pt-2 border-t" style={{ 
                          color: "var(--foreground-muted)", 
                          borderColor: "var(--border)" 
                        }}>
                          Updated {metric.lastUpdated.toDate().toLocaleDateString()}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingMetric) && (
        <MetricModal
          metric={editingMetric}
          onClose={() => {
            setShowAddModal(false);
            setEditingMetric(null);
          }}
          organizationId={currentOrg?.id || ""}
        />
      )}
    </AppLayout>
  );
}

// Metric Modal Component
function MetricModal({ 
  metric, 
  onClose, 
  organizationId 
}: { 
  metric: Metric | null;
  onClose: () => void; 
  organizationId: string;
}) {
  const [formData, setFormData] = useState({
    name: metric?.name || "",
    description: metric?.description || "",
    category: metric?.category || "conversion" as "conversion" | "revenue" | "customer" | "marketing" | "product" | "other",
    value: metric?.value || 0,
    unit: metric?.unit || "percentage" as "percentage" | "currency" | "number" | "ratio",
    target: metric?.target || undefined,
    previousValue: metric?.previousValue || undefined,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      if (metric) {
        // Update existing metric
        await updateDoc(doc(db, "metrics", metric.id), {
          ...formData,
          lastUpdated: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new metric
        await addDoc(collection(db, "metrics"), {
          ...formData,
          organizationId,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving metric:", error);
      alert("Failed to save metric");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--background)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            {metric ? "Edit Metric" : "New Metric"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--background-secondary)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Metric Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="e.g. Checkout Conversion Rate"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="Brief description of what this metric tracks..."
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as Metric["category"] })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                {metricCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value as Metric["unit"] })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="currency">Currency ($)</option>
                <option value="number">Number</option>
                <option value="ratio">Ratio (X:1)</option>
              </select>
            </div>
          </div>

          {/* Current Value & Target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Current Value *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Target (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.target || ""}
                onChange={(e) => setFormData({ ...formData, target: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>

          {/* Previous Value (for comparison) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Previous Value (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.previousValue || ""}
              onChange={(e) => setFormData({ ...formData, previousValue: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="For trend comparison..."
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting || !formData.name.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              {submitting ? "Saving..." : metric ? "Update Metric" : "Create Metric"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg font-medium"
              style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

