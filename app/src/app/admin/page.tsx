"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  Settings,
  Users,
  Briefcase,
  Zap,
  Bot,
  Shield,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";

const systemHealth = [
  { name: "API Services", status: "healthy", uptime: "99.9%" },
  { name: "Database", status: "healthy", uptime: "99.8%" },
  { name: "AI Engine", status: "healthy", uptime: "99.7%" },
  { name: "Integrations", status: "warning", uptime: "98.2%" },
];

const recentActivity = [
  { action: "User role updated", user: "admin@company.com", target: "Sarah Chen → Manager", time: "2 hours ago" },
  { action: "Integration enabled", user: "admin@company.com", target: "Slack workspace", time: "5 hours ago" },
  { action: "AI model updated", user: "system", target: "Forecasting v2.3", time: "1 day ago" },
  { action: "Rhythm schedule changed", user: "admin@company.com", target: "Weekly sync → Bi-weekly", time: "2 days ago" },
];

const quickActions = [
  { label: "Add User", icon: <Users className="w-5 h-5" />, color: "#00d4aa" },
  { label: "Configure AI", icon: <Bot className="w-5 h-5" />, color: "#3b82f6" },
  { label: "Integrations", icon: <Zap className="w-5 h-5" />, color: "#f59e0b" },
  { label: "Permissions", icon: <Shield className="w-5 h-5" />, color: "#8b5cf6" },
];

const statusColors: Record<string, string> = {
  healthy: "#00d4aa",
  warning: "#f59e0b",
  error: "#ef4444",
};

export default function AdminDashboard() {
  return (
    <AppLayout title="Admin Dashboard" subtitle="System configuration & governance">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Users" 
            value="247"
            change="12 pending invites"
            changeType="neutral"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard 
            label="Active Integrations" 
            value="8"
            change="1 needs attention"
            changeType="neutral"
            icon={<Zap className="w-5 h-5" />}
          />
          <StatCard 
            label="System Health" 
            value="99.5%"
            change="All systems normal"
            changeType="positive"
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard 
            label="AI Usage" 
            value="12.4k"
            change="Requests this week"
            changeType="positive"
            icon={<Bot className="w-5 h-5" />}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <motion.button
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-xl flex flex-col items-center gap-3 transition-all duration-200"
              style={{
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: `${action.color}20`,
                  color: action.color,
                }}
              >
                {action.icon}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Health */}
          <Card>
            <CardHeader 
              title="System Health" 
              subtitle="Service status"
              icon={<Activity className="w-5 h-5" />}
            />

            <div className="space-y-3">
              {systemHealth.map((service, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ background: statusColors[service.status] }}
                    />
                    <span style={{ color: "var(--foreground)" }}>{service.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      {service.uptime}
                    </span>
                    {service.status === "healthy" ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: statusColors.healthy }} />
                    ) : (
                      <AlertTriangle className="w-4 h-4" style={{ color: statusColors.warning }} />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader 
                title="Recent Activity" 
                subtitle="Admin actions log"
                icon={<Settings className="w-5 h-5" />}
              />

              <div className="space-y-3">
                {recentActivity.map((activity, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-4 p-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ 
                        background: "var(--accent-muted)",
                        color: "var(--accent)",
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {activity.action}
                      </p>
                      <p className="text-sm truncate" style={{ color: "var(--foreground-muted)" }}>
                        {activity.target}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          {activity.user}
                        </span>
                        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>•</span>
                        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          {activity.time}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Configuration Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Organization", subtitle: "Company settings", icon: <Briefcase className="w-5 h-5" />, count: 12 },
            { title: "Users & Roles", subtitle: "Access management", icon: <Users className="w-5 h-5" />, count: 247 },
            { title: "Integrations", subtitle: "Connected services", icon: <Zap className="w-5 h-5" />, count: 8 },
            { title: "Rhythms", subtitle: "Meeting cadences", icon: <Calendar className="w-5 h-5" />, count: 5 },
          ].map((section, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="p-5 rounded-xl cursor-pointer"
              style={{
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ 
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                {section.icon}
              </div>
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                {section.title}
              </h3>
              <p className="text-sm mb-2" style={{ color: "var(--foreground-muted)" }}>
                {section.subtitle}
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {section.count} items
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

