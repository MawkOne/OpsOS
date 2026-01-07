"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench,
  Plus,
  Search,
  DollarSign,
  Calendar,
  Shield,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { Person, Tool, toolCategories, currencies } from "@/types/resources";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function ToolsPage() {
  const { currentOrg } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Current time for renewal calculations
  const [currentTime] = useState(() => Date.now());

  // Load data from Firestore
  useEffect(() => {
    if (!currentOrg?.id) {
      setLoading(false);
      return;
    }

    const toolsQuery = query(
      collection(db, "tools"), 
      where("organizationId", "==", currentOrg.id),
      orderBy("name")
    );
    const peopleQuery = query(
      collection(db, "people"), 
      where("organizationId", "==", currentOrg.id),
      orderBy("name")
    );

    const unsubTools = onSnapshot(toolsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
      setTools(data);
      setLoading(false);
    });

    const unsubPeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
      setPeople(data);
    });

    return () => {
      unsubTools();
      unsubPeople();
    };
  }, [currentOrg?.id]);

  // Filter data based on search
  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total cost (recurring only)
  const totalToolsCost = tools.reduce((sum, t) => {
    if (t.billingCycle === "one_time") return sum; // One-time costs not included in annual
    if (t.billingCycle === "annual") return sum + t.cost;
    return sum + (t.cost * 12); // monthly
  }, 0);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tool?")) return;
    await deleteDoc(doc(db, "tools", id));
  };

  return (
    <AppLayout title="Tools" subtitle="Manage your software subscriptions">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#8b5cf620", color: "#8b5cf6" }}
              >
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{tools.length}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Tools</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#f59e0b20", color: "#f59e0b" }}
              >
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>${(totalToolsCost / 1000).toFixed(0)}k</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Annual Cost</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              <Plus className="w-4 h-4" />
              Add Tool
            </button>
          </div>
        </div>

        {/* Tools List */}
        <ToolsList tools={filteredTools} people={people} onDelete={handleDelete} loading={loading} currentTime={currentTime} />

        {/* Add Modal */}
        <AnimatePresence>
          {showAddModal && currentOrg && (
            <AddToolModal
              people={people}
              onClose={() => setShowAddModal(false)}
              organizationId={currentOrg.id}
            />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

function ToolsList({ tools, people, onDelete, loading, currentTime }: { tools: Tool[]; people: Person[]; onDelete: (id: string) => void; loading: boolean; currentTime: number }) {
  const now = currentTime;

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      </Card>
    );
  }

  if (tools.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12">
          <Wrench className="w-12 h-12 mb-4" style={{ color: "var(--foreground-muted)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--foreground)" }}>No tools yet</p>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Add your first tool to track costs and access</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tools.map((tool, idx) => {
        const category = toolCategories.find(c => c.value === tool.category);
        const admin = people.find(p => p.id === tool.adminId);
        const renewalDate = tool.renewalDate instanceof Timestamp 
          ? tool.renewalDate.toDate() 
          : new Date(tool.renewalDate);
        const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now) / (1000 * 60 * 60 * 24));

        return (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ background: `${category?.color}20`, color: category?.color }}
                  >
                    {tool.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{tool.name}</h3>
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${category?.color}20`, color: category?.color }}
                    >
                      {category?.label}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => onDelete(tool.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--background-tertiary)]"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                    <DollarSign className="w-4 h-4" />
                    Cost
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {currencies.find(c => c.value === tool.currency)?.symbol || "$"}
                    {tool.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {tool.billingCycle === "one_time" ? "" : `/${tool.billingCycle === "monthly" ? "mo" : "yr"}`}
                    {tool.costType && <span className="text-xs ml-1 opacity-70">({tool.costType})</span>}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                    <Calendar className="w-4 h-4" />
                    Renewal
                  </span>
                  <span 
                    className="text-sm font-medium"
                    style={{ color: daysUntilRenewal < 30 ? "var(--warning)" : "var(--foreground)" }}
                  >
                    {renewalDate.toLocaleDateString()} ({daysUntilRenewal}d)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                    <Shield className="w-4 h-4" />
                    Admin
                  </span>
                  <span className="text-sm" style={{ color: "var(--foreground)" }}>
                    {admin?.name || tool.adminName || "Not assigned"}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function AddToolModal({ people, onClose, organizationId }: { people: Person[]; onClose: () => void; organizationId: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, "tools"), {
        ...formData,
        cost: Number(formData.cost) || 0,
        currency: formData.currency || "USD",
        costType: formData.costType || "fixed",
        isCOGS: formData.isCOGS || false,
        renewalDate: formData.renewalDate ? new Date(formData.renewalDate as string) : new Date(),
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        organizationId,
      });
      onClose();
    } catch (error) {
      console.error("Error adding tool:", error);
      alert("Failed to add tool. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Add Tool
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background-tertiary)]">
            <X className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Tool Name"
              value={formData.name as string || ""}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="Slack"
            />
            <FormSelect
              label="Category"
              value={formData.category as string || ""}
              onChange={(v) => setFormData({ ...formData, category: v })}
              options={toolCategories}
            />
          </div>

          <div className="grid grid-cols-5 gap-4">
            <FormSelect
              label="Currency"
              value={formData.currency as string || "USD"}
              onChange={(v) => setFormData({ ...formData, currency: v })}
              options={currencies}
            />
            <FormField
              label="Cost"
              type="number"
              value={formData.cost as string || ""}
              onChange={(v) => setFormData({ ...formData, cost: v })}
              placeholder="100.00"
              min="0"
              step="0.01"
            />
            <FormSelect
              label="Cost Type"
              value={formData.costType as string || "fixed"}
              onChange={(v) => setFormData({ ...formData, costType: v })}
              options={[
                { value: "fixed", label: "Fixed" },
                { value: "variable", label: "Variable" },
              ]}
            />
            <FormSelect
              label="Billing"
              value={formData.billingCycle as string || "monthly"}
              onChange={(v) => setFormData({ ...formData, billingCycle: v })}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
                { value: "one_time", label: "One Time" },
              ]}
            />
            <FormField
              label="Renewal Date"
              type="date"
              value={formData.renewalDate as string || ""}
              onChange={(v) => setFormData({ ...formData, renewalDate: v })}
            />
          </div>

          {/* COGS Checkbox */}
          <div 
            className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
            style={{ background: "var(--background-tertiary)" }}
            onClick={() => setFormData({ ...formData, isCOGS: !formData.isCOGS })}
          >
            <div 
              className="w-5 h-5 rounded flex items-center justify-center transition-all duration-200"
              style={{ 
                background: Boolean(formData.isCOGS) ? "var(--accent)" : "transparent",
                border: Boolean(formData.isCOGS) ? "none" : "2px solid var(--border)"
              }}
            >
              {Boolean(formData.isCOGS) && <Check className="w-3 h-3 text-white" />}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Cost of Goods Sold (COGS)</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Check if this is a direct cost tied to revenue</p>
            </div>
          </div>

          <FormSelect
            label="Tool Admin"
            value={formData.adminId as string || ""}
            onChange={(v) => {
              const admin = people.find(p => p.id === v);
              setFormData({ ...formData, adminId: v, adminName: admin?.name });
            }}
            options={people.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Select admin..."
          />

          <FormField
            label="Website"
            value={formData.website as string || ""}
            onChange={(v) => setFormData({ ...formData, website: v })}
            placeholder="https://slack.com"
          />

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg font-medium transition-all duration-200"
              style={{ 
                background: "var(--background-tertiary)",
                color: "var(--foreground-muted)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Add Tool
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Form Components
function FormField({ 
  label, 
  type = "text", 
  required, 
  value, 
  onChange, 
  placeholder,
  min,
  step 
}: { 
  label: string; 
  type?: string; 
  required?: boolean; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
        {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--accent)]/50"
        style={{
          background: "var(--background-tertiary)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      />
    </div>
  );
}

function FormSelect({ 
  label, 
  required, 
  value, 
  onChange, 
  options,
  placeholder = "Select..."
}: { 
  label: string; 
  required?: boolean; 
  value: string; 
  onChange: (v: string) => void; 
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
        {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
      </label>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--accent)]/50"
        style={{
          background: "var(--background-tertiary)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

