"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Mail,
  Send,
  MousePointerClick,
  Eye,
  UserMinus,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Zap,
  Users,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, getCountFromServer } from "firebase/firestore";
import Link from "next/link";

interface CampaignData {
  id: string;
  name: string;
  type: string;
  status: number;
  sendAmt: number;
  opens: number;
  uniqueOpens: number;
  linkClicks: number;
  uniqueLinkClicks: number;
  unsubscribes: number;
  bounces: number;
  sentAt: Date | null;
  createdAt: Date | null;
}

interface MonthlyEmailData {
  month: string;
  sent: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  openRate: number;
  clickRate: number;
  campaigns: number;
}

interface ContactCount {
  date: string;
  count: number;
}

interface MonthlyContacts {
  counts: Record<string, number>; // "2026-01": 262000
}

type ViewMode = "ttm" | "year";
type MetricType = "sent" | "opens" | "clicks" | "openRate" | "clickRate" | "unsubscribes" | "campaigns";

const metricConfig: Record<MetricType, { label: string; format: (v: number) => string; color: string }> = {
  sent: { label: "Emails Sent", format: (v) => formatNumber(v), color: "#3b82f6" },
  opens: { label: "Opens", format: (v) => formatNumber(v), color: "#10b981" },
  clicks: { label: "Clicks", format: (v) => formatNumber(v), color: "#8b5cf6" },
  openRate: { label: "Open Rate", format: (v) => `${v.toFixed(1)}%`, color: "#f59e0b" },
  clickRate: { label: "Click Rate", format: (v) => `${v.toFixed(2)}%`, color: "#06b6d4" },
  unsubscribes: { label: "Unsubscribes", format: (v) => formatNumber(v), color: "#ef4444" },
  campaigns: { label: "Campaigns", format: (v) => formatNumber(v), color: "#ec4899" },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

export default function EmailPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyEmailData[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<CampaignData[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [contactHistory, setContactHistory] = useState<ContactCount[]>([]);
  const [monthlyContacts, setMonthlyContacts] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("sent");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const organizationId = currentOrg?.id || "";

  // Generate months based on view mode
  const { months, monthLabels } = useMemo(() => {
    if (viewMode === "ttm") {
      const now = new Date();
      const ttmMonths: string[] = [];
      const ttmLabels: string[] = [];
      
      for (let i = 12; i >= 1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        ttmMonths.push(monthKey);
        ttmLabels.push(label);
      }
      
      return { months: ttmMonths, monthLabels: ttmLabels };
    } else {
      const yearMonths = Array.from({ length: 12 }, (_, i) => {
        const month = (i + 1).toString().padStart(2, "0");
        return `${selectedYear}-${month}`;
      });
      const yearLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { months: yearMonths, monthLabels: yearLabels };
    }
  }, [viewMode, selectedYear]);

  // Check connection and fetch data
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Check if ActiveCampaign is connected
        const connectionRef = doc(db, "activecampaign_connections", organizationId);
        const connectionSnap = await getDoc(connectionRef);
        
        if (!connectionSnap.exists() || connectionSnap.data()?.status === "disconnected") {
          setIsConnected(false);
          setLoading(false);
          return;
        }
        
        setIsConnected(true);

        // Fetch contacts count
        const contactsQuery = query(
          collection(db, "activecampaign_contacts"),
          where("organizationId", "==", organizationId)
        );
        const contactsCount = await getCountFromServer(contactsQuery);
        setTotalContacts(contactsCount.data().count);

        // Fetch contact count history
        const contactHistoryQuery = query(
          collection(db, "activecampaign_contact_counts"),
          where("organizationId", "==", organizationId)
        );
        const contactHistorySnap = await getDocs(contactHistoryQuery);
        const history: ContactCount[] = [];
        contactHistorySnap.docs.forEach(doc => {
          const data = doc.data();
          history.push({
            date: data.date,
            count: data.count,
          });
        });
        // Sort by date
        history.sort((a, b) => a.date.localeCompare(b.date));
        setContactHistory(history);

        // If we have history, use the latest count
        if (history.length > 0) {
          setTotalContacts(history[history.length - 1].count);
        }

        // Fetch monthly contact counts
        const monthlyContactsRef = doc(db, "activecampaign_monthly_contacts", organizationId);
        const monthlyContactsSnap = await getDoc(monthlyContactsRef);
        if (monthlyContactsSnap.exists()) {
          const data = monthlyContactsSnap.data() as MonthlyContacts;
          setMonthlyContacts(data.counts || {});
          
          // Use the latest month's count as total if available
          const sortedMonths = Object.keys(data.counts || {}).sort().reverse();
          if (sortedMonths.length > 0) {
            setTotalContacts(data.counts[sortedMonths[0]]);
          }
        }

        // Fetch campaigns from Firestore
        const campaignsQuery = query(
          collection(db, "activecampaign_campaigns"),
          where("organizationId", "==", organizationId)
        );
        const campaignsSnap = await getDocs(campaignsQuery);
        
        const campaigns: CampaignData[] = [];
        const monthlyAggregates: Record<string, MonthlyEmailData> = {};

        // Initialize months
        months.forEach(month => {
          monthlyAggregates[month] = {
            month,
            sent: 0,
            opens: 0,
            clicks: 0,
            unsubscribes: 0,
            bounces: 0,
            openRate: 0,
            clickRate: 0,
            campaigns: 0,
          };
        });

        campaignsSnap.docs.forEach(doc => {
          const data = doc.data();
          const campaign: CampaignData = {
            id: doc.id,
            name: data.name || "Untitled Campaign",
            type: data.type || "single",
            status: data.status || 0,
            sendAmt: data.sendAmt || 0,
            opens: data.opens || 0,
            uniqueOpens: data.uniqueOpens || 0,
            linkClicks: data.linkClicks || 0,
            uniqueLinkClicks: data.uniqueLinkClicks || 0,
            unsubscribes: data.unsubscribes || 0,
            bounces: data.bounces || 0,
            sentAt: data.sentAt?.toDate?.() || null,
            createdAt: data.createdAt?.toDate?.() || null,
          };
          campaigns.push(campaign);

          // Aggregate by month
          const date = campaign.sentAt || campaign.createdAt;
          if (date) {
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
            if (monthlyAggregates[monthKey]) {
              monthlyAggregates[monthKey].sent += campaign.sendAmt;
              monthlyAggregates[monthKey].opens += campaign.opens;
              monthlyAggregates[monthKey].clicks += campaign.linkClicks;
              monthlyAggregates[monthKey].unsubscribes += campaign.unsubscribes;
              monthlyAggregates[monthKey].bounces += campaign.bounces;
              monthlyAggregates[monthKey].campaigns += 1;
            }
          }
        });

        // Calculate rates
        Object.values(monthlyAggregates).forEach(m => {
          m.openRate = m.sent > 0 ? (m.opens / m.sent) * 100 : 0;
          m.clickRate = m.sent > 0 ? (m.clicks / m.sent) * 100 : 0;
        });

        // Sort campaigns by sends (top performers)
        campaigns.sort((a, b) => b.sendAmt - a.sendAmt);
        setTopCampaigns(campaigns.slice(0, 20));

        // Convert to array
        setMonthlyData(months.map(m => monthlyAggregates[m]));

      } catch (err) {
        console.error("Error fetching email data:", err);
        setError("Failed to load email data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, months]);

  // Calculate totals
  const totals = useMemo(() => {
    return monthlyData.reduce((acc, m) => ({
      sent: acc.sent + m.sent,
      opens: acc.opens + m.opens,
      clicks: acc.clicks + m.clicks,
      unsubscribes: acc.unsubscribes + m.unsubscribes,
      bounces: acc.bounces + m.bounces,
      campaigns: acc.campaigns + m.campaigns,
    }), { sent: 0, opens: 0, clicks: 0, unsubscribes: 0, bounces: 0, campaigns: 0 });
  }, [monthlyData]);

  const overallOpenRate = totals.sent > 0 ? (totals.opens / totals.sent) * 100 : 0;
  const overallClickRate = totals.sent > 0 ? (totals.clicks / totals.sent) * 100 : 0;

  // Helper function to calculate CMGR (Compound Monthly Growth Rate)
  const calculateCMGR = (beginning: number, ending: number, numMonths: number): number => {
    if (beginning <= 0 || numMonths <= 0) return 0;
    return (Math.pow(ending / beginning, 1 / numMonths) - 1) * 100;
  };

  // Calculate contact CMGR from monthly data
  const contactCMGR = useMemo(() => {
    const sortedMonths = Object.keys(monthlyContacts).sort();
    if (sortedMonths.length < 2) return 0;
    
    const beginning = monthlyContacts[sortedMonths[0]] || 0;
    const ending = monthlyContacts[sortedMonths[sortedMonths.length - 1]] || totalContacts;
    const numMonths = sortedMonths.length - 1;
    
    return calculateCMGR(beginning, ending, numMonths);
  }, [monthlyContacts, totalContacts]);

  // Calculate CMGR for email metrics with tooltip data
  const metricCMGRs = useMemo(() => {
    const empty = { 
      sent: { value: 0, tooltip: "" },
      opens: { value: 0, tooltip: "" },
      clicks: { value: 0, tooltip: "" },
      openRate: { value: 0, tooltip: "" },
      clickRate: { value: 0, tooltip: "" },
    };
    
    if (monthlyData.length < 2) return empty;
    
    // Find first and last months with data
    const monthsWithData = monthlyData.filter(m => m.sent > 0);
    if (monthsWithData.length < 2) return empty;
    
    const first = monthsWithData[0];
    const last = monthsWithData[monthsWithData.length - 1];
    const numMonths = monthsWithData.length - 1;
    
    const buildTooltip = (name: string, start: number, end: number, months: number, isPercent = false) => {
      const cmgr = calculateCMGR(start, end, months);
      const fmt = isPercent ? (v: number) => `${v.toFixed(1)}%` : formatNumber;
      return `${name} CMGR\n((${fmt(end)} / ${fmt(start)}) ^ (1/${months})) - 1\n= ${cmgr > 0 ? "+" : ""}${cmgr.toFixed(2)}% per month`;
    };
    
    return {
      sent: { 
        value: calculateCMGR(first.sent, last.sent, numMonths),
        tooltip: buildTooltip("Emails Sent", first.sent, last.sent, numMonths),
      },
      opens: { 
        value: calculateCMGR(first.opens, last.opens, numMonths),
        tooltip: buildTooltip("Opens", first.opens, last.opens, numMonths),
      },
      clicks: { 
        value: calculateCMGR(first.clicks, last.clicks, numMonths),
        tooltip: buildTooltip("Clicks", first.clicks, last.clicks, numMonths),
      },
      openRate: { 
        value: calculateCMGR(first.openRate, last.openRate, numMonths),
        tooltip: buildTooltip("Open Rate", first.openRate, last.openRate, numMonths, true),
      },
      clickRate: { 
        value: calculateCMGR(first.clickRate, last.clickRate, numMonths),
        tooltip: buildTooltip("Click Rate", first.clickRate, last.clickRate, numMonths, true),
      },
    };
  }, [monthlyData]);
  
  // Build contact CMGR tooltip
  const contactCMGRTooltip = useMemo(() => {
    const sortedMonths = Object.keys(monthlyContacts).sort();
    if (sortedMonths.length < 2) return "";
    
    const beginning = monthlyContacts[sortedMonths[0]] || 0;
    const ending = monthlyContacts[sortedMonths[sortedMonths.length - 1]] || totalContacts;
    const numMonths = sortedMonths.length - 1;
    const cmgr = calculateCMGR(beginning, ending, numMonths);
    
    return `Contacts CMGR\n((${formatNumber(ending)} / ${formatNumber(beginning)}) ^ (1/${numMonths})) - 1\n= ${cmgr > 0 ? "+" : ""}${cmgr.toFixed(2)}% per month`;
  }, [monthlyContacts, totalContacts]);

  if (loading) {
    return (
      <AppLayout title="Email Marketing" subtitle="Campaign performance and engagement analytics">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  if (!isConnected) {
    return (
      <AppLayout title="Email Marketing" subtitle="Campaign performance and engagement analytics">
        <Card className="max-w-xl mx-auto text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            Connect ActiveCampaign
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
            Connect your ActiveCampaign account to see email marketing analytics.
          </p>
          <Link
            href="/marketing/activecampaign"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "#356AE6", color: "white" }}
          >
            <Mail className="w-4 h-4" />
            Connect ActiveCampaign
          </Link>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Email Marketing" subtitle="Campaign performance and engagement analytics">
      <div className="max-w-full mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Contacts</span>
              <Users className="w-4 h-4" style={{ color: "#356AE6" }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: "#356AE6" }}>
                {formatNumber(totalContacts)}
              </p>
              {contactCMGR !== 0 && (
                <p 
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-help" 
                  style={{ 
                    color: contactCMGR > 0 ? "#10b981" : "#ef4444",
                    background: contactCMGR > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }}
                  title={contactCMGRTooltip}
                >
                  {contactCMGR > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {contactCMGR > 0 ? "+" : ""}{contactCMGR.toFixed(1)}%
                </p>
              )}
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Emails Sent</span>
              <Send className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
                {formatNumber(totals.sent)}
              </p>
              {metricCMGRs.sent.value !== 0 && (
                <p 
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-help" 
                  style={{ 
                    color: metricCMGRs.sent.value > 0 ? "#10b981" : "#ef4444",
                    background: metricCMGRs.sent.value > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }}
                  title={metricCMGRs.sent.tooltip}
                >
                  {metricCMGRs.sent.value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {metricCMGRs.sent.value > 0 ? "+" : ""}{metricCMGRs.sent.value.toFixed(1)}%
                </p>
              )}
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Opens</span>
              <Eye className="w-4 h-4" style={{ color: "#10b981" }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
                {formatNumber(totals.opens)}
              </p>
              {metricCMGRs.opens.value !== 0 && (
                <p 
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-help" 
                  style={{ 
                    color: metricCMGRs.opens.value > 0 ? "#10b981" : "#ef4444",
                    background: metricCMGRs.opens.value > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }}
                  title={metricCMGRs.opens.tooltip}
                >
                  {metricCMGRs.opens.value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {metricCMGRs.opens.value > 0 ? "+" : ""}{metricCMGRs.opens.value.toFixed(1)}%
                </p>
              )}
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Clicks</span>
              <MousePointerClick className="w-4 h-4" style={{ color: "#8b5cf6" }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                {formatNumber(totals.clicks)}
              </p>
              {metricCMGRs.clicks.value !== 0 && (
                <p 
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-help" 
                  style={{ 
                    color: metricCMGRs.clicks.value > 0 ? "#10b981" : "#ef4444",
                    background: metricCMGRs.clicks.value > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }}
                  title={metricCMGRs.clicks.tooltip}
                >
                  {metricCMGRs.clicks.value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {metricCMGRs.clicks.value > 0 ? "+" : ""}{metricCMGRs.clicks.value.toFixed(1)}%
                </p>
              )}
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Open Rate</span>
              <TrendingUp className="w-4 h-4" style={{ color: "#f59e0b" }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                {overallOpenRate.toFixed(1)}%
              </p>
              {metricCMGRs.openRate.value !== 0 && (
                <p 
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-help" 
                  style={{ 
                    color: metricCMGRs.openRate.value > 0 ? "#10b981" : "#ef4444",
                    background: metricCMGRs.openRate.value > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }}
                  title={metricCMGRs.openRate.tooltip}
                >
                  {metricCMGRs.openRate.value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {metricCMGRs.openRate.value > 0 ? "+" : ""}{metricCMGRs.openRate.value.toFixed(1)}%
                </p>
              )}
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Click Rate</span>
              <MousePointerClick className="w-4 h-4" style={{ color: "#06b6d4" }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: "#06b6d4" }}>
                {overallClickRate.toFixed(2)}%
              </p>
              {metricCMGRs.clickRate.value !== 0 && (
                <p 
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-help" 
                  style={{ 
                    color: metricCMGRs.clickRate.value > 0 ? "#10b981" : "#ef4444",
                    background: metricCMGRs.clickRate.value > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }}
                  title={metricCMGRs.clickRate.tooltip}
                >
                  {metricCMGRs.clickRate.value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {metricCMGRs.clickRate.value > 0 ? "+" : ""}{metricCMGRs.clickRate.value.toFixed(1)}%
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Filters & Controls */}
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--background-tertiary)" }}>
                <button
                  onClick={() => setViewMode("ttm")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: viewMode === "ttm" ? "var(--accent)" : "transparent",
                    color: viewMode === "ttm" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  TTM
                </button>
                <button
                  onClick={() => setViewMode("year")}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: viewMode === "year" ? "var(--accent)" : "transparent",
                    color: viewMode === "year" ? "var(--background)" : "var(--foreground-muted)",
                  }}
                >
                  Year
                </button>
              </div>

              {/* Year Selector */}
              {viewMode === "year" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--background-tertiary)]"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold min-w-[60px] text-center" style={{ color: "var(--foreground)" }}>
                    {selectedYear}
                  </span>
                  <button
                    onClick={() => setSelectedYear(y => y + 1)}
                    disabled={selectedYear >= new Date().getFullYear()}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--background-tertiary)] disabled:opacity-30"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Metric Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {Object.entries(metricConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export Button */}
            <button
              className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
              style={{
                background: "var(--background-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--foreground-muted)",
              }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </Card>

        {/* Monthly Trends Table - Months as columns */}
        <Card className="overflow-hidden">
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Monthly Email Performance
          </h3>
          {monthlyData.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                No email data for this period
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold sticky left-0 min-w-[120px]"
                      style={{ color: "var(--foreground)", background: "var(--background-secondary)" }}
                    >
                      Metric
                    </th>
                    {monthLabels.map((label, idx) => (
                      <th 
                        key={label}
                        className="text-right py-3 px-3 text-sm font-semibold min-w-[80px]"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        {label}
                      </th>
                    ))}
                    <th 
                      className="text-right py-3 px-4 text-sm font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Contacts Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.01 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" style={{ color: "#356AE6" }} />
                        Total Contacts
                      </div>
                    </td>
                    {months.map((month) => {
                      const count = monthlyContacts[month] || 0;
                      return (
                        <td key={month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "#356AE6" }}>
                          {count > 0 ? formatNumber(count) : "—"}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#356AE6" }}>
                      {formatNumber(totalContacts)}
                    </td>
                  </motion.tr>

                  {/* Campaigns Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" style={{ color: "#ec4899" }} />
                        Campaigns
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {row.campaigns > 0 ? formatNumber(row.campaigns) : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#ec4899" }}>
                      {formatNumber(totals.campaigns)}
                    </td>
                  </motion.tr>

                  {/* Sent Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4" style={{ color: "#3b82f6" }} />
                        Emails Sent
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "var(--foreground)" }}>
                        {row.sent > 0 ? formatNumber(row.sent) : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#3b82f6" }}>
                      {formatNumber(totals.sent)}
                    </td>
                  </motion.tr>

                  {/* Opens Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" style={{ color: "#10b981" }} />
                        Opens
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "#10b981" }}>
                        {row.opens > 0 ? formatNumber(row.opens) : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#10b981" }}>
                      {formatNumber(totals.opens)}
                    </td>
                  </motion.tr>

                  {/* Clicks Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                        Clicks
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "#8b5cf6" }}>
                        {row.clicks > 0 ? formatNumber(row.clicks) : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#8b5cf6" }}>
                      {formatNumber(totals.clicks)}
                    </td>
                  </motion.tr>

                  {/* Open Rate Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.10 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" style={{ color: "#f59e0b" }} />
                        Open Rate
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "#f59e0b" }}>
                        {row.sent > 0 ? `${row.openRate.toFixed(1)}%` : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#f59e0b" }}>
                      {overallOpenRate.toFixed(1)}%
                    </td>
                  </motion.tr>

                  {/* Click Rate Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="w-4 h-4" style={{ color: "#06b6d4" }} />
                        Click Rate
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "#06b6d4" }}>
                        {row.sent > 0 ? `${row.clickRate.toFixed(2)}%` : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#06b6d4" }}>
                      {overallClickRate.toFixed(2)}%
                    </td>
                  </motion.tr>

                  {/* Unsubscribes Row */}
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--background-tertiary)] transition-colors"
                  >
                    <td 
                      className="py-3 px-4 text-sm font-medium sticky left-0"
                      style={{ color: "var(--foreground)", background: "inherit" }}
                    >
                      <div className="flex items-center gap-2">
                        <UserMinus className="w-4 h-4" style={{ color: "#ef4444" }} />
                        Unsubscribes
                      </div>
                    </td>
                    {monthlyData.map((row) => (
                      <td key={row.month} className="py-3 px-3 text-sm text-right tabular-nums" style={{ color: "#ef4444" }}>
                        {row.unsubscribes > 0 ? formatNumber(row.unsubscribes) : "—"}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-sm text-right font-semibold tabular-nums" style={{ color: "#ef4444" }}>
                      {formatNumber(totals.unsubscribes)}
                    </td>
                  </motion.tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Top Campaigns */}
        <Card>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Top Campaigns by Volume
          </h3>
          {topCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--foreground-muted)" }} />
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No campaigns found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topCampaigns.slice(0, 10).map((campaign, idx) => {
                const openRate = campaign.sendAmt > 0 ? (campaign.opens / campaign.sendAmt) * 100 : 0;
                const clickRate = campaign.sendAmt > 0 ? (campaign.linkClicks / campaign.sendAmt) * 100 : 0;
                
                return (
                  <motion.div
                    key={campaign.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{ background: "var(--background-tertiary)" }}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: "var(--background-secondary)", color: "var(--foreground-muted)" }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {campaign.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {campaign.sentAt ? campaign.sentAt.toLocaleDateString() : "Not sent"}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="font-medium" style={{ color: "#3b82f6" }}>{formatNumber(campaign.sendAmt)}</p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>sent</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium" style={{ color: "#f59e0b" }}>{openRate.toFixed(1)}%</p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>opens</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium" style={{ color: "#06b6d4" }}>{clickRate.toFixed(2)}%</p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>clicks</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

