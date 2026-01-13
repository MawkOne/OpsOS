"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Filter,
  Search,
  Download,
  CreditCard,
  Receipt,
  Activity,
  Mail,
  Search as SearchIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

interface MasterRecord {
  id: string;
  source: "stripe" | "quickbooks" | "google-analytics" | "activecampaign" | "dataforseo";
  type: string;
  date: Date;
  amount?: number;
  currency?: string;
  description: string;
  status?: string;
  metadata: Record<string, any>;
}

type SortField = "date" | "amount" | "source" | "type";
type SortDirection = "asc" | "desc";

export default function MasterTablePage() {
  const { currentOrg } = useOrganization();
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const organizationId = currentOrg?.id || "";

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchAllData();
  }, [organizationId]);

  const fetchAllData = async () => {
    setLoading(true);
    const allRecords: MasterRecord[] = [];

    try {
      // Fetch Stripe data
      await fetchStripeData(allRecords);
      
      // Fetch QuickBooks data
      await fetchQuickBooksData(allRecords);
      
      // Fetch Google Analytics data (limited sample)
      await fetchGoogleAnalyticsData(allRecords);
      
      setRecords(allRecords);
    } catch (error) {
      console.error("Error fetching master table data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeData = async (allRecords: MasterRecord[]) => {
    try {
      // Fetch Stripe Payments
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        orderBy("created", "desc"),
        limit(500)
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      
      paymentsSnap.docs.forEach(doc => {
        const data = doc.data();
        allRecords.push({
          id: doc.id,
          source: "stripe",
          type: "Payment",
          date: data.created?.toDate?.() || new Date(),
          amount: data.amount / 100, // Convert from cents
          currency: data.currency?.toUpperCase() || "USD",
          description: data.description || `Payment from ${data.customer?.email || "customer"}`,
          status: data.status,
          metadata: {
            customerId: data.customer?.id,
            customerEmail: data.customer?.email,
            paymentMethod: data.paymentMethod,
          },
        });
      });

      // Fetch Stripe Invoices
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId),
        orderBy("created", "desc"),
        limit(500)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      invoicesSnap.docs.forEach(doc => {
        const data = doc.data();
        allRecords.push({
          id: doc.id,
          source: "stripe",
          type: "Invoice",
          date: data.created?.toDate?.() || new Date(),
          amount: data.total / 100,
          currency: data.currency?.toUpperCase() || "USD",
          description: `Invoice #${data.number || data.stripeId}`,
          status: data.status,
          metadata: {
            customerId: data.customerId,
            subscriptionId: data.subscriptionId,
          },
        });
      });
    } catch (error) {
      console.error("Error fetching Stripe data:", error);
    }
  };

  const fetchQuickBooksData = async (allRecords: MasterRecord[]) => {
    try {
      // Fetch QuickBooks Invoices
      const invoicesQuery = query(
        collection(db, "quickbooks_invoices"),
        where("organizationId", "==", organizationId),
        limit(500)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      invoicesSnap.docs.forEach(doc => {
        const data = doc.data();
        allRecords.push({
          id: doc.id,
          source: "quickbooks",
          type: "Invoice",
          date: data.txnDate?.toDate?.() || new Date(),
          amount: data.totalAmount || 0,
          currency: data.currency || "CAD",
          description: `Invoice #${data.docNumber || data.quickbooksId}`,
          status: data.status,
          metadata: {
            customerId: data.customerId,
            customerName: data.customerName,
          },
        });
      });

      // Fetch QuickBooks Expenses
      const expensesQuery = query(
        collection(db, "quickbooks_expenses"),
        where("organizationId", "==", organizationId),
        limit(500)
      );
      const expensesSnap = await getDocs(expensesQuery);
      
      expensesSnap.docs.forEach(doc => {
        const data = doc.data();
        allRecords.push({
          id: doc.id,
          source: "quickbooks",
          type: data.type === "bill" ? "Bill" : "Expense",
          date: data.txnDate?.toDate?.() || new Date(),
          amount: -(data.totalAmount || 0), // Negative for expenses
          currency: data.currency || "CAD",
          description: `${data.vendorName || "Vendor"} - ${data.accountName || data.categoryName || "Expense"}`,
          status: data.status,
          metadata: {
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            category: data.accountName || data.categoryName,
          },
        });
      });

      // Fetch QuickBooks Payments
      const paymentsQuery = query(
        collection(db, "quickbooks_payments"),
        where("organizationId", "==", organizationId),
        limit(500)
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      
      paymentsSnap.docs.forEach(doc => {
        const data = doc.data();
        allRecords.push({
          id: doc.id,
          source: "quickbooks",
          type: "Payment",
          date: data.txnDate?.toDate?.() || new Date(),
          amount: data.totalAmount || 0,
          currency: data.currency || "CAD",
          description: `Payment ${data.paymentMethod || ""}`,
          status: "completed",
          metadata: {
            paymentMethod: data.paymentMethod,
            customerId: data.customerId,
          },
        });
      });
    } catch (error) {
      console.error("Error fetching QuickBooks data:", error);
    }
  };

  const fetchGoogleAnalyticsData = async (allRecords: MasterRecord[]) => {
    try {
      // Note: GA data is typically stored differently
      // This is a placeholder for event-based data
      const eventsQuery = query(
        collection(db, "ga4_events"),
        where("organizationId", "==", organizationId),
        limit(100) // Limit GA events as they can be numerous
      );
      const eventsSnap = await getDocs(eventsQuery);
      
      eventsSnap.docs.forEach(doc => {
        const data = doc.data();
        allRecords.push({
          id: doc.id,
          source: "google-analytics",
          type: "Event",
          date: data.timestamp?.toDate?.() || new Date(),
          description: `${data.eventName || "Event"} - ${data.pagePath || ""}`,
          metadata: {
            eventName: data.eventName,
            pagePath: data.pagePath,
            sessionId: data.sessionId,
            userId: data.userId,
          },
        });
      });
    } catch (error) {
      console.error("Error fetching Google Analytics data:", error);
    }
  };

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Source filter
    if (sourceFilter !== "all") {
      filtered = filtered.filter(record => record.source === sourceFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(record => record.type === typeFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date":
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case "amount":
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case "source":
          comparison = a.source.localeCompare(b.source);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [records, searchTerm, sourceFilter, typeFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sourceIcons = {
    stripe: <CreditCard className="w-4 h-4" />,
    quickbooks: <Receipt className="w-4 h-4" />,
    "google-analytics": <Activity className="w-4 h-4" />,
    activecampaign: <Mail className="w-4 h-4" />,
    dataforseo: <SearchIcon className="w-4 h-4" />,
  };

  const sourceColors = {
    stripe: "#635BFF",
    quickbooks: "#2CA01C",
    "google-analytics": "#E37400",
    activecampaign: "#356AE6",
    dataforseo: "#0066FF",
  };

  const uniqueTypes = useMemo(() => {
    const types = new Set(records.map(r => r.type));
    return Array.from(types).sort();
  }, [records]);

  const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
    if (amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout title="Master Table" subtitle="All records from all data sources">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                Total Records
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {loading ? "..." : records.length.toLocaleString()}
              </p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                Filtered Records
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {filteredAndSortedRecords.length.toLocaleString()}
              </p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                Data Sources
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {new Set(records.map(r => r.source)).size}
              </p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                Record Types
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {uniqueTypes.length}
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              {/* Source Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="all">All Sources</option>
                <option value="stripe">Stripe</option>
                <option value="quickbooks">QuickBooks</option>
                <option value="google-analytics">Google Analytics</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {/* Export Button */}
              <button
                className="px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:bg-[var(--sidebar-hover)]"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-3 px-4 text-xs font-medium cursor-pointer hover:bg-[var(--sidebar-hover)]" style={{ color: "var(--foreground-muted)" }} onClick={() => toggleSort("source")}>
                      <div className="flex items-center gap-2">
                        Source
                        {sortField === "source" && (
                          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium cursor-pointer hover:bg-[var(--sidebar-hover)]" style={{ color: "var(--foreground-muted)" }} onClick={() => toggleSort("type")}>
                      <div className="flex items-center gap-2">
                        Type
                        {sortField === "type" && (
                          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium cursor-pointer hover:bg-[var(--sidebar-hover)]" style={{ color: "var(--foreground-muted)" }} onClick={() => toggleSort("date")}>
                      <div className="flex items-center gap-2">
                        Date
                        {sortField === "date" && (
                          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Description
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium cursor-pointer hover:bg-[var(--sidebar-hover)]" style={{ color: "var(--foreground-muted)" }} onClick={() => toggleSort("amount")}>
                      <div className="flex items-center justify-end gap-2">
                        Amount
                        {sortField === "amount" && (
                          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Loading records...
                      </td>
                    </tr>
                  ) : filteredAndSortedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
                        No records found
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedRecords.map((record) => (
                      <tr key={record.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-[var(--sidebar-hover)] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div style={{ color: sourceColors[record.source] }}>
                              {sourceIcons[record.source]}
                            </div>
                            <span className="text-xs capitalize" style={{ color: "var(--foreground)" }}>
                              {record.source.replace("-", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs" style={{ color: "var(--foreground)" }}>
                          {record.type}
                        </td>
                        <td className="py-3 px-4 text-xs" style={{ color: "var(--foreground-muted)" }}>
                          {formatDate(record.date)}
                        </td>
                        <td className="py-3 px-4 text-xs" style={{ color: "var(--foreground)" }}>
                          {record.description}
                        </td>
                        <td className="py-3 px-4 text-xs text-right font-semibold" style={{ color: record.amount && record.amount < 0 ? "#ef4444" : "#10b981" }}>
                          {formatCurrency(record.amount, record.currency)}
                        </td>
                        <td className="py-3 px-4">
                          {record.status && (
                            <span
                              className="text-xs px-2 py-1 rounded-full"
                              style={{
                                background: record.status === "paid" || record.status === "succeeded" ? "#10b98120" : "var(--muted)",
                                color: record.status === "paid" || record.status === "succeeded" ? "#10b981" : "var(--foreground-muted)",
                              }}
                            >
                              {record.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
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
