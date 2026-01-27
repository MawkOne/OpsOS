"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  ChevronDown,
  BarChart3,
  Wallet,
  TrendingUp,
  Target,
  Zap,
  UserCircle,
  Calendar,
  Sparkles,
  Wrench,
  Crown,
  PieChart,
  LineChart,
  DollarSign,
  CreditCard,
  Receipt,
  Megaphone,
  Activity,
  Search,
  Mail,
  Settings,
  Link2,
  Building2,
  Check,
  Plus,
  Percent,
  Layers,
  Table,
  Network,
  Brain,
  Lightbulb,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

type Module = "ai" | "initiatives" | "planning" | "resources" | "sources" | "leadership" | "revenue" | "expenses" | "metrics" | "marketing";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const moduleConfig: Record<Module, { label: string; icon: React.ReactNode; color: string; href: string }> = {
  ai: { 
    label: "AI", 
    icon: <Brain className="w-4 h-4" />, 
    color: "#a855f7",
    href: "/ai",
  },
  leadership: { 
    label: "Leadership", 
    icon: <Crown className="w-4 h-4" />, 
    color: "#8b5cf6",
    href: "/leadership",
  },
  revenue: { 
    label: "Revenue", 
    icon: <DollarSign className="w-4 h-4" />, 
    color: "#10b981",
    href: "/revenue",
  },
  expenses: { 
    label: "Expenses", 
    icon: <Receipt className="w-4 h-4" />, 
    color: "#ef4444",
    href: "/expenses",
  },
  metrics: { 
    label: "Metrics", 
    icon: <Activity className="w-4 h-4" />, 
    color: "#06b6d4",
    href: "/metrics",
  },
  marketing: { 
    label: "Marketing", 
    icon: <Megaphone className="w-4 h-4" />, 
    color: "#ec4899",
    href: "/marketing",
  },
  initiatives: { 
    label: "Initiatives", 
    icon: <Zap className="w-4 h-4" />, 
    color: "#00d4aa",
    href: "/initiatives",
  },
  planning: { 
    label: "Planning", 
    icon: <Target className="w-4 h-4" />, 
    color: "#3b82f6",
    href: "/planning",
  },
  resources: { 
    label: "Resources", 
    icon: <Users className="w-4 h-4" />, 
    color: "#f59e0b",
    href: "/resources",
  },
  sources: { 
    label: "Sources", 
    icon: <Zap className="w-4 h-4" />, 
    color: "#8b5cf6",
    href: "/sources",
  },
};

// Define the order for module selector dropdown
const moduleOrder: Module[] = ["ai", "leadership", "revenue", "expenses", "metrics", "marketing", "initiatives", "planning", "resources", "sources"];

