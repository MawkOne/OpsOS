"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Plus,
  Layers,
  Edit,
  Trash2,
  DollarSign,
  Package,
  TrendingUp,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc } from "firebase/firestore";
import { RevenueStream, RevenueStreamWithMetrics } from "@/types/revenue-streams";
import RevenueStreamModal from "@/components/RevenueStreamModal";

export default function RevenueStreamsPage() {
  const { currentOrg } = useOrganization();
  const [revenueStreams, setRevenueStreams] = useState<RevenueStreamWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [editingStream, setEditingStream] = useState<RevenueStream | undefined>(undefined);

  const organizationId = currentOrg?.id || "";

  // Listen to revenue streams
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const streamsQuery = query(
      collection(db, "revenue_streams"),
      where("organizationId", "==", organizationId)
    );

    const unsubscribe = onSnapshot(streamsQuery, async (snapshot) => {
      const streams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as RevenueStream[];

      // Calculate metrics for each stream
      const streamsWithMetrics = await calculateStreamMetrics(streams);
      setRevenueStreams(streamsWithMetrics);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organizationId]);

  const calculateStreamMetrics = async (streams: RevenueStream[]): Promise<RevenueStreamWithMetrics[]> => {
    try {
      // Use stripe_invoices - query all and filter (same as sales page!)
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnap = await getDocs(invoicesQuery);
      
      console.log("📊 Invoice Query Results:");
      console.log(`   Total invoices fetched: ${invoicesSnap.docs.length}`);
      
      // Check status distribution
      const statusCounts: Record<string, number> = {};
      let paidCount = 0;
      invoicesSnap.docs.forEach(doc => {
        const invoice = doc.data();
        const status = invoice.status || 'null';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (invoice.status === 'paid') paidCount++;
      });
      
      console.log(`   Status distribution:`, statusCounts);
      console.log(`   Paid invoices: ${paidCount}`);

      const streamsWithMetrics: RevenueStreamWithMetrics[] = streams.map(stream => {
        let totalRevenue = 0;
        const monthlyRevenue: Record<string, number> = {};
        let matchedLineItems = 0;
        
        console.log(`\n💰 Calculating: ${stream.name}`);
        console.log(`   Product IDs in stream: [${stream.productIds.join(', ')}]`);
        
        const hasUnlabeledProduct = stream.productIds.includes('unlabeled-payments');
        
        invoicesSnap.docs.forEach(doc => {
          const invoice = doc.data();
          
          // Only count paid invoices (same filter as sales page)
          if (invoice.status !== 'paid') return;
          
          const lineItems = invoice.lineItems || [];
          const date = invoice.created?.toDate?.() || new Date();
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
          
          if (lineItems.length > 0) {
            lineItems.forEach((lineItem: any) => {
              const productId = lineItem.productId;
              const amount = (lineItem.amount || 0) / 100;
              
              // Check if this line item's product is in this stream
              if (productId && stream.productIds.includes(productId)) {
                matchedLineItems++;
                totalRevenue += amount;
                monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
              }
              // Handle unlabeled payments if stream includes the unlabeled pseudo-product
              else if (!productId && hasUnlabeledProduct) {
                matchedLineItems++;
                totalRevenue += amount;
                monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
              }
            });
          }
        });

        console.log(`   ✅ Matched line items: ${matchedLineItems}`);
        console.log(`   💵 Total revenue: $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        return {
          ...stream,
          totalRevenue,
          monthlyRevenue,
          productCount: stream.productIds.length,
        };
      });

      return streamsWithMetrics;
    } catch (error) {
      console.error("Error calculating stream metrics:", error);
      return streams.map(s => ({
        ...s,
        totalRevenue: 0,
        monthlyRevenue: {},
        productCount: s.productIds.length,
      }));
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

  // Calculate totals
  const totalRevenue = revenueStreams.reduce((sum, stream) => sum + stream.totalRevenue, 0);
  const totalProducts = revenueStreams.reduce((sum, stream) => sum + stream.productCount, 0);
  const avgRevenuePerStream = revenueStreams.length > 0 ? totalRevenue / revenueStreams.length : 0;

  return (
    <AppLayout title="Revenue Streams" subtitle="Group products into logical revenue streams">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Total Streams
                </span>
                <Layers className="w-4 h-4" style={{ color: "#10b981" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                {revenueStreams.length}
              </p>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Total Revenue
                </span>
                <DollarSign className="w-4 h-4" style={{ color: "#3b82f6" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
                {formatCurrency(totalRevenue)}
              </p>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Total Products
                </span>
                <Package className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                {totalProducts}
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
                  Avg per Stream
                </span>
                <TrendingUp className="w-4 h-4" style={{ color: "#f59e0b" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                {formatCurrency(avgRevenuePerStream)}
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Your Revenue Streams
            </h2>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              {revenueStreams.length === 0 ? "Create your first revenue stream" : `${revenueStreams.length} stream${revenueStreams.length === 1 ? '' : 's'} tracking revenue`}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingStream(undefined);
              setShowStreamModal(true);
            }}
            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all"
            style={{
              background: "var(--accent)",
              color: "#ffffff",
            }}
          >
            <Plus className="w-4 h-4" />
            New Stream
          </button>
        </div>

        {/* Streams Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : revenueStreams.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Layers className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                No Revenue Streams Yet
              </h3>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--foreground-muted)" }}>
                Create revenue streams to group products by category and track revenue by stream. 
                For example: "Job Listings", "Subscriptions", or "Consulting Services".
              </p>
              <button
                onClick={() => setShowStreamModal(true)}
                className="px-6 py-3 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
                style={{
                  background: "var(--accent)",
                  color: "#ffffff",
                }}
              >
                <Plus className="w-5 h-5" />
                Create Your First Stream
              </button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {revenueStreams.map((stream, idx) => (
              <motion.div
                key={stream.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="hover:border-[var(--accent)] transition-all group h-full">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${stream.color}20`, color: stream.color }}
                        >
                          <Layers className="w-6 h-6" />
                        </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-base truncate" style={{ color: "var(--foreground)" }}>
                                {stream.name}
                              </h3>
                            </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingStream(stream);
                            setShowStreamModal(true);
                          }}
                          className="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete "${stream.name}"? This action cannot be undone.`)) {
                              try {
                                await deleteDoc(doc(db, "revenue_streams", stream.id));
                              } catch (error) {
                                console.error("Error deleting stream:", error);
                                alert("Failed to delete revenue stream");
                              }
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} />
                        </button>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>
                            Total Revenue
                          </p>
                          <p className="text-2xl font-bold" style={{ color: stream.color }}>
                            {formatCurrency(stream.totalRevenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>
                            Products
                          </p>
                          <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                            {stream.productCount}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Recent Revenue (if available) */}
                    {Object.keys(stream.monthlyRevenue).length > 0 && (
                      <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                        <p className="text-xs mb-2" style={{ color: "var(--foreground-muted)" }}>
                          Recent Months
                        </p>
                        <div className="flex gap-1">
                          {Object.entries(stream.monthlyRevenue)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .slice(0, 6)
                            .reverse()
                            .map(([month, amount]) => {
                              const maxAmount = Math.max(...Object.values(stream.monthlyRevenue));
                              const heightPercent = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                              return (
                                <div key={month} className="flex-1 flex flex-col items-center">
                                  <div
                                    className="w-full rounded-t"
                                    style={{
                                      height: `${Math.max(heightPercent, 10)}px`,
                                      background: stream.color,
                                      opacity: 0.7,
                                    }}
                                    title={`${month}: ${formatCurrency(amount)}`}
                                  />
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Revenue Stream Modal */}
        {showStreamModal && (
          <RevenueStreamModal
            organizationId={organizationId}
            onClose={() => {
              setShowStreamModal(false);
              setEditingStream(undefined);
            }}
            existingStream={editingStream}
          />
        )}
      </div>
    </AppLayout>
  );
}

