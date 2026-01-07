"use client";

import { useState } from "react";
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
} from "lucide-react";

type Module = "initiatives" | "planning" | "resources" | "leadership" | "revenue" | "marketing";

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
};

// Define the order for module selector dropdown
const moduleOrder: Module[] = ["leadership", "revenue", "marketing", "initiatives", "planning", "resources"];

const navigationByModule: Record<Module, NavSection[]> = {
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
        { label: "Roadmap", href: "/planning/roadmap", icon: <TrendingUp className="w-4 h-4" /> },
        { label: "Priorities", href: "/planning/priorities", icon: <Target className="w-4 h-4" /> },
      ],
    },
    {
      title: "Forecasting",
      items: [
        { label: "Build Forecast", href: "/planning/forecast", icon: <TrendingUp className="w-4 h-4" />, badge: "Core" },
        { label: "Scenarios", href: "/planning/scenarios", icon: <BarChart3 className="w-4 h-4" /> },
        { label: "Monte Carlo", href: "/planning/monte-carlo", icon: <Sparkles className="w-4 h-4" /> },
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
        { label: "Sales", href: "/revenue/sales", icon: <TrendingUp className="w-4 h-4" /> },
        { label: "Analytics", href: "/revenue/analytics", icon: <LineChart className="w-4 h-4" /> },
      ],
    },
    {
      title: "Sources",
      items: [
        { label: "QuickBooks", href: "/revenue/quickbooks", icon: <Receipt className="w-4 h-4" /> },
        { label: "Stripe", href: "/revenue/stripe", icon: <CreditCard className="w-4 h-4" /> },
      ],
    },
  ],
  marketing: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/marketing", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Traffic", href: "/marketing/traffic", icon: <TrendingUp className="w-4 h-4" /> },
        { label: "Advertising", href: "/marketing/ads", icon: <Megaphone className="w-4 h-4" /> },
        { label: "SEO", href: "/marketing/seo", icon: <Search className="w-4 h-4" /> },
      ],
    },
    {
      title: "Sources",
      items: [
        { label: "Google Analytics", href: "/marketing/google-analytics", icon: <Activity className="w-4 h-4" /> },
      ],
    },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);

  // Determine current module from URL path
  const getCurrentModule = (): Module => {
    if (pathname.startsWith("/planning")) return "planning";
    if (pathname.startsWith("/resources")) return "resources";
    if (pathname.startsWith("/leadership")) return "leadership";
    if (pathname.startsWith("/revenue")) return "revenue";
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

  const navigation = navigationByModule[currentModule];
  const currentModuleConfig = moduleConfig[currentModule];

  return (
    <aside className="w-64 h-screen flex flex-col" style={{ background: "var(--sidebar-bg)" }}>
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)" }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
              OpsOS
            </h1>
            <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
              Company OS
            </p>
          </div>
        </Link>
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

