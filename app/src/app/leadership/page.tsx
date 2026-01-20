"use client";

import { useState, useEffect, useMemo } from "react";
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
  Target,
  Zap,
  AlertCircle,
} from "lucide-react";
import { Person, Tool } from "@/types/resources";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchMasterTableEntities } from "@/lib/masterTableData";

export default function LeadershipDashboard() {
  const { currentOrg } = useOrganization();
  const [people, setPeople] = useState<Person[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load People & Tools from Firestore
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

  // Load Revenue data from Master Table
  useEffect(() => {
    if (!currentOrg?.id) return;

    const loadRevenueData = async () => {
      try {
        console.log("📊 Loading revenue data for leadership dashboard...");
        const allEntities = await fetchMasterTableEntities(currentOrg.id);
        console.log(`  → Loaded ${allEntities.length} total entities`);
        
        // Filter for revenue entities
        const revenueEntities = allEntities.filter(e => e.metricType === "revenue");
        console.log(`  → Filtered to ${revenueEntities.length} revenue entities`);
        
        if (revenueEntities.length > 0) {
          console.log(`  → Sample revenue entity:`, {
            name: revenueEntities[0].entityName,
            source: revenueEntities[0].source,
            total: revenueEntities[0].total,
            monthsCount: Object.keys(revenueEntities[0].months || {}).length
          });
        }
        
        setRevenueData(revenueEntities);
      } catch (error) {
        console.error("Error loading revenue data:", error);
      }
    };

    loadRevenueData();
  }, [currentOrg?.id]);

  // Calculate cost metrics
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

  // Calculate revenue metrics from last 12 months
  const revenueMetrics = useMemo(() => {
    if (revenueData.length === 0) {
      return {
        lastMonthRevenue: 0,
        last12MonthsRevenue: 0,
        avgMonthlyRevenue: 0,
        growthRate: 0,
        runway: 0
      };
    }

    // Get all months data
    const allMonthsData: Record<string, number> = {};
    revenueData.forEach(entity => {
      Object.entries(entity.months || {}).forEach(([monthKey, value]) => {
        allMonthsData[monthKey] = (allMonthsData[monthKey] || 0) + (value as number);
      });
    });

    // Get last 12 months
    const sortedMonths = Object.keys(allMonthsData).sort().slice(-12);
    const last12Values = sortedMonths.map(key => allMonthsData[key]);
    
    const lastMonthRevenue = last12Values[last12Values.length - 1] || 0;
    const last12MonthsRevenue = last12Values.reduce((sum, val) => sum + val, 0);
    const avgMonthlyRevenue = last12MonthsRevenue / Math.max(last12Values.length, 1);

    // Calculate growth rate (first month vs last month)
    const firstMonth = last12Values[0] || 0;
    const lastMonth = lastMonthRevenue;
    const growthRate = firstMonth > 0 ? ((lastMonth - firstMonth) / firstMonth) * 100 : 0;

    // Calculate runway (months of cash at current burn vs revenue)
    const monthlyBurn = totalBurn / 12;
    const netBurn = monthlyBurn - lastMonthRevenue;
    const runway = netBurn > 0 ? 0 : Infinity; // Profitable = infinite runway

    return {
      lastMonthRevenue,
      last12MonthsRevenue,
      avgMonthlyRevenue,
      growthRate,
      runway,
      monthlyBurn
    };
  }, [revenueData, totalBurn]);

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

  // Calculate key ratios
  const revenuePerEmployee = people.length > 0 ? revenueMetrics.last12MonthsRevenue / people.length : 0;
  const burnMultiple = revenueMetrics.lastMonthRevenue > 0 ? (totalBurn / 12) / revenueMetrics.lastMonthRevenue : 0;
  const profitMargin = revenueMetrics.lastMonthRevenue > 0 ? 
    ((revenueMetrics.lastMonthRevenue - (totalBurn / 12)) / revenueMetrics.lastMonthRevenue) * 100 : 0;

  return (
    <AppLayout title="Leadership" subtitle="Executive overview and company health">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <MetricCard
              label="Last Month Revenue"
              value={`$${(revenueMetrics.lastMonthRevenue / 1000).toFixed(1)}k`}
              icon={<DollarSign className="w-5 h-5" />}
              color="#00d4aa"
              change={revenueMetrics.growthRate > 0 ? `+${revenueMetrics.growthRate.toFixed(0)}%` : undefined}
              changeType={revenueMetrics.growthRate > 0 ? "positive" : "negative"}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <MetricCard
              label="Monthly Burn Rate"
              value={`$${((totalBurn / 12) / 1000).toFixed(1)}k`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="#3b82f6"
              subtitle="expenses/mo"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MetricCard
              label="Profit Margin"
              value={`${profitMargin.toFixed(0)}%`}
              icon={<Target className="w-5 h-5" />}
              color={profitMargin > 0 ? "#00d4aa" : "#ef4444"}
              changeType={profitMargin > 0 ? "positive" : "negative"}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <MetricCard
              label="Total Headcount"
              value={people.length}
              icon={<Users className="w-5 h-5" />}
              color="#8b5cf6"
              subtitle="team members"
            />
          </motion.div>
        </div>

        {/* Financial Health Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Burn */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Revenue vs Burn
              </h3>
              <span className="text-xs px-2 py-1 rounded" 
                style={{ 
                  background: profitMargin > 0 ? "#00d4aa20" : "#ef444420",
                  color: profitMargin > 0 ? "#00d4aa" : "#ef4444"
                }}>
                {profitMargin > 0 ? "Profitable" : "Burning"}
              </span>
            </div>

            <div className="space-y-4">
              {/* Revenue */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Monthly Revenue</span>
                  <span className="font-semibold" style={{ color: "#00d4aa" }}>
                    ${(revenueMetrics.lastMonthRevenue / 1000).toFixed(1)}k
                  </span>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#00d4aa" }}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Burn */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Monthly Burn</span>
                  <span className="font-semibold" style={{ color: "#ef4444" }}>
                    ${((totalBurn / 12) / 1000).toFixed(1)}k
                  </span>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--background-tertiary)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#ef4444" }}
                    initial={{ width: 0 }}
                    animate={{ 
                      width: revenueMetrics.lastMonthRevenue > 0 ? 
                        `${Math.min(((totalBurn / 12) / revenueMetrics.lastMonthRevenue) * 100, 100)}%` : 
                        "100%" 
                    }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Net */}
              <div 
                className="p-3 rounded-lg mt-4"
                style={{ background: profitMargin > 0 ? "#00d4aa10" : "#ef444410" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Net Monthly</span>
                  <span className="text-lg font-bold" style={{ color: profitMargin > 0 ? "#00d4aa" : "#ef4444" }}>
                    ${((revenueMetrics.lastMonthRevenue - (totalBurn / 12)) / 1000).toFixed(1)}k
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Key Ratios */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Efficiency Metrics
              </h3>
              <Zap className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Revenue per Employee</span>
                  <span className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    ${(revenuePerEmployee / 1000).toFixed(0)}k
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Annual per person</p>
              </div>

              <div 
                className="h-px w-full"
                style={{ background: "var(--border)" }}
              />

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Burn Multiple</span>
                  <span className="text-xl font-bold" style={{ 
                    color: burnMultiple < 1 ? "#00d4aa" : burnMultiple < 2 ? "#f59e0b" : "#ef4444" 
                  }}>
                    {burnMultiple.toFixed(1)}x
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {burnMultiple < 1 ? "Profitable" : burnMultiple < 2 ? "Healthy" : "High burn"}
                </p>
              </div>

              <div 
                className="h-px w-full"
                style={{ background: "var(--border)" }}
              />

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Annual Run Rate</span>
                  <span className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    ${(revenueMetrics.last12MonthsRevenue / 1000).toFixed(0)}k
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>Last 12 months</p>
              </div>
            </div>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Expense Breakdown
              </h3>
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Annual</span>
            </div>

            <div className="space-y-4">
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
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Payroll</span>
                  </div>
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>
                    ${(totalSalary / 1000).toFixed(0)}k
                  </span>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
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
                  {totalBurn > 0 ? ((totalSalary / totalBurn) * 100).toFixed(0) : 0}% of expenses
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
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Tools</span>
                  </div>
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>
                    ${(totalToolsCost / 1000).toFixed(0)}k
                  </span>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
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
                  {totalBurn > 0 ? ((totalToolsCost / totalBurn) * 100).toFixed(0) : 0}% of expenses
                </p>
              </div>

              {/* Total */}
              <div 
                className="p-3 rounded-lg mt-4"
                style={{ background: "var(--background-tertiary)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Total Annual</span>
                  <span className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    ${(totalBurn / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Department Costs */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Cost by Department
            </h3>
            <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Annual Payroll</span>
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{dept}</span>
                      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        ${(cost / 1000).toFixed(0)}k ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div 
                      className="h-2.5 rounded-full overflow-hidden"
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

        {/* Bottom Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              {revenueMetrics.growthRate.toFixed(0)}%
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>12-mo Growth</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              ${people.length > 0 ? ((totalBurn / people.length) / 1000).toFixed(0) : 0}k
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Cost per Employee</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              {tools.length}
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Active Tools</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              {Object.keys(departmentCosts).length}
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Departments</p>
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
