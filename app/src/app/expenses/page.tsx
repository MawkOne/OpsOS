"use client";

import { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  Filter,
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
  bankBalance: number;
  bankAccountCount: number;
}

interface ExpenseRow {
  vendorId: string;
  vendorName: string;
  category: string;
  months: Record<string, number>; // "2026-01": 1500
  total: number;
}

interface MonthlyExpense {
  month: string;
  amount: number;
  bills: number;
  purchases: number;
  trend?: number;
}

type ViewMode = "ttm" | "year" | "all";

export default function ExpensesPage() {
  const { currentOrg } = useOrganization();
  const [qbConnection, setQbConnection] = useState<QuickBooksConnection | null>(null);
  const [metrics, setMetrics] = useState<ExpenseMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);
  const [expenseData, setExpenseData] = useState<ExpenseRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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

    fetchExpenseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qbConnection, organizationId, viewMode, selectedYear]);

  const fetchExpenseData = async () => {
    setLoading(true);
    try {
      // Calculate TTM date range - last 12 COMPLETE months
      const now = new Date();
      const ttmStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      const ttmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      // Fetch bank accounts from QuickBooks
      const accountsQuery = query(
        collection(db, "quickbooks_accounts"),
        where("organizationId", "==", organizationId),
        where("accountType", "==", "Bank")
      );
      const accountsSnap = await getDocs(accountsQuery);
      
      let bankBalance = 0;
      let bankAccountCount = 0;
      
      accountsSnap.docs.forEach(doc => {
        const account = doc.data();
        if (account.active !== false) {
          bankBalance += account.currentBalance || 0;
          bankAccountCount++;
        }
      });
      
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
      
      // Group expenses by vendor
      const vendorExpenses: Record<string, ExpenseRow> = {};
      
      expensesSnap.docs.forEach(doc => {
        const expense = doc.data();
        const amount = expense.totalAmount || 0;
        const date = expense.txnDate?.toDate?.() || new Date();
        const type = expense.type || "expense";
        const vendorName = expense.vendorName || "Unknown Vendor";
        const vendorId = expense.vendorId || "unknown";
        const category = expense.accountName || expense.categoryName || "Uncategorized";
        
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
        
        // Group by month for summary
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
        
        // Group by vendor for table
        const key = `${vendorId}_${category}`;
        if (!vendorExpenses[key]) {
          vendorExpenses[key] = {
            vendorId,
            vendorName,
            category,
            months: {},
            total: 0,
          };
        }
        
        // For all-time view, group by year
        if (isAllTime) {
          const yearKey = date.getFullYear().toString();
          vendorExpenses[key].months[yearKey] = (vendorExpenses[key].months[yearKey] || 0) + amount;
        } else {
          vendorExpenses[key].months[monthKey] = (vendorExpenses[key].months[monthKey] || 0) + amount;
        }
        vendorExpenses[key].total += amount;
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

      // Convert vendor expenses to array and sort by total
      const expenseRows = Object.values(vendorExpenses)
        .sort((a, b) => b.total - a.total);

      setMetrics({
        totalExpenses,
        ttmExpenses,
        monthlyAverage,
        totalBills,
        totalPurchases,
        accountsPayable,
        topVendorCount: vendors.size,
        bankBalance,
        bankAccountCount,
      });
      setMonthlyExpenses(monthlyWithTrends);
      setExpenseData(expenseRows);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter expense data
  const filteredExpenseData = useMemo(() => {
    if (categoryFilter === "all") return expenseData;
    return expenseData.filter(row => row.category === categoryFilter);
  }, [expenseData, categoryFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(expenseData.map(row => row.category));
    return Array.from(cats).sort();
  }, [expenseData]);

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredExpenseData.forEach(row => {
      Object.entries(row.months).forEach(([month, amount]) => {
        totals[month] = (totals[month] || 0) + amount;
      });
    });
    return totals;
  }, [filteredExpenseData]);

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
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    QuickBooks Connected
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    {qbConnection?.companyName || "Company"}
                    {qbConnection?.lastSyncAt && (
                      <> · Last synced {new Date(qbConnection.lastSyncAt.toDate()).toLocaleString()}</>
                    )}
                  </p>
                </div>
              </div>
              <Link
                href="/revenue/quickbooks"
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  background: "var(--card)",
                  color: "var(--foreground-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                Manage
              </Link>
            </div>
          </Card>
        </motion.div>

        {/* Metrics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                  Bank Balance
                </p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {loading ? "..." : formatCurrency(metrics?.bankBalance || 0)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {metrics?.bankAccountCount || 0} {metrics?.bankAccountCount === 1 ? "account" : "accounts"}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}
              >
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                  Total Expenses
                </p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {loading ? "..." : formatCurrency(metrics?.totalExpenses || 0)}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
              >
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                  TTM Expenses
                </p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {loading ? "..." : formatCurrency(metrics?.ttmExpenses || 0)}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
              >
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                  Monthly Average
                </p>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {loading ? "..." : formatCurrency(metrics?.monthlyAverage || 0)}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
              >
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Detailed Expense Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                    Expenses by Vendor
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                    Detailed breakdown of expenses by vendor and category
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Category Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-all duration-200"
                      style={{
                        background: "var(--card)",
                        color: "var(--foreground)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <option value="all">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

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

                  {/* Year Navigation (only for year view) */}
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
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-3 px-3 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Vendor
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Category
                    </th>
                    {monthLabels.map((label, index) => (
                      <th key={index} className="text-right py-3 px-3 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                        {label}
                      </th>
                    ))}
                    <th className="text-right py-3 px-3 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={monthLabels.length + 3} className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Loading expenses...
                      </td>
                    </tr>
                  ) : filteredExpenseData.length === 0 ? (
                    <tr>
                      <td colSpan={monthLabels.length + 3} className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        No expense data available
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredExpenseData.map((row, index) => (
                        <tr key={`${row.vendorId}_${row.category}_${index}`} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="py-3 px-3 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                            {row.vendorName}
                          </td>
                          <td className="py-3 px-3 text-xs" style={{ color: "var(--foreground-muted)" }}>
                            {row.category}
                          </td>
                          {months.map((month) => {
                            const amount = row.months[month] || 0;
                            return (
                              <td key={month} className="text-right py-3 px-3 text-xs" style={{ color: "var(--foreground)" }}>
                                {amount > 0 ? formatCurrency(amount) : "-"}
                              </td>
                            );
                          })}
                          <td className="text-right py-3 px-3 text-sm font-semibold" style={{ color: "#ef4444" }}>
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {/* Totals Row */}
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--muted)" }}>
                        <td className="py-3 px-3 text-sm font-bold" style={{ color: "var(--foreground)" }}>
                          Total
                        </td>
                        <td className="py-3 px-3"></td>
                        {months.map((month) => {
                          const total = monthlyTotals[month] || 0;
                          return (
                            <td key={month} className="text-right py-3 px-3 text-xs font-bold" style={{ color: "var(--foreground)" }}>
                              {total > 0 ? formatCurrency(total) : "-"}
                            </td>
                          );
                        })}
                        <td className="text-right py-3 px-3 text-sm font-bold" style={{ color: "#ef4444" }}>
                          {formatCurrency(filteredExpenseData.reduce((sum, row) => sum + row.total, 0))}
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
