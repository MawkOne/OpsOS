"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";

interface QuickBooksConnection {
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSyncAt?: { toDate: () => Date };
  companyName?: string;
}

interface ExpenseMetrics {
  totalExpenses: number;
  ttmExpenses: number;
  monthlyAverage: number;
  totalBills: number;
  totalPurchases: number;
  accountsPayable: number;
  topVendorCount: number;
}

interface MonthlyExpense {
  month: string;
  amount: number;
  bills: number;
  purchases: number;
  trend?: number;
}

export default function ExpensesPage() {
  const { currentOrg } = useOrganization();
  const [qbConnection, setQbConnection] = useState<QuickBooksConnection | null>(null);
  const [metrics, setMetrics] = useState<ExpenseMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);

  const organizationId = currentOrg?.id || "";

  // Listen to QuickBooks connection
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "quickbooks_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setQbConnection(snapshot.data() as QuickBooksConnection);
        } else {
          setQbConnection(null);
        }
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  // Fetch metrics when connected
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const isConnected = qbConnection?.status === "connected" || qbConnection?.lastSyncAt;
    if (!isConnected) {
      setLoading(false);
      return;
    }

    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qbConnection, organizationId]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Calculate TTM date range - last 12 COMPLETE months
      const now = new Date();
      const ttmStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      const ttmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      // Fetch expenses from QuickBooks
      const expensesQuery = query(
        collection(db, "quickbooks_expenses"),
        where("organizationId", "==", organizationId)
      );
      const expensesSnap = await getDocs(expensesQuery);
      
      let totalExpenses = 0;
      let ttmExpenses = 0;
      let totalBills = 0;
      let totalPurchases = 0;
      let accountsPayable = 0;
      const monthlyData: Record<string, { amount: number; bills: number; purchases: number }> = {};
      const vendors = new Set<string>();
      
      expensesSnap.docs.forEach(doc => {
        const expense = doc.data();
        const amount = expense.totalAmount || 0;
        const date = expense.txnDate?.toDate?.() || new Date();
        const type = expense.type || "expense";
        
        totalExpenses += amount;
        accountsPayable += expense.balance || 0;
        
        // Track vendor
        if (expense.vendorId) {
          vendors.add(expense.vendorId);
        }
        
        // Count by type
        if (type === "bill") {
          totalBills++;
        } else {
          totalPurchases++;
        }
        
        // Check if within TTM period
        if (date >= ttmStart && date <= ttmEnd) {
          ttmExpenses += amount;
        }
        
        // Group by month
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { amount: 0, bills: 0, purchases: 0 };
        }
        monthlyData[monthKey].amount += amount;
        if (type === "bill") {
          monthlyData[monthKey].bills++;
        } else {
          monthlyData[monthKey].purchases++;
        }
      });

      // Calculate monthly average (TTM / 12)
      const monthlyAverage = ttmExpenses / 12;

      // Convert to sorted array
      const sortedMonthly = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          amount: data.amount,
          bills: data.bills,
          purchases: data.purchases,
        }))
        .sort((a, b) => b.month.localeCompare(a.month));

      // Calculate trends
      const monthlyWithTrends = sortedMonthly.map((item, index) => {
        if (index < sortedMonthly.length - 1) {
          const prevAmount = sortedMonthly[index + 1].amount;
          const trend = prevAmount > 0 ? ((item.amount - prevAmount) / prevAmount) * 100 : 0;
          return { ...item, trend };
        }
        return item;
      });

      setMetrics({
        totalExpenses,
        ttmExpenses,
        monthlyAverage,
        totalBills,
        totalPurchases,
        accountsPayable,
        topVendorCount: vendors.size,
      });
      setMonthlyExpenses(monthlyWithTrends);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const isConnected = qbConnection?.status === "connected" || qbConnection?.lastSyncAt;

  if (!isConnected) {
    return (
      <AppLayout title="Expenses" subtitle="Track and manage business expenses">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="text-center py-12">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
              >
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                QuickBooks Not Connected
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
                Connect your QuickBooks account to view expense data.
              </p>
              <Link
                href="/revenue/quickbooks"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-foreground)",
                }}
              >
                <CheckCircle className="w-4 h-4" />
                Connect QuickBooks
              </Link>
            </div>
          </Card>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Expenses" subtitle="Track and manage business expenses">
      <div className="space-y-6">
        {/* QuickBooks Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#2CA01C20", color: "#2CA01C" }}
                >
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      QuickBooks
                    </h3>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    {qbConnection?.companyName || "Connected to QuickBooks"}
                    {qbConnection?.lastSyncAt && (
                      <span className="ml-2">
                        • Last synced {qbConnection.lastSyncAt.toDate().toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Link
                href="/revenue/quickbooks"
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  background: "var(--background-tertiary)",
                  color: "var(--foreground-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                Manage Connection
              </Link>
            </div>
          </Card>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Total Expenses
                </span>
                <Receipt className="w-4 h-4" style={{ color: "#ef4444" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
                {loading ? "..." : formatCurrency(metrics?.totalExpenses || 0)}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  TTM Expenses
                </span>
                <TrendingUp className="w-4 h-4" style={{ color: "#f59e0b" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                {loading ? "..." : formatCurrency(metrics?.ttmExpenses || 0)}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                Last 12 months
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Monthly Average
                </span>
                <CreditCard className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                {loading ? "..." : formatCurrency(metrics?.monthlyAverage || 0)}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                TTM average
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Accounts Payable
                </span>
                <FileText className="w-4 h-4" style={{ color: "#06b6d4" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#06b6d4" }}>
                {loading ? "..." : formatCurrency(metrics?.accountsPayable || 0)}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                Outstanding balance
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Monthly Expenses Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Monthly Expenses
              </h3>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {metrics?.totalBills || 0} bills • {metrics?.totalPurchases || 0} purchases
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8" style={{ color: "var(--foreground-muted)" }}>
                Loading expenses...
              </div>
            ) : monthlyExpenses.length === 0 ? (
              <div className="text-center py-8" style={{ color: "var(--foreground-muted)" }}>
                No expense data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                        Month
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                        Total Expenses
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                        Bills
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                        Purchases
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                        Trend
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyExpenses.map((item, index) => (
                      <tr
                        key={item.month}
                        style={{
                          borderBottom: index < monthlyExpenses.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground)" }}>
                          {formatMonth(item.month)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium" style={{ color: "#ef4444" }}>
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                          {item.bills}
                        </td>
                        <td className="py-3 px-4 text-sm text-right" style={{ color: "var(--foreground-muted)" }}>
                          {item.purchases}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {item.trend !== undefined && (
                            <span
                              className="flex items-center justify-end gap-1"
                              style={{
                                color: item.trend > 0 ? "#ef4444" : "#10b981",
                              }}
                            >
                              {item.trend > 0 ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {Math.abs(item.trend).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Total Bills
                </span>
                <FileText className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {loading ? "..." : metrics?.totalBills || 0}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Total Purchases
                </span>
                <CreditCard className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {loading ? "..." : metrics?.totalPurchases || 0}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Active Vendors
                </span>
                <Package className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {loading ? "..." : metrics?.topVendorCount || 0}
              </p>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

