"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, X, Filter, TrendingUp } from "lucide-react";
import { MasterTableEntity, MasterTableFilters, fetchMasterTableEntities } from "@/lib/masterTableData";

interface MasterTableSelectorProps {
  organizationId: string;
  selectedEntityIds: string[];
  onSelectionChange: (entityIds: string[]) => void;
  filters?: MasterTableFilters;
  multiSelect?: boolean;
  title?: string;
  description?: string;
  onClose?: () => void;
}

export default function MasterTableSelector({
  organizationId,
  selectedEntityIds,
  onSelectionChange,
  filters: defaultFilters = {},
  multiSelect = true,
  title = "Select Forecast Items",
  description,
  onClose
}: MasterTableSelectorProps) {
  const [entities, setEntities] = useState<MasterTableEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<MasterTableFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Load entities
  useEffect(() => {
    const loadEntities = async () => {
      setLoading(true);
      const data = await fetchMasterTableEntities(organizationId, {
        ...filters,
        searchTerm
      });
      setEntities(data);
      setLoading(false);
    };

    loadEntities();
  }, [organizationId, searchTerm, filters]);

  // Handle selection
  const handleToggle = (entityId: string) => {
    if (multiSelect) {
      if (selectedEntityIds.includes(entityId)) {
        onSelectionChange(selectedEntityIds.filter(id => id !== entityId));
      } else {
        onSelectionChange([...selectedEntityIds, entityId]);
      }
    } else {
      onSelectionChange([entityId]);
      onClose?.();
    }
  };

  // Source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case "stripe": return "💳";
      case "quickbooks": return "📒";
      case "google-analytics": return "📊";
      case "activecampaign": return "📧";
      default: return "📄";
    }
  };

  // Metric type badge color
  const getMetricColor = (metricType: string) => {
    switch (metricType) {
      case "revenue": return "text-green-400 bg-green-400/10";
      case "expenses": return "text-red-400 bg-red-400/10";
      case "sessions": return "text-blue-400 bg-blue-400/10";
      case "pageviews": return "text-purple-400 bg-purple-400/10";
      case "email": return "text-cyan-400 bg-cyan-400/10";
      case "sales": return "text-yellow-400 bg-yellow-400/10";
      default: return "text-gray-400 bg-gray-400/10";
    }
  };

  // Format total value
  const formatTotal = (entity: MasterTableEntity) => {
    if (entity.metricType === "revenue" || entity.metricType === "expenses") {
      return `$${entity.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return entity.total.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Group entities by source
  const groupedEntities = useMemo(() => {
    const grouped: Record<string, MasterTableEntity[]> = {};
    entities.forEach(entity => {
      if (!grouped[entity.source]) {
        grouped[entity.source] = [];
      }
      grouped[entity.source].push(entity);
    });
    return grouped;
  }, [entities]);

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Metric Type</label>
              <select
                value={Array.isArray(filters.metricType) ? "" : filters.metricType || ""}
                onChange={(e) => setFilters({ ...filters, metricType: e.target.value as any || undefined })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
              >
                <option value="">All Types</option>
                <option value="revenue">Revenue</option>
                <option value="expenses">Expenses</option>
                <option value="sessions">Sessions</option>
                <option value="pageviews">Page Views</option>
                <option value="email">Email</option>
                <option value="sales">Sales</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Source</label>
              <select
                value={Array.isArray(filters.source) ? "" : filters.source || ""}
                onChange={(e) => setFilters({ ...filters, source: e.target.value as any || undefined })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
              >
                <option value="">All Sources</option>
                <option value="stripe">Stripe</option>
                <option value="quickbooks">QuickBooks</option>
                <option value="google-analytics">Google Analytics</option>
                <option value="activecampaign">ActiveCampaign</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Minimum Total</label>
              <input
                type="number"
                placeholder="e.g., 1000"
                value={filters.minTotal || ""}
                onChange={(e) => setFilters({ ...filters, minTotal: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
              />
            </div>

            <button
              onClick={() => setFilters(defaultFilters)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Selected Count */}
      {multiSelect && selectedEntityIds.length > 0 && (
        <div className="mb-3 text-sm text-gray-400">
          {selectedEntityIds.length} item{selectedEntityIds.length !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-cyan-500 rounded-full animate-spin"></div>
            <p className="text-gray-400 mt-3">Loading entities...</p>
          </div>
        ) : entities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No entities found</p>
            <p className="text-sm mt-2">Try adjusting your filters or search term</p>
          </div>
        ) : (
          Object.entries(groupedEntities).map(([source, sourceEntities]) => (
            <div key={source}>
              {/* Source Header */}
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-2">
                <span>{getSourceIcon(source)}</span>
                <span>{source}</span>
                <span className="text-gray-600">({sourceEntities.length})</span>
              </div>

              {/* Entities */}
              <div className="space-y-2">
                {sourceEntities.map(entity => (
                  <label
                    key={entity.entityId}
                    className="flex items-center gap-3 p-3 rounded bg-gray-900/50 border border-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntityIds.includes(entity.entityId)}
                      onChange={() => handleToggle(entity.entityId)}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-sm text-white font-medium truncate">
                          {entity.entityName}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${getMetricColor(entity.metricType)}`}>
                          {entity.metricType}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>{entity.type}</span>
                        <span>•</span>
                        <span className="font-medium">{formatTotal(entity)}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
