"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { motion } from "framer-motion";
import {
  Sun,
  CheckCircle2,
  Clock,
  Target,
  Calendar,
  MessageSquare,
  TrendingUp,
  Sparkles,
  Play,
  Coffee,
} from "lucide-react";

const todaysTasks = [
  { id: 1, title: "Review Q1 planning doc", priority: "high", time: "9:00 AM", completed: false },
  { id: 2, title: "Team standup meeting", priority: "medium", time: "10:00 AM", completed: true },
  { id: 3, title: "Finish feature spec", priority: "high", time: "11:00 AM", completed: false },
  { id: 4, title: "1:1 with Sarah", priority: "medium", time: "2:00 PM", completed: false },
  { id: 5, title: "Code review: Auth module", priority: "low", time: "4:00 PM", completed: false },
];

const focusBlocks = [
  { time: "9:00 - 11:00 AM", label: "Deep Work", type: "focus", icon: <Target className="w-4 h-4" /> },
  { time: "11:00 - 12:00 PM", label: "Meetings", type: "meeting", icon: <Calendar className="w-4 h-4" /> },
  { time: "12:00 - 1:00 PM", label: "Lunch", type: "break", icon: <Coffee className="w-4 h-4" /> },
  { time: "1:00 - 3:00 PM", label: "Collaboration", type: "collab", icon: <MessageSquare className="w-4 h-4" /> },
  { time: "3:00 - 5:00 PM", label: "Deep Work", type: "focus", icon: <Target className="w-4 h-4" /> },
];

const typeColors: Record<string, string> = {
  focus: "#00d4aa",
  meeting: "#f59e0b",
  break: "#8b5cf6",
  collab: "#3b82f6",
};

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
};

export default function StaffDashboard() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  
  return (
    <AppLayout title="My Day" subtitle={`${greeting}, Mark`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Tasks Today" 
            value="5" 
            change="2 completed"
            changeType="positive"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard 
            label="Focus Time" 
            value="4h" 
            change="2 blocks scheduled"
            changeType="neutral"
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard 
            label="Meetings" 
            value="2" 
            change="1h 30m total"
            changeType="neutral"
            icon={<Calendar className="w-5 h-5" />}
          />
          <StatCard 
            label="Streak" 
            value="7 days" 
            change="+3 from last week"
            changeType="positive"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader 
                title="Today's Schedule" 
                subtitle="Tuesday, January 6"
                icon={<Sun className="w-5 h-5" />}
              />
              
              <div className="space-y-3">
                {focusBlocks.map((block, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ 
                        background: `${typeColors[block.type]}20`,
                        color: typeColors[block.type],
                      }}
                    >
                      {block.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {block.label}
                      </p>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {block.time}
                      </p>
                    </div>
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ background: typeColors[block.type] }}
                    />
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Assistant */}
          <Card glow="accent">
            <CardHeader 
              title="AI Assistant" 
              subtitle="Here to help"
              icon={<Sparkles className="w-5 h-5" />}
            />
            
            <div 
              className="p-4 rounded-lg mb-4"
              style={{ background: "var(--accent-muted)" }}
            >
              <p className="text-sm" style={{ color: "var(--foreground)" }}>
                &quot;Based on your patterns, I&apos;ve optimized your schedule for peak focus time this morning. You have 2 hours of uninterrupted deep work ahead.&quot;
              </p>
            </div>

            <div className="space-y-2">
              <button 
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{ 
                  background: "var(--accent)",
                  color: "var(--background)",
                }}
              >
                <Play className="w-4 h-4" />
                Start Focus Session
              </button>
              <button 
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{ 
                  background: "var(--background-tertiary)",
                  color: "var(--foreground-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <MessageSquare className="w-4 h-4" />
                Ask AI
              </button>
            </div>
          </Card>
        </div>

        {/* Tasks */}
        <Card>
          <CardHeader 
            title="Today's Tasks" 
            subtitle={`${todaysTasks.filter(t => t.completed).length} of ${todaysTasks.length} completed`}
            icon={<CheckCircle2 className="w-5 h-5" />}
            action={
              <button 
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ 
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                Add Task
              </button>
            }
          />

          <div className="space-y-2">
            {todaysTasks.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-lg transition-all duration-150 hover:bg-[var(--background-tertiary)]"
                style={{ 
                  opacity: task.completed ? 0.6 : 1,
                }}
              >
                <button 
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150"
                  style={{ 
                    borderColor: task.completed ? "var(--accent)" : "var(--border)",
                    background: task.completed ? "var(--accent)" : "transparent",
                  }}
                >
                  {task.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1">
                  <p 
                    className={`font-medium ${task.completed ? 'line-through' : ''}`}
                    style={{ color: "var(--foreground)" }}
                  >
                    {task.title}
                  </p>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {task.time}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{ 
                    background: `${priorityColors[task.priority]}20`,
                    color: priorityColors[task.priority],
                  }}
                >
                  {task.priority}
                </span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

