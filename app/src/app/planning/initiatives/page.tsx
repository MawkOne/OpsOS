"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  GripVertical,
  Plus,
  Target,
  Calendar,
  Users,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Initiative {
  id: string;
  title: string;
  description: string;
  owner: string;
  targetDate: string;
  status: "active" | "planning" | "on-hold";
  priority: number;
  impact: "high" | "medium" | "low";
}

const initialInitiatives: Initiative[] = [
  {
    id: "1",
    title: "Launch New Product Line",
    description: "Develop and launch 3 new premium subscription tiers with enhanced features",
    owner: "Product Team",
    targetDate: "Mar 2026",
    status: "active",
    priority: 1,
    impact: "high",
  },
  {
    id: "2",
    title: "Expand to European Markets",
    description: "Localize platform for EU markets including GDPR compliance and multi-currency support",
    owner: "Growth Team",
    targetDate: "Apr 2026",
    status: "active",
    priority: 2,
    impact: "high",
  },
  {
    id: "3",
    title: "AI-Powered Analytics Dashboard",
    description: "Build intelligent insights engine with predictive analytics and automated recommendations",
    owner: "Engineering",
    targetDate: "May 2026",
    status: "planning",
    priority: 3,
    impact: "high",
  },
  {
    id: "4",
    title: "Customer Success Platform",
    description: "Implement comprehensive CS tool with health scores, automated workflows, and engagement tracking",
    owner: "CS Team",
    targetDate: "Jun 2026",
    status: "planning",
    priority: 4,
    impact: "medium",
  },
  {
    id: "5",
    title: "Mobile App Development",
    description: "Create native iOS and Android apps with offline capabilities and push notifications",
    owner: "Mobile Team",
    targetDate: "Jul 2026",
    status: "on-hold",
    priority: 5,
    impact: "medium",
  },
  {
    id: "6",
    title: "API Marketplace",
    description: "Build third-party integration marketplace with developer portal and sandbox environment",
    owner: "Platform Team",
    targetDate: "Aug 2026",
    status: "on-hold",
    priority: 6,
    impact: "low",
  },
];

const impactColors = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

const statusIcons = {
  active: <CheckCircle2 className="w-4 h-4" style={{ color: "#00d4aa" }} />,
  planning: <Clock className="w-4 h-4" style={{ color: "#3b82f6" }} />,
  "on-hold": <AlertCircle className="w-4 h-4" style={{ color: "#6b7280" }} />,
};

export default function InitiativesPage() {
  const [initiatives, setInitiatives] = useState<Initiative[]>(initialInitiatives);
  const [draggedItem, setDraggedItem] = useState<Initiative | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Find the waterline index (first on-hold initiative)
  const waterlineIndex = initiatives.findIndex(init => init.status === "on-hold");

  const handleDragStart = (e: React.DragEvent, initiative: Initiative) => {
    setDraggedItem(initiative);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    const currentIndex = initiatives.findIndex(init => init.id === draggedItem.id);
    
    if (currentIndex === dropIndex) {
      setDragOverIndex(null);
      setDraggedItem(null);
      return;
    }

    const newInitiatives = [...initiatives];
    newInitiatives.splice(currentIndex, 1);
    newInitiatives.splice(dropIndex, 0, draggedItem);

    // Update priority numbers
    const updatedInitiatives = newInitiatives.map((init, idx) => ({
      ...init,
      priority: idx + 1,
    }));

    setInitiatives(updatedInitiatives);
    setDragOverIndex(null);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDraggedItem(null);
  };

  const activeCount = initiatives.filter(i => i.status !== "on-hold").length;
  const onHoldCount = initiatives.filter(i => i.status === "on-hold").length;

  return (
    <AppLayout 
      title="Initiatives" 
      subtitle="Prioritize and manage strategic initiatives"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Total Initiatives
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {initiatives.length}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                >
                  <Target className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Active
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {activeCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(0, 212, 170, 0.1)", color: "#00d4aa" }}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    On Hold
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {onHoldCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(107, 114, 128, 0.1)", color: "#6b7280" }}
                >
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    High Impact
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {initiatives.filter(i => i.impact === "high").length}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
                >
                  <Zap className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Instructions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139, 92, 246, 0.1)" }}>
                <GripVertical className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Drag to Prioritize
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Drag initiatives to reorder them by priority. Items below the waterline are on hold and not actively being worked on.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Initiatives List */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <div className="space-y-3">
              {initiatives.map((initiative, index) => (
                <div key={initiative.id}>
                  {/* Waterline */}
                  {waterlineIndex === index && (
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-dashed" style={{ borderColor: "var(--border)" }}></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span 
                          className="px-4 py-1 text-xs font-medium rounded-full"
                          style={{ 
                            background: "var(--muted)", 
                            color: "var(--foreground-muted)",
                            border: "2px dashed var(--border)"
                          }}
                        >
                          ⚡ Waterline — Items below are on hold
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Initiative Card */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, initiative)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                      group relative rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing
                      ${dragOverIndex === index ? 'scale-105 shadow-lg' : 'hover:shadow-md'}
                      ${draggedItem?.id === initiative.id ? 'opacity-50' : ''}
                      ${initiative.status === "on-hold" ? 'opacity-60' : ''}
                    `}
                    style={{ 
                      background: "var(--card)",
                      borderColor: dragOverIndex === index ? "#8b5cf6" : "var(--border)",
                    }}
                  >
                    <div className="p-4 flex items-start gap-4">
                      {/* Drag Handle */}
                      <div className="flex-shrink-0 pt-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                      </div>

                      {/* Priority Badge */}
                      <div 
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ 
                          background: initiative.status === "on-hold" ? "var(--muted)" : "rgba(139, 92, 246, 0.1)",
                          color: initiative.status === "on-hold" ? "var(--foreground-muted)" : "#8b5cf6"
                        }}
                      >
                        {initiative.priority}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                              {initiative.title}
                            </h3>
                            <p className="text-xs line-clamp-2" style={{ color: "var(--foreground-muted)" }}>
                              {initiative.description}
                            </p>
                          </div>
                          
                          {/* Impact Badge */}
                          <div 
                            className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium capitalize"
                            style={{ 
                              background: `${impactColors[initiative.impact]}15`,
                              color: impactColors[initiative.impact]
                            }}
                          >
                            {initiative.impact} impact
                          </div>
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--foreground-muted)" }}>
                          <div className="flex items-center gap-1.5">
                            {statusIcons[initiative.status]}
                            <span className="capitalize">{initiative.status.replace("-", " ")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>{initiative.owner}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>{initiative.targetDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Button */}
            <button
              className="w-full mt-4 py-3 rounded-lg border-2 border-dashed transition-all duration-200 hover:border-opacity-100 hover:bg-opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
              style={{ 
                borderColor: "var(--border)",
                color: "var(--foreground-muted)"
              }}
            >
              <Plus className="w-4 h-4" />
              Add New Initiative
            </button>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
