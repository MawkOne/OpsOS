"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  GripVertical,
  Plus,
  Target,
  TrendingUp,
  Users,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface Priority {
  id: string;
  title: string;
  problem: string;
  category: "growth" | "efficiency" | "risk" | "innovation";
  owner: string;
  quarter: string;
  status: "on-track" | "at-risk" | "needs-attention";
  rank: number;
  alignedInitiatives: string[];
}

const initialPriorities: Priority[] = [
  {
    id: "1",
    title: "Accelerate Revenue Growth",
    problem: "Revenue growth has plateaued at 15% YoY. Need to reach 40% growth to meet Series B targets.",
    category: "growth",
    owner: "CEO",
    quarter: "Q1-Q2 2026",
    status: "on-track",
    rank: 1,
    alignedInitiatives: ["Launch New Product Line", "Expand to European Markets"],
  },
  {
    id: "2",
    title: "Improve Customer Retention",
    problem: "Churn rate increased to 8% monthly. Customer lifetime value declining, need to improve onboarding and engagement.",
    category: "efficiency",
    owner: "VP Customer Success",
    quarter: "Q1 2026",
    status: "at-risk",
    rank: 2,
    alignedInitiatives: ["Customer Success Platform"],
  },
  {
    id: "3",
    title: "Build Competitive Moat",
    problem: "Two major competitors launched similar features. Need differentiation through AI/ML capabilities to maintain market position.",
    category: "innovation",
    owner: "CTO",
    quarter: "Q1-Q3 2026",
    status: "on-track",
    rank: 3,
    alignedInitiatives: ["AI-Powered Analytics Dashboard"],
  },
  {
    id: "4",
    title: "Scale Team Efficiency",
    problem: "Cost per customer acquisition rising while team productivity declining. Need process improvements and automation.",
    category: "efficiency",
    owner: "COO",
    quarter: "Q2 2026",
    status: "needs-attention",
    rank: 4,
    alignedInitiatives: [],
  },
  {
    id: "5",
    title: "Reduce Technical Debt",
    problem: "System performance degrading, 15% of engineering time spent on incidents. Infrastructure modernization critical.",
    category: "risk",
    owner: "VP Engineering",
    quarter: "Q2-Q3 2026",
    status: "needs-attention",
    rank: 5,
    alignedInitiatives: [],
  },
];

const categoryColors = {
  growth: "#00d4aa",
  efficiency: "#3b82f6",
  risk: "#ef4444",
  innovation: "#8b5cf6",
};

const categoryIcons = {
  growth: <TrendingUp className="w-4 h-4" />,
  efficiency: <Target className="w-4 h-4" />,
  risk: <AlertTriangle className="w-4 h-4" />,
  innovation: <Zap className="w-4 h-4" />,
};

