"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Sun, 
  Users, 
  Crown, 
  Settings, 
  Database,
  ArrowRight,
  Zap,
  Heart,
  TrendingUp,
  Target,
  Sparkles
} from "lucide-react";

const roles = [
  {
    id: "staff",
    title: "Staff",
    subtitle: "Your personal workspace",
    description: "Focus on what matters. Manage your day, tasks, and growth with AI-powered support.",
    icon: <Sun className="w-6 h-6" />,
    color: "#00d4aa",
    href: "/staff",
    features: ["My Day view", "Focus time blocks", "Personal AI assistant", "Career pathways"],
  },
  {
    id: "manager",
    title: "Manager",
    subtitle: "Lead your team effectively",
    description: "Get insights into team health, prepare for 1:1s, and drive performance.",
    icon: <Users className="w-6 h-6" />,
    color: "#3b82f6",
    href: "/manager",
    features: ["Team dashboard", "Health metrics", "1:1 coaching hub", "Forecasting tools"],
  },
  {
    id: "leadership",
    title: "Leadership",
    subtitle: "Strategic command center",
    description: "See the truth across human, business, and financial dimensions. Make better decisions.",
    icon: <Crown className="w-6 h-6" />,
    color: "#f59e0b",
    href: "/leadership",
    features: ["Reality dashboard", "Waterline engine", "Strategic alignment", "Drift detection"],
  },
  {
    id: "admin",
    title: "Admin",
    subtitle: "System governance",
    description: "Configure organization settings, manage users, and control integrations.",
    icon: <Settings className="w-6 h-6" />,
    color: "#ef4444",
    href: "/admin",
    features: ["Org configuration", "User management", "Integration control", "AI governance"],
  },
  {
    id: "data",
    title: "Data & Analytics",
    subtitle: "Advanced analysis tools",
    description: "Build forecasts, run simulations, and understand the drivers of your business.",
    icon: <Database className="w-6 h-6" />,
    color: "#8b5cf6",
    href: "/data",
    features: ["Data explorer", "Monte Carlo sims", "Feature analysis", "Scenario modeling"],
  },
];

const modules = [
  { icon: <Heart className="w-5 h-5" />, label: "Human Truth", color: "#00d4aa" },
  { icon: <TrendingUp className="w-5 h-5" />, label: "Business Data", color: "#3b82f6" },
  { icon: <Target className="w-5 h-5" />, label: "Planning", color: "#f59e0b" },
  { icon: <Sparkles className="w-5 h-5" />, label: "AI Coordination", color: "#8b5cf6" },
];

export default function Home() {
  return (
    <div className="min-h-screen gradient-mesh">
      {/* Hero Section */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: "radial-gradient(circle, #00d4aa 0%, transparent 70%)" }}
          />
          <div 
            className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15"
            style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-12">
          {/* Logo and Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-3 mb-6">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse-glow"
                style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)" }}
              >
                <Zap className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 
              className="text-5xl font-bold mb-4 tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              OpsOS
            </h1>
            <p 
              className="text-xl mb-2"
              style={{ color: "var(--foreground-muted)" }}
            >
              Company Operating System
            </p>
            <p 
              className="text-base max-w-2xl mx-auto"
              style={{ color: "var(--foreground-subtle)" }}
            >
              A human-centered, AI-powered platform integrating truth, planning, 
              execution, and growth into one unified system.
            </p>
          </motion.div>

          {/* Module Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-wrap justify-center gap-3 mb-16"
          >
            {modules.map((module, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ 
                  background: `${module.color}15`,
                  border: `1px solid ${module.color}30`,
                }}
              >
                <span style={{ color: module.color }}>{module.icon}</span>
                <span className="text-sm font-medium" style={{ color: module.color }}>
                  {module.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Role Cards */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-10"
        >
          <h2 
            className="text-2xl font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Choose Your Workspace
          </h2>
          <p style={{ color: "var(--foreground-muted)" }}>
            Select a role to access your personalized experience
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {roles.map((role) => (
            <Link key={role.id} href={role.href}>
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ duration: 0.2 }}
                className="h-full rounded-2xl p-6 cursor-pointer group"
                style={{
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{ 
                      background: `${role.color}20`,
                      color: role.color,
                    }}
                  >
                    {role.icon}
                  </div>
                  <ArrowRight 
                    className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1"
                    style={{ color: role.color }}
                  />
                </div>

                <h3 
                  className="text-lg font-semibold mb-1"
                  style={{ color: "var(--foreground)" }}
                >
                  {role.title}
                </h3>
                <p 
                  className="text-sm mb-3"
                  style={{ color: role.color }}
                >
                  {role.subtitle}
                </p>
                <p 
                  className="text-sm mb-4"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {role.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {role.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-md"
                      style={{ 
                        background: "var(--background-tertiary)",
                        color: "var(--foreground-subtle)",
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer 
        className="border-t py-8"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)" }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              OpsOS v1.0
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
            Human-centered. AI-powered. Built for clarity.
          </p>
        </div>
      </footer>
    </div>
  );
}
