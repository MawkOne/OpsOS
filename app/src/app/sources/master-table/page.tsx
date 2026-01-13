"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Receipt,
  Activity,
  TrendingUp,
  Package,
  Mail,
  Megaphone,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface EntityRow {
  entityId: string;
  entityName: string;
  source: "stripe" | "quickbooks" | "google-analytics" | "activecampaign";
  type: string;
  months: Record<string, number>; // "2026-01": 1500
  total: number;
}

type ViewMode = "ttm" | "year" | "all";
type SourceFilter = "all" | "stripe" | "quickbooks" | "google-analytics" | "activecampaign";

export default function MasterTablePage() {
  const { currentOrg } = useOrganization();
  const { convertAmountHistorical, formatAmount } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [entityData, setEntityData] = useState<EntityRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const organizationId = currentOrg?.id || "";

  // Generate months based on view mode (same as sales page)
  const { months, monthLabels, isAllTime } = useMemo(() => {
    if (viewMode === "all") {
      const currentYear = new Date().getFullYear();
      const allYears: string[] = [];
      const allLabels: string[] = [];
      
      for (let year = 2018; year <= currentYear; year++) {
        allYears.push(year.toString());
        allLabels.push(year.toString());
      }
      
      return { months: allYears, monthLabels: allLabels, isAllTime: true };
    } else if (viewMode === "ttm") {
      const now = new Date();
      const ttmMonths: string[] = [];
      const ttmLabels: string[] = [];
      
      for (let i = 12; i >= 1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        ttmMonths.push(monthKey);
        ttmLabels.push(label);
      }
      
      return { months: ttmMonths, monthLabels: ttmLabels, isAllTime: false };
    } else {
      const yearMonths = Array.from({ length: 12 }, (_, i) => {
        const month = (i + 1).toString().padStart(2, "0");
        return `${selectedYear}-${month}`;
      });
      const yearLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { months: yearMonths, monthLabels: yearLabels, isAllTime: false };
    }
  }, [viewMode, selectedYear]);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchAllEntities();
  }, [organizationId, viewMode, selectedYear]);

  const fetchAllEntities = async () => {
    setLoading(true);
    const entities: EntityRow[] = [];

    try {
      // Fetch Stripe data (customers)
      await fetchStripeEntities(entities);
      
      // Fetch QuickBooks data (vendors & customers)
      await fetchQuickBooksEntities(entities);
      
      // Fetch Advertising data (campaigns)
      await fetchAdvertisingEntities(entities);
      
      // Fetch Email data (campaigns)
      await fetchEmailEntities(entities);
      
      setEntityData(entities);
    } catch (error) {
      console.error("Error fetching master table data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeEntities = async (entities: EntityRow[]) => {
    try {
      // Fetch all Stripe invoices
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      // Group by customer
      const customerRevenue: Record<string, { name: string; months: Record<string, number>; total: number }> = {};
      
      invoicesSnap.docs.forEach(doc => {
        const invoice = doc.data();
        if (invoice.status !== 'paid') return;
        
        const customerId = invoice.customerId || 'unknown';
        const customerName = invoice.customerName || invoice.customerEmail || 'Unknown Customer';
        const amount = (invoice.total || 0) / 100; // Convert from cents
        const date = invoice.created?.toDate?.() || new Date();
        
        // Determine month key
        let monthKey: string;
        if (isAllTime) {
          monthKey = date.getFullYear().toString();
        } else {
          monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        }
        
        // Only include if in our month range
        if (!months.includes(monthKey)) return;
        
        if (!customerRevenue[customerId]) {
          customerRevenue[customerId] = {
            name: customerName,
            months: {},
            total: 0,
          };
        }
        
        customerRevenue[customerId].months[monthKey] = (customerRevenue[customerId].months[monthKey] || 0) + amount;
        customerRevenue[customerId].total += amount;
      });
      
      // Convert to entity rows
      Object.entries(customerRevenue).forEach(([customerId, data]) => {
        entities.push({
          entityId: customerId,
          entityName: data.name,
          source: "stripe",
          type: "Customer",
          months: data.months,
          total: data.total,
        });
      });
    } catch (error) {
      console.error("Error fetching Stripe entities:", error);
    }
  };

  const fetchQuickBooksEntities = async (entities: EntityRow[]) => {
    try {
      // Fetch QB Expenses grouped by vendor
      const expensesQuery = query(
        collection(db, "quickbooks_expenses"),
        where("organizationId", "==", organizationId)
      );
      const expensesSnap = await getDocs(expensesQuery);
      
      const vendorExpenses: Record<string, { name: string; months: Record<string, number>; total: number }> = {};
      
      expensesSnap.docs.forEach(doc => {
        const expense = doc.data();
        const vendorId = expense.vendorId || 'unknown';
        const vendorName = expense.vendorName || 'Unknown Vendor';
        const amount = expense.totalAmount || 0;
        const date = expense.txnDate?.toDate?.() || new Date();
        
        let monthKey: string;
        if (isAllTime) {
          monthKey = date.getFullYear().toString();
        } else {
          monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        }
        
        if (!months.includes(monthKey)) return;
        
        if (!vendorExpenses[vendorId]) {
          vendorExpenses[vendorId] = {
            name: vendorName,
            months: {},
            total: 0,
          };
        }
        
        vendorExpenses[vendorId].months[monthKey] = (vendorExpenses[vendorId].months[monthKey] || 0) + amount;
        vendorExpenses[vendorId].total += amount;
      });
      
      Object.entries(vendorExpenses).forEach(([vendorId, data]) => {
        entities.push({
          entityId: vendorId,
          entityName: data.name,
          source: "quickbooks",
          type: "Vendor",
          months: data.months,
          total: data.total,
        });
      });

      // Fetch QB Invoices grouped by customer
      const invoicesQuery = query(
        collection(db, "quickbooks_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      const customerRevenue: Record<string, { name: string; months: Record<string, number>; total: number }> = {};
      
      invoicesSnap.docs.forEach(doc => {
        const invoice = doc.data();
        if (invoice.status !== 'paid') return;
        
        const customerId = invoice.customerId || 'unknown';
        const customerName = invoice.customerName || 'Unknown Customer';
        const amount = invoice.totalAmount || 0;
        const date = invoice.txnDate?.toDate?.() || new Date();
        
        let monthKey: string;
        if (isAllTime) {
          monthKey = date.getFullYear().toString();
        } else {
          monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        }
        
        if (!months.includes(monthKey)) return;
        
        if (!customerRevenue[customerId]) {
          customerRevenue[customerId] = {
            name: customerName,
            months: {},
            total: 0,
          };
        }
        
        customerRevenue[customerId].months[monthKey] = (customerRevenue[customerId].months[monthKey] || 0) + amount;
        customerRevenue[customerId].total += amount;
      });
      
      Object.entries(customerRevenue).forEach(([customerId, data]) => {
        entities.push({
          entityId: customerId,
          entityName: data.name,
          source: "quickbooks",
          type: "Customer",
          months: data.months,
          total: data.total,
        });
      });
    } catch (error) {
      console.error("Error fetching QuickBooks entities:", error);
    }
  };

  const fetchAdvertisingEntities = async (entities: EntityRow[]) => {
    try {
      // Fetch advertising campaign data from Google Analytics
      const response = await fetch(
        `/api/google-analytics/ads?organizationId=${organizationId}&viewMode=${viewMode}&year=${selectedYear}`
      );

      if (!response.ok) {
        console.warn("Could not fetch advertising data");
        return;
      }

      const data = await response.json();
      const campaigns = data.campaigns || [];

      campaigns.forEach((campaign: any) => {
        const campaignMonths: Record<string, number> = {};
        let total = 0;

        // Extract spend for each month
        Object.entries(campaign.months || {}).forEach(([monthKey, metrics]: [string, any]) => {
          const spend = metrics.spend || 0;
          
          // Only include if in our month range
          if (months.includes(monthKey) || (isAllTime && months.includes(monthKey.split('-')[0]))) {
            const key = isAllTime ? monthKey.split('-')[0] : monthKey;
            campaignMonths[key] = (campaignMonths[key] || 0) + spend;
            total += spend;
          }
        });

        if (total > 0) {
          entities.push({
            entityId: campaign.id || campaign.name,
            entityName: campaign.name || 'Unknown Campaign',
            source: "google-analytics",
            type: "Ad Campaign",
            months: campaignMonths,
            total,
          });
        }
      });
    } catch (error) {
      console.error("Error fetching advertising entities:", error);
    }
  };

  const fetchEmailEntities = async (entities: EntityRow[]) => {
    try {
      // Fetch email campaigns from ActiveCampaign
      const campaignsQuery = query(
        collection(db, "activecampaign_campaigns"),
        where("organizationId", "==", organizationId)
      );
      const campaignsSnap = await getDocs(campaignsQuery);

      campaignsSnap.docs.forEach(doc => {
        const campaign = doc.data();
        const sentDate = campaign.send_date?.toDate?.() || campaign.sdate?.toDate?.();
        
        if (!sentDate) return;

        let monthKey: string;
        if (isAllTime) {
          monthKey = sentDate.getFullYear().toString();
        } else {
          monthKey = `${sentDate.getFullYear()}-${(sentDate.getMonth() + 1).toString().padStart(2, "0")}`;
        }

        // Only include if in our month range
        if (!months.includes(monthKey)) return;

        // Use total_sent as the value (could also use opens, clicks, etc.)
        const value = campaign.total_sent || 0;

        if (value > 0) {
          entities.push({
            entityId: doc.id,
            entityName: campaign.name || 'Untitled Campaign',
            source: "activecampaign",
            type: "Email Campaign",
            months: { [monthKey]: value },
            total: value,
          });
        }
      });
    } catch (error) {
      console.error("Error fetching email entities:", error);
    }
  };

  // Filter and sort entities
  const filteredEntities = useMemo(() => {
    let filtered = entityData;

    if (sourceFilter !== "all") {
      filtered = filtered.filter(entity => entity.source === sourceFilter);
    }

    // Sort by total descending
    return filtered.sort((a, b) => b.total - a.total);
  }, [entityData, sourceFilter]);

  // Calculate monthly totals (currency sources only)
  const monthlyTotals = useMemo(() => {
    return months.map(month => {
      const total = filteredEntities
        .filter(entity => entity.source !== "activecampaign") // Exclude count-based sources
        .reduce((sum, entity) => sum + (entity.months[month] || 0), 0);
      return { month, total };
    });
  }, [filteredEntities, months]);

  const periodTotal = useMemo(() => {
    return filteredEntities
      .filter(entity => entity.source !== "activecampaign") // Exclude count-based sources
      .reduce((sum, entity) => sum + entity.total, 0);
  }, [filteredEntities]);

  const formatValue = (amount: number, source: EntityRow["source"], monthKey?: string) => {
    // Email campaigns show count, not currency
    if (source === "activecampaign") {
      return new Intl.NumberFormat("en-US").format(Math.round(amount));
    }
    
    // Currency for Stripe, QuickBooks, and Advertising
    if (monthKey) {
      return formatAmount(convertAmountHistorical(amount, "USD", monthKey));
    }
    return formatAmount(amount, "USD");
  };

  const sourceIcons = {
    stripe: <CreditCard className="w-4 h-4" />,
    quickbooks: <Receipt className="w-4 h-4" />,
    "google-analytics": <Megaphone className="w-4 h-4" />,
    activecampaign: <Mail className="w-4 h-4" />,
  };

  const sourceColors = {
    stripe: "#635BFF",
    quickbooks: "#2CA01C",
    "google-analytics": "#E37400",
    activecampaign: "#356AE6",
  };

  return (
    <AppLayout title="Master Table" subtitle="All entities across all data sources">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Period Total
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                    {loading ? "..." : formatValue(periodTotal, "stripe")}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}
                >
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Total Entities
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {loading ? "..." : filteredEntities.length}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-between"
                  style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" }}
                >
                  <Package className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Monthly Average
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {loading ? "..." : formatValue(periodTotal / months.length, "stripe")}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                >
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                  className="px-3 py-1.5 rounded-lg text-xs border transition-all duration-200"
                  style={{
                    background: "var(--card)",
                    color: "var(--foreground)",
                    borderColor: "var(--border)",
                  }}
                >
                  <option value="all">All Sources</option>
                  <option value="stripe">Stripe</option>
                  <option value="quickbooks">QuickBooks</option>
                  <option value="google-analytics">Advertising</option>
                  <option value="activecampaign">Email Marketing</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode */}
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--muted)" }}>
                  <button
                    onClick={() => setViewMode("ttm")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                      viewMode === "ttm" ? "shadow-sm" : ""
                    }`}
                    style={{
                      background: viewMode === "ttm" ? "var(--card)" : "transparent",
                      color: viewMode === "ttm" ? "var(--foreground)" : "var(--foreground-muted)",
                    }}
                  >
                    TTM
                  </button>
                  <button
                    onClick={() => setViewMode("year")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                      viewMode === "year" ? "shadow-sm" : ""
                    }`}
                    style={{
                      background: viewMode === "year" ? "var(--card)" : "transparent",
                      color: viewMode === "year" ? "var(--foreground)" : "var(--foreground-muted)",
                    }}
                  >
                    Year
                  </button>
                  <button
                    onClick={() => setViewMode("all")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                      viewMode === "all" ? "shadow-sm" : ""
                    }`}
                    style={{
                      background: viewMode === "all" ? "var(--card)" : "transparent",
                      color: viewMode === "all" ? "var(--foreground)" : "var(--foreground-muted)",
                    }}
                  >
                    All Time
                  </button>
                </div>

                {/* Year Navigation */}
                {viewMode === "year" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedYear(selectedYear - 1)}
                      className="p-1 rounded transition-all duration-200 hover:bg-gray-100"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {selectedYear}
                    </span>
                    <button
                      onClick={() => setSelectedYear(selectedYear + 1)}
                      disabled={selectedYear >= new Date().getFullYear()}
                      className="p-1 rounded transition-all duration-200 hover:bg-gray-100 disabled:opacity-50"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-3 px-4 text-xs font-medium sticky left-0 z-10" style={{ color: "var(--foreground-muted)", background: "var(--card)" }}>
                      Entity
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Type
                    </th>
                    {monthLabels.map((label, index) => (
                      <th key={index} className="text-right py-3 px-3 text-xs font-medium whitespace-nowrap" style={{ color: "var(--foreground-muted)" }}>
                        {label}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-xs font-medium sticky right-0 z-10" style={{ color: "var(--foreground-muted)", background: "var(--card)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={monthLabels.length + 3} className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Loading entities...
                      </td>
                    </tr>
                  ) : filteredEntities.length === 0 ? (
                    <tr>
                      <td colSpan={monthLabels.length + 3} className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        No entities found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredEntities.map((entity) => (
                        <tr key={`${entity.source}_${entity.entityId}`} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-[var(--sidebar-hover)] transition-colors">
                          <td className="py-3 px-4 sticky left-0 z-10" style={{ background: "var(--card)" }}>
                            <div className="flex items-center gap-2">
                              <div style={{ color: sourceColors[entity.source] }}>
                                {sourceIcons[entity.source]}
                              </div>
                              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                                {entity.entityName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs" style={{ color: "var(--foreground-muted)" }}>
                            {entity.type}
                          </td>
                          {months.map((month) => {
                            const amount = entity.months[month] || 0;
                            return (
                              <td key={month} className="text-right py-3 px-3 text-xs" style={{ color: amount > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}>
                                {amount > 0 ? formatValue(amount, entity.source, month) : "—"}
                              </td>
                            );
                          })}
                          <td className="text-right py-3 px-4 text-sm font-semibold sticky right-0 z-10" style={{ color: "#10b981", background: "var(--card)" }}>
                            {formatValue(entity.total, entity.source)}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--muted)" }}>
                        <td className="py-3 px-4 text-sm font-bold sticky left-0 z-10" style={{ color: "var(--foreground)", background: "var(--muted)" }}>
                          Total
                        </td>
                        <td className="py-3 px-3"></td>
                        {monthlyTotals.map((mt) => (
                          <td 
                            key={mt.month}
                            className="text-right py-3 px-3 text-xs font-bold"
                            style={{ color: mt.total > 0 ? "var(--foreground)" : "var(--foreground-subtle)" }}
                          >
                            {mt.total > 0 ? formatValue(mt.total, "stripe", mt.month) : "—"}
                          </td>
                        ))}
                        <td className="text-right py-3 px-4 text-sm font-bold sticky right-0 z-10" style={{ color: "#10b981", background: "var(--muted)" }}>
                          {formatValue(periodTotal, "stripe")}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
