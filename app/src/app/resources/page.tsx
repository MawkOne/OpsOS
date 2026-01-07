"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Users,
  Wrench,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowRight,
  AlertTriangle,
  PieChart,
  Package,
} from "lucide-react";
import { Person, Tool, toolCategories, currencies } from "@/types/resources";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function ResourcesDashboard() {
  const { currentOrg } = useOrganization();
  const [people, setPeople] = useState<Person[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Current time for renewal calculations
  const [currentTime] = useState(() => Date.now());

  // Load data from Firestore
  useEffect(() => {
    if (!currentOrg?.id) {
      setLoading(false);
      return;
    }

    const peopleQuery = query(
      collection(db, "people"), 
      where("organizationId", "==", currentOrg.id),
      orderBy("name")
    );
    const toolsQuery = query(
      collection(db, "tools"), 
      where("organizationId", "==", currentOrg.id),
      orderBy("name")
    );

    const unsubPeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
      setPeople(data);
      setLoading(false);
    });

    const unsubTools = onSnapshot(toolsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
      setTools(data);
    });

    return () => {
      unsubPeople();
      unsubTools();
    };
  }, [currentOrg?.id]);

  // Calculate stats
  const totalSalary = people.reduce((sum, p) => {
    if (p.salaryType === "annual") return sum + p.salary;
    if (p.salaryType === "monthly") return sum + (p.salary * 12);
    return sum + (p.salary * p.hoursPerWeek * 52);
  }, 0);

  const totalToolsCost = tools.reduce((sum, t) => {
    if (t.billingCycle === "one_time") return sum; // One-time costs not included in annual
    if (t.billingCycle === "annual") return sum + t.cost;
    return sum + (t.cost * 12); // monthly
  }, 0);

  // Get upcoming renewals (next 30 days)
  const upcomingRenewals = tools.filter(t => {
    const renewalDate = t.renewalDate instanceof Timestamp 
      ? t.renewalDate.toDate() 
      : new Date(t.renewalDate);
    const daysUntil = Math.ceil((renewalDate.getTime() - currentTime) / (1000 * 60 * 60 * 24));
    return daysUntil > 0 && daysUntil <= 30;
  }).slice(0, 5);

  // Get recent team members (last 5)
  const recentPeople = [...people].slice(0, 5);

  // Calculate expenses by department
  const expensesByDepartment = people.reduce((acc, p) => {
    const annualSalary = p.salaryType === "annual" 
      ? p.salary 
      : p.salaryType === "monthly" 
        ? p.salary * 12 
        : p.salary * p.hoursPerWeek * 52;
    
    const dept = p.department || "Other";
    acc[dept] = (acc[dept] || 0) + annualSalary;
    return acc;
  }, {} as Record<string, number>);

  // Sort departments by expense and assign colors
  const departmentColors: Record<string, string> = {
    "Engineering": "#3b82f6",
    "Product": "#8b5cf6",
    "Design": "#ec4899",
    "Marketing": "#f59e0b",
    "Sales": "#10b981",
    "Operations": "#06b6d4",
    "Finance": "#84cc16",
    "HR": "#f43f5e",
    "Legal": "#6366f1",
    "Other": "#6b7280",
  };

  const sortedDepartments = Object.entries(expensesByDepartment)
    .sort((a, b) => b[1] - a[1])
    .map(([dept, amount]) => ({
      name: dept,
      amount,
      color: departmentColors[dept] || "#6b7280",
      percentage: totalSalary > 0 ? (amount / totalSalary) * 100 : 0,
    }));

  // Get COGS tools
  const cogsTools = tools.filter(t => t.isCOGS);
  const totalCOGS = cogsTools.reduce((sum, t) => {
    if (t.billingCycle === "one_time") return sum;
    if (t.billingCycle === "annual") return sum + t.cost;
    return sum + (t.cost * 12);
  }, 0);

  return (
    <AppLayout title="Resources" subtitle="Overview of your team and tools">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <StatCard 
              label="Team Members" 
              value={people.length}
              icon={<Users className="w-5 h-5" />}
              color="#00d4aa"
              href="/resources/people"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <StatCard 
              label="Monthly Payroll" 
              value={`-$${(totalSalary / 12 / 1000).toFixed(0)}k`}
              icon={<DollarSign className="w-5 h-5" />}
              color="#ef4444"
              href="/resources/people"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard 
              label="Annual Payroll" 
              value={`-$${(totalSalary / 1000).toFixed(0)}k`}
              icon={<DollarSign className="w-5 h-5" />}
              color="#ef4444"
              href="/resources/people"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <StatCard 
              label="Tools" 
              value={tools.length}
              icon={<Wrench className="w-5 h-5" />}
              color="#8b5cf6"
              href="/resources/tools"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatCard 
              label="Monthly Tools Cost" 
              value={`-$${(totalToolsCost / 12 / 1000).toFixed(1)}k`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="#ef4444"
              href="/resources/tools"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <StatCard 
              label="Annual Tools Cost" 
              value={`-$${(totalToolsCost / 1000).toFixed(0)}k`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="#ef4444"
              href="/resources/tools"
            />
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/resources/people">
            <Card className="hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "#00d4aa20", color: "#00d4aa" }}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                      Manage People
                    </h3>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Add, edit, and manage team members
                    </p>
                  </div>
                </div>
                <ArrowRight 
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform" 
                  style={{ color: "var(--foreground-muted)" }} 
                />
              </div>
            </Card>
          </Link>

          <Link href="/resources/tools">
            <Card className="hover:border-[var(--accent)] transition-all duration-200 cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                  >
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                      Manage Tools
                    </h3>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Track subscriptions and costs
                    </p>
                  </div>
                </div>
                <ArrowRight 
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform" 
                  style={{ color: "var(--foreground-muted)" }} 
                />
              </div>
            </Card>
          </Link>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Team Members */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Recent Team Members
              </h3>
              <Link 
                href="/resources/people"
                className="text-sm font-medium hover:underline"
                style={{ color: "var(--accent)" }}
              >
                View all
              </Link>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : recentPeople.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} />
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No team members yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPeople.map((person, idx) => (
                  <motion.div
                    key={person.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)", color: "white" }}
                    >
                      {person.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: "var(--foreground)" }}>{person.name}</p>
                      <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>{person.role}</p>
                    </div>
                    <span 
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: "var(--background-secondary)", color: "var(--foreground-muted)" }}
                    >
                      {person.department}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Upcoming Renewals */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Upcoming Renewals
              </h3>
              <Link 
                href="/resources/tools"
                className="text-sm font-medium hover:underline"
                style={{ color: "var(--accent)" }}
              >
                View all
              </Link>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : upcomingRenewals.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} />
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No renewals in the next 30 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingRenewals.map((tool, idx) => {
                  const category = toolCategories.find(c => c.value === tool.category);
                  const renewalDate = tool.renewalDate instanceof Timestamp 
                    ? tool.renewalDate.toDate() 
                    : new Date(tool.renewalDate);
                  const daysUntil = Math.ceil((renewalDate.getTime() - currentTime) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <motion.div
                      key={tool.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 p-2 rounded-lg"
                      style={{ background: "var(--background-tertiary)" }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{ background: `${category?.color}20`, color: category?.color }}
                      >
                        {tool.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: "var(--foreground)" }}>{tool.name}</p>
                        <p className="text-xs" style={{ color: "#ef4444" }}>
                          -{currencies.find(c => c.value === tool.currency)?.symbol || "$"}
                          {tool.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {tool.billingCycle === "one_time" ? "" : `/${tool.billingCycle === "monthly" ? "mo" : "yr"}`}
                        </p>
                      </div>
                      <span 
                        className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${daysUntil <= 7 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                      >
                        {daysUntil <= 7 && <AlertTriangle className="w-3 h-3" />}
                        {daysUntil}d
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Expenses by Department & COGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expenses by Department Pie Chart */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5" style={{ color: "var(--accent)" }} />
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Expenses by Department
              </h3>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : sortedDepartments.length === 0 ? (
              <div className="text-center py-8">
                <PieChart className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} />
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No expense data yet</p>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                {/* Pie Chart */}
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      let cumulativePercent = 0;
                      return sortedDepartments.map((dept, idx) => {
                        const startPercent = cumulativePercent;
                        cumulativePercent += dept.percentage;
                        const startAngle = (startPercent / 100) * 360;
                        const endAngle = (cumulativePercent / 100) * 360;
                        
                        // Calculate SVG arc path
                        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                        const largeArcFlag = dept.percentage > 50 ? 1 : 0;
                        
                        return (
                          <path
                            key={idx}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={dept.color}
                            stroke="var(--background-secondary)"
                            strokeWidth="1"
                          />
                        );
                      });
                    })()}
                    <circle cx="50" cy="50" r="25" fill="var(--background-secondary)" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Total</p>
                      <p className="text-sm font-bold" style={{ color: "#ef4444" }}>
                        -${(totalSalary / 1000).toFixed(0)}k
                      </p>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {sortedDepartments.slice(0, 6).map((dept, idx) => (
                    <motion.div
                      key={dept.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ background: dept.color }}
                        />
                        <span className="text-sm" style={{ color: "var(--foreground)" }}>
                          {dept.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium" style={{ color: "#ef4444" }}>
                          -${(dept.amount / 1000).toFixed(0)}k
                        </span>
                        <span className="text-xs ml-2" style={{ color: "var(--foreground-muted)" }}>
                          ({dept.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {sortedDepartments.length > 6 && (
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      +{sortedDepartments.length - 6} more departments
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* COGS List */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" style={{ color: "#f59e0b" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Cost of Goods Sold (COGS)
                </h3>
              </div>
              <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                -${(totalCOGS / 1000).toFixed(1)}k/yr
              </span>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : cogsTools.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} />
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No COGS items</p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                  Mark tools as COGS when adding them
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cogsTools.map((tool, idx) => {
                  const category = toolCategories.find(c => c.value === tool.category);
                  const annualCost = tool.billingCycle === "annual" 
                    ? tool.cost 
                    : tool.billingCycle === "monthly" 
                      ? tool.cost * 12 
                      : tool.cost;
                  
                  return (
                    <motion.div
                      key={tool.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 p-2 rounded-lg"
                      style={{ background: "var(--background-tertiary)" }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{ background: `${category?.color}20`, color: category?.color }}
                      >
                        {tool.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: "var(--foreground)" }}>{tool.name}</p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          {category?.label || tool.category}
                          {tool.costType && ` • ${tool.costType}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
                          -{currencies.find(c => c.value === tool.currency)?.symbol || "$"}
                          {tool.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {tool.billingCycle === "one_time" ? "" : `/${tool.billingCycle === "monthly" ? "mo" : "yr"}`}
                        </p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          ${annualCost.toLocaleString()}/yr
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

// Stat Card Component
function StatCard({ label, value, icon, color, href }: { label: string; value: string | number; icon: React.ReactNode; color: string; href: string }) {
  return (
    <Link href={href}>
      <div 
        className="p-4 rounded-xl cursor-pointer hover:border-[var(--accent)] transition-all duration-200"
        style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{label}</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
      </div>
    </Link>
  );
}
