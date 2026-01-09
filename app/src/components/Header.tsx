"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, MessageSquare, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
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

