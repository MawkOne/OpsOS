"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Receipt,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Settings,
  Trash2,
  DollarSign,
  FileText,
  Users,
} from "lucide-react";

export default function QuickBooksPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate OAuth flow - will be replaced with real QuickBooks OAuth
    setTimeout(() => {
      setIsConnecting(false);
      // In reality, this would redirect to QuickBooks OAuth
      alert("QuickBooks OAuth integration coming soon! This will redirect you to QuickBooks to authorize the connection.");
    }, 1500);
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect QuickBooks? This will stop syncing your financial data.")) {
      setIsConnected(false);
    }
  };

  return (
    <AppLayout title="QuickBooks" subtitle="Connect and sync your QuickBooks data">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: "#2CA01C20", color: "#2CA01C" }}
              >
                <Receipt className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    QuickBooks Online
                  </h2>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                      <AlertCircle className="w-3 h-3" />
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {isConnected 
                    ? "Your QuickBooks account is connected. Data syncs automatically every hour."
                    : "Connect your QuickBooks account to import invoices, payments, and financial reports."
                  }
                </p>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200"
                    style={{ 
                      background: "var(--background-tertiary)", 
                      color: "var(--foreground-muted)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200"
                    style={{ 
                      background: "var(--background-tertiary)", 
                      color: "var(--error)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                  style={{ background: "#2CA01C", color: "white" }}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Connect QuickBooks
                    </>
                  )}
                </button>
              )}
            </div>
          </Card>
        </motion.div>

        {/* What We Import */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            What We Import
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#10b98120", color: "#10b981" }}
                >
                  <DollarSign className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Revenue Data</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Invoices, payments received, and income by category
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#3b82f620", color: "#3b82f6" }}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Financial Reports</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Profit & Loss, Balance Sheet, and Cash Flow statements
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#8b5cf620", color: "#8b5cf6" }}
                >
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="font-medium" style={{ color: "var(--foreground)" }}>Customer Data</h4>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Customer list, payment history, and outstanding balances
              </p>
            </Card>
          </div>
        </motion.div>

        {/* Setup Instructions */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                How to Connect
              </h3>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    1
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Click &quot;Connect QuickBooks&quot;</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      You&apos;ll be redirected to QuickBooks to authorize the connection
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    2
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Sign in to QuickBooks</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Use your QuickBooks Online credentials to log in
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    3
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Authorize Access</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Grant OpsOS permission to read your financial data
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    4
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Data Syncs Automatically</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                      Your data will sync every hour. You can also trigger manual syncs.
                    </p>
                  </div>
                </li>
              </ol>
            </Card>
          </motion.div>
        )}

        {/* Settings (when connected) */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Sync Settings
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Auto-sync frequency</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>How often to pull new data</p>
                  </div>
                  <select 
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background-tertiary)", 
                      border: "1px solid var(--border)",
                      color: "var(--foreground)" 
                    }}
                  >
                    <option value="1h">Every hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="24h">Daily</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>Historical data</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>How far back to import data</p>
                  </div>
                  <select 
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{ 
                      background: "var(--background-tertiary)", 
                      border: "1px solid var(--border)",
                      color: "var(--foreground)" 
                    }}
                  >
                    <option value="12m">Last 12 months</option>
                    <option value="24m">Last 24 months</option>
                    <option value="all">All available data</option>
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

