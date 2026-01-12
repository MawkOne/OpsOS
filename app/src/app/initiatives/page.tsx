"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Play,
  Calendar,
  ArrowRight,
  Plus,
  DollarSign,
  Waves,
  TrendingDown,
  X,
} from "lucide-react";
import { Initiative, statusConfig, priorityColors, calculateWaterlinePosition, calculateInitiativeCosts, initiativeCategories, InitiativeStatus, InitiativeCategory } from "@/types/initiatives";
import { Person, Tool } from "@/types/resources";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";

// Stripe Product interface
interface StripeProduct {
  id: string;
  stripeId: string;
  name: string;
  description?: string;
  active: boolean;
  organizationId: string;
}

export default function InitiativesDashboard() {
  const { currentOrg } = useOrganization();
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<InitiativeStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<InitiativeCategory | "all">("all");
  const [filterType, setFilterType] = useState<"new" | "existing" | "all">("all");

  // Load data from Firestore
  useEffect(() => {
    if (!currentOrg?.id) {
      setLoading(false);
      return;
    }

    const initiativesQuery = query(
      collection(db, "initiatives"), 
      where("organizationId", "==", currentOrg.id),
      orderBy("waterlineScore", "desc")
    );
    const peopleQuery = query(
      collection(db, "people"), 
      where("organizationId", "==", currentOrg.id)
    );
    const toolsQuery = query(
      collection(db, "tools"), 
      where("organizationId", "==", currentOrg.id)
    );
    const productsQuery = query(
      collection(db, "stripe_products"), 
      where("organizationId", "==", currentOrg.id)
    );

    const unsubInitiatives = onSnapshot(initiativesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Initiative));
      setInitiatives(data);
      setLoading(false);
    });

    const unsubPeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
      setPeople(data);
    });

    const unsubTools = onSnapshot(toolsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
      setTools(data);
    });

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StripeProduct));
      setProducts(data);
    });

    return () => {
      unsubInitiatives();
      unsubPeople();
      unsubTools();
      unsubProducts();
    };
  }, [currentOrg?.id]);

  // Calculate available resources
  const resources = useMemo(() => {
    // Total budget (annual)
    const totalPeopleCost = people.reduce((sum, p) => {
      if (p.salaryType === "annual") return sum + p.salary;
      if (p.salaryType === "monthly") return sum + (p.salary * 12);
      return sum + (p.salary * p.hoursPerWeek * 52);
    }, 0);

    const totalToolsCost = tools.reduce((sum, t) => {
      if (t.billingCycle === "one_time") return sum;
      if (t.billingCycle === "annual") return sum + t.cost;
      return sum + (t.cost * 12);
    }, 0);

    const totalBudget = totalPeopleCost + totalToolsCost;

    // Available people hours (annual)
    const availablePeopleHours = people.reduce((sum, p) => {
      return sum + (p.hoursPerWeek * 52);
    }, 0);

    // Already allocated to in-progress initiatives
    const allocatedBudget = initiatives
      .filter(i => i.status === "in-progress" || i.status === "planned")
      .reduce((sum, i) => sum + (i.estimatedCost || 0), 0);

    const allocatedPeopleHours = initiatives
      .filter(i => i.status === "in-progress" || i.status === "planned")
      .reduce((sum, i) => sum + (i.estimatedPeopleHours || 0), 0);

    return {
      totalBudget,
      allocatedBudget,
      availablePeopleHours,
      allocatedPeopleHours,
      remainingBudget: totalBudget - allocatedBudget,
      remainingHours: availablePeopleHours - allocatedPeopleHours,
    };
  }, [people, tools, initiatives]);

  // Recalculate waterline positions for all initiatives
  const initiativesWithWaterline = useMemo(() => {
    return initiatives.map(initiative => {
      const { isAbove, score, reason } = calculateWaterlinePosition(initiative, resources);
      return {
        ...initiative,
        isAboveWaterline: isAbove,
        waterlineScore: score,
        waterlineReason: reason,
      };
    }).sort((a, b) => b.waterlineScore - a.waterlineScore);
  }, [initiatives, resources]);

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    return initiativesWithWaterline.filter(i => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterType !== "all" && i.type !== filterType) return false;
      return true;
    });
  }, [initiativesWithWaterline, filterStatus, filterCategory, filterType]);

  // Calculate stats
  const aboveWaterlineCount = initiativesWithWaterline.filter(i => i.isAboveWaterline && i.status !== "completed" && i.status !== "cancelled").length;
  const belowWaterlineCount = initiativesWithWaterline.filter(i => !i.isAboveWaterline && i.status !== "completed" && i.status !== "cancelled").length;
  const inProgressCount = initiativesWithWaterline.filter(i => i.status === "in-progress").length;
  const completedCount = initiativesWithWaterline.filter(i => i.status === "completed").length;

  // Find the waterline position (first initiative that's below waterline)
  const waterlineIndex = filteredInitiatives.findIndex(i => !i.isAboveWaterline && i.status !== "completed" && i.status !== "cancelled");

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this initiative?")) return;
    try {
      await deleteDoc(doc(db, "initiatives", id));
    } catch (error) {
      console.error("Error deleting initiative:", error);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Initiatives" subtitle="Track and manage strategic initiatives">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Loading initiatives...
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Initiatives" subtitle="Ideas limited by your resource waterline">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Above Waterline" 
            value={aboveWaterlineCount}
            change="Can execute"
            changeType="positive"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard 
            label="Below Waterline" 
            value={belowWaterlineCount}
            change="Need capacity"
            changeType="neutral"
            icon={<TrendingDown className="w-5 h-5" />}
          />
          <StatCard 
            label="In Progress" 
            value={inProgressCount}
            change={`${inProgressCount} active`}
            changeType="neutral"
            icon={<Play className="w-5 h-5" />}
          />
          <StatCard 
            label="Completed" 
            value={completedCount}
            change="This period"
            changeType="positive"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
        </div>

        {/* Resource Capacity Card */}
        <Card>
          <CardHeader 
            title="Resource Capacity" 
            subtitle="Your waterline is determined by available resources"
            icon={<Waves className="w-5 h-5" />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Budget */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Budget Capacity
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  ${resources.remainingBudget.toLocaleString()} / ${resources.totalBudget.toLocaleString()}
                </span>
              </div>
              <div 
                className="h-3 rounded-full overflow-hidden"
                style={{ background: "var(--background-secondary)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (resources.allocatedBudget / resources.totalBudget) * 100)}%`,
                    background: resources.allocatedBudget > resources.totalBudget * 0.9 ? "#ef4444" : "#00d4aa"
                  }}
                />
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                {Math.round((resources.allocatedBudget / resources.totalBudget) * 100)}% allocated
              </div>
            </div>

            {/* People Hours */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  People Capacity (Annual Hours)
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {resources.remainingHours.toLocaleString()}h / {resources.availablePeopleHours.toLocaleString()}h
                </span>
              </div>
              <div 
                className="h-3 rounded-full overflow-hidden"
                style={{ background: "var(--background-secondary)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (resources.allocatedPeopleHours / resources.availablePeopleHours) * 100)}%`,
                    background: resources.allocatedPeopleHours > resources.availablePeopleHours * 0.9 ? "#ef4444" : "#00d4aa"
                  }}
                />
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                {Math.round((resources.allocatedPeopleHours / resources.availablePeopleHours) * 100)}% allocated
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              <strong style={{ color: "var(--foreground)" }}>Waterline Concept:</strong> Initiatives above the waterline can be executed with your current resources ({people.length} people, {tools.length} tools). Those below need additional capacity.
            </p>
          </div>
        </Card>

        {/* Quick Actions & Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            <Plus className="w-4 h-4" />
            New Initiative
          </button>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as InitiativeStatus | "all")}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="idea">Ideas</option>
            <option value="proposed">Proposed</option>
            <option value="above-waterline">Above Waterline</option>
            <option value="below-waterline">Below Waterline</option>
            <option value="planned">Planned</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as InitiativeCategory | "all")}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All Categories</option>
            {initiativeCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "new" | "existing" | "all")}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All Types</option>
            <option value="new">New Initiatives</option>
            <option value="existing">Existing Baseline</option>
          </select>
        </div>

        {/* Initiatives List with Waterline */}
        <Card>
          <CardHeader 
            title="All Initiatives" 
            subtitle={`Sorted by waterline score • ${filteredInitiatives.length} total`}
            icon={<Target className="w-5 h-5" />}
          />

          {filteredInitiatives.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--foreground-muted)" }} />
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                No initiatives yet. Create your first one!
              </p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--background)" }}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                New Initiative
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInitiatives.map((initiative, idx) => {
                const status = statusConfig[initiative.status];
                const isWaterline = idx === waterlineIndex;
                
                return (
                  <div key={initiative.id}>
                    {/* Waterline Indicator */}
                    {isWaterline && (
                      <div className="flex items-center gap-3 py-4 mb-2">
                        <div className="flex-1 h-0.5" style={{ background: "#3b82f6" }} />
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                          <Waves className="w-4 h-4" />
                          <span className="text-xs font-semibold">WATERLINE</span>
                        </div>
                        <div className="flex-1 h-0.5" style={{ background: "#3b82f6" }} />
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="p-4 rounded-xl cursor-pointer group transition-all duration-200 hover:bg-[var(--background-tertiary)] relative"
                      style={{ background: "var(--background-tertiary)" }}
                    >
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(initiative.id)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--background-secondary)]"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: status.bg, color: status.color }}
                          >
                            {initiative.status === "completed" ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : initiative.status === "in-progress" ? (
                              <Play className="w-5 h-5" />
                            ) : initiative.isAboveWaterline ? (
                              <TrendingUp className="w-5 h-5" />
                            ) : (
                              <TrendingDown className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold truncate" style={{ color: "var(--foreground)" }}>
                                {initiative.name}
                              </h4>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                                style={{ background: statusConfig[initiative.status].bg, color: statusConfig[initiative.status].color }}
                              >
                                {statusConfig[initiative.status].label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {initiative.ownerName && (
                                <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                                  <Users className="w-3 h-3" />
                                  {initiative.ownerName}
                                </span>
                              )}
                              <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                                <DollarSign className="w-3 h-3" />
                                ${initiative.estimatedCost?.toLocaleString() || 0}
                              </span>
                              <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                                <Clock className="w-3 h-3" />
                                {initiative.estimatedPeopleHours?.toLocaleString() || 0}h
                              </span>
                              {initiative.targetDate && (
                                <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                                  <Calendar className="w-3 h-3" />
                                  {initiative.targetDate instanceof Timestamp 
                                    ? initiative.targetDate.toDate().toLocaleDateString()
                                    : new Date(initiative.targetDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {initiative.description && (
                              <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--foreground-muted)" }}>
                                {initiative.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar (if in progress) */}
                      {initiative.status === "in-progress" && (
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex-1">
                            <div 
                              className="h-2 rounded-full overflow-hidden"
                              style={{ background: "var(--background-secondary)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${initiative.progress}%`,
                                  background: status.color 
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-medium w-12 text-right" style={{ color: status.color }}>
                            {initiative.progress}%
                          </span>
                        </div>
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Add Initiative Modal */}
      {showAddModal && (
        <AddInitiativeModal
          onClose={() => setShowAddModal(false)}
          organizationId={currentOrg?.id || ""}
          people={people}
          tools={tools}
          products={products}
          resources={resources}
        />
      )}
    </AppLayout>
  );
}

// Add Initiative Modal Component
function AddInitiativeModal({ 
  onClose, 
  organizationId, 
  people, 
  tools, 
  products,
  resources 
}: { 
  onClose: () => void; 
  organizationId: string;
  people: Person[];
  tools: Tool[];
  products: StripeProduct[];
  resources: any;
}) {
  const [formData, setFormData] = useState({
    name: "",
    type: "new" as "new" | "existing",
    category: "product" as InitiativeCategory,
    priority: "medium" as "critical" | "high" | "medium" | "low",
    ownerId: "",
    // Three key descriptions (LEFT SIDE)
    whatsImportant: "", // Why this matters
    howAreWeDoing: "", // Current state
    prioritiesToImprove: "", // What needs to change
    // Revenue plans (RIGHT SIDE)
    linkedProductIds: [] as string[],
    customRevenue: 0,
    // People & Tools (RIGHT SIDE)
    linkedPeopleIds: [] as string[],
    linkedToolIds: [] as string[],
    // Legacy fields (kept for backward compatibility)
    description: "", // Will be combined from the three descriptions
    estimatedCost: 0,
    estimatedPeopleHours: 0,
    estimatedDuration: 0,
    expectedRevenue: 0,
    expectedSavings: 0,
  });

  const [submitting, setSubmitting] = useState(false);

  // Calculate actual costs from linked resources
  const actualCosts = useMemo(() => {
    return calculateInitiativeCosts(formData, people, tools);
  }, [formData, people, tools]);

  // Calculate waterline position in real-time
  const waterlinePreview = useMemo(() => {
    // Use actual costs if available, otherwise use estimated
    const costToUse = actualCosts.totalCost > 0 ? actualCosts.totalCost : formData.estimatedCost;
    return calculateWaterlinePosition({ ...formData, estimatedCost: costToUse }, resources);
  }, [formData, resources, actualCosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const owner = people.find(p => p.id === formData.ownerId);
      
      // Combine the three descriptions into one for backward compatibility
      const combinedDescription = [
        formData.whatsImportant ? `What's Important: ${formData.whatsImportant}` : "",
        formData.howAreWeDoing ? `How We're Doing: ${formData.howAreWeDoing}` : "",
        formData.prioritiesToImprove ? `Priorities to Improve: ${formData.prioritiesToImprove}` : "",
      ].filter(Boolean).join("\n\n");
      
      await addDoc(collection(db, "initiatives"), {
        ...formData,
        description: combinedDescription, // Legacy field
        organizationId,
        ownerName: owner?.name || "",
        status: waterlinePreview.isAbove ? "above-waterline" : "below-waterline",
        progress: 0,
        isAboveWaterline: waterlinePreview.isAbove,
        waterlineScore: waterlinePreview.score,
        // Store calculated actual costs
        actualPeopleCost: actualCosts.peopleCost,
        actualToolsCost: actualCosts.toolsCost,
        actualExpensesCost: actualCosts.expensesCost,
        // Legacy fields for backward compatibility
        requiredPeopleIds: formData.linkedPeopleIds,
        requiredToolIds: formData.linkedToolIds,
        expenses: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      onClose();
    } catch (error) {
      console.error("Error adding initiative:", error);
      alert("Failed to add initiative");
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
        className="rounded-2xl p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--background)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              New Initiative
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
              Start with why it matters, then plan the resources needed
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--background-secondary)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
          {/* ============= LEFT SIDE: THE "WHY" ============= */}
          <div className="space-y-4">
            <div 
              className="p-4 rounded-lg"
              style={{ background: "var(--background-secondary)", border: "2px solid var(--border)" }}
            >
              <h3 className="font-bold text-lg mb-4" style={{ color: "var(--foreground)" }}>
                📝 Define the Initiative
              </h3>

              {/* Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Initiative Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-base font-medium"
                  style={{ 
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  placeholder="e.g. Q1 Product Launch"
                />
              </div>

              {/* Type, Category, Priority */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "new" | "existing" })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="new">New</option>
                    <option value="existing">Existing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as InitiativeCategory })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    {initiativeCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 1. What's Important */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                1️⃣ What's Important
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--foreground-muted)" }}>
                Why does this matter? What problem are we solving?
              </p>
              <textarea
                value={formData.whatsImportant}
                onChange={(e) => setFormData({ ...formData, whatsImportant: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                placeholder="Explain why this initiative is important to the business, team, or customers..."
              />
            </div>

            {/* 2. How Are We Doing */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                2️⃣ How Are We Doing
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--foreground-muted)" }}>
                What's the current state? Where are we now?
              </p>
              <textarea
                value={formData.howAreWeDoing}
                onChange={(e) => setFormData({ ...formData, howAreWeDoing: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                placeholder="Describe the current situation, metrics, pain points, or opportunities..."
              />
            </div>

            {/* 3. Priorities to Improve */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                3️⃣ Priorities to Improve
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--foreground-muted)" }}>
                What needs to change? What are the key outcomes?
              </p>
              <textarea
                value={formData.prioritiesToImprove}
                onChange={(e) => setFormData({ ...formData, prioritiesToImprove: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                placeholder="List the specific improvements, goals, or changes we need to make..."
              />
            </div>

            {/* Owner */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as InitiativeCategory })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                {initiativeCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Owner
              </label>
              <select
                value={formData.ownerId}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="">Select owner...</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ============= RIGHT SIDE: THE "HOW" (RESOURCES & FORECAST) ============= */}
          <div className="space-y-4">
            {/* Revenue & Forecast */}
            <div 
              className="p-4 rounded-lg"
              style={{ background: "var(--background-secondary)", border: "2px solid var(--border)" }}
            >
              <h3 className="font-bold text-lg mb-4" style={{ color: "var(--foreground)" }}>
                💰 Revenue & Forecast
              </h3>

              {/* Linked Products */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Linked Revenue Products
                </label>
                <select
                  multiple
                  value={formData.linkedProductIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                    setFormData({ ...formData, linkedProductIds: selected });
                  }}
                  className="w-full px-3 py-2 rounded-lg min-h-[60px] text-sm"
                  style={{ 
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {products.length === 0 ? (
                    <option disabled>No Stripe products</option>
                  ) : (
                    products.map(product => (
                      <option key={product.id} value={product.stripeId}>
                        {product.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Custom Revenue */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    Expected Revenue
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.expectedRevenue}
                    onChange={(e) => setFormData({ ...formData, expectedRevenue: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                    Expected Savings
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.expectedSavings}
                    onChange={(e) => setFormData({ ...formData, expectedSavings: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                    placeholder="$0"
                  />
                </div>
              </div>
            </div>

            {/* People & Tools */}
            <div 
              className="p-4 rounded-lg"
              style={{ background: "var(--background-secondary)", border: "2px solid var(--border)" }}
            >
              <h3 className="font-bold text-lg mb-4" style={{ color: "var(--foreground)" }}>
                👥 Resources & Costs
              </h3>
              {/* Linked People */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                  People Working on This
                </label>
                <select
                  multiple
                  value={formData.linkedPeopleIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                    setFormData({ ...formData, linkedPeopleIds: selected });
                  }}
                  className="w-full px-3 py-2 rounded-lg min-h-[60px] text-sm"
                  style={{ 
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {people.length === 0 ? (
                    <option disabled>No people found</option>
                  ) : (
                    people.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.name} - {person.role}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Linked Tools */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Tools & Software Needed
                </label>
                <select
                  multiple
                  value={formData.linkedToolIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                    setFormData({ ...formData, linkedToolIds: selected });
                  }}
                  className="w-full px-3 py-2 rounded-lg min-h-[60px] text-sm"
                  style={{ 
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {tools.length === 0 ? (
                    <option disabled>No tools found</option>
                  ) : (
                    tools.map(tool => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name} - ${tool.cost}/{tool.billingCycle}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Calculated Costs */}
              {actualCosts.totalCost > 0 && (
                <div className="p-3 rounded-lg" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                    📊 Calculated Annual Costs
                  </p>
                  <div className="space-y-1 text-xs" style={{ color: "var(--foreground)" }}>
                    <div className="flex justify-between">
                      <span>People:</span>
                      <span className="font-semibold">${actualCosts.peopleCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tools:</span>
                      <span className="font-semibold">${actualCosts.toolsCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 mt-1 border-t font-semibold" style={{ borderColor: "var(--border)" }}>
                      <span>Total Cost:</span>
                      <span>${actualCosts.totalCost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Waterline Preview */}
            <div 
              className="p-4 rounded-lg"
              style={{ 
                background: waterlinePreview.isAbove ? "rgba(0, 212, 170, 0.1)" : "rgba(245, 158, 11, 0.1)",
                border: `2px solid ${waterlinePreview.isAbove ? "#00d4aa" : "#f59e0b"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {waterlinePreview.isAbove ? (
                  <TrendingUp className="w-6 h-6" style={{ color: "#00d4aa" }} />
                ) : (
                  <TrendingDown className="w-6 h-6" style={{ color: "#f59e0b" }} />
                )}
                <span className="font-bold text-base" style={{ color: waterlinePreview.isAbove ? "#00d4aa" : "#f59e0b" }}>
                  {waterlinePreview.isAbove ? "✓ Above Waterline" : "⚠ Below Waterline"}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                {waterlinePreview.reason}
              </p>
            </div>
          </div>

          {/* Submit - Spans Both Columns */}
          <div className="col-span-2 flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button
              type="submit"
              disabled={submitting || !formData.name.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              {submitting ? "Creating..." : "Create Initiative"}
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
