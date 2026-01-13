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
      // Fetch all payments
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded")
      );
      const paymentsSnap = await getDocs(paymentsQuery);

      // Fetch all subscriptions (for payments without lineItems)
      const subscriptionsQuery = query(
        collection(db, "stripe_subscriptions"),
        where("organizationId", "==", organizationId)
      );
      const subscriptionsSnap = await getDocs(subscriptionsQuery);
      
      // Build subscription ID -> product IDs map
      const subscriptionToProducts = new Map<string, string[]>();
      
      console.log("🔎 Inspecting subscription items structure:");
      subscriptionsSnap.docs.slice(0, 3).forEach((doc, i) => {
        const sub = doc.data();
        console.log(`   Subscription ${i} (${sub.stripeId}):`);
        console.log(`      Items array:`, sub.items);
        if (sub.items && sub.items.length > 0) {
          sub.items.forEach((item: any, idx: number) => {
            console.log(`         Item ${idx}:`, {
              priceId: item.priceId,
              productId: item.productId,
              productName: item.productName,
              allKeys: Object.keys(item)
            });
          });
        }
      });
      
      subscriptionsSnap.docs.forEach(doc => {
        const sub = doc.data();
        const productIds = (sub.items || [])
          .map((item: any) => item.productId)
          .filter((id: string) => id);
        if (productIds.length > 0) {
          subscriptionToProducts.set(sub.stripeId, productIds);
        }
      });
      
      console.log("📊 Loaded subscriptions:", subscriptionToProducts.size);
      
      // Show first 3 subscription mappings with explicit formatting
      const first3Subs = Array.from(subscriptionToProducts.entries()).slice(0, 3);
      first3Subs.forEach(([subId, productIds], i) => {
        console.log(`   Subscription ${i}: ${subId} -> Products: [${productIds.join(', ')}]`);
      });
      
      // Check if any subscription has the Job Listing product
      const jobListingProductId = 'prod_MgvGuhDR8gUGmF';
      const subsWithJobListing = Array.from(subscriptionToProducts.entries())
        .filter(([_, productIds]) => productIds.includes(jobListingProductId));
      console.log(`   ⭐ Subscriptions with ${jobListingProductId}: ${subsWithJobListing.length}`);
      if (subsWithJobListing.length > 0) {
        subsWithJobListing.slice(0, 3).forEach(([subId, productIds]) => {
          console.log(`      - ${subId}: [${productIds.join(', ')}]`);
        });
      }
      
      // Check how many payments have subscriptionId
      const paymentsWithSub = paymentsSnap.docs.filter(doc => doc.data().subscriptionId).length;
      const paymentsWithLineItems = paymentsSnap.docs.filter(doc => doc.data().lineItems?.length > 0).length;
      console.log(`   📋 Payments with subscriptionId: ${paymentsWithSub} / ${paymentsSnap.docs.length}`);
      console.log(`   📋 Payments with lineItems: ${paymentsWithLineItems} / ${paymentsSnap.docs.length}`);
      
      // Show all unique product IDs
      const allSubProductIds = new Set<string>();
      subscriptionToProducts.forEach((productIds) => {
        productIds.forEach(pid => allSubProductIds.add(pid));
      });
      console.log(`   🏷️  All unique product IDs in subscriptions (${allSubProductIds.size} total):`);
      console.log(`      ${Array.from(allSubProductIds).join(', ')}`);
      
      // Check for any overlap with stripe_products
      // (This requires fetching products here for comparison)
      const productsQuery = query(
        collection(db, "stripe_products"),
        where("organizationId", "==", organizationId)
      );
      const productsSnap = await getDocs(productsQuery);
      const availableProductIds = productsSnap.docs.map(doc => doc.data().stripeId);
      
      console.log(`   🛍️  Product IDs in stripe_products (${availableProductIds.length} total):`);
      console.log(`      ${availableProductIds.slice(0, 10).join(', ')}${availableProductIds.length > 10 ? '...' : ''}`);
      
      const overlap = availableProductIds.filter(pid => allSubProductIds.has(pid));
      console.log(`   ✅ OVERLAP between products and subscriptions: ${overlap.length} matches`);
      if (overlap.length > 0) {
        console.log(`      Matching IDs: ${overlap.slice(0, 5).join(', ')}${overlap.length > 5 ? '...' : ''}`);
      } else {
        console.log(`      ❌ NO OVERLAP! This is the problem!`);
      }

      const streamsWithMetrics: RevenueStreamWithMetrics[] = streams.map(stream => {
        let totalRevenue = 0;
        const monthlyRevenue: Record<string, number> = {};
        
        console.log("🔍 Calculating revenue for stream:", stream.name);
        console.log("   Stream product IDs:", stream.productIds);

        let matchedPayments = 0;
        let subscriptionFallbacks = 0;
        
        paymentsSnap.docs.forEach(doc => {
          const payment = doc.data();
          const lineItems = payment.lineItems || [];
          let matched = false;

          // Try 1: Check line items
          if (lineItems.length > 0) {
            lineItems.forEach((lineItem: any) => {
              const productId = lineItem.productId;
              
              if (productId && stream.productIds.includes(productId)) {
                matched = true;
                matchedPayments++;
                const amount = (lineItem.amount || 0) / 100;
                const date = payment.created?.toDate?.() || new Date();
                const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

                console.log("   ✅ Matched payment (lineItem):", {
                  productId,
                  amount,
                  monthKey
                });

                totalRevenue += amount;
                monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
              }
            });
          }
          
          // Try 2: If no line items, check subscription
          if (!matched && payment.subscriptionId) {
            const subProductIds = subscriptionToProducts.get(payment.subscriptionId) || [];
            const matchingProducts = subProductIds.filter(pid => stream.productIds.includes(pid));
            
            if (matchingProducts.length > 0) {
              matched = true;
              matchedPayments++;
              subscriptionFallbacks++;
              const amount = (payment.amount || 0) / 100;
              const date = payment.created?.toDate?.() || new Date();
              const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

              console.log("   ✅ Matched payment (subscription):", {
                subscriptionId: payment.subscriptionId,
                matchingProducts,
                amount,
                monthKey
              });

              totalRevenue += amount;
              monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
            }
          }
        });

        console.log("   Total matched payments:", matchedPayments);
        console.log("   Matched via lineItems:", matchedPayments - subscriptionFallbacks);
        console.log("   Matched via subscription:", subscriptionFallbacks);
        console.log("   Total revenue:", totalRevenue);
        console.log("   Total payments checked:", paymentsSnap.docs.length);

        // Debug: Show first 5 payments with subscription IDs
        if (matchedPayments === 0 && paymentsSnap.docs.length > 0) {
          console.log("   ⚠️ No matches found. First 5 payments:");
          paymentsSnap.docs.slice(0, 5).forEach((doc, i) => {
            const payment = doc.data();
            const subProducts = payment.subscriptionId ? subscriptionToProducts.get(payment.subscriptionId) : null;
            console.log(`   Payment ${i}:`);
            console.log(`      Amount: $${(payment.amount / 100).toFixed(2)}`);
            console.log(`      Subscription ID: ${payment.subscriptionId || 'NONE'}`);
            console.log(`      Subscription Products: ${subProducts ? `[${subProducts.join(', ')}]` : 'N/A'}`);
            console.log(`      Has LineItems: ${payment.lineItems?.length > 0 ? 'YES' : 'NO'}`);
            if (payment.lineItems?.length > 0) {
              payment.lineItems.forEach((li: any, idx: number) => {
                console.log(`         LineItem ${idx}: productId=${li.productId}, amount=$${(li.amount / 100).toFixed(2)}`);
              });
            }
          });
          
          console.log(`   🎯 Looking for product IDs: [${stream.productIds.join(', ')}]`);
        }

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

