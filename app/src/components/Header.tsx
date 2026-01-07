"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, MessageSquare, User, LogOut, ChevronDown, Building2, Check, Plus, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { organizations, currentOrg, switchOrganization } = useOrganization();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOrgMenu, setShowOrgMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleSwitchOrg = async (orgId: string) => {
    await switchOrganization(orgId);
    setShowOrgMenu(false);
    // Refresh the page to reload data for new org
    router.refresh();
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header 
      className="h-16 px-6 flex items-center justify-between border-b"
      style={{ 
        background: "var(--background)",
        borderColor: "var(--border)" 
      }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <button 
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{ 
            background: "var(--background-secondary)",
            border: "1px solid var(--border)"
          }}
        >
          <Search className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
        </button>

        {/* Messages */}
        <button 
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 relative"
          style={{ 
            background: "var(--background-secondary)",
            border: "1px solid var(--border)"
          }}
        >
          <MessageSquare className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          <span 
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            3
          </span>
        </button>

        {/* Notifications */}
        <button 
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 relative"
          style={{ 
            background: "var(--background-secondary)",
            border: "1px solid var(--border)"
          }}
        >
          <Bell className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          <span 
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center"
            style={{ background: "var(--error)", color: "white" }}
          >
            5
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 mx-2" style={{ background: "var(--border)" }} />

        {/* Organization Switcher */}
        {currentOrg && (
          <div className="relative">
            <button
              onClick={() => setShowOrgMenu(!showOrgMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150"
              style={{
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <Building2 className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium max-w-[120px] truncate" style={{ color: "var(--foreground)" }}>
                {currentOrg.name}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${showOrgMenu ? "rotate-180" : ""}`}
                style={{ color: "var(--foreground-muted)" }}
              />
            </button>

            <AnimatePresence>
              {showOrgMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 w-64 rounded-lg overflow-hidden z-50"
                  style={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                  }}
                >
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Organizations
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
                        {org.id === currentOrg.id && (
                          <Check className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    <Link
                      href="/settings/organization"
                      onClick={() => setShowOrgMenu(false)}
                      className="w-full px-4 py-3 flex items-center gap-3 transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                    >
                      <Settings className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Organization Settings
                      </span>
                    </Link>
                    <Link
                      href="/onboarding"
                      onClick={() => setShowOrgMenu(false)}
                      className="w-full px-4 py-3 flex items-center gap-3 transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                    >
                      <Plus className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        Create Organization
                      </span>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* User Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-150"
            style={{ 
              background: "var(--background-secondary)",
              border: "1px solid var(--border)"
            }}
          >
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)", color: "white" }}
              >
                {initials}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {displayName}
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {user?.email || "Not signed in"}
              </p>
            </div>
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
              style={{ color: "var(--foreground-muted)" }}
            />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-48 rounded-lg overflow-hidden z-50"
                style={{ 
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
                }}
              >
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left transition-all duration-150 hover:bg-[var(--sidebar-hover)]"
                  style={{ color: "var(--error)" }}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

