"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Target,
  TrendingUp,
  Calendar,
  BarChart3,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Play,
} from "lucide-react";

const planningTools = [
  {
    title: "Build Forecast",
    subtitle: "AI-powered predictions",
    description: "Create accurate forecasts with causal analysis and scenario modeling.",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "#00d4aa",
    href: "/planning/forecast",
    badge: "Core",
  },
  {
    title: "Scenario Modeling",
    subtitle: "What-if analysis",
    description: "Compare different scenarios and understand sensitivity to inputs.",
    icon: <BarChart3 className="w-6 h-6" />,
    color: "#3b82f6",
    href: "/planning/scenarios",
  },
  {
    title: "Monte Carlo",
    subtitle: "Probabilistic simulation",
    description: "Run thousands of simulations to understand risk distributions.",
    icon: <Sparkles className="w-6 h-6" />,
    color: "#8b5cf6",
    href: "/planning/monte-carlo",
  },
];

const upcomingMilestones = [
  { name: "Q1 Planning Complete", date: "Jan 15", status: "completed" },
  { name: "Budget Finalization", date: "Jan 31", status: "in-progress" },
  { name: "Team Allocations", date: "Feb 7", status: "upcoming" },
  { name: "Roadmap Review", date: "Feb 14", status: "upcoming" },
];

const statusColors: Record<string, string> = {
  completed: "#00d4aa",
  "in-progress": "#3b82f6",
  upcoming: "#f59e0b",
};

export default function PlanningDashboard() {
  return (
    <AppLayout title="Planning" subtitle="Strategic planning and forecasting">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Planning Cycle" 
            value="Q1 2026"
            change="In progress"
            changeType="neutral"
            icon={<Calendar className="w-5 h-5" />}
          />
          <StatCard 
            label="Forecast Accuracy" 
            value="94%"
            change="+3% vs last quarter"
            changeType="positive"
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard 
            label="Scenarios" 
            value="4"
            change="Active scenarios"
            changeType="neutral"
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <StatCard 
            label="Next Milestone" 
            value="6 days"
            change="Budget Finalization"
            changeType="neutral"
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        {/* Planning Tools */}
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Planning Tools
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planningTools.map((tool, idx) => (
              <Link key={idx} href={tool.href}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="p-5 rounded-xl cursor-pointer group h-full"
                  style={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{ background: `${tool.color}20`, color: tool.color }}
                    >
                      {tool.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {tool.badge && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                        >
                          {tool.badge}
                        </span>
                      )}
                      <ArrowRight 
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        style={{ color: tool.color }}
                      />
                    </div>
                  </div>
                  <h4 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    {tool.title}
                  </h4>
                  <p className="text-sm mb-2" style={{ color: tool.color }}>
                    {tool.subtitle}
                  </p>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {tool.description}
                  </p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Roadmap Preview */}
          <Card>
            <CardHeader 
              title="Roadmap" 
              subtitle="Q1 2026 priorities"
              icon={<Target className="w-5 h-5" />}
              action={
                <Link 
                  href="/planning/roadmap"
                  className="text-sm font-medium flex items-center gap-1"
                  style={{ color: "var(--accent)" }}
                >
                  View Full
                  <ArrowRight className="w-4 h-4" />
                </Link>
              }
            />

            <div className="space-y-4">
              {[
                { name: "Product Launch v2.0", progress: 65, priority: 1 },
                { name: "Platform Scalability", progress: 40, priority: 2 },
                { name: "Customer Portal", progress: 25, priority: 3 },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                      >
                        {item.priority}
                      </span>
                      <span className="font-medium" style={{ color: "var(--foreground)" }}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                      {item.progress}%
                    </span>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader 
              title="Upcoming Milestones" 
              subtitle="Key dates"
              icon={<Calendar className="w-5 h-5" />}
            />

            <div className="space-y-3">
              {upcomingMilestones.map((milestone, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: `${statusColors[milestone.status]}20`,
                      color: statusColors[milestone.status],
                    }}
                  >
                    {milestone.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : milestone.status === "in-progress" ? (
                      <Play className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p 
                      className="font-medium"
                      style={{ 
                        color: milestone.status === "completed" ? "var(--foreground-muted)" : "var(--foreground)",
                        textDecoration: milestone.status === "completed" ? "line-through" : "none",
                      }}
                    >
                      {milestone.name}
                    </p>
                    <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
                      {milestone.date}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded capitalize"
                    style={{ 
                      background: `${statusColors[milestone.status]}20`,
                      color: statusColors[milestone.status],
                    }}
                  >
                    {milestone.status.replace("-", " ")}
                  </span>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

