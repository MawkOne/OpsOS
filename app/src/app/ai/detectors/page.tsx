"use client";

import { useState, useMemo } from "react";
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
  Target
} from "lucide-react";
import { allDetectors, DetectorInfo, DetectorCategory } from "./detectors-data";

export default function DetectorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DetectorCategory | "all">("all");
  const [selectedLayer, setSelectedLayer] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "planned">("all");
  const [selectedDetector, setSelectedDetector] = useState<DetectorInfo | null>(null);

  const categories: { id: DetectorCategory | "all"; label: string; icon: any; count: number }[] = [
    { id: "all", label: "All Detectors", icon: Target, count: allDetectors.length },
    { id: "email", label: "Email", icon: Mail, count: allDetectors.filter(d => d.category === "email").length },
    { id: "seo", label: "SEO", icon: Search, count: allDetectors.filter(d => d.category === "seo").length },
    { id: "advertising", label: "Advertising", icon: Hash, count: allDetectors.filter(d => d.category === "advertising").length },
    { id: "pages", label: "Pages/CRO", icon: FileText, count: allDetectors.filter(d => d.category === "pages").length },
    { id: "content", label: "Content", icon: FileText, count: allDetectors.filter(d => d.category === "content").length },
    { id: "traffic", label: "Traffic", icon: Activity, count: allDetectors.filter(d => d.category === "traffic").length },
    { id: "revenue", label: "Revenue", icon: DollarSign, count: allDetectors.filter(d => d.category === "revenue").length },
    { id: "system", label: "System", icon: Shield, count: allDetectors.filter(d => d.category === "system").length },
  ];

  const layers = [
    { id: "all", label: "All Layers" },
    { id: "fast", label: "Fast (Daily)" },
    { id: "trend", label: "Trend (Weekly)" },
    { id: "strategic", label: "Strategic (Monthly)" },
  ];

  const filteredDetectors = useMemo(() => {
    return allDetectors.filter((detector) => {
      const matchesSearch =
        detector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        detector.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || detector.category === selectedCategory;
      const matchesLayer =
        selectedLayer === "all" || detector.layer === selectedLayer;
      const matchesStatus =
        selectedStatus === "all" || detector.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesLayer && matchesStatus;
    });
  }, [searchQuery, selectedCategory, selectedLayer, selectedStatus]);

  const stats = {
    total: allDetectors.length,
    active: allDetectors.filter(d => d.status === "active").length,
    planned: allDetectors.filter(d => d.status === "planned").length,
  };

  return (
    <AppLayout
      title="Detectors"
      subtitle={`${stats.total} total detectors (${stats.active} active, ${stats.planned} planned)`}
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Detectors</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--accent)" }}>{stats.total}</p>
            </div>
            <Database className="w-8 h-8" style={{ color: "var(--accent)", opacity: 0.5 }} />
          </div>
        </Card>
        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--success)" }}>{stats.active}</p>
            </div>
            <Check className="w-8 h-8" style={{ color: "var(--success)", opacity: 0.5 }} />
          </div>
        </Card>
        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Planned</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--warning)" }}>{stats.planned}</p>
            </div>
            <Clock className="w-8 h-8" style={{ color: "var(--warning)", opacity: 0.5 }} />
          </div>
        </Card>
        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Coverage</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--accent)" }}>
                {Math.round((stats.active / stats.total) * 100)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8" style={{ color: "var(--accent)", opacity: 0.5 }} />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass mb-8">
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: "var(--foreground-muted)" }}
            />
            <input
              type="text"
              placeholder="Search detectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg"
              style={{
                background: "var(--background-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Category Filter */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                Category
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    style={{
                      background: isSelected ? "var(--accent)" : "var(--background-tertiary)",
                      color: isSelected ? "var(--background)" : "var(--foreground)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label} ({cat.count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layer Filter */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--foreground-muted)" }}>
              Layer
            </p>
            <div className="flex flex-wrap gap-2">
              {layers.map((layer) => {
                const isSelected = selectedLayer === layer.id;
                return (
                  <button
                    key={layer.id}
                    onClick={() => setSelectedLayer(layer.id)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: isSelected ? "var(--accent)" : "var(--background-tertiary)",
                      color: isSelected ? "var(--background)" : "var(--foreground)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {layer.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--foreground-muted)" }}>
              Status
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStatus("all")}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selectedStatus === "all" ? "var(--accent)" : "var(--background-tertiary)",
                  color: selectedStatus === "all" ? "var(--background)" : "var(--foreground)",
                  border: `1px solid ${selectedStatus === "all" ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus("active")}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selectedStatus === "active" ? "var(--success)" : "var(--background-tertiary)",
                  color: selectedStatus === "active" ? "var(--background)" : "var(--foreground)",
                  border: `1px solid ${selectedStatus === "active" ? "var(--success)" : "var(--border)"}`,
                }}
              >
                Active ({stats.active})
              </button>
              <button
                onClick={() => setSelectedStatus("planned")}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selectedStatus === "planned" ? "var(--warning)" : "var(--background-tertiary)",
                  color: selectedStatus === "planned" ? "var(--background)" : "var(--foreground)",
                  border: `1px solid ${selectedStatus === "planned" ? "var(--warning)" : "var(--border)"}`,
                }}
              >
                Planned ({stats.planned})
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          Showing {filteredDetectors.length} of {allDetectors.length} detectors
        </p>
      </div>

      {/* Detector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDetectors.map((detector) => (
            <DetectorCard
              key={detector.id}
              detector={detector}
              onClick={() => setSelectedDetector(detector)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredDetectors.length === 0 && (
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

interface DetectorCardProps {
  detector: DetectorInfo;
  onClick: () => void;
}

function DetectorCard({ detector, onClick }: DetectorCardProps) {
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

  const layerIcons: Record<string, any> = {
    fast: Zap,
    trend: TrendingUp,
    strategic: Target,
  };

  const Icon = categoryIcons[detector.category];
  const LayerIcon = layerIcons[detector.layer];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="glass cursor-pointer relative"
        hover
        style={{
          borderColor: detector.status === "active" ? "var(--success)" : "var(--border)",
          borderWidth: "2px",
        }}
        onClick={onClick}
      >
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          {detector.status === "active" ? (
            <div
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                background: "var(--success)",
                color: "var(--background)",
              }}
            >
              Active
            </div>
          ) : (
            <div
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                background: "var(--warning)",
                color: "var(--background)",
              }}
            >
              Planned
            </div>
          )}
        </div>

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
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

        {/* Name */}
        <h3 className="font-bold mb-2 pr-16" style={{ color: "var(--foreground)" }}>
          {detector.name}
        </h3>

        {/* Description */}
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--foreground-muted)" }}>
          {detector.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--foreground-subtle)" }}>
          <div className="flex items-center gap-1">
            <LayerIcon className="w-3 h-3" />
            {detector.layer.charAt(0).toUpperCase() + detector.layer.slice(1)}
          </div>
          {detector.priority && (
            <div
              className="px-2 py-0.5 rounded"
              style={{
                background:
                  detector.priority === "high"
                    ? "var(--error-muted)"
                    : detector.priority === "medium"
                    ? "var(--warning-muted)"
                    : "var(--accent-muted)",
                color:
                  detector.priority === "high"
                    ? "var(--error)"
                    : detector.priority === "medium"
                    ? "var(--warning)"
                    : "var(--accent)",
              }}
            >
              {detector.priority.toUpperCase()}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
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