const statusConfig = {
  "on-track": {
    label: "On Track",
    color: "#00d4aa",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  "at-risk": {
    label: "At Risk",
    color: "#f59e0b",
    icon: <Clock className="w-4 h-4" />,
  },
  "needs-attention": {
    label: "Needs Attention",
    color: "#ef4444",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState<Priority[]>(initialPriorities);
  const [draggedItem, setDraggedItem] = useState<Priority | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, priority: Priority) => {
    setDraggedItem(priority);
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

    const currentIndex = priorities.findIndex(p => p.id === draggedItem.id);
    
    if (currentIndex === dropIndex) {
      setDragOverIndex(null);
      setDraggedItem(null);
      return;
    }

    const newPriorities = [...priorities];
    newPriorities.splice(currentIndex, 1);
    newPriorities.splice(dropIndex, 0, draggedItem);

    // Update rank numbers
    const updatedPriorities = newPriorities.map((priority, idx) => ({
      ...priority,
      rank: idx + 1,
    }));

    setPriorities(updatedPriorities);
    setDragOverIndex(null);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDraggedItem(null);
  };

  const onTrackCount = priorities.filter(p => p.status === "on-track").length;
  const atRiskCount = priorities.filter(p => p.status === "at-risk").length;
  const needsAttentionCount = priorities.filter(p => p.status === "needs-attention").length;

  return (
    <AppLayout 
      title="Strategic Priorities" 
      subtitle="Company-level problems and goals that drive initiatives"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Total Priorities
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {priorities.length}
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
                    On Track
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {onTrackCount}
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
                    At Risk
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {atRiskCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}
                >
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Needs Attention
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {needsAttentionCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
                >
                  <AlertTriangle className="w-5 h-5" />
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
                <Target className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Strategic Priorities
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  These are the highest-level company problems and goals. All initiatives should align with and support these priorities. Drag to reorder by importance.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Priorities List */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <div className="space-y-3">
              {priorities.map((priority, index) => (
                <div
                  key={priority.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, priority)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    group relative rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing
                    ${dragOverIndex === index ? 'scale-105 shadow-lg' : 'hover:shadow-md'}
                    ${draggedItem?.id === priority.id ? 'opacity-50' : ''}
                  `}
                  style={{ 
                    background: "var(--card)",
                    borderColor: dragOverIndex === index ? categoryColors[priority.category] : "var(--border)",
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Drag Handle */}
                      <div className="flex-shrink-0 pt-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                      </div>

                      {/* Rank Badge */}
                      <div 
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ 
                          background: `${categoryColors[priority.category]}15`,
                          color: categoryColors[priority.category]
                        }}
                      >
                        {priority.rank}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold mb-1" style={{ color: "var(--foreground)" }}>
                              {priority.title}
                            </h3>
                            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--foreground-muted)" }}>
                              {priority.problem}
                            </p>
                          </div>
                        </div>

                        {/* Meta Info Row 1 */}
                        <div className="flex items-center gap-4 mb-2 text-xs">
                          {/* Category */}
                          <div 
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full font-medium capitalize"
                            style={{ 
                              background: `${categoryColors[priority.category]}15`,
                              color: categoryColors[priority.category]
                            }}
                          >
                            {categoryIcons[priority.category]}
                            <span>{priority.category}</span>
                          </div>

                          {/* Status */}
                          <div 
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full font-medium"
                            style={{ 
                              background: `${statusConfig[priority.status].color}15`,
                              color: statusConfig[priority.status].color
                            }}
                          >
                            {statusConfig[priority.status].icon}
                            <span>{statusConfig[priority.status].label}</span>
                          </div>

                          {/* Owner */}
                          <div className="flex items-center gap-1.5" style={{ color: "var(--foreground-muted)" }}>
                            <Users className="w-4 h-4" />
                            <span>{priority.owner}</span>
                          </div>

                          {/* Quarter */}
                          <div className="flex items-center gap-1.5" style={{ color: "var(--foreground-muted)" }}>
                            <Clock className="w-4 h-4" />
                            <span>{priority.quarter}</span>
                          </div>
                        </div>

                        {/* Aligned Initiatives */}
                        {priority.alignedInitiatives.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium" style={{ color: "var(--foreground-muted)" }}>
                              Aligned Initiatives:
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {priority.alignedInitiatives.map((initiative, idx) => (
                                <span 
                                  key={idx}
                                  className="px-2 py-1 rounded-full flex items-center gap-1"
                                  style={{ 
                                    background: "var(--muted)",
                                    color: "var(--foreground)"
                                  }}
                                >
                                  <Zap className="w-3 h-3" />
                                  {initiative}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {priority.alignedInitiatives.length === 0 && (
                          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                            <AlertTriangle className="w-4 h-4" style={{ color: "#f59e0b" }} />
                            <span>No aligned initiatives yet</span>
                          </div>
                        )}
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
              Add New Priority
            </button>
          </Card>
        </motion.div>

        {/* Link to Initiatives */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Ready to execute?
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Create and prioritize initiatives that align with these strategic priorities.
                </p>
              </div>
              <a 
                href="/planning/initiatives"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:opacity-80"
                style={{ 
                  background: "#8b5cf6",
                  color: "white"
                }}
              >
                View Initiatives
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
