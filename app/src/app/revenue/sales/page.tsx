"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Receipt,
  Package,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface RevenueRow {
  productId: string;
  productName: string;
  source: "stripe" | "quickbooks" | "square" | "manual";
  months: Record<string, number>; // "2026-01": 1500
  total: number;
}

interface MonthlyTotal {
  month: string;
  total: number;
  bySource: Record<string, number>;
}

type ViewMode = "ttm" | "year";

type GroupBy = "type" | "plan";

interface TypedRevenueRow {
  id: string;
  name: string;
  type: "subscription" | "one_time" | "invoice";
  months: Record<string, number>;
  total: number;
}

export default function SalesPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueRow[]>([]);
  const [typedData, setTypedData] = useState<TypedRevenueRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [groupBy, setGroupBy] = useState<GroupBy>("type"); // "type" or "plan"
  const [planFilter, setPlanFilter] = useState<string>("all"); // Filter for specific plan
  
  const organizationId = currentOrg?.id || "";

  // Generate months based on view mode
  const { months, monthLabels } = useMemo(() => {
    if (viewMode === "ttm") {
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
      
      return { months: ttmMonths, monthLabels: ttmLabels };
    } else {
      // Calendar year
      const yearMonths = Array.from({ length: 12 }, (_, i) => {
        const month = (i + 1).toString().padStart(2, "0");
        return `${selectedYear}-${month}`;
      });
      const yearLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { months: yearMonths, monthLabels: yearLabels };
    }
  }, [viewMode, selectedYear]);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    
    fetchRevenueData();
  }, [organizationId, viewMode, selectedYear]);

  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      const rows: RevenueRow[] = [];
      const monthsSet = new Set(months);
      
      // Typed revenue aggregation
      const typeRevenue: Record<string, TypedRevenueRow> = {
        subscription: { id: "subscription", name: "Subscriptions", type: "subscription", months: {}, total: 0 },
        one_time: { id: "one_time", name: "One-Time", type: "one_time", months: {}, total: 0 },
        invoice: { id: "invoice", name: "Invoices", type: "invoice", months: {}, total: 0 },
      };
      
      // Fetch products as name lookup (productId -> productName)
      const productsQuery = query(
        collection(db, "stripe_products"),
        where("organizationId", "==", organizationId)
      );
      const productsSnap = await getDocs(productsQuery);
      const products = new Map<string, string>();
      productsSnap.docs.forEach(doc => {
        const data = doc.data();
        products.set(data.stripeId, data.name);
      });
      
      // Fetch prices for priceId -> productId lookup
      const pricesQuery = query(
        collection(db, "stripe_prices"),
        where("organizationId", "==", organizationId)
      );
      const pricesSnap = await getDocs(pricesQuery);
      const prices = new Map<string, { productId: string; productName: string | null }>();
      pricesSnap.docs.forEach(doc => {
        const data = doc.data();
        prices.set(data.stripeId, {
          productId: data.productId,
          productName: data.productName || products.get(data.productId) || null,
        });
      });

      // Aggregate by product and month
      const productRevenue = new Map<string, RevenueRow>();

      // PRIMARY: Use stripe_invoices (most Stripe accounts use invoicing for subscriptions)
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      invoicesSnap.docs.forEach(doc => {
        const invoice = doc.data();
        
        // Only count paid invoices
        if (invoice.status !== 'paid') return;
        
        const invoiceDate = invoice.created?.toDate?.() || new Date();
        const monthKey = `${invoiceDate.getFullYear()}-${(invoiceDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (!monthsSet.has(monthKey)) return;
        
        // Determine type: has subscriptionId = subscription, otherwise one-time
        const hasSubscription = !!invoice.subscriptionId;
        // Also check if description mentions subscription patterns
        const lineItems = invoice.lineItems || [];
        const looksLikeSubscription = lineItems.some((item: any) => 
          item.description && (item.description.includes('/ month') || item.description.includes('/ year'))
        );
        const revenueType = (hasSubscription || looksLikeSubscription) ? "subscription" : "one_time";
        
        if (lineItems.length > 0) {
          // Use line items for product attribution
          lineItems.forEach((item: any) => {
            // Start with synced productName if available
            let productName = item.productName || item.description || "Unknown Product";
            let productId = item.productId || "unknown";
            
            // Try lookup chain: productId -> products, priceId -> prices -> products
            if (item.productId && products.has(item.productId)) {
              productName = products.get(item.productId)!;
            } else if (item.priceId && prices.has(item.priceId)) {
              const priceInfo = prices.get(item.priceId)!;
              productId = priceInfo.productId || productId;
              productName = priceInfo.productName || products.get(priceInfo.productId) || productName;
            }
            
            // Fallback: Extract product name from description like "1 × Agency (at $50.00 / month)"
            if ((productName === item.description || productName === "Unknown Product") && item.description) {
              const match = item.description.match(/^\d+\s*×\s*(.+?)\s*\(at/);
              if (match) {
                productName = match[1].trim();
                productId = productName.toLowerCase().replace(/\s+/g, '-');
              }
            }
            
            const amount = (item.amount || 0) / 100;
            
            // Add to type totals
            typeRevenue[revenueType].months[monthKey] = (typeRevenue[revenueType].months[monthKey] || 0) + amount;
            typeRevenue[revenueType].total += amount;
            
            // Add to product totals
            if (!productRevenue.has(productId)) {
              productRevenue.set(productId, {
                productId,
                productName,
                source: "stripe",
                months: {},
                total: 0,
              });
            }
            
            const row = productRevenue.get(productId)!;
            row.months[monthKey] = (row.months[monthKey] || 0) + amount;
            row.total += amount;
          });
        } else {
          // No line items - use invoice amount directly
          const amount = (invoice.amount || 0) / 100;
          
          // Add to type totals
          typeRevenue[revenueType].months[monthKey] = (typeRevenue[revenueType].months[monthKey] || 0) + amount;
          typeRevenue[revenueType].total += amount;
          
          // Add to product totals
          const productId = "stripe-other";
          const productName = "Other Stripe Revenue";
          
          if (!productRevenue.has(productId)) {
            productRevenue.set(productId, {
              productId,
              productName,
              source: "stripe",
              months: {},
              total: 0,
            });
          }
          
          const row = productRevenue.get(productId)!;
          row.months[monthKey] = (row.months[monthKey] || 0) + amount;
          row.total += amount;
        }
      });
      
      // SECONDARY: Also check stripe_payments for direct charges (if any)
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded")
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      
      paymentsSnap.docs.forEach(doc => {
        const payment = doc.data();
        // Skip if this payment has an invoice (already counted above)
        if (payment.invoiceId) return;
        
        const paymentDate = payment.created?.toDate?.() || new Date();
        const monthKey = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (!monthsSet.has(monthKey)) return;
        
        const amount = (payment.amount || 0) / 100;
        
        // Direct charges without invoices = one-time
        typeRevenue.one_time.months[monthKey] = (typeRevenue.one_time.months[monthKey] || 0) + amount;
        typeRevenue.one_time.total += amount;
        
        const productId = payment.description || "stripe-other";
        const productName = payment.description || "One-time Payment";
        
        if (!productRevenue.has(productId)) {
          productRevenue.set(productId, {
            productId,
            productName,
            source: "stripe",
            months: {},
            total: 0,
          });
        }
        
        const row = productRevenue.get(productId)!;
        row.months[monthKey] = (row.months[monthKey] || 0) + amount;
        row.total += amount;
      });

      // Fetch QuickBooks invoices (manual invoices)
      const qbInvoicesQuery = query(
        collection(db, "quickbooks_invoices"),
        where("organizationId", "==", organizationId)
      );
      const qbInvoicesSnap = await getDocs(qbInvoicesQuery);
      
      qbInvoicesSnap.docs.forEach(doc => {
        const invoice = doc.data();
        const invoiceDate = invoice.txnDate?.toDate?.() || invoice.created?.toDate?.() || new Date();
        const monthKey = `${invoiceDate.getFullYear()}-${(invoiceDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (!monthsSet.has(monthKey)) return;
        
        const amount = invoice.totalAmt || invoice.amount || 0;
        
        // Add to invoice type (QuickBooks = manual invoices)
        typeRevenue.invoice.months[monthKey] = (typeRevenue.invoice.months[monthKey] || 0) + amount;
        typeRevenue.invoice.total += amount;
        
        // Add to product totals
        const productId = `qb-${invoice.customerRef?.name || "invoice"}`;
        const productName = invoice.customerRef?.name || "QuickBooks Invoice";
        
        if (!productRevenue.has(productId)) {
          productRevenue.set(productId, {
            productId,
            productName,
            source: "quickbooks",
            months: {},
            total: 0,
          });
        }
        
        const row = productRevenue.get(productId)!;
        row.months[monthKey] = (row.months[monthKey] || 0) + amount;
        row.total += amount;
      });

      // Convert maps to arrays and sort
      rows.push(...Array.from(productRevenue.values()));
      rows.sort((a, b) => b.total - a.total);
      
      // Filter out zero-total type rows
      const typedRows = Object.values(typeRevenue).filter(r => r.total > 0);
      
      setRevenueData(rows);
      setTypedData(typedRows);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter plans by selection
  const filteredPlanData = useMemo(() => {
    if (planFilter === "all") return revenueData;
    return revenueData.filter(row => row.productId === planFilter);
  }, [revenueData, planFilter]);

  // Get display data based on groupBy mode
  const displayData = useMemo(() => {
    if (groupBy === "type") {
      return typedData;
    } else {
      return filteredPlanData;
    }
  }, [groupBy, typedData, filteredPlanData]);

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: MonthlyTotal[] = months.map(month => ({
      month,
      total: 0,
      bySource: {},
    }));
    
    // Always use full revenue data for totals
    revenueData.forEach(row => {
      months.forEach((month, idx) => {
        const amount = row.months[month] || 0;
        totals[idx].total += amount;
        totals[idx].bySource[row.source] = (totals[idx].bySource[row.source] || 0) + amount;
      });
    });
    
    return totals;
  }, [revenueData, months]);

  // Calculate period total (TTM or year)
  const periodTotal = useMemo(() => {
    return revenueData.reduce((sum, row) => sum + row.total, 0);
  }, [revenueData]);

  // Calculate YoY growth (placeholder - would need previous year data)
  const yoyGrowth = 0; // TODO: Calculate when historical data available

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "stripe":
        return <CreditCard className="w-4 h-4" style={{ color: "#635BFF" }} />;
      case "quickbooks":
        return <Receipt className="w-4 h-4" style={{ color: "#2CA01C" }} />;
      case "square":
        return <Package className="w-4 h-4" style={{ color: "#006AFF" }} />;
      default:
        return <DollarSign className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "stripe": return "#635BFF";
      case "quickbooks": return "#2CA01C";
      case "square": return "#006AFF";
      default: return "var(--foreground-muted)";
    }
  };

  return (
    <AppLayout title="Sales" subtitle="Monthly revenue breakdown by product and source">
      <div className="max-w-full mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {viewMode === "ttm" ? "TTM Revenue" : `${selectedYear} Revenue`}
              </span>
              <DollarSign className="w-4 h-4" style={{ color: "#10b981" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {formatCurrency(periodTotal)}
            </p>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Products</span>
              <Package className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
              {revenueData.length}
            </p>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Monthly</span>
              <TrendingUp className="w-4 h-4" style={{ color: "#8b5cf6" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
              {formatCurrency(periodTotal / 12)}
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
              {yoyGrowth >= 0 ? "+" : ""}{yoyGrowth}%
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

              {/* Year Selector (only show when in year mode) */}
              {viewMode === "year" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--background-tertiary)]"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold min-w-[60px] text-center" style={{ color: "var(--foreground)" }}>
                    {selectedYear}
                  </span>
                  <button
                    onClick={() => setSelectedYear(y => y + 1)}
                    disabled={selectedYear >= new Date().getFullYear()}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--background-tertiary)] disabled:opacity-30"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Group By Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={groupBy}
                  onChange={(e) => {
                    setGroupBy(e.target.value as GroupBy);
                    setPlanFilter("all"); // Reset plan filter when changing view
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="type">By Type</option>
                  <option value="plan">By Plan</option>
                </select>
              </div>

              {/* Plan Filter (only show when grouped by plan) */}
              {groupBy === "plan" && (
                <div className="flex items-center gap-2">
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-sm min-w-[200px]"
                    style={{
                      background: "var(--background-tertiary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="all">All Plans</option>
                    {revenueData.map(row => (
                      <option key={row.productId} value={row.productId}>
                        {row.productName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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

        {/* Revenue Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : displayData.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                No Revenue Data
              </h3>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Connect a revenue source and sync data to see your sales breakdown.
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
                      {groupBy === "type" ? "Revenue Type" : "Product / Plan"}
                    </th>
                    {groupBy === "plan" && (
                      <th 
                        className="text-center py-3 px-2 text-sm font-semibold"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        Source
                      </th>
                    )}
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
                  {groupBy === "type" ? (
                    /* Type View - Show Subscription, One-time, Invoice rows */
                    <>
                      {typedData.map((row, idx) => {
                        const typeConfig = {
                          subscription: { color: "#10b981", icon: <CreditCard className="w-5 h-5" style={{ color: "#10b981" }} /> },
                          one_time: { color: "#3b82f6", icon: <DollarSign className="w-5 h-5" style={{ color: "#3b82f6" }} /> },
                          invoice: { color: "#8b5cf6", icon: <Receipt className="w-5 h-5" style={{ color: "#8b5cf6" }} /> },
                        }[row.type];
                        
                        return (
                          <motion.tr
                            key={row.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            style={{ borderBottom: "1px solid var(--border)" }}
                            className="hover:bg-[var(--background-tertiary)] transition-colors"
                          >
                            <td 
                              className="py-4 px-4 text-sm font-medium sticky left-0"
                              style={{ color: "var(--foreground)", background: "inherit" }}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                                  style={{ background: `${typeConfig.color}15` }}
                                >
                                  {typeConfig.icon}
                                </div>
                                <span className="font-semibold">{row.name}</span>
                              </div>
                            </td>
                            {months.map(month => {
                              const amount = row.months[month] || 0;
                              return (
                                <td 
                                  key={month}
                                  className="py-4 px-3 text-sm text-right tabular-nums"
                                  style={{ color: amount > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}
                                >
                                  {amount > 0 ? formatCurrency(amount) : "—"}
                                </td>
                              );
                            })}
                            <td 
                              className="py-4 px-4 text-sm text-right font-bold tabular-nums"
                              style={{ color: typeConfig.color }}
                            >
                              {formatCurrency(row.total)}
                            </td>
                          </motion.tr>
                        );
                      })}
                      {/* Total Row */}
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: typedData.length * 0.05 }}
                        style={{ borderTop: "2px solid var(--border)", background: "var(--background-tertiary)" }}
                      >
                        <td 
                          className="py-4 px-4 text-sm font-bold sticky left-0"
                          style={{ color: "var(--foreground)", background: "inherit" }}
                        >
                          Total Revenue
                        </td>
                        {monthlyTotals.map((mt) => (
                          <td 
                            key={mt.month}
                            className="py-4 px-3 text-sm text-right font-bold tabular-nums"
                            style={{ color: mt.total > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}
                          >
                            {mt.total > 0 ? formatCurrency(mt.total) : "—"}
                          </td>
                        ))}
                        <td 
                          className="py-4 px-4 text-sm text-right font-bold tabular-nums"
                          style={{ color: "#10b981" }}
                        >
                          {formatCurrency(periodTotal)}
                        </td>
                      </motion.tr>
                    </>
                  ) : (
                    /* Plan View - Show individual product/plan rows */
                    <>
                      {filteredPlanData.map((row, idx) => (
                        <motion.tr
                          key={row.productId}
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
                            {row.productName}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center">
                              {getSourceIcon(row.source)}
                            </div>
                          </td>
                          {months.map(month => {
                            const amount = row.months[month] || 0;
                            return (
                              <td 
                                key={month}
                                className="py-3 px-3 text-sm text-right tabular-nums"
                                style={{ 
                                  color: amount > 0 ? "var(--foreground)" : "var(--foreground-subtle)",
                                }}
                              >
                                {amount > 0 ? formatCurrency(amount) : "—"}
                              </td>
                            );
                          })}
                          <td 
                            className="py-3 px-4 text-sm text-right font-semibold tabular-nums"
                            style={{ color: "#10b981" }}
                          >
                            {formatCurrency(row.total)}
                          </td>
                        </motion.tr>
                      ))}
                      {/* Total Row for Plans */}
                      {planFilter === "all" && filteredPlanData.length > 1 && (
                        <motion.tr
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: filteredPlanData.length * 0.02 }}
                          style={{ borderTop: "2px solid var(--border)", background: "var(--background-tertiary)" }}
                        >
                          <td 
                            className="py-4 px-4 text-sm font-bold sticky left-0"
                            style={{ color: "var(--foreground)", background: "inherit" }}
                          >
                            Total ({filteredPlanData.length} plans)
                          </td>
                          <td className="py-4 px-2"></td>
                          {monthlyTotals.map((mt) => (
                            <td 
                              key={mt.month}
                              className="py-4 px-3 text-sm text-right font-bold tabular-nums"
                              style={{ color: mt.total > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}
                            >
                              {mt.total > 0 ? formatCurrency(mt.total) : "—"}
                            </td>
                          ))}
                          <td 
                            className="py-4 px-4 text-sm text-right font-bold tabular-nums"
                            style={{ color: "#10b981" }}
                          >
                            {formatCurrency(periodTotal)}
                          </td>
                        </motion.tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </AppLayout>
  );
}

