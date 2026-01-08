"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Repeat,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Package,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";

interface StripeConnection {
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSyncAt?: { toDate: () => Date };
  lastSyncResults?: {
    payments: number;
    subscriptions: number;
    customers: number;
    products: number;
    prices: number;
  };
  isTestMode?: boolean;
}

interface RevenueMetrics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  ttmRevenue: number;
  totalCustomers: number;
  activeSubscriptions: number;
  totalProducts: number;
  recentPayments: number;
  avgRevenuePerCustomer: number;
}

export default function RevenueDashboard() {
  const { currentOrg } = useOrganization();
  const [stripeConnection, setStripeConnection] = useState<StripeConnection | null>(null);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; amount: number }[]>([]);

  const organizationId = currentOrg?.id || "";

  // Listen to Stripe connection
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "stripe_connections", organizationId),
      (snapshot) => {
        if (snapshot.exists()) {
          setStripeConnection(snapshot.data() as StripeConnection);
        } else {
          setStripeConnection(null);
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

    const isConnected = stripeConnection?.status === "connected" || stripeConnection?.lastSyncAt;
    if (!isConnected) {
      setLoading(false);
      return;
    }

    fetchMetrics();
  }, [stripeConnection, organizationId]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Calculate TTM date range - trailing 365 days (not calendar months)
      const now = new Date();
      const ttmStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 365 days ago
      
      // Fetch payments
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded")
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      
      let totalRevenue = 0;
      let ttmRevenue = 0;
      const monthlyData: Record<string, number> = {};
      
      paymentsSnap.docs.forEach(doc => {
        const payment = doc.data();
        const amount = (payment.amount || 0) / 100; // cents to dollars
        const date = payment.created?.toDate?.() || new Date();
        
        totalRevenue += amount;
        
        // Check if within TTM period
        if (date >= ttmStart) {
          ttmRevenue += amount;
        }
        
        // Group by month
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
      });

      // Fetch subscriptions
      const subsQuery = query(
        collection(db, "stripe_subscriptions"),
        where("organizationId", "==", organizationId)
      );
      const subsSnap = await getDocs(subsQuery);
      
      let mrr = 0;
      let activeSubscriptions = 0;
      
      // Valid statuses for MRR calculation (not canceled/incomplete)
      const validStatuses = ["active", "trialing", "past_due"];
      
      subsSnap.docs.forEach(doc => {
        const sub = doc.data();
        
        if (validStatuses.includes(sub.status)) {
          activeSubscriptions++;
          
          // Use stored MRR, or calculate from items if not available
          if (sub.mrr && sub.mrr > 0) {
            mrr += sub.mrr;
          } else if (sub.items && sub.items.length > 0) {
            // Calculate MRR from items
            sub.items.forEach((item: any) => {
              const unitAmount = (item.unitAmount || 0) / 100; // Convert cents to dollars
              const quantity = item.quantity || 1;
              let monthlyAmount = unitAmount * quantity;
              
              // Adjust for billing interval
              if (item.interval === "year") {
                monthlyAmount = monthlyAmount / 12;
              } else if (item.interval === "week") {
                monthlyAmount = monthlyAmount * 4;
              }
              
              mrr += monthlyAmount;
            });
          }
        }
      });

      // Fetch customers
      const customersQuery = query(
        collection(db, "stripe_customers"),
        where("organizationId", "==", organizationId)
      );
      const customersSnap = await getDocs(customersQuery);
      const totalCustomers = customersSnap.docs.length;

      // Fetch products
      const productsQuery = query(
        collection(db, "stripe_products"),
        where("organizationId", "==", organizationId)
      );
      const productsSnap = await getDocs(productsQuery);
      const totalProducts = productsSnap.docs.length;

      // Recent payments (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentPayments = paymentsSnap.docs.filter(doc => {
        const date = doc.data().created?.toDate?.();
        return date && date >= thirtyDaysAgo;
      }).length;

      setMetrics({
        mrr,
        arr: mrr * 12,
        totalRevenue,
        ttmRevenue,
        totalCustomers,
        activeSubscriptions,
        totalProducts,
        recentPayments,
        avgRevenuePerCustomer: totalCustomers > 0 ? ttmRevenue / totalCustomers : 0,
      });

      // Set monthly revenue for chart (last 12 months)
      const sortedMonths = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, amount]) => ({ month, amount }));
      setMonthlyRevenue(sortedMonths);

    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const isStripeConnected = stripeConnection?.status === "connected" || stripeConnection?.lastSyncAt;
  const connectedSourcesCount = isStripeConnected ? 1 : 0;
  const totalSourcesCount = 2; // QuickBooks + Stripe

  // Calculate max for chart scaling
  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map(m => m.amount), 1);

  return (
    <AppLayout title="Revenue" subtitle="Track and analyze your revenue streams">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <MetricCard
              label="Monthly Recurring Revenue"
              value={metrics?.mrr ? formatCurrency(metrics.mrr) : "—"}
              icon={<DollarSign className="w-5 h-5" />}
              color="#10b981"
              subtitle={isStripeConnected ? "from active subscriptions" : "Connect Stripe to track"}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <MetricCard
              label="Annual Run Rate"
              value={metrics?.arr ? formatCurrency(metrics.arr) : "—"}
              icon={<TrendingUp className="w-5 h-5" />}
              color="#3b82f6"
              subtitle="MRR × 12"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MetricCard
              label="TTM Revenue"
              value={metrics?.ttmRevenue ? formatCurrency(metrics.ttmRevenue) : "—"}
              icon={<CreditCard className="w-5 h-5" />}
              color="#8b5cf6"
              subtitle="last 365 days"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <MetricCard
              label="Connected Sources"
              value={`${connectedSourcesCount}/${totalSourcesCount}`}
              icon={<CheckCircle className="w-5 h-5" />}
              color="#f59e0b"
            />
          </motion.div>
        </div>

        {/* Secondary Metrics */}
        {isStripeConnected && metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#10b98120", color: "#10b981" }}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.totalCustomers}</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Customers</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.activeSubscriptions}</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Active Subscriptions</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620", color: "#8b5cf6" }}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{metrics.totalProducts}</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Products</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#f59e0b20", color: "#f59e0b" }}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{formatCurrency(metrics.avgRevenuePerCustomer)}</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Avg per Customer</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Revenue Sources */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Revenue Sources
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* QuickBooks Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <SourceCard
                name="QuickBooks"
                description="Import invoices, payments, and financial data from QuickBooks"
                icon={<Receipt className="w-6 h-6" />}
                color="#2CA01C"
                status="disconnected"
                href="/revenue/quickbooks"
              />
            </motion.div>

            {/* Stripe Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <SourceCard
                name="Stripe"
                description="Track payments, subscriptions, and recurring revenue from Stripe"
                icon={<CreditCard className="w-6 h-6" />}
                color="#635BFF"
                status={isStripeConnected ? "connected" : stripeConnection?.status || "disconnected"}
                href="/revenue/stripe"
                lastSync={stripeConnection?.lastSyncAt?.toDate()}
                syncResults={stripeConnection?.lastSyncResults}
              />
            </motion.div>
          </div>
        </div>

        {/* Getting Started */}
        {connectedSourcesCount === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <div className="text-center py-8">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#10b98120", color: "#10b981" }}
                >
                  <DollarSign className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Connect Your First Revenue Source
                </h3>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--foreground-muted)" }}>
                  Connect QuickBooks or Stripe to automatically track your revenue, analyze trends, and get insights into your business performance.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/revenue/quickbooks"
                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                    style={{ background: "#2CA01C", color: "white" }}
                  >
                    <Receipt className="w-4 h-4" />
                    Connect QuickBooks
                  </Link>
                  <Link
                    href="/revenue/stripe"
                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                    style={{ background: "#635BFF", color: "white" }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Connect Stripe
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Revenue Chart */}
        {isStripeConnected && monthlyRevenue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                    Monthly Revenue
                  </h3>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Trailing 12 months</p>
                </div>
                <Link 
                  href="/revenue/sales"
                  className="text-sm font-medium flex items-center gap-1 hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  View Details
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              
              {/* Simple Bar Chart */}
              <div className="h-48 flex items-end gap-2">
                {monthlyRevenue.map((item, idx) => {
                  const heightPercent = (item.amount / maxMonthlyRevenue) * 100;
                  const monthLabel = new Date(item.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                  return (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center justify-end h-36">
                        <span className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                          {formatCurrency(item.amount)}
                        </span>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPercent, 2)}%` }}
                          transition={{ delay: 0.6 + idx * 0.03, duration: 0.3 }}
                          className="w-full rounded-t-md"
                          style={{ background: "#10b981", minHeight: "4px" }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {monthLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        {isStripeConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/revenue/sales">
                <Card className="hover:border-[var(--accent)] transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#10b98120", color: "#10b981" }}>
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>Sales by Product</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Monthly breakdown</p>
                    </div>
                  </div>
                </Card>
              </Link>
              <Link href="/revenue/analytics">
                <Card className="hover:border-[var(--accent)] transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>Analytics</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Trends & insights</p>
                    </div>
                  </div>
                </Card>
              </Link>
              <Link href="/revenue/stripe">
                <Card className="hover:border-[var(--accent)] transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#635BFF20", color: "#635BFF" }}>
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>Sync Data</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Update from Stripe</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon, 
  color, 
  change, 
  changeType,
  subtitle 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode; 
  color: string;
  change?: string;
  changeType?: "positive" | "negative";
  subtitle?: string;
}) {
  return (
    <div 
      className="p-4 rounded-xl"
      style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
        {change && (
          <span 
            className="text-xs font-medium flex items-center gap-0.5 mb-1"
            style={{ color: changeType === "positive" ? "#10b981" : "#ef4444" }}
          >
            {changeType === "positive" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{subtitle}</p>
      )}
    </div>
  );
}

function SourceCard({ 
  name, 
  description, 
  icon, 
  color, 
  status,
  href,
  lastSync,
  syncResults,
}: { 
  name: string; 
  description: string; 
  icon: React.ReactNode; 
  color: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  href: string;
  lastSync?: Date;
  syncResults?: {
    payments: number;
    subscriptions: number;
    customers: number;
    products: number;
    prices: number;
  };
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
        <div className="flex items-start gap-4">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}20`, color }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{name}</h3>
              {status === "connected" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )}
              {status === "syncing" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing
                </span>
              )}
              {status === "disconnected" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                  <AlertCircle className="w-3 h-3" />
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{description}</p>
            
            {/* Sync info for connected sources */}
            {status === "connected" && lastSync && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Last synced: {lastSync.toLocaleDateString()} at {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {syncResults && (
                  <div className="flex gap-3 mt-1 text-xs" style={{ color: "var(--foreground-muted)" }}>
                    <span>{syncResults.payments} payments</span>
                    <span>•</span>
                    <span>{syncResults.subscriptions} subs</span>
                    <span>•</span>
                    <span>{syncResults.customers} customers</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <ExternalLink 
            className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" 
            style={{ color: "var(--foreground-muted)" }} 
          />
        </div>
      </Card>
    </Link>
  );
}
