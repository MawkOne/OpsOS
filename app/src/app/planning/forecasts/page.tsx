"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Calendar,
  Settings,
  Layers,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs,
} from "firebase/firestore";

interface ProductRevenue {
  productId: string;
  productName: string;
  monthlyRevenue: Record<string, number>; // monthKey -> revenue
}

interface RevenueStream {
  id: string;
  name: string;
  productIds: string[];
  color?: string;
}

interface StreamRevenue {
  streamId: string;
  streamName: string;
  monthlyRevenue: Record<string, number>;
  color?: string;
}

interface InitiativeForecast {
  id: string;
  name: string;
  monthlyImpact: Record<string, number>; // monthKey -> revenue impact
  status: string;
}

export default function ForecastsPage() {
  const { currentOrg } = useOrganization();
  const { formatAmount, convertAmountHistorical } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [productRevenue, setProductRevenue] = useState<ProductRevenue[]>([]);
  const [revenueStreams, setRevenueStreams] = useState<RevenueStream[]>([]);
  const [initiativeForecasts, setInitiativeForecasts] = useState<InitiativeForecast[]>([]);
  const [viewMode, setViewMode] = useState<"ttm" | "year">("year");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [groupBy, setGroupBy] = useState<"product" | "stream">("stream");

  const organizationId = currentOrg?.id || "";

  // Generate month keys based on view mode
  const getMonthKeys = useCallback(() => {
    const keys: string[] = [];
    const now = new Date();
    
    if (viewMode === "ttm") {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else {
      // Selected year
      for (let i = 1; i <= 12; i++) {
        keys.push(`${selectedYear}-${String(i).padStart(2, '0')}`);
      }
    }
    
    return keys;
  }, [viewMode, selectedYear]);

  const monthKeys = getMonthKeys();

  const fetchRevenueData = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      // Fetch revenue streams
      const streamsQuery = query(
        collection(db, "revenue_streams"),
        where("organizationId", "==", organizationId)
      );
      const streamsSnapshot = await getDocs(streamsQuery);
      const streams: RevenueStream[] = [];
      streamsSnapshot.forEach((doc) => {
        const data = doc.data();
        streams.push({
          id: doc.id,
          name: data.name,
          productIds: data.productIds || [],
          color: data.color,
        });
      });
      setRevenueStreams(streams);

      // Fetch products
      const productsQuery = query(
        collection(db, "stripe_products"),
        where("organizationId", "==", organizationId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const products = new Map<string, string>();
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        products.set(data.stripeId, data.name);
      });

      // Fetch invoices
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);

      // Calculate revenue by product and month
      const revenueMap = new Map<string, Record<string, number>>();
      
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data();
        if (invoice.status !== "paid" || !invoice.lineItems || invoice.lineItems.length === 0) return;

        const invoiceDate = invoice.created?.toDate();
        if (!invoiceDate) return;

        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

        invoice.lineItems.forEach((item: any) => {
          const productId = item.productId;
          if (!productId) return;

          if (!revenueMap.has(productId)) {
            revenueMap.set(productId, {});
          }

          const productRevenue = revenueMap.get(productId)!;
          productRevenue[monthKey] = (productRevenue[monthKey] || 0) + (item.amount / 100);
        });
      });

      // Convert to array
      const revenueData: ProductRevenue[] = [];
      revenueMap.forEach((monthlyRevenue, productId) => {
        revenueData.push({
          productId,
          productName: products.get(productId) || "Unknown Product",
          monthlyRevenue,
        });
      });

      // Sort by total revenue (descending)
      revenueData.sort((a, b) => {
        const totalA = Object.values(a.monthlyRevenue).reduce((sum, val) => sum + val, 0);
        const totalB = Object.values(b.monthlyRevenue).reduce((sum, val) => sum + val, 0);
        return totalB - totalA;
      });

      setProductRevenue(revenueData);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchRevenueData();
  }, [organizationId, fetchRevenueData]);

  // Aggregate products into streams
  const getStreamRevenue = useCallback((): StreamRevenue[] => {
    const streamRevMap = new Map<string, StreamRevenue>();
    const usedProductIds = new Set<string>();

    // Process each stream
    revenueStreams.forEach((stream) => {
      const monthlyRevenue: Record<string, number> = {};
      
      stream.productIds.forEach((productId) => {
        const product = productRevenue.find((p) => p.productId === productId);
        if (product) {
          usedProductIds.add(productId);
          Object.entries(product.monthlyRevenue).forEach(([month, value]) => {
            monthlyRevenue[month] = (monthlyRevenue[month] || 0) + value;
          });
        }
      });

      streamRevMap.set(stream.id, {
        streamId: stream.id,
        streamName: stream.name,
        monthlyRevenue,
        color: stream.color,
      });
    });

    // Add ungrouped products
    const ungroupedRevenue: Record<string, number> = {};
    let hasUngrouped = false;

    productRevenue.forEach((product) => {
      if (!usedProductIds.has(product.productId)) {
        hasUngrouped = true;
        Object.entries(product.monthlyRevenue).forEach(([month, value]) => {
          ungroupedRevenue[month] = (ungroupedRevenue[month] || 0) + value;
        });
      }
    });

    if (hasUngrouped) {
      streamRevMap.set("ungrouped", {
        streamId: "ungrouped",
        streamName: "Ungrouped Products",
        monthlyRevenue: ungroupedRevenue,
      });
    }

    return Array.from(streamRevMap.values());
  }, [productRevenue, revenueStreams]);

  const streamRevenue = getStreamRevenue();

  // Calculate growth rate (for products)
  const calculateGrowthRate = (product: ProductRevenue) => {
    const values = monthKeys.map(key => product.monthlyRevenue[key] || 0);
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    if (firstAvg === 0) return 0;
    return ((secondAvg - firstAvg) / firstAvg) * 100;
  };

  // Calculate growth rate (for streams)
  const calculateStreamGrowthRate = (stream: StreamRevenue) => {
    const values = monthKeys.map(key => stream.monthlyRevenue[key] || 0);
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    if (firstAvg === 0) return 0;
    return ((secondAvg - firstAvg) / firstAvg) * 100;
  };

  // Calculate baseline totals
  const baselineTotals = monthKeys.map(key => {
    return productRevenue.reduce((sum, product) => {
      return sum + (product.monthlyRevenue[key] || 0);
    }, 0);
  });

  const totalBaseline = baselineTotals.reduce((sum, val) => sum + val, 0);

  return (
    <AppLayout 
      title="Revenue Forecasts" 
      subtitle="Baseline growth projections and initiative impacts"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("ttm")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "ttm"
                  ? "shadow-sm"
                  : ""
              }`}
              style={{
                background: viewMode === "ttm" ? "var(--accent)" : "var(--muted)",
                color: viewMode === "ttm" ? "white" : "var(--foreground-muted)",
              }}
            >
              Last 12 Months
            </button>
            <button
              onClick={() => setViewMode("year")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "year"
                  ? "shadow-sm"
                  : ""
              }`}
              style={{
                background: viewMode === "year" ? "var(--accent)" : "var(--muted)",
                color: viewMode === "year" ? "white" : "var(--foreground-muted)",
              }}
            >
              Year
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>Group by:</span>
            <button
              onClick={() => setGroupBy("stream")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                groupBy === "stream"
                  ? "shadow-sm"
                  : ""
              }`}
              style={{
                background: groupBy === "stream" ? "var(--accent)" : "var(--muted)",
                color: groupBy === "stream" ? "white" : "var(--foreground-muted)",
              }}
            >
              <Layers className="w-3 h-3" />
              Stream
            </button>
            <button
              onClick={() => setGroupBy("product")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                groupBy === "product"
                  ? "shadow-sm"
                  : ""
              }`}
              style={{
                background: groupBy === "product" ? "var(--accent)" : "var(--muted)",
                color: groupBy === "product" ? "white" : "var(--foreground-muted)",
              }}
            >
              Product
            </button>
            <a
              href="/revenue/streams"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: "var(--foreground-muted)" }}
              title="Manage streams"
            >
              <Settings className="w-4 h-4" />
            </a>
          </div>

          {viewMode === "year" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: "var(--foreground-muted)" }}
              >
                ←
              </button>
              <span className="text-sm font-medium px-4" style={{ color: "var(--foreground)" }}>
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: "var(--foreground-muted)" }}
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Total Baseline Revenue
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {formatAmount(totalBaseline)}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(0, 212, 170, 0.1)", color: "#00d4aa" }}
                >
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Active Products
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {productRevenue.length}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                >
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Initiative Forecasts
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {initiativeForecasts.length}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" }}
                >
                  <Zap className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Baseline Revenue Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Baseline Revenue {groupBy === "stream" ? "by Stream" : "by Product"}
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Historical revenue growth patterns
                </p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading revenue data...</p>
              </div>
            ) : productRevenue.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  No revenue data available
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Connect Stripe to view baseline revenue forecasts
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-3 px-4 text-xs font-semibold sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground-muted)" }}>
                        {groupBy === "stream" ? "Revenue Stream" : "Product"}
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        Growth
                      </th>
                      {monthKeys.map((key) => {
                        const [year, month] = key.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1);
                        return (
                          <th key={key} className="text-right py-3 px-4 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--foreground-muted)" }}>
                            {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                          </th>
                        );
                      })}
                      <th className="text-right py-3 px-4 text-xs font-semibold sticky right-0 z-10" style={{ background: "var(--background)", color: "var(--foreground-muted)" }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupBy === "stream" ? (
                      // Stream view
                      streamRevenue.map((stream) => {
                        const growth = calculateStreamGrowthRate(stream);
                        const total = monthKeys.reduce((sum, key) => sum + (stream.monthlyRevenue[key] || 0), 0);
                        
                        return (
                          <tr key={stream.streamId} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="py-3 px-4 text-sm sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                              <div className="flex items-center gap-2">
                                {stream.color && (
                                  <div 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ background: stream.color }}
                                  />
                                )}
                                <span style={{ fontStyle: stream.streamId === "ungrouped" ? "italic" : "normal" }}>
                                  {stream.streamName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-right">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium"
                                style={{ color: growth >= 0 ? "#00d4aa" : "#ef4444" }}
                              >
                                {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(growth).toFixed(1)}%
                              </span>
                            </td>
                            {monthKeys.map((key) => {
                              const value = stream.monthlyRevenue[key] || 0;
                              return (
                                <td key={key} className="py-3 px-4 text-sm text-right whitespace-nowrap" style={{ color: value > 0 ? "var(--foreground)" : "var(--foreground-muted)" }}>
                                  {value > 0 ? formatAmount(value) : "—"}
                                </td>
                              );
                            })}
                            <td className="py-3 px-4 text-sm text-right font-semibold sticky right-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                              {formatAmount(total)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      // Product view
                      productRevenue.map((product) => {
                        const growth = calculateGrowthRate(product);
                        const total = monthKeys.reduce((sum, key) => sum + (product.monthlyRevenue[key] || 0), 0);
                        
                        return (
                          <tr key={product.productId} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="py-3 px-4 text-sm sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                              {product.productName}
                            </td>
                            <td className="py-3 px-4 text-sm text-right">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium"
                                style={{ color: growth >= 0 ? "#00d4aa" : "#ef4444" }}
                              >
                                {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(growth).toFixed(1)}%
                              </span>
                            </td>
                            {monthKeys.map((key) => {
                              const value = product.monthlyRevenue[key] || 0;
                              return (
                                <td key={key} className="py-3 px-4 text-sm text-right whitespace-nowrap" style={{ color: value > 0 ? "var(--foreground)" : "var(--foreground-muted)" }}>
                                  {value > 0 ? formatAmount(value) : "—"}
                                </td>
                              );
                            })}
                            <td className="py-3 px-4 text-sm text-right font-semibold sticky right-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                              {formatAmount(total)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    <tr style={{ borderTop: "2px solid var(--border)", fontWeight: "bold" }}>
                      <td className="py-3 px-4 text-sm sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        Total Baseline
                      </td>
                      <td className="py-3 px-4 text-sm"></td>
                      {baselineTotals.map((total, index) => (
                        <td key={index} className="py-3 px-4 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatAmount(total)}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-sm text-right sticky right-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        {formatAmount(totalBaseline)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Initiative Forecasts Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Initiative Forecasts
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Expected revenue impact from planned initiatives
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
                style={{ 
                  background: "#3b82f6",
                  color: "white"
                }}
              >
                Add Forecast
              </button>
            </div>

            <div className="text-center py-12" style={{ background: "var(--muted)", borderRadius: "8px" }}>
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                No initiative forecasts yet
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                Add revenue forecasts for your initiatives to see their projected impact
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
