"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function InitiativePage() {
  const router = useRouter();
  const params = useParams();
  const { currentOrg } = useOrganization();
  const initiativeId = params?.id as string;
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "forecast" | "scenarios" | "montecarlo">("overview");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Editable form state
  const [formData, setFormData] = useState({
    name: "",
    progress: 0,
    estimatedCost: 0,
    expectedRevenue: 0,
    expectedSavings: 0,
    estimatedPeopleHours: 0,
    estimatedDuration: 0,
    priority: "medium" as "critical" | "high" | "medium" | "low",
    whatsImportant: "",
    howAreWeDoing: "",
    prioritiesToImprove: "",
  });
  
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
    if (!currentOrg?.id || !initiativeId) return;

    const loadInitiative = async () => {
      try {
        console.log("🔍 Loading initiative:", initiativeId);
        
        // Use a fresh document reference with server timestamp handling
        const docRef = doc(db, "initiatives", initiativeId);
        const initiativeDoc = await getDoc(docRef);
        
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
          
          // Sanitize the data to handle problematic fields
          const sanitizedData: Record<string, unknown> = { ...rawData };
          
          // Remove or fix problematic date fields
          ['startDate', 'targetDate', 'completedDate', 'createdAt', 'updatedAt'].forEach(field => {
            if (sanitizedData[field] === null || sanitizedData[field] === undefined) {
              delete sanitizedData[field];
            }
          });
          
          const data = { id: initiativeDoc.id, ...sanitizedData } as Initiative;
          
          // Check if initiative belongs to current org
          if (data.organizationId !== currentOrg.id) {
            alert("❌ Initiative not found or access denied");
            router.push("/initiatives");
            return;
          }
          
          setInitiative(data);
          
          // Parse description into sections
          const sections = data.description?.split('\n\n') || [];
          const parsed = {
            whatsImportant: '',
            howAreWeDoing: '',
            prioritiesToImprove: ''
          };
          
          sections.forEach(section => {
            if (section.startsWith("What's Important:")) {
              parsed.whatsImportant = section.replace("What's Important:", '').trim();
            } else if (section.startsWith("How We're Doing:")) {
              parsed.howAreWeDoing = section.replace("How We're Doing:", '').trim();
            } else if (section.startsWith("Priorities to Improve:")) {
              parsed.prioritiesToImprove = section.replace("Priorities to Improve:", '').trim();
            }
          });
          
          // Initialize form data
          setFormData({
            name: data.name || "",
            progress: data.progress || 0,
            estimatedCost: data.estimatedCost || 0,
            expectedRevenue: data.expectedRevenue || 0,
            expectedSavings: data.expectedSavings || 0,
            estimatedPeopleHours: data.estimatedPeopleHours || 0,
            estimatedDuration: data.estimatedDuration || 0,
            priority: data.priority || "medium",
            whatsImportant: parsed.whatsImportant,
            howAreWeDoing: parsed.howAreWeDoing,
            prioritiesToImprove: parsed.prioritiesToImprove,
          });
          
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
          initiativeId,
          orgId: currentOrg?.id,
        });
        alert("❌ Failed to load initiative. This initiative may have corrupted data.");
        router.push("/initiatives");
      } finally {
        setLoading(false);
      }
    };

    loadInitiative();
  }, [initiativeId, currentOrg?.id, router]);

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
  
  const handleSaveOverview = async () => {
    if (!initiative) return;
    
    setSaving(true);
    try {
      // Reconstruct description from sections
      const descriptionSections = [];
      if (formData.whatsImportant) {
        descriptionSections.push(`What's Important: ${formData.whatsImportant}`);
      }
      if (formData.howAreWeDoing) {
        descriptionSections.push(`How We're Doing: ${formData.howAreWeDoing}`);
      }
      if (formData.prioritiesToImprove) {
        descriptionSections.push(`Priorities to Improve: ${formData.prioritiesToImprove}`);
      }
      const description = descriptionSections.join('\n\n');
      
      await updateDoc(doc(db, "initiatives", initiative.id), {
        name: formData.name,
        progress: formData.progress,
        estimatedCost: formData.estimatedCost,
        expectedRevenue: formData.expectedRevenue,
        expectedSavings: formData.expectedSavings,
        estimatedPeopleHours: formData.estimatedPeopleHours,
        estimatedDuration: formData.estimatedDuration,
        priority: formData.priority,
        description,
        updatedAt: serverTimestamp(),
      });
      
      // Reload the initiative
      const initiativeDoc = await getDoc(doc(db, "initiatives", initiative.id));
      if (initiativeDoc.exists()) {
        const rawData = initiativeDoc.data();
        const sanitizedData: Record<string, unknown> = { ...rawData };
        ['startDate', 'targetDate', 'completedDate', 'createdAt', 'updatedAt'].forEach(field => {
          if (sanitizedData[field] === null || sanitizedData[field] === undefined) {
            delete sanitizedData[field];
          }
        });
        const data = { id: initiativeDoc.id, ...sanitizedData } as Initiative;
        setInitiative(data);
      }
      
      setEditMode(false);
      alert("✅ Initiative updated successfully!");
    } catch (error) {
      console.error("Error updating initiative:", error);
      alert("❌ Failed to update initiative");
    } finally {
      setSaving(false);
    }
  };
  
  const handleStatusToggle = async () => {
    if (!initiative) return;
    
    const newStatus = initiative.status === "draft" ? "ready" : "draft";
    
    setSaving(true);
    try {
      await updateDoc(doc(db, "initiatives", initiative.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      
      setInitiative({ ...initiative, status: newStatus });
      alert(`✅ Initiative marked as ${newStatus === "ready" ? "Ready" : "Draft"}!`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("❌ Failed to update status");
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
      title="Initiative Details" 
      subtitle="View and manage initiative forecasting"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-start justify-between">
          <button
            onClick={() => router.push("/initiatives")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
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
            {initiative.status === "draft" && (
              <button
                onClick={handleStatusToggle}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00d4aa] text-black hover:bg-[#00b894] transition-colors disabled:opacity-50"
              >
                {saving ? "Updating..." : "Mark as Ready"}
              </button>
            )}
          </div>
        </div>
        
        {/* Initiative Title */}
        <div className="px-6 py-4 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center justify-between">
          {editMode && activeTab === "overview" ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-2xl font-bold text-white bg-gray-900/50 border border-gray-600 rounded px-3 py-1 flex-1 focus:outline-none focus:border-[#00d4aa]"
            />
          ) : (
            <h1 className="text-2xl font-bold text-white">{initiative.name}</h1>
          )}
          
          {activeTab === "overview" && (
            <div className="flex items-center gap-2 ml-4">
              {editMode ? (
                <>
                  <button
                    onClick={handleSaveOverview}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00d4aa] text-black hover:bg-[#00b894] transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      // Reset form data
                      const sections = initiative.description?.split('\n\n') || [];
                      const parsed = { whatsImportant: '', howAreWeDoing: '', prioritiesToImprove: '' };
                      sections.forEach(section => {
                        if (section.startsWith("What's Important:")) {
                          parsed.whatsImportant = section.replace("What's Important:", '').trim();
                        } else if (section.startsWith("How We're Doing:")) {
                          parsed.howAreWeDoing = section.replace("How We're Doing:", '').trim();
                        } else if (section.startsWith("Priorities to Improve:")) {
                          parsed.prioritiesToImprove = section.replace("Priorities to Improve:", '').trim();
                        }
                      });
                      setFormData({
                        name: initiative.name || "",
                        progress: initiative.progress || 0,
                        estimatedCost: initiative.estimatedCost || 0,
                        expectedRevenue: initiative.expectedRevenue || 0,
                        expectedSavings: initiative.expectedSavings || 0,
                        estimatedPeopleHours: initiative.estimatedPeopleHours || 0,
                        estimatedDuration: initiative.estimatedDuration || 0,
                        priority: initiative.priority || "medium",
                        whatsImportant: parsed.whatsImportant,
                        howAreWeDoing: parsed.howAreWeDoing,
                        prioritiesToImprove: parsed.prioritiesToImprove,
                      });
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Card>
          <div className="flex border-b border-gray-700">
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
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-800/30 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Progress</div>
                    {editMode ? (
                      <input
                        type="number"
                        value={formData.progress}
                        onChange={(e) => setFormData({ ...formData, progress: parseFloat(e.target.value) || 0 })}
                        className="w-full text-2xl font-bold text-white bg-gray-900/50 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-[#00d4aa]"
                        min="0"
                        max="100"
                      />
                    ) : (
                      <div className="text-2xl font-bold text-white">{initiative.progress || 0}%</div>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-800/30 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Est. Cost</div>
                    {editMode ? (
                      <input
                        type="number"
                        value={formData.estimatedCost}
                        onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })}
                        className="w-full text-2xl font-bold text-white bg-gray-900/50 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-[#00d4aa]"
                      />
                    ) : (
                      <div className="text-2xl font-bold text-white">${(initiative.estimatedCost || 0).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-800/30 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Expected Revenue</div>
                    {editMode ? (
                      <input
                        type="number"
                        value={formData.expectedRevenue}
                        onChange={(e) => setFormData({ ...formData, expectedRevenue: parseFloat(e.target.value) || 0 })}
                        className="w-full text-2xl font-bold text-[#00d4aa] bg-gray-900/50 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-[#00d4aa]"
                      />
                    ) : (
                      <div className="text-2xl font-bold text-[#00d4aa]">${(initiative.expectedRevenue || 0).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-800/30 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">ROI</div>
                    <div className="text-2xl font-bold text-[#3b82f6]">
                      {editMode
                        ? (formData.estimatedCost && formData.expectedRevenue
                            ? ((formData.expectedRevenue / formData.estimatedCost - 1) * 100).toFixed(0)
                            : 0)
                        : (initiative.estimatedCost && initiative.expectedRevenue
                            ? ((initiative.expectedRevenue / initiative.estimatedCost - 1) * 100).toFixed(0)
                            : 0)}%
                    </div>
                  </div>
                </div>
                
                {/* Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Resources Required</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">People Hours:</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={formData.estimatedPeopleHours}
                            onChange={(e) => setFormData({ ...formData, estimatedPeopleHours: parseFloat(e.target.value) || 0 })}
                            className="text-white font-medium bg-gray-900/50 border border-gray-600 rounded px-2 py-1 w-24 focus:outline-none focus:border-[#00d4aa]"
                          />
                        ) : (
                          <span className="text-white font-medium">{initiative.estimatedPeopleHours || 0}h</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">Duration:</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={formData.estimatedDuration}
                            onChange={(e) => setFormData({ ...formData, estimatedDuration: parseFloat(e.target.value) || 0 })}
                            className="text-white font-medium bg-gray-900/50 border border-gray-600 rounded px-2 py-1 w-24 focus:outline-none focus:border-[#00d4aa]"
                          />
                        ) : (
                          <span className="text-white font-medium">{initiative.estimatedDuration || 0} weeks</span>
                        )}
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
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">Expected Revenue:</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={formData.expectedRevenue}
                            onChange={(e) => setFormData({ ...formData, expectedRevenue: parseFloat(e.target.value) || 0 })}
                            className="text-[#00d4aa] font-medium bg-gray-900/50 border border-gray-600 rounded px-2 py-1 w-32 focus:outline-none focus:border-[#00d4aa]"
                          />
                        ) : (
                          <span className="text-[#00d4aa] font-medium">${(initiative.expectedRevenue || 0).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">Expected Savings:</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={formData.expectedSavings}
                            onChange={(e) => setFormData({ ...formData, expectedSavings: parseFloat(e.target.value) || 0 })}
                            className="text-[#00d4aa] font-medium bg-gray-900/50 border border-gray-600 rounded px-2 py-1 w-32 focus:outline-none focus:border-[#00d4aa]"
                          />
                        ) : (
                          <span className="text-[#00d4aa] font-medium">${(initiative.expectedSavings || 0).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">Priority:</span>
                        {editMode ? (
                          <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as "critical" | "high" | "medium" | "low" })}
                            className="text-white font-medium bg-gray-900/50 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-[#00d4aa]"
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        ) : (
                          <span className="text-white font-medium capitalize">{initiative.priority}</span>
                        )}
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
                
                {/* Initiative Details - Parsed from description */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-2">What&apos;s Important</h3>
                    {editMode ? (
                      <textarea
                        value={formData.whatsImportant}
                        onChange={(e) => setFormData({ ...formData, whatsImportant: e.target.value })}
                        className="w-full text-sm text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 min-h-[80px] focus:outline-none focus:border-[#00d4aa] resize-y"
                        placeholder="Describe what's important about this initiative..."
                      />
                    ) : (
                      <p className="text-sm text-gray-300">{formData.whatsImportant || "Not set"}</p>
                    )}
                  </div>
                  
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-2">How We&apos;re Doing</h3>
                    {editMode ? (
                      <textarea
                        value={formData.howAreWeDoing}
                        onChange={(e) => setFormData({ ...formData, howAreWeDoing: e.target.value })}
                        className="w-full text-sm text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 min-h-[80px] focus:outline-none focus:border-[#00d4aa] resize-y"
                        placeholder="Describe current performance..."
                      />
                    ) : (
                      <p className="text-sm text-gray-300">{formData.howAreWeDoing || "Not set"}</p>
                    )}
                  </div>
                  
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-2">Priorities to Improve</h3>
                    {editMode ? (
                      <textarea
                        value={formData.prioritiesToImprove}
                        onChange={(e) => setFormData({ ...formData, prioritiesToImprove: e.target.value })}
                        className="w-full text-sm text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 min-h-[80px] focus:outline-none focus:border-[#00d4aa] resize-y"
                        placeholder="List priorities to improve..."
                      />
                    ) : (
                      <p className="text-sm text-gray-300">{formData.prioritiesToImprove || "Not set"}</p>
                    )}
                  </div>
                </div>
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
                    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
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
                              className="w-full px-2 py-1 rounded bg-gray-900/50 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#00d4aa]"
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
                
                <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Simulation Parameters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Number of Simulations</label>
                      <input
                        type="number"
                        value={monteCarlo.simulations}
                        onChange={(e) => setMonteCarlo({ ...monteCarlo, simulations: parseInt(e.target.value) || 10000 })}
                        className="w-full px-3 py-2 rounded bg-gray-900/50 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#00d4aa]"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
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
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
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
