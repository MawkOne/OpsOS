"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Trash2,
  Edit,
  X,
  Check,
} from "lucide-react";
import { Person, timezones, departments, currencies } from "@/types/resources";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  doc, 
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function PeoplePage() {
  const { currentOrg } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Firestore
  useEffect(() => {
    if (!currentOrg?.id) {
      setLoading(false);
      return;
    }

    const peopleQuery = query(
      collection(db, "people"), 
      where("organizationId", "==", currentOrg.id),
      orderBy("name")
    );

    const unsubPeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
      setPeople(data);
      setLoading(false);
    });

    return () => {
      unsubPeople();
    };
  }, [currentOrg?.id]);

  // Filter data based on search
  const filteredPeople = people.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this person?")) return;
    await deleteDoc(doc(db, "people", id));
  };

  return (
    <AppLayout title="People" subtitle="Manage your team members">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#00d4aa20", color: "#00d4aa" }}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{people.length}</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Team Members</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <input
                type="text"
                placeholder="Search people..."
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
              Add Person
            </button>
          </div>
        </div>

        {/* People List */}
        <PeopleList 
          people={filteredPeople} 
          onDelete={handleDelete} 
          onEdit={setEditingPerson}
          loading={loading} 
        />

        {/* Add Modal */}
        <AnimatePresence>
          {showAddModal && currentOrg && (
            <AddPersonModal
              onClose={() => setShowAddModal(false)}
              organizationId={currentOrg.id}
            />
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingPerson && (
            <EditPersonModal
              person={editingPerson}
              onClose={() => setEditingPerson(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

function PeopleList({ people, onDelete, onEdit, loading }: { people: Person[]; onDelete: (id: string) => void; onEdit: (person: Person) => void; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      </Card>
    );
  }

  if (people.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="w-12 h-12 mb-4" style={{ color: "var(--foreground-muted)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--foreground)" }}>No team members yet</p>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Add your first team member to get started</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Name</th>
              <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Department</th>
              <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Salary</th>
              <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Hours/Week</th>
              <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Timezone</th>
              <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person, idx) => (
              <motion.tr
                key={person.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)", color: "white" }}
                    >
                      {person.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>{person.name}</p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{person.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground)" }}>{person.role}</td>
                <td className="py-3 px-4">
                  <span 
                    className="text-xs px-2 py-1 rounded-full"
                    style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}
                  >
                    {person.department}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground)" }}>
                  {currencies.find(c => c.value === person.currency)?.symbol || "$"}
                  {person.salary.toLocaleString()}
                  {person.salaryType === "hourly" ? "/hr" : person.salaryType === "monthly" ? "/mo" : "/yr"}
                </td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground)" }}>{person.hoursPerWeek}h</td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {timezones.find(t => t.value === person.timezone)?.label || person.timezone}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(person)}
                      className="p-1.5 rounded-lg hover:bg-[var(--background-tertiary)]"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(person.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--background-tertiary)]"
                      style={{ color: "var(--error)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AddPersonModal({ onClose, organizationId }: { onClose: () => void; organizationId: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, "people"), {
        ...formData,
        salary: Number(formData.salary),
        hoursPerWeek: Number(formData.hoursPerWeek),
        status: "active",
        startDate: new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        organizationId,
      });
      onClose();
    } catch (error) {
      console.error("Error adding person:", error);
      alert("Failed to add person. Please try again.");
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
            Add Team Member
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background-tertiary)]">
            <X className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Full Name"
              value={formData.name as string || ""}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="John Doe"
            />
            <FormField
              label="Email"
              type="email"
              value={formData.email as string || ""}
              onChange={(v) => setFormData({ ...formData, email: v })}
              placeholder="john@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Role"
              value={formData.role as string || ""}
              onChange={(v) => setFormData({ ...formData, role: v })}
              placeholder="Software Engineer"
            />
            <FormSelect
              label="Department"
              value={formData.department as string || ""}
              onChange={(v) => setFormData({ ...formData, department: v })}
              options={departments.map(d => ({ value: d, label: d }))}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <FormSelect
              label="Currency"
              value={formData.currency as string || "USD"}
              onChange={(v) => setFormData({ ...formData, currency: v })}
              options={currencies}
            />
            <FormField
              label="Salary"
              type="number"
              value={formData.salary as string || ""}
              onChange={(v) => setFormData({ ...formData, salary: v })}
              placeholder="75000"
            />
            <FormSelect
              label="Type"
              value={formData.salaryType as string || "annual"}
              onChange={(v) => setFormData({ ...formData, salaryType: v })}
              options={[
                { value: "annual", label: "Annual" },
                { value: "monthly", label: "Monthly" },
                { value: "hourly", label: "Hourly" },
              ]}
            />
            <FormField
              label="Hours/Week"
              type="number"
              value={formData.hoursPerWeek as string || "40"}
              onChange={(v) => setFormData({ ...formData, hoursPerWeek: v })}
              placeholder="40"
            />
          </div>

          <FormSelect
            label="Timezone"
            value={formData.timezone as string || ""}
            onChange={(v) => setFormData({ ...formData, timezone: v })}
            options={timezones}
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
                  Add Person
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function EditPersonModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({
    name: person.name || "",
    email: person.email || "",
    role: person.role || "",
    department: person.department || "",
    currency: person.currency || "USD",
    salary: person.salary?.toString() || "",
    salaryType: person.salaryType || "annual",
    hoursPerWeek: person.hoursPerWeek?.toString() || "40",
    timezone: person.timezone || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateDoc(doc(db, "people", person.id), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department,
        currency: formData.currency,
        salary: Number(formData.salary) || 0,
        salaryType: formData.salaryType,
        hoursPerWeek: Number(formData.hoursPerWeek) || 40,
        timezone: formData.timezone,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (error) {
      console.error("Error updating person:", error);
      alert("Failed to update person. Please try again.");
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
            Edit Team Member
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background-tertiary)]">
            <X className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Full Name"
              value={formData.name as string || ""}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="John Doe"
            />
            <FormField
              label="Email"
              type="email"
              value={formData.email as string || ""}
              onChange={(v) => setFormData({ ...formData, email: v })}
              placeholder="john@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Role"
              value={formData.role as string || ""}
              onChange={(v) => setFormData({ ...formData, role: v })}
              placeholder="Software Engineer"
            />
            <FormSelect
              label="Department"
              value={formData.department as string || ""}
              onChange={(v) => setFormData({ ...formData, department: v })}
              options={departments.map(d => ({ value: d, label: d }))}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <FormSelect
              label="Currency"
              value={formData.currency as string || "USD"}
              onChange={(v) => setFormData({ ...formData, currency: v })}
              options={currencies}
            />
            <FormField
              label="Salary"
              type="number"
              value={formData.salary as string || ""}
              onChange={(v) => setFormData({ ...formData, salary: v })}
              placeholder="75000"
            />
            <FormSelect
              label="Type"
              value={formData.salaryType as string || "annual"}
              onChange={(v) => setFormData({ ...formData, salaryType: v })}
              options={[
                { value: "annual", label: "Annual" },
                { value: "monthly", label: "Monthly" },
                { value: "hourly", label: "Hourly" },
              ]}
            />
            <FormField
              label="Hours/Week"
              type="number"
              value={formData.hoursPerWeek as string || "40"}
              onChange={(v) => setFormData({ ...formData, hoursPerWeek: v })}
              placeholder="40"
            />
          </div>

          <FormSelect
            label="Timezone"
            value={formData.timezone as string || ""}
            onChange={(v) => setFormData({ ...formData, timezone: v })}
            options={timezones}
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
                  Save Changes
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
  placeholder 
}: { 
  label: string; 
  type?: string; 
  required?: boolean; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string;
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