// Create navigation function to make it dynamic
const getNavigationByModule = (oppCount: number): Record<Module, NavSection[]> => ({
  ai: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/ai", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "All Detectors", href: "/ai/detectors", icon: <Brain className="w-4 h-4" />, badge: "42" },
        { label: "All Opportunities", href: "/ai/opportunities", icon: <Target className="w-4 h-4" />, badge: oppCount > 0 ? String(oppCount) : undefined },
      ],
    },
    {
      title: "📧 Email (8 detectors)",
      items: [
        { label: "Email Overview", href: "/ai/email", icon: <Mail className="w-4 h-4" /> },
        { label: "Engagement & Volume", href: "/ai/email/engagement", icon: <Activity className="w-4 h-4" /> },
        { label: "Revenue Attribution", href: "/ai/email/revenue", icon: <DollarSign className="w-4 h-4" /> },
      ],
    },
    {
      title: "🔍 SEO (8 detectors)",
      items: [
        { label: "SEO Overview", href: "/ai/seo", icon: <Search className="w-4 h-4" /> },
        { label: "Rankings & Keywords", href: "/ai/seo/rankings", icon: <TrendingUp className="w-4 h-4" /> },
        { label: "Technical Health", href: "/ai/seo/technical", icon: <Wrench className="w-4 h-4" /> },
      ],
    },
    {
      title: "💰 Advertising (6 detectors)",
      items: [
        { label: "Ads Overview", href: "/ai/advertising", icon: <Megaphone className="w-4 h-4" /> },
        { label: "Campaign Performance", href: "/ai/advertising/campaigns", icon: <BarChart3 className="w-4 h-4" /> },
        { label: "Budget & Efficiency", href: "/ai/advertising/efficiency", icon: <DollarSign className="w-4 h-4" /> },
      ],
    },
    {
      title: "📄 Pages (10 detectors)",
      items: [
        { label: "Pages Overview", href: "/ai/pages", icon: <Layers className="w-4 h-4" /> },
        { label: "Conversion Optimization", href: "/ai/pages/conversion", icon: <Target className="w-4 h-4" /> },
        { label: "Mobile vs Desktop", href: "/ai/pages/devices", icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      title: "✍️ Content (4 detectors)",
      items: [
        { label: "Content Overview", href: "/ai/content", icon: <Lightbulb className="w-4 h-4" /> },
        { label: "Publishing & Performance", href: "/ai/content/publishing", icon: <TrendingUp className="w-4 h-4" /> },
      ],
    },
    {
      title: "🚦 Traffic (7 detectors)",
      items: [
        { label: "Traffic Overview", href: "/ai/traffic", icon: <Network className="w-4 h-4" /> },
        { label: "Source Analysis", href: "/ai/traffic/sources", icon: <Link2 className="w-4 h-4" /> },
        { label: "Channel Mix & CAC", href: "/ai/traffic/channels", icon: <PieChart className="w-4 h-4" /> },
      ],
    },
    {
      title: "💵 Revenue (8 detectors)",
      items: [
        { label: "Revenue Overview", href: "/ai/revenue", icon: <DollarSign className="w-4 h-4" /> },
        { label: "Anomalies & Forecasts", href: "/ai/revenue/forecasts", icon: <LineChart className="w-4 h-4" /> },
        { label: "Unit Economics", href: "/ai/revenue/economics", icon: <Percent className="w-4 h-4" /> },
      ],
    },
  ],
  initiatives: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/initiatives", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "All Initiatives", href: "/initiatives/all", icon: <Zap className="w-4 h-4" /> },
        { label: "My Initiatives", href: "/initiatives/mine", icon: <UserCircle className="w-4 h-4" /> },
      ],
    },
    {
      title: "Management",
      items: [
        { label: "Create New", href: "/initiatives/new", icon: <Target className="w-4 h-4" /> },
        { label: "Timeline", href: "/initiatives/timeline", icon: <Calendar className="w-4 h-4" /> },
        { label: "Dependencies", href: "/initiatives/dependencies", icon: <BarChart3 className="w-4 h-4" /> },
      ],
    },
  ],
  planning: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/planning", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Priorities", href: "/planning/priorities", icon: <Target className="w-4 h-4" /> },
        { label: "Initiatives", href: "/planning/initiatives", icon: <Zap className="w-4 h-4" /> },
        { label: "Forecasts", href: "/planning/forecasts", icon: <TrendingUp className="w-4 h-4" /> },
      ],
    },
    {
      title: "Forecasting",
      items: [
        { label: "Build Forecast", href: "/planning/forecast", icon: <TrendingUp className="w-4 h-4" />, badge: "Core" },
        { label: "Scenarios", href: "/planning/scenarios", icon: <BarChart3 className="w-4 h-4" /> },
        { label: "Monte Carlo", href: "/planning/monte-carlo", icon: <Sparkles className="w-4 h-4" /> },
        { label: "Causation Analysis", href: "/planning/causation", icon: <Network className="w-4 h-4" />, badge: "New" },
      ],
    },
  ],
  resources: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/resources", icon: <LayoutDashboard className="w-4 h-4" /> },
      ],
    },
    {
      title: "Manage",
      items: [
        { label: "People", href: "/resources/people", icon: <Users className="w-4 h-4" /> },
        { label: "Tools", href: "/resources/tools", icon: <Wrench className="w-4 h-4" /> },
      ],
    },
  ],
  sources: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/sources", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Master Table", href: "/sources/master-table", icon: <Table className="w-4 h-4" /> },
        { label: "Entity Mapping", href: "/sources/entity-map", icon: <Link2 className="w-4 h-4" /> },
      ],
    },
    {
      title: "Financial",
      items: [
        { label: "Stripe", href: "/sources/stripe", icon: <CreditCard className="w-4 h-4" /> },
        { label: "QuickBooks", href: "/sources/quickbooks", icon: <Receipt className="w-4 h-4" /> },
      ],
    },
    {
      title: "Marketing",
      items: [
        { label: "Google Analytics", href: "/sources/google-analytics", icon: <Activity className="w-4 h-4" /> },
        { label: "Google Ads", href: "/sources/google-ads", icon: <Megaphone className="w-4 h-4" /> },
        { label: "ActiveCampaign", href: "/sources/activecampaign", icon: <Mail className="w-4 h-4" /> },
        { label: "DataForSEO", href: "/sources/dataforseo", icon: <Search className="w-4 h-4" /> },
      ],
    },
  ],
  leadership: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/leadership", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Company Health", href: "/leadership/health", icon: <PieChart className="w-4 h-4" /> },
        { label: "Metrics", href: "/leadership/metrics", icon: <LineChart className="w-4 h-4" /> },
      ],
    },
    {
      title: "Reports",
      items: [
        { label: "Financials", href: "/leadership/financials", icon: <Wallet className="w-4 h-4" /> },
        { label: "Team Overview", href: "/leadership/team", icon: <Users className="w-4 h-4" /> },
        { label: "Forecasts", href: "/leadership/forecasts", icon: <TrendingUp className="w-4 h-4" /> },
      ],
    },
  ],
  revenue: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/revenue", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Streams", href: "/revenue/streams", icon: <Layers className="w-4 h-4" /> },
        { label: "Sales", href: "/revenue/sales", icon: <TrendingUp className="w-4 h-4" /> },
        { label: "Analytics", href: "/revenue/analytics", icon: <LineChart className="w-4 h-4" /> },
      ],
    },
  ],
  expenses: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/expenses", icon: <LayoutDashboard className="w-4 h-4" /> },
      ],
    },
  ],
  metrics: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/metrics", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "All Metrics", href: "/metrics/all", icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      title: "Categories",
      items: [
        { label: "Conversion", href: "/metrics/conversion", icon: <Percent className="w-4 h-4" /> },
        { label: "Revenue", href: "/metrics/revenue", icon: <DollarSign className="w-4 h-4" /> },
        { label: "Customer", href: "/metrics/customer", icon: <Users className="w-4 h-4" /> },
        { label: "Marketing", href: "/metrics/marketing", icon: <Megaphone className="w-4 h-4" /> },
      ],
    },
  ],
  marketing: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/marketing", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Metrics", href: "/marketing/metrics", icon: <BarChart3 className="w-4 h-4" /> },
        { label: "Traffic", href: "/marketing/traffic", icon: <TrendingUp className="w-4 h-4" /> },
        { label: "Email", href: "/marketing/email", icon: <Mail className="w-4 h-4" /> },
        { label: "Advertising", href: "/marketing/ads", icon: <Megaphone className="w-4 h-4" /> },
        { label: "SEO", href: "/marketing/seo", icon: <Search className="w-4 h-4" /> },
      ],
    },
  ],
});

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { organizations, currentOrg, switchOrganization } = useOrganization();
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [opportunityCount, setOpportunityCount] = useState<number>(0);

  // Fetch opportunity count
  useEffect(() => {
    if (currentOrg?.id) {
      fetch(`/api/opportunities?organizationId=${currentOrg.id}&limit=1000`)
        .then(res => res.json())
        .then(data => {
          setOpportunityCount(data.opportunities?.length || 0);
        })
        .catch(err => console.error('Error fetching opportunity count:', err));
    }
  }, [currentOrg?.id]);

  // Determine current module from URL path
  const getCurrentModule = (): Module => {
    if (pathname.startsWith("/ai")) return "ai";
    if (pathname.startsWith("/planning")) return "planning";
    if (pathname.startsWith("/resources")) return "resources";
    if (pathname.startsWith("/sources")) return "sources";
    if (pathname.startsWith("/leadership")) return "leadership";
    if (pathname.startsWith("/revenue")) return "revenue";
    if (pathname.startsWith("/expenses")) return "expenses";
    if (pathname.startsWith("/metrics")) return "metrics";
    if (pathname.startsWith("/marketing")) return "marketing";
    return "initiatives"; // default
  };

  const [currentModule, setCurrentModule] = useState<Module>(getCurrentModule());

  // Sync module with URL changes
  const derivedModule = getCurrentModule();
  if (derivedModule !== currentModule && !moduleMenuOpen) {
    setCurrentModule(derivedModule);
  }

  const handleModuleSelect = (module: Module) => {
    setCurrentModule(module);
    setModuleMenuOpen(false);
    router.push(moduleConfig[module].href);
  };

  const handleSwitchOrg = async (orgId: string) => {
    await switchOrganization(orgId);
    setOrgMenuOpen(false);
    router.refresh();
  };

  const navigationByModule = getNavigationByModule(opportunityCount);
  const navigation = navigationByModule[currentModule];
  const currentModuleConfig = moduleConfig[currentModule];

  return (
    <aside className="w-64 h-screen flex flex-col" style={{ background: "var(--sidebar-bg)" }}>
      {/* Workspace/Organization Selector */}
      <div className="px-3 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="relative">
          <button
            onClick={() => setOrgMenuOpen(!orgMenuOpen)}
            className="w-full px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all duration-200 hover:bg-[var(--sidebar-hover)]"
            style={{ 
              background: orgMenuOpen ? "var(--sidebar-hover)" : "transparent",
            }}
          >
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)", color: "white" }}
            >
              {currentOrg?.name?.slice(0, 2).toUpperCase() || "OS"}
            </div>
            <div className="flex-1 text-left min-w-0">
              <h1 className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {currentOrg?.name || "OpsOS"}
              </h1>
              <p className="text-xs truncate" style={{ color: "var(--foreground-subtle)" }}>
                Workspace
              </p>
            </div>
            <ChevronDown 
              className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${orgMenuOpen ? 'rotate-180' : ''}`}
              style={{ color: "var(--foreground-muted)" }}
            />
          </button>

          <AnimatePresence>
            {orgMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-lg overflow-hidden z-50"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
                }}
              >
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                    Workspaces
                  </p>
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrg(org.id)}
                      className="w-full px-2 py-2 flex items-center gap-3 rounded-md transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                    >
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold"
                        style={{ background: "var(--accent)", color: "var(--background)" }}
                      >
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="flex-1 text-left text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {org.name}
                      </span>
                      {org.id === currentOrg?.id && (
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t" style={{ borderColor: "var(--border)" }}>
                  <Link
                    href="/settings/team"
                    onClick={() => setOrgMenuOpen(false)}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                  >
                    <Building2 className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Workspace Settings
                    </span>
                  </Link>
                  <Link
                    href="/onboarding"
                    onClick={() => setOrgMenuOpen(false)}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                  >
                    <Plus className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Create Workspace
                    </span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Module Switcher */}
      <div className="px-3 py-4">
        <div className="relative">
          <button
            onClick={() => setModuleMenuOpen(!moduleMenuOpen)}
            className="w-full px-3 py-2.5 rounded-lg flex items-center justify-between transition-all duration-200"
            style={{ 
              background: `${currentModuleConfig.color}15`,
              border: `1px solid ${currentModuleConfig.color}40`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${currentModuleConfig.color}25`, color: currentModuleConfig.color }}
              >
                {currentModuleConfig.icon}
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {currentModuleConfig.label}
              </span>
            </div>
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-200 ${moduleMenuOpen ? 'rotate-180' : ''}`}
              style={{ color: currentModuleConfig.color }}
            />
          </button>

          <AnimatePresence>
            {moduleMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-lg overflow-hidden z-50"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
                }}
              >
                {moduleOrder.map((module) => {
                  const config = moduleConfig[module];
                  return (
                  <button
                    key={module}
                    onClick={() => handleModuleSelect(module)}
                    className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                    style={{ 
                      background: currentModule === module ? `${config.color}15` : "transparent"
                    }}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${config.color}20`, color: config.color }}
                    >
                      {config.icon}
                    </div>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: currentModule === module ? "var(--foreground)" : "var(--foreground-muted)" }}
                    >
                      {config.label}
                    </span>
                  </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navigation.map((section, idx) => (
          <div key={section.title} className={idx > 0 ? "mt-6" : ""}>
            <h3 
              className="px-3 mb-2 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--foreground-subtle)" }}
            >
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150"
                      style={{
                        background: isActive ? "var(--sidebar-active)" : "transparent",
                        color: isActive ? "var(--accent)" : "var(--foreground-muted)",
                      }}
                    >
                      {item.icon}
                      <span className="text-sm">{item.label}</span>
                      {item.badge && (
                        <span 
                          className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ 
                            background: "var(--accent-muted)", 
                            color: "var(--accent)" 
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <Link
          href="/settings/team"
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
          style={{
            color: pathname.startsWith("/settings") ? "var(--accent)" : "var(--foreground-muted)",
            background: pathname.startsWith("/settings") ? "var(--sidebar-active)" : "transparent",
          }}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </Link>
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="px-3 py-2 rounded-lg" style={{ background: "var(--accent-muted)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              AI Ready
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            Your AI assistant is online
          </p>
        </div>
      </div>
    </aside>
  );
}

