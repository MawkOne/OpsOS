"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Zap,
  Target,
  TrendingUp,
  CheckCircle2,
  ArrowLeft,
  Save,
} from "lucide-react";
import { Initiative, statusConfig } from "@/types/initiatives";
import { db } from "@/lib/firebase";
import { 
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";

interface PageProps {
  params: {
    id: string;
  };
}

export default function InitiativePage({ params }: PageProps) {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "forecast" | "scenarios" | "montecarlo">("overview");
  const [saving, setSaving] = useState(false);
  
  // Forecast state
  const [forecastEnabled, setForecastEnabled] = useState(false);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>(Array(12).fill(0));
  
  // Scenario state
  const [scenarios, setScenarios] = useState({
    base: { revenue: 0, costs: 0, probability: 60, description: "Expected trajectory" },
    optimistic: { revenue: 0, costs: 0, probability: 25, description: "Best case outcome" },
    pessimistic: { revenue: 0, costs: 0, probability: 15, description: "Worst case outcome" },
  });
  
  // Monte Carlo state
  const [monteCarlo, setMonteCarlo] = useState<{
    simulations: number;
    expectedValue: number;
    standardDeviation: number;
    confidenceInterval: { p10: number; p50: number; p90: number };
    variables: Array<{
      name: string;
      min: number;
      max: number;
      mean: number;
      distribution: "normal" | "triangular" | "uniform";
    }>;
  }>({
    simulations: 10000,
    expectedValue: 0,
    standardDeviation: 0,
    confidenceInterval: { p10: 0, p50: 0, p90: 0 },
    variables: [],
  });

  // Load initiative data
  useEffect(() => {
    if (!currentOrg?.id) return;

    const loadInitiative = async () => {
      try {
        console.log("🔍 Loading initiative:", params.id);
        const initiativeDoc = await getDoc(doc(db, "initiatives", params.id));
        
        if (initiativeDoc.exists()) {
          console.log("📄 Document exists, extracting data...");
          
          // Extract data with error handling for malformed fields
          let rawData;
          try {
            rawData = initiativeDoc.data();
          } catch (dataError) {
            console.error("❌ Error extracting document data:", dataError);
            alert("❌ Error loading initiative data. Some fields may be corrupted.");
            router.push("/initiatives");
            return;
          }
          
          console.log("✅ Raw data extracted:", rawData);
          
          const data = { id: initiativeDoc.id, ...rawData } as Initiative;
          
          // Check if initiative belongs to current org
          if (data.organizationId !== currentOrg.id) {
            alert("❌ Initiative not found or access denied");
            router.push("/initiatives");
            return;
          }
          
          setInitiative(data);
          
          // Load forecast data
          if (data.forecast) {
            setForecastEnabled(data.forecast.enabled || false);
            setMonthlyRevenue(data.forecast.monthlyRevenue || Array(12).fill(0));
          }
          
          // Load scenarios
          if (data.scenarios) {
            setScenarios({
              base: {
                revenue: data.scenarios.base?.revenue || 0,
                costs: data.scenarios.base?.costs || 0,
                probability: data.scenarios.base?.probability || 60,
                description: data.scenarios.base?.description || "Expected trajectory",
              },
              optimistic: {
                revenue: data.scenarios.optimistic?.revenue || 0,
                costs: data.scenarios.optimistic?.costs || 0,
                probability: data.scenarios.optimistic?.probability || 25,
                description: data.scenarios.optimistic?.description || "Best case outcome",
              },
              pessimistic: {
                revenue: data.scenarios.pessimistic?.revenue || 0,
                costs: data.scenarios.pessimistic?.costs || 0,
                probability: data.scenarios.pessimistic?.probability || 15,
                description: data.scenarios.pessimistic?.description || "Worst case outcome",
              },
            });
          }
          
          // Load Monte Carlo
          if (data.monteCarlo) {
            setMonteCarlo({
              simulations: data.monteCarlo.simulations || 10000,
              expectedValue: data.monteCarlo.expectedValue ?? 0,
              standardDeviation: data.monteCarlo.standardDeviation ?? 0,
              confidenceInterval: {
                p10: data.monteCarlo.confidenceInterval?.p10 ?? 0,
                p50: data.monteCarlo.confidenceInterval?.p50 ?? 0,
                p90: data.monteCarlo.confidenceInterval?.p90 ?? 0,
              },
              variables: data.monteCarlo.variables ?? [],
            });
          }
        } else {
          alert("❌ Initiative not found");
          router.push("/initiatives");
        }
      } catch (error) {
        console.error("❌ Error loading initiative:", error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          initiativeId: params.id,
          orgId: currentOrg?.id,
        });
        alert("❌ Failed to load initiative. This initiative may have corrupted data.");
        router.push("/initiatives");
      } finally {
        setLoading(false);
      }
    };

    loadInitiative();
  }, [params.id, currentOrg?.id, router]);

  const handleSave = async () => {
    if (!initiative) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, "initiatives", initiative.id), {
        forecast: {
          enabled: forecastEnabled,
          monthlyRevenue,
          assumptions: [],
          drivers: [],
        },
        scenarios,
        monteCarlo,
        updatedAt: serverTimestamp(),
      });
      alert("✅ Initiative updated!");
    } catch (error) {
      console.error("Error updating initiative:", error);
      alert("❌ Failed to update initiative");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Loading..." subtitle="Loading initiative details">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#00d4aa] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading initiative...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!initiative) {
    return (
      <AppLayout title="Not Found" subtitle="Initiative not found">
        <div className="text-center py-12">
          <p className="text-gray-400">Initiative not found</p>
        </div>
      </AppLayout>
    );
  }

  const status = statusConfig[initiative.status];
  
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Target },
    { id: "forecast" as const, label: "Forecast", icon: TrendingUp },
    { id: "scenarios" as const, label: "Scenarios", icon: CheckCircle2 },
    { id: "montecarlo" as const, label: "Monte Carlo", icon: Zap },
  ];

  return (
    <AppLayout 
      title={initiative.name} 
      subtitle={initiative.description || "Initiative details and forecasting"}
    >
      <div className="max-w-7xl mx-auto">
        {/* Back Button & Header */}
        <div className="mb-6 flex items-start justify-between">
          <button
            onClick={() => router.push("/initiatives")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Initiatives
          </button>
          
          <div className="flex items-center gap-3">
            <span 
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Card>
          <div className="flex border-b border-[#2a2a2a]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id 
                    ? "text-[#00d4aa]" 
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d4aa]"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <div className="text-xs text-gray-400 mb-1">Progress</div>
                    <div className="text-2xl font-bold text-white">{initiative.progress || 0}%</div>
                  </div>
                  <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <div className="text-xs text-gray-400 mb-1">Est. Cost</div>
                    <div className="text-2xl font-bold text-white">${(initiative.estimatedCost || 0).toLocaleString()}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <div className="text-xs text-gray-400 mb-1">Expected Revenue</div>
                    <div className="text-2xl font-bold text-[#00d4aa]">${(initiative.expectedRevenue || 0).toLocaleString()}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <div className="text-xs text-gray-400 mb-1">ROI</div>
                    <div className="text-2xl font-bold text-[#3b82f6]">
                      {initiative.estimatedCost && initiative.expectedRevenue
                        ? ((initiative.expectedRevenue / initiative.estimatedCost - 1) * 100).toFixed(0)
                        : 0}%
                    </div>
                  </div>
                </div>
                
                {/* Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Resources Required</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">People Hours:</span>
                        <span className="text-white font-medium">{initiative.estimatedPeopleHours || 0}h</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-white font-medium">{initiative.estimatedDuration || 0} weeks</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Team Members:</span>
                        <span className="text-white font-medium">{initiative.linkedPeopleIds?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Impact</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Expected Revenue:</span>
                        <span className="text-[#00d4aa] font-medium">${(initiative.expectedRevenue || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Expected Savings:</span>
                        <span className="text-[#00d4aa] font-medium">${(initiative.expectedSavings || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Priority:</span>
                        <span className="text-white font-medium capitalize">{initiative.priority}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {initiative.impactDescription && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Impact Description</h3>
                    <p className="text-sm text-gray-300">{initiative.impactDescription}</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === "forecast" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Revenue Forecast</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forecastEnabled}
                      onChange={(e) => setForecastEnabled(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-400">Enable Forecast</span>
                  </label>
                </div>
                
                {forecastEnabled ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                      <h4 className="text-sm font-semibold text-gray-400 mb-3">Monthly Revenue Projections</h4>
                      <div className="grid grid-cols-4 gap-3">
                        {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, idx) => (
                          <div key={month}>
                            <label className="text-xs text-gray-400 block mb-1">{month}</label>
                            <input
                              type="number"
                              value={monthlyRevenue[idx]}
                              onChange={(e) => {
                                const newRevenue = [...monthlyRevenue];
                                newRevenue[idx] = parseFloat(e.target.value) || 0;
                                setMonthlyRevenue(newRevenue);
                              }}
                              className="w-full px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-sm text-gray-400">
                        Total Annual Revenue: <span className="text-[#00d4aa] font-semibold">${monthlyRevenue.reduce((a, b) => a + b, 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Enable forecasting to model revenue projections</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === "scenarios" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Scenario Planning</h3>
                
                {(["base", "optimistic", "pessimistic"] as const).map((scenarioType) => {
                  const scenario = scenarios[scenarioType];
                  const colors = {
                    base: { bg: "rgba(0, 212, 170, 0.1)", border: "#00d4aa", text: "#00d4aa" },
                    optimistic: { bg: "rgba(59, 130, 246, 0.1)", border: "#3b82f6", text: "#3b82f6" },
                    pessimistic: { bg: "rgba(245, 158, 11, 0.1)", border: "#f59e0b", text: "#f59e0b" },
                  };
                  
                  return (
                    <div 
                      key={scenarioType}
                      className="p-4 rounded-lg"
                      style={{ 
                        background: colors[scenarioType].bg, 
                        border: `1px solid ${colors[scenarioType].border}` 
                      }}
                    >
                      <h4 className="text-sm font-semibold capitalize mb-3" style={{ color: colors[scenarioType].text }}>
                        {scenarioType} Case
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Revenue</label>
                          <input
                            type="number"
                            value={scenario?.revenue || 0}
                            onChange={(e) => setScenarios({
                              ...scenarios,
                              [scenarioType]: { ...scenario!, revenue: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Costs</label>
                          <input
                            type="number"
                            value={scenario?.costs || 0}
                            onChange={(e) => setScenarios({
                              ...scenarios,
                              [scenarioType]: { ...scenario!, costs: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Probability (%)</label>
                          <input
                            type="number"
                            value={scenario?.probability || 0}
                            onChange={(e) => setScenarios({
                              ...scenarios,
                              [scenarioType]: { ...scenario!, probability: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs text-gray-400 block mb-1">Description</label>
                        <input
                          type="text"
                          value={scenario?.description || ""}
                          onChange={(e) => setScenarios({
                            ...scenarios,
                            [scenarioType]: { ...scenario!, description: e.target.value }
                          })}
                          className="w-full px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm"
                        />
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Net: <span className="text-white font-semibold">${((scenario?.revenue || 0) - (scenario?.costs || 0)).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {activeTab === "montecarlo" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white mb-4">Monte Carlo Simulation</h3>
                
                <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Simulation Parameters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Number of Simulations</label>
                      <input
                        type="number"
                        value={monteCarlo.simulations}
                        onChange={(e) => setMonteCarlo({ ...monteCarlo, simulations: parseInt(e.target.value) || 10000 })}
                        className="w-full px-3 py-2 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Results</h4>
                  <p className="text-sm text-gray-400">Run simulations to see probabilistic outcomes and confidence intervals.</p>
                  <button
                    className="mt-3 px-4 py-2 rounded-lg bg-[#00d4aa] text-black font-semibold text-sm hover:bg-[#00b894] transition-colors"
                  >
                    <Zap className="w-4 h-4 inline mr-2" />
                    Run Simulation
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          {(activeTab === "forecast" || activeTab === "scenarios" || activeTab === "montecarlo") && (
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#2a2a2a]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#00d4aa] text-black hover:bg-[#00b894] transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
