"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Crown,
  Users,
  DollarSign,
  TrendingUp,
  Wrench,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Person, Tool } from "@/types/resources";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function LeadershipDashboard() {
  const { currentOrg } = useOrganization();
  const [people, setPeople] = useState<Person[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (t.billingCycle === "one_time") return sum;
    if (t.billingCycle === "annual") return sum + t.cost;
    return sum + (t.cost * 12);
  }, 0);

  const totalBurn = totalSalary + totalToolsCost;

  // Department breakdown
  const departmentCosts = people.reduce((acc, p) => {
    const annualSalary = p.salaryType === "annual" 
      ? p.salary 
      : p.salaryType === "monthly" 
        ? p.salary * 12 
        : p.salary * p.hoursPerWeek * 52;
    acc[p.department] = (acc[p.department] || 0) + annualSalary;
    return acc;
  }, {} as Record<string, number>);

  const sortedDepartments = Object.entries(departmentCosts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <AppLayout title="Leadership" subtitle="Executive overview and company health">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <MetricCard
              label="Total Headcount"
              value={people.length}
              icon={<Users className="w-5 h-5" />}
              color="#00d4aa"
              change="+2"
              changeType="positive"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <MetricCard
              label="Monthly Burn Rate"
              value={`$${(totalBurn / 12 / 1000).toFixed(0)}k`}
              icon={<DollarSign className="w-5 h-5" />}
              color="#3b82f6"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MetricCard
              label="Annual Run Rate"
              value={`$${(totalBurn / 1000).toFixed(0)}k`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="#8b5cf6"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <MetricCard
              label="Cost per Employee"
              value={people.length > 0 ? `$${((totalBurn / people.length) / 1000).toFixed(0)}k` : "$0k"}
              icon={<PieChart className="w-5 h-5" />}
              color="#f59e0b"
              subtitle="annual avg"
            />
          </motion.div>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Costs */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Cost by Department
              </h3>
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Annual</span>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : sortedDepartments.length === 0 ? (
              <div className="text-center py-8">
                <PieChart className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} />
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No department data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDepartments.map(([dept, cost], idx) => {
                  const percentage = totalSalary > 0 ? (cost / totalSalary) * 100 : 0;
                  const colors = ["#00d4aa", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <motion.div
                      key={dept}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{dept}</span>
                        <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                          ${(cost / 1000).toFixed(0)}k ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div 
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--background-tertiary)" }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Expense Split */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Expense Breakdown
              </h3>
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Annual</span>
            </div>

            <div className="space-y-6">
              {/* Payroll */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "#3b82f620", color: "#3b82f6" }}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>Payroll</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    ${(totalSalary / 1000).toFixed(0)}k
                  </span>
                </div>
                <div 
                  className="h-3 rounded-full overflow-hidden"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#3b82f6" }}
                    initial={{ width: 0 }}
                    animate={{ width: totalBurn > 0 ? `${(totalSalary / totalBurn) * 100}%` : "0%" }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {totalBurn > 0 ? ((totalSalary / totalBurn) * 100).toFixed(1) : 0}% of total expenses
                </p>
              </div>

              {/* Tools */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                    >
                      <Wrench className="w-4 h-4" />
                    </div>
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>Tools & Software</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    ${(totalToolsCost / 1000).toFixed(0)}k
                  </span>
                </div>
                <div 
                  className="h-3 rounded-full overflow-hidden"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#8b5cf6" }}
                    initial={{ width: 0 }}
                    animate={{ width: totalBurn > 0 ? `${(totalToolsCost / totalBurn) * 100}%` : "0%" }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {totalBurn > 0 ? ((totalToolsCost / totalBurn) * 100).toFixed(1) : 0}% of total expenses
                </p>
              </div>

              {/* Total */}
              <div 
                className="p-4 rounded-xl mt-4"
                style={{ background: "var(--background-tertiary)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: "var(--foreground-muted)" }}>Total Annual Expenses</span>
                  <span className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    ${(totalBurn / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>{tools.length}</p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Tools</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              {people.length > 0 ? `$${((totalToolsCost / people.length) / 12).toFixed(0)}` : "$0"}
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Tools/Person/Month</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              {Object.keys(departmentCosts).length}
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Departments</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              ${people.length > 0 ? ((totalSalary / people.length) / 1000).toFixed(0) : 0}k
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg Salary</p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon, 
  color, 
  change, 
  changeType,
  subtitle 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode; 
  color: string;
  change?: string;
  changeType?: "positive" | "negative";
  subtitle?: string;
}) {
  return (
    <div 
      className="p-4 rounded-xl"
      style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
        {change && (
          <span 
            className="text-xs font-medium flex items-center gap-0.5 mb-1"
            style={{ color: changeType === "positive" ? "#00d4aa" : "#ef4444" }}
          >
            {changeType === "positive" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{subtitle}</p>
      )}
    </div>
  );
}
