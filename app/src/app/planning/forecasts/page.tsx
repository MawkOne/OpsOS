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
  Plus,
  X,
  Check,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

interface BaselineEntity {
  id?: string;
  entityId: string;
  entityName: string;
  source: string;
  type: string;
  metric: string;
  metricType: string;
  months: Record<string, number>;
  total: number;
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
  const [baselineEntities, setBaselineEntities] = useState<BaselineEntity[]>([]);
  const [initiativeForecasts, setInitiativeForecasts] = useState<InitiativeForecast[]>([]);
  const [viewMode, setViewMode] = useState<"ttm" | "year">("year");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [availableEntities, setAvailableEntities] = useState<BaselineEntity[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [modalLoading, setModalLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterMetric, setFilterMetric] = useState<string>("all");

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

  // Fetch saved baseline entities from Firestore
  const fetchBaselineEntities = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const baselineQuery = query(
        collection(db, "forecast_baseline_rows"),
        where("organizationId", "==", organizationId)
      );
      const baselineSnapshot = await getDocs(baselineQuery);
      const entities: BaselineEntity[] = [];
      
      baselineSnapshot.forEach((doc) => {
        const data = doc.data();
        entities.push({
          id: doc.id,
          entityId: data.entityId,
          entityName: data.entityName,
          source: data.source,
          type: data.type,
          metric: data.metric,
          metricType: data.metricType,
          months: data.months || {},
          total: data.total || 0,
        });
      });
      
      setBaselineEntities(entities);
    } catch (error) {
      console.error("Error fetching baseline entities:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Fetch available entities from Master Table sources
  const fetchAvailableEntities = useCallback(async () => {
    if (!organizationId) return;
    
    setModalLoading(true);
    try {
      const entities: BaselineEntity[] = [];
      
      // Fetch Stripe products for name lookup
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

      // Fetch all invoices
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);

      // Calculate revenue by product and month
      const productRevenue: Record<string, { name: string; months: Record<string, number>; total: number; count: Record<string, number> }> = {};
      
      // Track which invoices we've processed
      const countedInvoiceIds = new Set<string>();
      
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data();
        if (invoice.status !== "paid") return;

        if (invoice.stripeId) countedInvoiceIds.add(invoice.stripeId);

        const invoiceDate = invoice.created?.toDate();
        if (!invoiceDate) return;

        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        const invoiceAmount = (invoice.total || 0) / 100;

        const lineItems = invoice.lineItems || [];
        
        if (lineItems.length > 0) {
          let hasValidProduct = false;
          
          lineItems.forEach((item: any) => {
            const productId = item.productId;
            
            if (productId) {
              hasValidProduct = true;
              const productName = products.get(productId) || item.description || 'Unknown Product';
              const itemAmount = ((item.amount || 0) / 100) * (item.quantity || 1);
              
              if (!productRevenue[productId]) {
                productRevenue[productId] = {
                  name: productName,
                  months: {},
                  total: 0,
                  count: {},
                };
              }
              
              productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + itemAmount;
              productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + (item.quantity || 1);
              productRevenue[productId].total += itemAmount;
            }
          });
          
          // If line items exist but none have productId
          if (!hasValidProduct) {
            const unlabeledId = 'unlabeled';
            if (!productRevenue[unlabeledId]) {
              productRevenue[unlabeledId] = {
                name: 'Unlabeled Revenue',
                months: {},
                total: 0,
                count: {},
              };
            }
            productRevenue[unlabeledId].months[monthKey] = (productRevenue[unlabeledId].months[monthKey] || 0) + invoiceAmount;
            productRevenue[unlabeledId].count[monthKey] = (productRevenue[unlabeledId].count[monthKey] || 0) + 1;
            productRevenue[unlabeledId].total += invoiceAmount;
          }
        } else {
          // No line items at all
          const unlabeledId = 'unlabeled';
          if (!productRevenue[unlabeledId]) {
            productRevenue[unlabeledId] = {
              name: 'Unlabeled Revenue',
              months: {},
              total: 0,
              count: {},
            };
          }
          productRevenue[unlabeledId].months[monthKey] = (productRevenue[unlabeledId].months[monthKey] || 0) + invoiceAmount;
          productRevenue[unlabeledId].count[monthKey] = (productRevenue[unlabeledId].count[monthKey] || 0) + 1;
          productRevenue[unlabeledId].total += invoiceAmount;
        }
      });

      // Fetch Stripe payments (direct charges without invoices)
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded")
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data();
        
        // Skip if this payment's invoice was already counted
        if (payment.invoiceId && countedInvoiceIds.has(payment.invoiceId)) {
          return;
        }
        
        const paymentDate = payment.created?.toDate?.() || new Date();
        const monthKey = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, "0")}`;
        const paymentAmount = (payment.amount || 0) / 100;
        
        const lineItems = payment.lineItems || [];
        
        if (lineItems.length > 0) {
          // Has line items
          lineItems.forEach((item: any) => {
            const productId = item.productId;
            
            if (productId) {
              const productName = products.get(productId) || item.description || 'Unknown Product';
              const itemAmount = ((item.amount || 0) / 100) * (item.quantity || 1);
              
              if (!productRevenue[productId]) {
                productRevenue[productId] = {
                  name: productName,
                  months: {},
                  total: 0,
                  count: {},
                };
              }
              
              productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + itemAmount;
              productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + (item.quantity || 1);
              productRevenue[productId].total += itemAmount;
            }
          });
        } else {
          // No line items - use statement descriptor or categorize as unlabeled
          const statementDescriptor = payment.calculatedStatementDescriptor || payment.statementDescriptor;
          
          if (statementDescriptor) {
            // Use statement descriptor as product identifier
            const productId = `descriptor_${statementDescriptor}`;
            const productName = statementDescriptor;
            
            if (!productRevenue[productId]) {
              productRevenue[productId] = {
                name: productName,
                months: {},
                total: 0,
                count: {},
              };
            }
            
            productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + paymentAmount;
            productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + 1;
            productRevenue[productId].total += paymentAmount;
          } else {
            // Truly unlabeled
            const unlabeledId = 'unlabeled';
            if (!productRevenue[unlabeledId]) {
              productRevenue[unlabeledId] = {
                name: 'Unlabeled Revenue',
                months: {},
                total: 0,
                count: {},
              };
            }
            productRevenue[unlabeledId].months[monthKey] = (productRevenue[unlabeledId].months[monthKey] || 0) + paymentAmount;
            productRevenue[unlabeledId].count[monthKey] = (productRevenue[unlabeledId].count[monthKey] || 0) + 1;
            productRevenue[unlabeledId].total += paymentAmount;
          }
        }
      });

      // Convert to entities
      Object.entries(productRevenue).forEach(([productId, data]) => {
        entities.push({
          entityId: `stripe_product_${productId}`,
          entityName: data.name,
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: data.months,
          total: data.total,
        });
      });

      // Sort by total (descending)
      entities.sort((a, b) => b.total - a.total);
      
      setAvailableEntities(entities);
    } catch (error) {
      console.error("Error fetching available entities:", error);
    } finally {
      setModalLoading(false);
    }
  }, [organizationId]);

  // Add entity to baseline
  const handleAddEntity = async (entity: BaselineEntity) => {
    if (!organizationId) return;
    
    try {
      await addDoc(collection(db, "forecast_baseline_rows"), {
        organizationId,
        entityId: entity.entityId,
        entityName: entity.entityName,
        source: entity.source,
        type: entity.type,
        metric: entity.metric,
        metricType: entity.metricType,
        months: entity.months,
        total: entity.total,
        createdAt: serverTimestamp(),
      });
      
      setSelectedEntityIds(prev => new Set(prev).add(entity.entityId));
      await fetchBaselineEntities();
    } catch (error) {
      console.error("Error adding baseline entity:", error);
    }
  };

  // Remove entity from baseline
  const handleRemoveEntity = async (entityId: string) => {
    if (!organizationId) return;
    
    try {
      const entity = baselineEntities.find(e => e.entityId === entityId);
      if (entity && entity.id) {
        await deleteDoc(doc(db, "forecast_baseline_rows", entity.id));
        setSelectedEntityIds(prev => {
          const next = new Set(prev);
          next.delete(entityId);
          return next;
        });
        await fetchBaselineEntities();
      }
    } catch (error) {
      console.error("Error removing baseline entity:", error);
    }
  };

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchBaselineEntities();
  }, [organizationId, fetchBaselineEntities]);

  // Update selected IDs when baseline entities change
  useEffect(() => {
    const ids = new Set(baselineEntities.map(e => e.entityId));
    setSelectedEntityIds(ids);
  }, [baselineEntities]);

  // Calculate growth rate for entity
  const calculateGrowthRate = (entity: BaselineEntity) => {
    const values = monthKeys.map(key => entity.months[key] || 0);
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
    return baselineEntities.reduce((sum, entity) => {
      return sum + (entity.months[key] || 0);
    }, 0);
  });

  const totalBaseline = baselineTotals.reduce((sum, val) => sum + val, 0);

  // Get unique sources and metrics from available entities
  const uniqueSources = Array.from(new Set(availableEntities.map(e => e.source)));
  const uniqueMetrics = Array.from(new Set(availableEntities.map(e => e.metric)));

  // Filter entities based on source and metric
  const filteredAvailableEntities = availableEntities.filter(entity => {
    const matchesSource = filterSource === "all" || entity.source === filterSource;
    const matchesMetric = filterMetric === "all" || entity.metric === filterMetric;
    return matchesSource && matchesMetric;
  });

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
                    Baseline Rows
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {baselineEntities.length}
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
                  Baseline Revenue
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Selected rows from Master Table
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSelectorModal(true);
                  setFilterSource("all");
                  setFilterMetric("all");
                  fetchAvailableEntities();
                }}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
                style={{ 
                  background: "#3b82f6",
                  color: "white"
                }}
              >
                <Plus className="w-4 h-4" />
                Manage Baseline
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading baseline data...</p>
              </div>
            ) : baselineEntities.length === 0 ? (
              <div className="text-center py-12" style={{ background: "var(--muted)", borderRadius: "8px" }}>
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  No baseline rows selected
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                  Click &quot;Manage Baseline&quot; to add rows from the Master Table
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-3 px-4 text-xs font-semibold sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground-muted)" }}>
                        Entity
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        Metric
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
                      <th className="text-center py-3 px-4 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselineEntities.map((entity) => {
                      const growth = calculateGrowthRate(entity);
                      
                      return (
                        <tr key={entity.entityId} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="py-3 px-4 text-sm sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                            {entity.entityName}
                          </td>
                          <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-muted)" }}>
                            {entity.metric}
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
                            const value = entity.months[key] || 0;
                            return (
                              <td key={key} className="py-3 px-4 text-sm text-right whitespace-nowrap" style={{ color: value > 0 ? "var(--foreground)" : "var(--foreground-muted)" }}>
                                {value > 0 ? formatAmount(value) : "—"}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-sm text-right font-semibold sticky right-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                            {formatAmount(entity.total)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleRemoveEntity(entity.entityId)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              style={{ color: "#ef4444" }}
                              title="Remove from baseline"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid var(--border)", fontWeight: "bold" }}>
                      <td className="py-3 px-4 text-sm sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        Total Baseline
                      </td>
                      <td className="py-3 px-4 text-sm"></td>
                      <td className="py-3 px-4 text-sm"></td>
                      {baselineTotals.map((total, index) => (
                        <td key={index} className="py-3 px-4 text-sm text-right whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatAmount(total)}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-sm text-right sticky right-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        {formatAmount(totalBaseline)}
                      </td>
                      <td className="py-3 px-4 text-sm"></td>
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

      {/* Entity Selector Modal */}
      {showSelectorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl"
            style={{ background: "white" }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    Select Baseline Rows
                  </h3>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Choose entities from your data sources to include in baseline forecast
                  </p>
                </div>
                <button
                  onClick={() => setShowSelectorModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--foreground-muted)" }}>
                    Source
                  </label>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="all">All Sources ({availableEntities.length})</option>
                    {uniqueSources.map((source) => {
                      const count = availableEntities.filter(e => e.source === source).length;
                      return (
                        <option key={source} value={source}>
                          {source.charAt(0).toUpperCase() + source.slice(1)} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--foreground-muted)" }}>
                    Metric
                  </label>
                  <select
                    value={filterMetric}
                    onChange={(e) => setFilterMetric(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="all">All Metrics ({availableEntities.length})</option>
                    {uniqueMetrics.map((metric) => {
                      const count = availableEntities.filter(e => e.metric === metric).length;
                      return (
                        <option key={metric} value={metric}>
                          {metric} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {(filterSource !== "all" || filterMetric !== "all") && (
                  <button
                    onClick={() => {
                      setFilterSource("all");
                      setFilterMetric("all");
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100 self-end"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {modalLoading ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading available entities...</p>
                </div>
              ) : availableEntities.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    No entities available
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Connect data sources to view available entities
                  </p>
                </div>
              ) : filteredAvailableEntities.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    No entities match your filters
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Try adjusting your source or metric filters
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Showing {filteredAvailableEntities.length} of {availableEntities.length} entities
                    </p>
                  </div>
                  <div className="space-y-2">
                    {filteredAvailableEntities.map((entity) => {
                      const isSelected = selectedEntityIds.has(entity.entityId);
                      
                      return (
                        <div
                          key={entity.entityId}
                          className="flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm cursor-pointer"
                          style={{
                            borderColor: isSelected ? "#3b82f6" : "var(--border)",
                            background: isSelected ? "rgba(59, 130, 246, 0.05)" : "var(--background)",
                          }}
                          onClick={() => {
                            if (isSelected) {
                              handleRemoveEntity(entity.entityId);
                            } else {
                              handleAddEntity(entity);
                            }
                          }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ 
                                  background: isSelected ? "rgba(59, 130, 246, 0.1)" : "var(--muted)",
                                  color: isSelected ? "#3b82f6" : "var(--foreground-muted)"
                                }}
                              >
                                {isSelected ? <Check className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                                  {entity.entityName}
                                </p>
                                <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>
                                  {entity.metric} • {entity.source.toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                              {formatAmount(entity.total)}
                            </p>
                            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                              All time
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {selectedEntityIds.size} row{selectedEntityIds.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => setShowSelectorModal(false)}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
                  style={{ 
                    background: "#3b82f6",
                    color: "white"
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
