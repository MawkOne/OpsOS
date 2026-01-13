"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle,
  Loader2,
  ArrowRight,
  Building2,
  BarChart3,
} from "lucide-react";

interface GAProperty {
  id: string;
  displayName: string;
  accountId: string;
  accountName: string;
}

interface GAAccount {
  id: string;
  displayName: string;
}

interface PendingConnection {
  organizationId: string;
  userEmail: string;
  userName: string;
  accounts: GAAccount[];
  properties: GAProperty[];
}

function SelectPropertyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = pendingConnection?.organizationId || "";

  useEffect(() => {
    // Get pending connection data from URL params
    const dataParam = searchParams.get("data");
    if (dataParam) {
      try {
        const data = JSON.parse(decodeURIComponent(dataParam));
        setPendingConnection(data);
      } catch (e) {
        setError("Failed to load connection data. Please try connecting again.");
      }
    } else {
      setError("No connection data found. Please try connecting again.");
    }
    setLoading(false);
  }, [searchParams]);

  const handleConnect = async () => {
    if (!selectedPropertyId) {
      setError("Please select a property");
      return;
    }
    
    if (!organizationId) {
      setError("Organization ID not found. Please try connecting again.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const selectedProperty = pendingConnection?.properties.find(p => p.id === selectedPropertyId);
      
      console.log("Finalizing connection:", { organizationId, selectedPropertyId });
      
      const response = await fetch("/api/google-analytics/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          selectedPropertyId,
          selectedPropertyName: selectedProperty?.displayName,
          selectedAccountName: selectedProperty?.accountName,
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || "Failed to connect");
      }

      console.log("Connection successful:", responseData);
      
      // Redirect to GA page with success
      window.location.href = "/sources/google-analytics?connected=true";
    } catch (err: any) {
      console.error("Connection error:", err);
      setError(err.message || "Failed to connect. Please try again.");
      setIsConnecting(false);
    }
  };

  // Group properties by account
  const propertiesByAccount = pendingConnection?.properties.reduce((acc, property) => {
    const accountName = property.accountName || "Unknown Account";
    if (!acc[accountName]) {
      acc[accountName] = [];
    }
    acc[accountName].push(property);
    return acc;
  }, {} as Record<string, GAProperty[]>) || {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F9AB00" }} />
      </div>
    );
  }

  if (error && !pendingConnection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
        <div className="max-w-md w-full">
          <Card>
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto mb-4" style={{ color: "#F9AB00" }} />
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.href = "/sources/google-analytics"}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#F9AB00", color: "#1a1a1a" }}
              >
                Go Back
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#F9AB0020", color: "#F9AB00" }}
          >
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            Select a Property
          </h1>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Choose which Google Analytics property to connect
          </p>
        </div>
        {/* Connected Account Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "#10b98120", color: "#10b981" }}
              >
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                  Google Account Connected
                </h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Signed in as {pendingConnection?.userEmail || pendingConnection?.userName}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg"
            style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.3)" }}
          >
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Property Selection */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Select a Property to Sync
          </h3>
          
          {Object.entries(propertiesByAccount).map(([accountName, properties], accountIndex) => (
            <div key={accountName} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  {accountName}
                </span>
              </div>
              
              <div className="space-y-2">
                {properties.map((property, propIndex) => (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + (accountIndex * 0.1) + (propIndex * 0.05) }}
                  >
                    <button
                      onClick={() => setSelectedPropertyId(property.id)}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                        selectedPropertyId === property.id
                          ? "ring-2 ring-[#F9AB00]"
                          : "hover:border-[var(--accent)]"
                      }`}
                      style={{
                        background: selectedPropertyId === property.id 
                          ? "rgba(249, 171, 0, 0.1)" 
                          : "var(--background-secondary)",
                        border: `1px solid ${selectedPropertyId === property.id ? "#F9AB00" : "var(--border)"}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ 
                            background: selectedPropertyId === property.id ? "#F9AB0030" : "#F9AB0015",
                            color: "#F9AB00" 
                          }}
                        >
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: "var(--foreground)" }}>
                            {property.displayName}
                          </p>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                            {property.id}
                          </p>
                        </div>
                        {selectedPropertyId === property.id && (
                          <CheckCircle className="w-5 h-5" style={{ color: "#F9AB00" }} />
                        )}
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Connect Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3"
        >
          <button
            onClick={() => router.push("/sources/google-analytics")}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: "var(--background-tertiary)",
              color: "var(--foreground-muted)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!selectedPropertyId || isConnecting}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
            style={{ background: "#F9AB00", color: "#1a1a1a" }}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect Property
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F9AB00" }} />
    </div>
  );
}

export default function SelectPropertyPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SelectPropertyContent />
    </Suspense>
  );
}
