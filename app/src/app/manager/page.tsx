"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  Users,
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MessageSquare,
  Target,
  Sparkles,
} from "lucide-react";

const teamMembers = [
  { id: 1, name: "Sarah Chen", role: "Senior Engineer", health: 92, trend: "up", avatar: "SC" },
  { id: 2, name: "Mike Johnson", role: "Product Designer", health: 78, trend: "down", avatar: "MJ" },
  { id: 3, name: "Emily Davis", role: "Data Analyst", health: 85, trend: "stable", avatar: "ED" },
  { id: 4, name: "Alex Kim", role: "Backend Engineer", health: 88, trend: "up", avatar: "AK" },
  { id: 5, name: "Jordan Lee", role: "QA Engineer", health: 71, trend: "down", avatar: "JL" },
];

const upcomingOneOnOnes = [
  { name: "Mike Johnson", time: "Today 2:00 PM", topics: 3, flag: true },
  { name: "Jordan Lee", time: "Tomorrow 10:00 AM", topics: 2, flag: true },
  { name: "Sarah Chen", time: "Thu 3:00 PM", topics: 1, flag: false },
];

const teamGoals = [
  { name: "Q1 Feature Delivery", progress: 68, target: "Jan 31", status: "on-track" },
  { name: "Technical Debt Reduction", progress: 45, target: "Feb 15", status: "at-risk" },
  { name: "Customer Satisfaction", progress: 82, target: "Ongoing", status: "ahead" },
];

const statusColors: Record<string, string> = {
  "on-track": "#00d4aa",
  "at-risk": "#f59e0b",
  "ahead": "#3b82f6",
  "behind": "#ef4444",
};

export default function ManagerDashboard() {
  const averageHealth = Math.round(teamMembers.reduce((sum, m) => sum + m.health, 0) / teamMembers.length);
  
  return (
    <AppLayout title="Team Dashboard" subtitle="Your team at a glance">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Team Size" 
            value={teamMembers.length}
            change="All active"
            changeType="positive"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard 
            label="Team Health" 
            value={`${averageHealth}%`}
            change="+3% this week"
            changeType="positive"
            icon={<Heart className="w-5 h-5" />}
          />
          <StatCard 
            label="Goal Progress" 
            value="68%"
            change="On track for Q1"
            changeType="positive"
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard 
            label="1:1s This Week" 
            value="3"
            change="2 need attention"
            changeType="neutral"
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Members */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader 
                title="Team Health" 
                subtitle="Individual wellness scores"
                icon={<Heart className="w-5 h-5" />}
                action={
                  <button 
                    className="px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ 
                      background: "var(--accent-muted)",
                      color: "var(--accent)",
                    }}
                  >
                    View Details
                  </button>
                }
              />

              <div className="space-y-3">
                {teamMembers.map((member, idx) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ 
                        background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)",
                        color: "white",
                      }}
                    >
                      {member.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {member.name}
                      </p>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {member.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p 
                          className="font-semibold"
                          style={{ 
                            color: member.health >= 80 ? "var(--success)" : 
                                   member.health >= 70 ? "var(--warning)" : "var(--error)"
                          }}
                        >
                          {member.health}%
                        </p>
                      </div>
                      {member.trend === "up" && <TrendingUp className="w-4 h-4" style={{ color: "var(--success)" }} />}
                      {member.trend === "down" && <TrendingDown className="w-4 h-4" style={{ color: "var(--error)" }} />}
                      {member.health < 75 && (
                        <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning)" }} />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          {/* 1:1s */}
          <Card>
            <CardHeader 
              title="Upcoming 1:1s" 
              subtitle="Coaching conversations"
              icon={<MessageSquare className="w-5 h-5" />}
            />

            <div className="space-y-3">
              {upcomingOneOnOnes.map((meeting, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>
                      {meeting.name}
                    </p>
                    {meeting.flag && (
                      <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning)" }} />
                    )}
                  </div>
                  <p className="text-sm mb-2" style={{ color: "var(--foreground-muted)" }}>
                    {meeting.time}
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {meeting.topics} topics to discuss
                  </p>
                </motion.div>
              ))}
            </div>

            <button 
              className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
              style={{ 
                background: "var(--secondary-muted)",
                color: "var(--secondary)",
              }}
            >
              <Sparkles className="w-4 h-4" />
              AI Prep Topics
            </button>
          </Card>
        </div>

        {/* Team Goals */}
        <Card>
          <CardHeader 
            title="Team Goals" 
            subtitle="Q1 2026 objectives"
            icon={<Target className="w-5 h-5" />}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teamGoals.map((goal, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-4 rounded-lg"
                style={{ background: "var(--background-tertiary)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium" style={{ color: "var(--foreground)" }}>
                    {goal.name}
                  </p>
                  <span
                    className="text-xs px-2 py-1 rounded capitalize"
                    style={{ 
                      background: `${statusColors[goal.status]}20`,
                      color: statusColors[goal.status],
                    }}
                  >
                    {goal.status.replace("-", " ")}
                  </span>
                </div>
                
                <div className="mb-2">
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--background-secondary)" }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${goal.progress}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: statusColors[goal.status] }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--foreground-muted)" }}>{goal.progress}%</span>
                  <span style={{ color: "var(--foreground-subtle)" }}>Target: {goal.target}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

