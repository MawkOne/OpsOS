"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
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
} from "lucide-react";

const initiatives = [
  {
    id: 1,
    name: "Q1 Product Launch",
    status: "on-track",
    progress: 72,
    owner: "Product Team",
    dueDate: "Mar 31",
    priority: "high",
  },
  {
    id: 2,
    name: "Infrastructure Migration",
    status: "at-risk",
    progress: 45,
    owner: "Engineering",
    dueDate: "Feb 28",
    priority: "high",
  },
  {
    id: 3,
    name: "Customer Success Program",
    status: "on-track",
    progress: 88,
    owner: "CX Team",
    dueDate: "Jan 31",
    priority: "medium",
  },
  {
    id: 4,
    name: "Sales Enablement",
    status: "completed",
    progress: 100,
    owner: "Sales Ops",
    dueDate: "Jan 15",
    priority: "medium",
  },
  {
    id: 5,
    name: "Data Platform Upgrade",
    status: "not-started",
    progress: 0,
    owner: "Data Team",
    dueDate: "Apr 30",
    priority: "low",
  },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  "on-track": { label: "On Track", color: "#00d4aa", bg: "rgba(0, 212, 170, 0.15)" },
  "at-risk": { label: "At Risk", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  "completed": { label: "Completed", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  "not-started": { label: "Not Started", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)" },
  "blocked": { label: "Blocked", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
};

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
};

export default function InitiativesDashboard() {
  const activeCount = initiatives.filter(i => i.status !== "completed" && i.status !== "not-started").length;
  const atRiskCount = initiatives.filter(i => i.status === "at-risk").length;
  const completedCount = initiatives.filter(i => i.status === "completed").length;

  return (
    <AppLayout title="Initiatives" subtitle="Track and manage strategic initiatives">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Initiatives" 
            value={initiatives.length}
            change={`${activeCount} active`}
            changeType="neutral"
            icon={<Zap className="w-5 h-5" />}
          />
          <StatCard 
            label="On Track" 
            value={initiatives.filter(i => i.status === "on-track").length}
            change="Good progress"
            changeType="positive"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard 
            label="At Risk" 
            value={atRiskCount}
            change={atRiskCount > 0 ? "Needs attention" : "All good"}
            changeType={atRiskCount > 0 ? "negative" : "positive"}
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <StatCard 
            label="Completed" 
            value={completedCount}
            change="This quarter"
            changeType="positive"
            icon={<Target className="w-5 h-5" />}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <button 
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            <Zap className="w-4 h-4" />
            New Initiative
          </button>
          <button 
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground-muted)",
            }}
          >
            <Calendar className="w-4 h-4" />
            View Timeline
          </button>
        </div>

        {/* Initiatives List */}
        <Card>
          <CardHeader 
            title="All Initiatives" 
            subtitle="Strategic projects and programs"
            icon={<Target className="w-5 h-5" />}
          />

          <div className="space-y-3">
            {initiatives.map((initiative, idx) => {
              const status = statusConfig[initiative.status];
              return (
                <motion.div
                  key={initiative.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 rounded-xl cursor-pointer group transition-all duration-200 hover:bg-[var(--background-tertiary)]"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {initiative.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : initiative.status === "at-risk" ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : initiative.status === "not-started" ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
                          {initiative.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                            <Users className="w-3 h-3" />
                            {initiative.owner}
                          </span>
                          <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                            <Calendar className="w-3 h-3" />
                            {initiative.dueDate}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                      <ArrowRight 
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        style={{ color: "var(--foreground-muted)" }}
                      />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div 
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--background-secondary)" }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${initiative.progress}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: status.color }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-12 text-right" style={{ color: status.color }}>
                      {initiative.progress}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

