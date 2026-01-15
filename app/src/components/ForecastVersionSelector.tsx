"use client";

import { useState, useEffect } from "react";
import { ForecastVersion } from "@/types/forecast";
import { getForecastVersions } from "@/lib/forecastVersions";
import { GitBranch, Check, Clock, User, FileText, X } from "lucide-react";

interface ForecastVersionSelectorProps {
  organizationId: string;
  selectedVersionId?: string | null;
  onSelect: (version: ForecastVersion) => void;
  onClose?: () => void;
  title?: string;
  showDrafts?: boolean;
}

export default function ForecastVersionSelector({
  organizationId,
  selectedVersionId,
  onSelect,
  onClose,
  title = "Select Forecast Version",
  showDrafts = true,
}: ForecastVersionSelectorProps) {
  const [versions, setVersions] = useState<ForecastVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  useEffect(() => {
    loadVersions();
  }, [organizationId, filter]);

  const loadVersions = async () => {
    setLoading(true);
    const allVersions = await getForecastVersions(organizationId, {
      status: filter === "all" ? undefined : filter,
    });
    setVersions(allVersions);
    setLoading(false);
  };

  const filteredVersions = showDrafts
    ? versions
    : versions.filter(v => v.status === "published");

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (isActive) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-green-400/20 text-green-400 border border-green-400/30">
          Active
        </span>
      );
    }

    if (status === "published") {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-blue-400/20 text-blue-400 border border-blue-400/30">
          Published
        </span>
      );
    }

    if (status === "draft") {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-gray-400/20 text-gray-400 border border-gray-400/30">
          Draft
        </span>
      );
    }

    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-600/20 text-gray-500 border border-gray-600/30">
        Archived
      </span>
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            {title}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {filteredVersions.length} version{filteredVersions.length !== 1 ? "s" : ""} available
          </p>
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

      {/* Filters */}
      {showDrafts && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "all"
                ? "bg-[#00d4aa] text-black font-medium"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("published")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "published"
                ? "bg-[#00d4aa] text-black font-medium"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Published
          </button>
          <button
            onClick={() => setFilter("draft")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "draft"
                ? "bg-[#00d4aa] text-black font-medium"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Drafts
          </button>
        </div>
      )}

      {/* Version List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-cyan-500 rounded-full animate-spin"></div>
            <p className="text-gray-400 mt-3">Loading versions...</p>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No forecast versions found</p>
            <p className="text-sm mt-2">Create your first forecast version to get started</p>
          </div>
        ) : (
          filteredVersions.map(version => {
            const isSelected = selectedVersionId === version.id;
            return (
              <button
                key={version.id}
                onClick={() => onSelect(version)}
                className={`w-full p-4 rounded border text-left transition-all ${
                  isSelected
                    ? "bg-[#00d4aa]/10 border-[#00d4aa]"
                    : "bg-gray-900/50 border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        v{version.version} • {version.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#00d4aa]" />}
                    </div>
                    {version.description && (
                      <p className="text-xs text-gray-400 mb-2">{version.description}</p>
                    )}
                  </div>
                  {getStatusBadge(version.status, version.isActive)}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {version.createdByName}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(version.createdAt)}
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {version.selectedEntityIds.length} entities
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-800">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Forecasted Revenue:</span>
                      <span className="text-white ml-1 font-medium">
                        ${(version.summary.totalForecastedRevenue / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg Monthly:</span>
                      <span className="text-white ml-1 font-medium">
                        ${(version.summary.averageMonthlyRevenue / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Growth Rate:</span>
                      <span className={`ml-1 font-medium ${
                        version.summary.overallGrowthRate > 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {version.summary.overallGrowthRate.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Months:</span>
                      <span className="text-white ml-1 font-medium">
                        {version.forecastMonths}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
