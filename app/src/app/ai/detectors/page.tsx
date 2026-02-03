"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Mail,
  Hash,
  FileText,
  Activity,
  DollarSign,
  Shield,
  X,
  Check,
  Clock,
  TrendingUp,
  Zap,
  AlertCircle,
  Database,
  Target,
  Loader2,
  ChevronDown
} from "lucide-react";

type DetectorCategory = "email" | "revenue" | "pages" | "traffic" | "seo" | "advertising" | "content" | "system";

interface DetectorInfo {
  id: string;
  name: string;
  category: DetectorCategory;
  status: "active" | "planned";
  layer: "fast" | "trend" | "strategic";
  description: string;
  detects: string;
  pythonFile: string;
  metrics?: string[];
  thresholds?: string;
  actions?: string[];
  dataSources?: string[];
  priority?: "high" | "medium" | "low";
}

// Multi-select dropdown component
interface MultiSelectProps {
  label: string;
  options: { id: string; label: string; count?: number }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  icon?: React.ReactNode;
}

function MultiSelect({ label, options, selected, onChange, icon }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (optionId: string) => {
    if (selected.includes(optionId)) {
      onChange(selected.filter((id) => id !== optionId));
    } else {
      onChange([...selected, optionId]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectAll = () => {
    onChange(options.map((o) => o.id));
  };

  const displayText = selected.length === 0
    ? `All ${label}`
    : selected.length === options.length
    ? `All ${label}`
    : `${selected.length} selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-opacity-80"
        style={{
          background: selected.length > 0 && selected.length < options.length 
            ? "var(--accent-muted)" 
            : "var(--background-tertiary)",
          border: "1px solid var(--border)",
          color: selected.length > 0 && selected.length < options.length 
            ? "var(--accent)" 
            : "var(--foreground)",
        }}
      >
        {icon}
        <span>{displayText}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[200px] rounded-lg shadow-xl z-50 overflow-hidden"
          style={{
            background: "var(--background-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Quick actions */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 rounded hover:bg-opacity-80"
              style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 rounded hover:bg-opacity-80"
              style={{ background: "var(--background-tertiary)", color: "var(--foreground-muted)" }}
            >
              Clear
            </button>
          </div>

          {/* Options */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleOption(option.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-opacity-50 transition-colors"
                style={{
                  background: selected.includes(option.id) ? "var(--accent-muted)" : "transparent",
                  color: "var(--foreground)",
                }}
              >
                <div
                  className="w-4 h-4 rounded border flex items-center justify-center"
                  style={{
                    borderColor: selected.includes(option.id) ? "var(--accent)" : "var(--border)",
                    background: selected.includes(option.id) ? "var(--accent)" : "transparent",
                  }}
                >
                  {selected.includes(option.id) && (
                    <Check className="w-3 h-3" style={{ color: "var(--background)" }} />
                  )}
                </div>
                <span className="flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                    background: "var(--background-tertiary)", 
                    color: "var(--foreground-muted)" 
                  }}>
                    {option.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DetectorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDetector, setSelectedDetector] = useState<DetectorInfo | null>(null);
  const [detectors, setDetectors] = useState<DetectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch detectors from API
  useEffect(() => {
    async function fetchDetectors() {
      try {
        setLoading(true);
        const response = await fetch("/api/detectors/list");
        const data = await response.json();
        
        if (data.success) {
          setDetectors(data.detectors);
        } else {
          setError("Failed to load detectors");
        }
      } catch (err) {
        console.error("Error fetching detectors:", err);
        setError("Failed to load detectors");
      } finally {
        setLoading(false);
      }
    }

    fetchDetectors();
  }, []);

  // Filter options with counts
  const categoryOptions = useMemo(() => [
    { id: "email", label: "Email", count: detectors.filter(d => d.category === "email").length },
    { id: "seo", label: "SEO", count: detectors.filter(d => d.category === "seo").length },
    { id: "advertising", label: "Advertising", count: detectors.filter(d => d.category === "advertising").length },
    { id: "pages", label: "Pages/CRO", count: detectors.filter(d => d.category === "pages").length },
    { id: "content", label: "Content", count: detectors.filter(d => d.category === "content").length },
    { id: "traffic", label: "Traffic", count: detectors.filter(d => d.category === "traffic").length },
    { id: "revenue", label: "Revenue", count: detectors.filter(d => d.category === "revenue").length },
    { id: "system", label: "System", count: detectors.filter(d => d.category === "system").length },
  ].filter(c => c.count > 0), [detectors]);

  const layerOptions = useMemo(() => [
    { id: "fast", label: "Fast (Daily)", count: detectors.filter(d => d.layer === "fast").length },
    { id: "trend", label: "Trend (Weekly)", count: detectors.filter(d => d.layer === "trend").length },
    { id: "strategic", label: "Strategic (Monthly)", count: detectors.filter(d => d.layer === "strategic").length },
  ].filter(l => l.count > 0), [detectors]);

  const statusOptions = useMemo(() => [
    { id: "active", label: "Active", count: detectors.filter(d => d.status === "active").length },
    { id: "planned", label: "Planned", count: detectors.filter(d => d.status === "planned").length },
  ].filter(s => s.count > 0), [detectors]);

  const filteredDetectors = useMemo(() => {
    return detectors.filter((detector) => {
      const matchesSearch =
        detector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        detector.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(detector.category);
      const matchesLayer =
        selectedLayers.length === 0 || selectedLayers.includes(detector.layer);
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(detector.status);
      return matchesSearch && matchesCategory && matchesLayer && matchesStatus;
    });
  }, [searchQuery, selectedCategories, selectedLayers, selectedStatuses, detectors]);

  // Count active filters
  const activeFilterCount = selectedCategories.length + selectedLayers.length + selectedStatuses.length;

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedLayers([]);
    setSelectedStatuses([]);
    setSearchQuery("");
  };

  const stats = {
    total: detectors.length,
    active: detectors.filter(d => d.status === "active").length,
    planned: detectors.filter(d => d.status === "planned").length,
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout title="Detectors" subtitle="Loading detectors...">
        <Card className="glass text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
            Loading detectors...
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--foreground-muted)" }}>
            Scanning Python detector files
          </p>
        </Card>
      </AppLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AppLayout title="Detectors" subtitle="Error loading detectors">
        <Card className="glass text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--error)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            Retry
          </button>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Detectors"
      subtitle={`${stats.total} total detectors (${stats.active} active, ${stats.planned} planned)`}
    >
      {/* Horizontal Filter Bar */}
      <Card className="glass mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--foreground-muted)" }}
            />
            <input
              type="text"
              placeholder="Search detectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
              style={{
                background: "var(--background-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Divider */}
          <div className="h-8 w-px" style={{ background: "var(--border)" }} />

          {/* Multi-select Filters */}
          <MultiSelect
            label="Status"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            icon={<Activity className="w-4 h-4" />}
          />

          <MultiSelect
            label="Category"
            options={categoryOptions}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            icon={<Filter className="w-4 h-4" />}
          />

          <MultiSelect
            label="Layer"
            options={layerOptions}
            selected={selectedLayers}
            onChange={setSelectedLayers}
            icon={<Clock className="w-4 h-4" />}
          />

          {/* Clear All Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-opacity-80"
              style={{
                background: "var(--error-muted, rgba(239, 68, 68, 0.1))",
                color: "var(--error, #ef4444)",
              }}
            >
              <X className="w-4 h-4" />
              Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </Card>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          Showing {filteredDetectors.length} of {detectors.length} detectors
        </p>
      </div>

      {/* Detector Table */}
      {filteredDetectors.length > 0 ? (
        <Card className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-3 px-4 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                    STATUS
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                    NAME
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                    CATEGORY
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                    LAYER
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                    DESCRIPTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDetectors.map((detector) => (
                  <DetectorRow
                    key={detector.id}
                    detector={detector}
                    onClick={() => setSelectedDetector(detector)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="glass text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
            No detectors found
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--foreground-muted)" }}>
            Try adjusting your filters or search query
          </p>
        </Card>
      )}

      {/* Detector Detail Modal */}
      <DetectorModal
        detector={selectedDetector}
        onClose={() => setSelectedDetector(null)}
      />
    </AppLayout>
  );
}

interface DetectorRowProps {
  detector: DetectorInfo;
  onClick: () => void;
}

function DetectorRow({ detector, onClick }: DetectorRowProps) {
  const categoryIcons: Record<DetectorCategory, any> = {
    email: Mail,
    seo: Search,
    advertising: Hash,
    pages: FileText,
    content: FileText,
    traffic: Activity,
    revenue: DollarSign,
    system: Shield,
  };

  const layerLabels: Record<string, string> = {
    fast: "Fast",
    trend: "Trend",
    strategic: "Strategic",
  };

  const Icon = categoryIcons[detector.category];

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-opacity-50"
      style={{
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--background-tertiary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {/* Status */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {detector.status === "active" ? (
            <>
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--success)" }}
              />
              <span className="text-sm" style={{ color: "var(--success)" }}>
                Active
              </span>
            </>
          ) : (
            <>
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--warning)" }}
              />
              <span className="text-sm" style={{ color: "var(--warning)" }}>
                Planned
              </span>
            </>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="py-3 px-4">
        <div className="font-medium" style={{ color: "var(--foreground)" }}>
          {detector.name}
        </div>
      </td>

      {/* Category */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          <span className="text-sm capitalize" style={{ color: "var(--foreground)" }}>
            {detector.category}
          </span>
        </div>
      </td>

      {/* Layer */}
      <td className="py-3 px-4">
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            background: "var(--accent-muted)",
            color: "var(--accent)",
          }}
        >
          {layerLabels[detector.layer] || detector.layer}
        </span>
      </td>

      {/* Description */}
      <td className="py-3 px-4">
        <p className="text-sm line-clamp-2" style={{ color: "var(--foreground-muted)" }}>
          {detector.description}
        </p>
      </td>
    </tr>
  );
}

interface DetectorModalProps {
  detector: DetectorInfo | null;
  onClose: () => void;
}

function DetectorModal({ detector, onClose }: DetectorModalProps) {
  if (!detector) return null;

  const categoryIcons: Record<DetectorCategory, any> = {
    email: Mail,
    seo: Search,
    advertising: Hash,
    pages: FileText,
    content: FileText,
    traffic: Activity,
    revenue: DollarSign,
    system: Shield,
  };

  const Icon = categoryIcons[detector.category];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        >
          <Card className="glass">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: detector.status === "active" ? "var(--success-muted)" : "var(--warning-muted)",
                  }}
                >
                  <Icon
                    className="w-6 h-6"
                    style={{
                      color: detector.status === "active" ? "var(--success)" : "var(--warning)",
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
                    {detector.name}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: detector.status === "active" ? "var(--success)" : "var(--warning)",
                        color: "var(--background)",
                      }}
                    >
                      {detector.status === "active" ? "Active" : "Planned"}
                    </span>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: "var(--accent-muted)",
                        color: "var(--accent)",
                      }}
                    >
                      {detector.layer.charAt(0).toUpperCase() + detector.layer.slice(1)} Layer
                    </span>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: "var(--background-tertiary)",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {detector.category.charAt(0).toUpperCase() + detector.category.slice(1)}
                    </span>
                    {detector.priority && (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          background:
                            detector.priority === "high"
                              ? "var(--error)"
                              : detector.priority === "medium"
                              ? "var(--warning)"
                              : "var(--accent)",
                          color: "var(--background)",
                        }}
                      >
                        {detector.priority.toUpperCase()} Priority
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-opacity-80 transition-colors"
                style={{ background: "var(--background-tertiary)" }}
              >
                <X className="w-5 h-5" style={{ color: "var(--foreground)" }} />
              </button>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground-muted)" }}>
                DESCRIPTION
              </h3>
              <p style={{ color: "var(--foreground)" }}>{detector.description}</p>
            </div>

            {/* What It Detects */}
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground-muted)" }}>
                WHAT IT DETECTS
              </h3>
              <p style={{ color: "var(--foreground)" }}>{detector.detects}</p>
            </div>

            {/* Metrics */}
            {detector.metrics && (
              <div className="mb-6">
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground-muted)" }}>
                  METRICS USED
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detector.metrics.map((metric, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg text-sm font-mono"
                      style={{
                        background: "var(--background-tertiary)",
                        color: "var(--foreground)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Thresholds */}
            {detector.thresholds && (
              <div className="mb-6">
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground-muted)" }}>
                  THRESHOLDS
                </h3>
                <p className="font-mono text-sm" style={{ color: "var(--foreground)" }}>
                  {detector.thresholds}
                </p>
              </div>
            )}

            {/* Actions */}
            {detector.actions && (
              <div className="mb-6">
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground-muted)" }}>
                  RECOMMENDED ACTIONS
                </h3>
                <ul className="space-y-2">
                  {detector.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                      <span style={{ color: "var(--foreground)" }}>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Data Sources */}
            {detector.dataSources && (
              <div>
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground-muted)" }}>
                  DATA SOURCES
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detector.dataSources.map((source, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg text-sm"
                      style={{
                        background: "var(--accent-muted)",
                        color: "var(--accent)",
                      }}
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
