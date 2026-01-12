"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  Plus,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

interface Metric {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category: "conversion" | "revenue" | "customer" | "marketing" | "product" | "other";
  value: number;
  unit: "percentage" | "currency" | "number" | "ratio";
  target?: number;
  previousValue?: number;
  lastUpdated?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const metricCategories = [
  { value: "conversion", label: "Conversion", color: "#00d4aa" },
  { value: "revenue", label: "Revenue", color: "#10b981" },
  { value: "customer", label: "Customer", color: "#3b82f6" },
  { value: "marketing", label: "Marketing", color: "#ec4899" },
  { value: "product", label: "Product", color: "#8b5cf6" },
  { value: "other", label: "Other", color: "#f59e0b" },
];

export default function MetricsPage() {
  const { currentOrg } = useOrganization();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Load metrics from Firestore
  useEffect(() => {
    if (!currentOrg?.id) {
      return;
    }

    const metricsQuery = query(
      collection(db, "metrics"), 
      where("organizationId", "==", currentOrg.id)
    );

    const unsubscribe = onSnapshot(metricsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Metric));
      setMetrics(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Filter metrics by category
  const filteredMetrics = filterCategory === "all" 
    ? metrics 
    : metrics.filter(m => m.category === filterCategory);

  // Group metrics by category
  const metricsByCategory = filteredMetrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = [];
    }
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, Metric[]>);

  // Calculate summary stats
  const totalMetrics = metrics.length;
  const metricsOnTarget = metrics.filter(m => 
    m.target && m.value >= m.target
  ).length;
  const metricsImproved = metrics.filter(m => 
    m.previousValue !== undefined && m.value > m.previousValue
  ).length;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this metric?")) return;
    try {
      await deleteDoc(doc(db, "metrics", id));
    } catch (error) {
      console.error("Error deleting metric:", error);
    }
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case "percentage":
        return `${value.toFixed(2)}%`;
      case "currency":
        return `$${value.toLocaleString()}`;
      case "ratio":
        return `${value.toFixed(2)}:1`;
      default:
        return value.toLocaleString();
    }
  };

  const getChangeColor = (metric: Metric) => {
    if (metric.previousValue === undefined) return "var(--foreground-muted)";
    const change = metric.value - metric.previousValue;
    return change > 0 ? "#00d4aa" : change < 0 ? "#ef4444" : "var(--foreground-muted)";
  };

  const getChangeIcon = (metric: Metric) => {
    if (metric.previousValue === undefined) return null;
    const change = metric.value - metric.previousValue;
    return change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : null;
  };

  if (loading) {
    return (
      <AppLayout title="Metrics" subtitle="Track key business metrics">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Loading metrics...
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Metrics" subtitle="Track conversion rates and key performance indicators">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Metrics" 
            value={totalMetrics}
            change={`${metricsByCategory.conversion?.length || 0} conversion`}
            changeType="neutral"
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard 
            label="On Target" 
            value={metricsOnTarget}
            change={`${Math.round((metricsOnTarget / totalMetrics) * 100)}% of metrics`}
            changeType="positive"
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard 
            label="Improved" 
            value={metricsImproved}
            change="vs previous period"
            changeType="positive"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard 
            label="Categories" 
            value={Object.keys(metricsByCategory).length}
            change={`${metricCategories.length} available`}
            changeType="neutral"
            icon={<Percent className="w-5 h-5" />}
          />
        </div>

        {/* Actions & Filters */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            <Plus className="w-4 h-4" />
            New Metric
          </button>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All Categories</option>
            {metricCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Metrics by Category */}
        {Object.keys(metricsByCategory).length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--foreground-muted)" }} />
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                No metrics yet. Track your key performance indicators!
              </p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Your First Metric
              </button>
            </div>
          </Card>
        ) : (
          Object.entries(metricsByCategory).map(([category, categoryMetrics]) => {
            const categoryConfig = metricCategories.find(c => c.value === category);
            return (
              <Card key={category}>
                <CardHeader 
                  title={categoryConfig?.label || category}
                  subtitle={`${categoryMetrics.length} metric${categoryMetrics.length !== 1 ? 's' : ''}`}
                  icon={<Activity className="w-5 h-5" style={{ color: categoryConfig?.color }} />}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryMetrics.map((metric, idx) => (
                    <motion.div
                      key={metric.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-xl group relative"
                      style={{ background: "var(--background-tertiary)" }}
                    >
                      {/* Actions */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => setEditingMetric(metric)}
                          className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)]"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(metric.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)]"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Metric Name */}
                      <h4 className="font-semibold mb-1 pr-12" style={{ color: "var(--foreground)" }}>
                        {metric.name}
                      </h4>
                      {metric.description && (
                        <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
                          {metric.description}
                        </p>
                      )}

                      {/* Value */}
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-2xl font-bold" style={{ color: categoryConfig?.color }}>
                          {formatValue(metric.value, metric.unit)}
                        </span>
                        {getChangeIcon(metric) && (
                          <span className="flex items-center gap-1 text-sm" style={{ color: getChangeColor(metric) }}>
                            {getChangeIcon(metric)}
                            {metric.previousValue !== undefined && (
                              <span>{Math.abs(metric.value - metric.previousValue).toFixed(1)}</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Target */}
                      {metric.target !== undefined && (
                        <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          Target: {formatValue(metric.target, metric.unit)}
                          {metric.value >= metric.target && (
                            <span className="ml-2" style={{ color: "#00d4aa" }}>✓ On track</span>
                          )}
                        </div>
                      )}

                      {/* Last Updated */}
                      {metric.lastUpdated && (
                        <div className="text-xs mt-2 pt-2 border-t" style={{ 
                          color: "var(--foreground-muted)", 
                          borderColor: "var(--border)" 
                        }}>
                          Updated {metric.lastUpdated.toDate().toLocaleDateString()}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingMetric) && (
        <MetricModal
          metric={editingMetric}
          onClose={() => {
            setShowAddModal(false);
            setEditingMetric(null);
          }}
          organizationId={currentOrg?.id || ""}
        />
      )}
    </AppLayout>
  );
}

// Metric Modal Component
function MetricModal({ 
  metric, 
  onClose, 
  organizationId 
}: { 
  metric: Metric | null;
  onClose: () => void; 
  organizationId: string;
}) {
  const [formData, setFormData] = useState({
    name: metric?.name || "",
    description: metric?.description || "",
    category: metric?.category || "conversion" as "conversion" | "revenue" | "customer" | "marketing" | "product" | "other",
    value: metric?.value || 0,
    unit: metric?.unit || "percentage" as "percentage" | "currency" | "number" | "ratio",
    target: metric?.target || undefined,
    previousValue: metric?.previousValue || undefined,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      if (metric) {
        // Update existing metric
        await updateDoc(doc(db, "metrics", metric.id), {
          ...formData,
          lastUpdated: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new metric
        await addDoc(collection(db, "metrics"), {
          ...formData,
          organizationId,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving metric:", error);
      alert("Failed to save metric");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--background)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            {metric ? "Edit Metric" : "New Metric"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--background-secondary)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Metric Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="e.g. Checkout Conversion Rate"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="Brief description of what this metric tracks..."
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as Metric["category"] })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                {metricCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value as Metric["unit"] })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="currency">Currency ($)</option>
                <option value="number">Number</option>
                <option value="ratio">Ratio (X:1)</option>
              </select>
            </div>
          </div>

          {/* Current Value & Target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Current Value *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Target (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.target || ""}
                onChange={(e) => setFormData({ ...formData, target: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>

          {/* Previous Value (for comparison) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Previous Value (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.previousValue || ""}
              onChange={(e) => setFormData({ ...formData, previousValue: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="For trend comparison..."
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting || !formData.name.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              {submitting ? "Saving..." : metric ? "Update Metric" : "Create Metric"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg font-medium"
              style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

