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

export default function SalesPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  
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
      
      // Fetch products as name lookup
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

      // Aggregate by product and month
      const productRevenue = new Map<string, RevenueRow>();
      const monthsSet = new Set(months);

      // PRIMARY: Use invoices (have proper line items with product info)
      // Query all invoices and filter client-side to catch any status variations
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      console.log(`Found ${invoicesSnap.size} invoices in Firestore`);
      if (invoicesSnap.size > 0) {
        console.log('Sample invoice:', invoicesSnap.docs[0].data());
      }
      
      invoicesSnap.docs.forEach(doc => {
        const invoice = doc.data();
        
        // Only count paid invoices for revenue (case-insensitive check)
        const status = (invoice.status || '').toLowerCase();
        if (status !== 'paid') return;
        
        const invoiceDate = invoice.created?.toDate?.() || new Date();
        const monthKey = `${invoiceDate.getFullYear()}-${(invoiceDate.getMonth() + 1).toString().padStart(2, "0")}`;
        
        if (!monthsSet.has(monthKey)) return;
        
        const lineItems = invoice.lineItems || [];
        
        if (lineItems.length > 0) {
          lineItems.forEach((item: any) => {
            const productId = item.productId || "unknown";
            const productName = item.productName || products.get(productId) || item.description || "Unknown Product";
            const amount = (item.amount || 0) / 100;
            
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
          // Invoice without line items - use total
          const productId = "stripe-other";
          const productName = "Other Stripe Revenue";
          const amount = (invoice.amount || 0) / 100;
          
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

      // FALLBACK: If no invoices, use payments
      if (invoicesSnap.empty) {
        const paymentsQuery = query(
          collection(db, "stripe_payments"),
          where("organizationId", "==", organizationId),
          where("status", "==", "succeeded")
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        
        paymentsSnap.docs.forEach(doc => {
          const payment = doc.data();
          const paymentDate = payment.created?.toDate?.() || new Date();
          const monthKey = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, "0")}`;
          
          if (!monthsSet.has(monthKey)) return;
          
          const productId = "stripe-other";
          const productName = payment.description || "Other Stripe Revenue";
          const amount = (payment.amount || 0) / 100;
          
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
      }

      // Convert map to array and sort by total revenue
      rows.push(...Array.from(productRevenue.values()));
      rows.sort((a, b) => b.total - a.total);
      
      setRevenueData(rows);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by source
  const filteredData = useMemo(() => {
    if (sourceFilter === "all") return revenueData;
    return revenueData.filter(row => row.source === sourceFilter);
  }, [revenueData, sourceFilter]);

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: MonthlyTotal[] = months.map(month => ({
      month,
      total: 0,
      bySource: {},
    }));
    
    filteredData.forEach(row => {
      months.forEach((month, idx) => {
        const amount = row.months[month] || 0;
        totals[idx].total += amount;
        totals[idx].bySource[row.source] = (totals[idx].bySource[row.source] || 0) + amount;
      });
    });
    
    return totals;
  }, [filteredData, months]);

  // Calculate period total (TTM or year)
  const periodTotal = useMemo(() => {
    return filteredData.reduce((sum, row) => sum + row.total, 0);
  }, [filteredData]);

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
              {filteredData.length}
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

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="all">All Sources</option>
                  <option value="stripe">Stripe</option>
                  <option value="quickbooks">QuickBooks</option>
                  <option value="square">Square</option>
                  <option value="manual">Manual</option>
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

        {/* Revenue Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : filteredData.length === 0 ? (
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
                      Product / Plan
                    </th>
                    <th 
                      className="text-center py-3 px-2 text-sm font-semibold"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Source
                    </th>
                    {monthLabels.map((label, idx) => (
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
                  {filteredData.map((row, idx) => (
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
                    <td></td>
                    {monthlyTotals.map((mt, idx) => (
                      <td 
                        key={mt.month}
                        className="py-3 px-3 text-sm text-right font-bold tabular-nums"
                        style={{ color: "var(--foreground)" }}
                      >
                        {mt.total > 0 ? formatCurrency(mt.total) : "—"}
                      </td>
                    ))}
                    <td 
                      className="py-3 px-4 text-sm text-right font-bold tabular-nums"
                      style={{ color: "#10b981" }}
                    >
                      {formatCurrency(periodTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Source Legend */}
        <div className="flex items-center gap-6 text-sm" style={{ color: "var(--foreground-muted)" }}>
          <span className="font-medium">Sources:</span>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" style={{ color: "#635BFF" }} />
            <span>Stripe</span>
          </div>
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" style={{ color: "#2CA01C" }} />
            <span>QuickBooks</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" style={{ color: "#006AFF" }} />
            <span>Square</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

