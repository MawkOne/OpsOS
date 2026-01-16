"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Initiative, statusConfig } from "@/types/initiatives";
import { db } from "@/lib/firebase";
import { 
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useOrganization } from "@/contexts/OrganizationContext";
import { MasterTableEntity, getEntitiesByIds } from "@/lib/masterTableData";
import MasterTableSelector from "@/components/MasterTableSelector";

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
  const [forecastEnabled, setForecastEnabled] = useState(true);
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([]);
  const [initiativeImpact, setInitiativeImpact] = useState<number>(0); // % growth impact
  const [funnelMode, setFunnelMode] = useState(false);
  const [funnelOperations, setFunnelOperations] = useState<Record<number, 'add' | 'subtract' | 'multiply' | 'divide'>>({});
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [calculatedStages, setCalculatedStages] = useState<Record<number, Record<string, number>>>({});
  const [stageNumberFormats, setStageNumberFormats] = useState<Record<number, 'percentage' | 'whole' | 'decimal' | 'currency'>>({});
  const [itemsInForecast, setItemsInForecast] = useState<string[]>([]); // Which items to show in chart
  const [baselineEntities, setBaselineEntities] = useState<MasterTableEntity[]>([]);
  const [showLineItemSelector, setShowLineItemSelector] = useState(false);
  
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

  // Load baseline entities
  useEffect(() => {
    if (!currentOrg?.id) return;

    // Load entities when selected line items change
    const loadSelectedEntities = async () => {
      if (selectedLineItems.length === 0) {
        setBaselineEntities([]);
        return;
      }
      
      try {
        const entities = await getEntitiesByIds(currentOrg.id, selectedLineItems);
        setBaselineEntities(entities);
        console.log(`✅ Loaded ${entities.length} selected entities`);
      } catch (error) {
        console.error("❌ Error loading selected entities:", error);
      }
    };

    loadSelectedEntities();
  }, [currentOrg?.id, selectedLineItems]);

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
            setSelectedLineItems(data.forecast.selectedLineItems || []);
            setInitiativeImpact(data.forecast.initiativeImpact || 0);
            setFunnelMode(data.forecast.funnelMode || false);
            setFunnelOperations(data.forecast.funnelOperations || {});
            setCalculatedStages(data.forecast.calculatedStages || {});
            setStageNumberFormats(data.forecast.stageNumberFormats || {});
            setItemsInForecast(data.forecast.itemsInForecast || []);
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
          selectedLineItems,
          initiativeImpact,
          funnelMode,
          funnelOperations,
          calculatedStages,
          stageNumberFormats,
          itemsInForecast,
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
  
  // Generate month keys for historical data (trailing 12 months)
  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    
    for (let i = 12; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    
    return keys;
  }, []);

  // Generate forecast month keys (next 12 months)
  const forecastMonthKeys = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    
    return keys;
  }, []);

  // Calculate CMGR and MoM patterns for an entity
  const calculateForecast = useCallback((entity: typeof baselineEntities[0]) => {
    const values = monthKeys.map(key => entity.months[key] || 0).filter(v => v > 0);
    if (values.length < 3) return { cmgr: 0, momPatterns: {}, baselineValue: 0, lastMonthKey: monthKeys[monthKeys.length - 1] };

    // Calculate CMGR
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const months = values.length - 1;
    const cmgr = months > 0 ? Math.pow(lastValue / firstValue, 1 / months) - 1 : 0;

    // Calculate month-over-month patterns from trailing 12 months
    const trailing12Months = monthKeys.slice(-12);
    const momPatterns: Record<string, number> = {};
    
    for (let i = 1; i < trailing12Months.length; i++) {
      const prevKey = trailing12Months[i - 1];
      const currKey = trailing12Months[i];
      const prevValue = entity.months[prevKey] || 0;
      const currValue = entity.months[currKey] || 0;
      
      if (prevValue > 0 && currValue > 0) {
        const prevMonth = parseInt(prevKey.split('-')[1]);
        const currMonth = parseInt(currKey.split('-')[1]);
        const changePercent = (currValue - prevValue) / prevValue;
        const transitionKey = `${prevMonth}-${currMonth}`;
        momPatterns[transitionKey] = changePercent;
      }
    }

    // Get baseline value (last month with data)
    const baselineValue = lastValue;
    const lastMonthKey = monthKeys[monthKeys.length - 1];
    
    return { cmgr, momPatterns, baselineValue, lastMonthKey };
  }, [monthKeys]);

  // Calculate baseline forecast for selected line items
  const baselineForecast = useMemo(() => {
    console.log("📊 Computing baseline forecast...");
    console.log(`  → selectedLineItems: ${selectedLineItems.length} items`, selectedLineItems);
    console.log(`  → baselineEntities: ${baselineEntities.length} entities`);
    
    if (selectedLineItems.length === 0 || baselineEntities.length === 0) {
      console.log("  ⚠️ No data to forecast (empty line items or entities)");
      return {};
    }

    const forecast: Record<string, number> = {};
    
    selectedLineItems.forEach(itemId => {
      const entity = baselineEntities.find(e => e.entityId === itemId);
      if (!entity) {
        console.log(`  ⚠️ Entity not found for itemId: ${itemId}`);
        return;
      }

      console.log(`  ✓ Found entity: ${entity.entityName} (${entity.source})`);
      const { cmgr, momPatterns, baselineValue, lastMonthKey } = calculateForecast(entity);
      console.log(`    → CMGR: ${(cmgr * 100).toFixed(2)}%, Baseline: $${baselineValue.toFixed(2)}`);
      
      if (baselineValue === 0 || !lastMonthKey) {
        console.log(`    ⚠️ Skipping entity (no baseline value or last month)`);
        return;
      }

      const lastMonthNum = parseInt(lastMonthKey.split('-')[1]);
      let previousValue = baselineValue;
      let previousMonthNum = lastMonthNum;

      forecastMonthKeys.forEach((forecastKey) => {
        const forecastMonthNum = parseInt(forecastKey.split('-')[1]);
        const transitionKey = `${previousMonthNum}-${forecastMonthNum}`;
        const historicalChange = momPatterns[transitionKey];

        let forecastValue;
        if (historicalChange !== undefined) {
          forecastValue = previousValue * (1 + historicalChange);
        } else {
          forecastValue = previousValue;
        }

        // Apply CMGR
        forecastValue = forecastValue * (1 + cmgr);

        forecast[forecastKey] = (forecast[forecastKey] || 0) + forecastValue;

        previousValue = forecastValue;
        previousMonthNum = forecastMonthNum;
      });
    });

    console.log(`  ✅ Baseline forecast computed:`, Object.keys(forecast).length, "months");
    console.log(`    Total forecasted value: $${Object.values(forecast).reduce((sum, val) => sum + val, 0).toFixed(2)}`);
    
    return forecast;
  }, [selectedLineItems, baselineEntities, forecastMonthKeys, calculateForecast]);

  // Calculate initiative-impacted forecast
  const initiativeForecast = useMemo(() => {
    if (!forecastEnabled || Object.keys(baselineForecast).length === 0) {
      return {};
    }

    const forecast: Record<string, number> = {};
    const impactMultiplier = 1 + (initiativeImpact / 100);

    Object.entries(baselineForecast).forEach(([key, value]) => {
      forecast[key] = value * impactMultiplier;
    });

    return forecast;
  }, [forecastEnabled, baselineForecast, initiativeImpact]);

  // Calculate funnel stage results
  useEffect(() => {
    if (!funnelMode || selectedLineItems.length < 2) {
      setCalculatedStages({});
      return;
    }

    const newCalculatedStages: Record<number, Record<string, number>> = {};

    // Calculate each stage (operation between item[i] and item[i+1])
    for (let i = 0; i < selectedLineItems.length - 1; i++) {
      const operation = funnelOperations[i] || 'multiply';
      const entity1 = baselineEntities.find(e => e.entityId === selectedLineItems[i]);
      const entity2 = baselineEntities.find(e => e.entityId === selectedLineItems[i + 1]);

      if (!entity1 || !entity2) continue;

      const stageResult: Record<string, number> = {};

      // Calculate for each month
      monthKeys.forEach(monthKey => {
        const val1 = entity1.months[monthKey] || 0;
        const val2 = entity2.months[monthKey] || 0;

        switch (operation) {
          case 'add':
            stageResult[monthKey] = val1 + val2;
            break;
          case 'subtract':
            stageResult[monthKey] = val1 - val2;
            break;
          case 'multiply':
            stageResult[monthKey] = val1 * val2;
            break;
          case 'divide':
            stageResult[monthKey] = val2 !== 0 ? val1 / val2 : 0;
            break;
        }
      });

      newCalculatedStages[i] = stageResult;
    }

    setCalculatedStages(newCalculatedStages);
  }, [funnelMode, selectedLineItems, funnelOperations, baselineEntities, monthKeys]);

  // Prepare chart data
  const forecastChartData = useMemo(() => {
    if (!forecastEnabled || Object.keys(baselineForecast).length === 0) {
      return [];
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return forecastMonthKeys.map((key) => {
      const [year, month] = key.split('-');
      const monthIndex = parseInt(month) - 1;
      const monthLabel = `${monthNames[monthIndex]} '${year.slice(-2)}`;

      return {
        month: monthLabel,
        baseline: (baselineForecast[key] || 0) / 1000,
        withInitiative: (initiativeForecast[key] || 0) / 1000,
      };
    });
  }, [forecastEnabled, baselineForecast, initiativeForecast, forecastMonthKeys]);

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
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Framing Content */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-2">What&apos;s Important</h3>
                    {editMode ? (
                      <textarea
                        value={formData.whatsImportant}
                        onChange={(e) => setFormData({ ...formData, whatsImportant: e.target.value })}
                        className="w-full text-sm text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 min-h-[120px] focus:outline-none focus:border-[#00d4aa] resize-y"
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
                        className="w-full text-sm text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 min-h-[120px] focus:outline-none focus:border-[#00d4aa] resize-y"
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
                        className="w-full text-sm text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 min-h-[120px] focus:outline-none focus:border-[#00d4aa] resize-y"
                        placeholder="List priorities to improve..."
                      />
                    ) : (
                      <p className="text-sm text-gray-300">{formData.prioritiesToImprove || "Not set"}</p>
                    )}
                  </div>

                  {/* Resources & Impact */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Resources Required */}
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-3">Resources Required</h3>
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

                      {/* Impact */}
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-3">Impact</h3>
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
                  </div>
                </div>
                
                {/* Right Column - Charts */}
                <div className="space-y-4">
                  {/* Forecast Line Chart */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-4">12-Month Forecast</h3>
                    {forecastEnabled && forecastChartData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={forecastChartData}>
                            <defs>
                              <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorInitiative" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="month" 
                              stroke="#9ca3af"
                              tick={{ fill: "#9ca3af", fontSize: 11 }}
                            />
                            <YAxis 
                              stroke="#9ca3af"
                              tick={{ fill: "#9ca3af", fontSize: 11 }}
                              tickFormatter={(value: number) => `$${value}K`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: "#1f2937", 
                                border: "1px solid #374151",
                                borderRadius: "8px",
                                color: "#fff",
                              }}
                              formatter={(value: number | undefined, name: string | undefined) => [
                                `$${(value || 0).toFixed(1)}K`, 
                                name === "baseline" ? "Baseline" : "With Initiative"
                              ]}
                            />
                            <Area
                              type="monotone"
                              dataKey="baseline"
                              stroke="#9ca3af"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              fill="url(#colorBaseline)"
                              dot={{ fill: "#9ca3af", strokeWidth: 2, r: 3 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="withInitiative"
                              stroke="#00d4aa"
                              strokeWidth={2}
                              fill="url(#colorInitiative)"
                              dot={{ fill: "#00d4aa", strokeWidth: 2, r: 3 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                        <div className="text-center">
                          <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p>Select line items in the Forecast tab to see projections</p>
                        </div>
                      </div>
                    )}
                    
                    {forecastEnabled && forecastChartData.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Baseline Total</div>
                            <div className="text-lg font-bold text-gray-400">
                              ${Object.values(baselineForecast).reduce((sum, val) => sum + val, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">With Initiative</div>
                            <div className="text-lg font-bold text-[#00d4aa]">
                              ${Object.values(initiativeForecast).reduce((sum, val) => sum + val, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Incremental Impact</div>
                            <div className="text-lg font-bold text-[#3b82f6]">
                              ${(Object.values(initiativeForecast).reduce((sum, val) => sum + val, 0) - Object.values(baselineForecast).reduce((sum, val) => sum + val, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Placeholder for future funnel chart */}
                    {forecastEnabled && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="text-center text-xs text-gray-500">
                          Funnel analysis coming soon
                        </div>
                      </div>
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
                      checked={funnelMode}
                      onChange={(e) => setFunnelMode(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-400">Funnel Mode</span>
                  </label>
                </div>
                
                <div className="space-y-4">
                    {/* Line Item Selection */}
                    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-white">Impacted Forecast Items</h4>
                        <button
                          onClick={() => setShowLineItemSelector(true)}
                          className="text-xs px-3 py-1 rounded bg-[#00d4aa] text-black hover:bg-[#00b894] font-medium"
                        >
                          + Select Forecast Items
                        </button>
                      </div>
                      
                      {selectedLineItems.length > 0 ? (
                        <div className="space-y-2">
                          {selectedLineItems.map((itemId, index) => {
                            const entity = baselineEntities.find(e => e.entityId === itemId);
                            if (!entity) return null;
                            
                            // Get last 12 months of data
                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                            const last12Months = monthKeys.slice(-12).map(key => {
                              const [, month] = key.split('-');
                              const value = entity.months[key] || 0;
                              return {
                                label: monthNames[parseInt(month) - 1],
                                value: value
                              };
                            });
                            
                            // Format value for display
                            const formatValue = (val: number) => {
                              if (val === 0) return '-';
                              if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                              if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                              return val.toFixed(0);
                            };
                            
                            const handleDragStart = (e: React.DragEvent, idx: number) => {
                              setDraggedItem(idx);
                              e.dataTransfer.effectAllowed = 'move';
                            };
                            
                            const handleDragOver = (e: React.DragEvent) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            };
                            
                            const handleDrop = (e: React.DragEvent, dropIdx: number) => {
                              e.preventDefault();
                              if (draggedItem === null || draggedItem === dropIdx) return;
                              
                              const newItems = [...selectedLineItems];
                              const [removed] = newItems.splice(draggedItem, 1);
                              newItems.splice(dropIdx, 0, removed);
                              setSelectedLineItems(newItems);
                              setDraggedItem(null);
                            };
                            
                            const handleDragEnd = () => {
                              setDraggedItem(null);
                            };
                            
                            return (
                              <div key={itemId}>
                                <div 
                                  draggable={funnelMode}
                                  onDragStart={(e) => handleDragStart(e, index)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, index)}
                                  onDragEnd={handleDragEnd}
                                  className={`p-3 rounded bg-gray-900/50 border border-gray-600 ${funnelMode ? 'cursor-move' : ''} ${draggedItem === index ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {funnelMode && (
                                        <div className="text-gray-500 text-xs">☰</div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white font-medium truncate">{entity.entityName}</div>
                                        <div className="text-xs text-gray-400">{entity.source} • {entity.metricType}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setItemsInForecast(prev => 
                                            prev.includes(itemId) 
                                              ? prev.filter(id => id !== itemId)
                                              : [...prev, itemId]
                                          );
                                        }}
                                        className={`text-xs hover:text-[#00d4aa] ml-2 ${itemsInForecast.includes(itemId) ? 'text-[#00d4aa]' : 'text-gray-400'}`}
                                        title={itemsInForecast.includes(itemId) ? 'In forecast chart' : 'Add to forecast chart'}
                                      >
                                        <TrendingUp className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setSelectedLineItems(prev => prev.filter(id => id !== itemId))}
                                        className="text-xs text-gray-400 hover:text-red-400"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Last 12 Months Data */}
                                  <div className="grid grid-cols-12 gap-1 text-center">
                                    {last12Months.map((month, idx) => (
                                      <div key={idx} className="flex flex-col">
                                        <div className="text-[10px] text-gray-500">{month.label}</div>
                                        <div className={`text-xs font-mono ${month.value > 0 ? 'text-[#00d4aa]' : 'text-gray-600'}`}>
                                          {formatValue(month.value)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Operation Selector & Calculated Result (only show between items in funnel mode) */}
                                {funnelMode && index < selectedLineItems.length - 1 && (
                                  <div className="space-y-2">
                                    {/* Operation Selector */}
                                    <div className="flex items-center justify-center py-2">
                                      <select
                                        value={funnelOperations[index] || 'multiply'}
                                        onChange={(e) => setFunnelOperations(prev => ({
                                          ...prev,
                                          [index]: e.target.value as 'add' | 'subtract' | 'multiply' | 'divide'
                                        }))}
                                        className="px-3 py-1 rounded bg-gray-800 border border-gray-600 text-white text-xs focus:outline-none focus:border-[#00d4aa]"
                                      >
                                        <option value="add">+ Add</option>
                                        <option value="subtract">− Subtract</option>
                                        <option value="multiply">× Multiply</option>
                                        <option value="divide">÷ Divide</option>
                                      </select>
                                    </div>
                                    
                                    {/* Calculated Result */}
                                    {calculatedStages[index] && (
                                      <div className="p-3 rounded bg-blue-900/20 border border-blue-700/50">
                                        <div className="flex items-start gap-3">
                                          {/* Number Format Dropdown */}
                                          <select
                                            value={stageNumberFormats[index] || 'whole'}
                                            onChange={(e) => setStageNumberFormats(prev => ({
                                              ...prev,
                                              [index]: e.target.value as 'percentage' | 'whole' | 'decimal' | 'currency'
                                            }))}
                                            className="px-2 py-1 rounded bg-gray-800 border border-gray-600 text-white text-xs focus:outline-none focus:border-[#00d4aa] min-w-[80px]"
                                          >
                                            <option value="percentage">% (1 dec)</option>
                                            <option value="whole">Number</option>
                                            <option value="decimal">Decimal</option>
                                            <option value="currency">$ Currency</option>
                                          </select>
                                          
                                          {/* Monthly Data Grid */}
                                          <div className="flex-1 grid grid-cols-12 gap-1 text-center">
                                            {monthKeys.slice(-12).map((monthKey, idx) => {
                                              const [, month] = monthKey.split('-');
                                              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                              const value = calculatedStages[index][monthKey] || 0;
                                              
                                              // Format based on selected type
                                              const numberFormat = stageNumberFormats[index] || 'whole';
                                              let displayValue = '';
                                              if (value === 0) {
                                                displayValue = '-';
                                              } else if (numberFormat === 'percentage') {
                                                displayValue = `${value.toFixed(1)}%`;
                                              } else if (numberFormat === 'decimal') {
                                                displayValue = value.toFixed(2);
                                              } else if (numberFormat === 'currency') {
                                                // Currency - use smart formatting with $
                                                if (value >= 1000000) {
                                                  displayValue = `$${(value / 1000000).toFixed(1)}M`;
                                                } else if (value >= 1000) {
                                                  displayValue = `$${(value / 1000).toFixed(0)}K`;
                                                } else {
                                                  displayValue = `$${value.toFixed(0)}`;
                                                }
                                              } else {
                                                // whole - use smart formatting
                                                displayValue = formatValue(value);
                                              }
                                              
                                              return (
                                                <div key={idx} className="flex flex-col">
                                                  <div className="text-[10px] text-gray-500">{monthNames[parseInt(month) - 1]}</div>
                                                  <div className={`text-xs font-mono ${value !== 0 ? 'text-blue-400' : 'text-gray-600'}`}>
                                                    {displayValue}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>Select which master table line items this initiative will impact</p>
                        </div>
                      )}
                    </div>

                    {/* Initiative Impact */}
                    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700">
                      <h4 className="text-sm font-semibold text-white mb-3">Initiative Impact</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-2">
                            Growth Impact (% change to baseline)
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="-100"
                              max="200"
                              step="1"
                              value={initiativeImpact}
                              onChange={(e) => setInitiativeImpact(parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <input
                              type="number"
                              value={initiativeImpact}
                              onChange={(e) => setInitiativeImpact(parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 rounded bg-gray-900/50 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#00d4aa]"
                            />
                            <span className="text-sm text-white font-medium">%</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400">
                          {initiativeImpact > 0 && (
                            <span className="text-[#00d4aa]">✓ This initiative will increase revenue by {initiativeImpact}%</span>
                          )}
                          {initiativeImpact < 0 && (
                            <span className="text-orange-400">⚠ This initiative will reduce revenue by {Math.abs(initiativeImpact)}%</span>
                          )}
                          {initiativeImpact === 0 && (
                            <span>No impact set - baseline forecast will be used</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                
                {/* Master Table Selector Modal */}
                {showLineItemSelector && currentOrg && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLineItemSelector(false)}>
                    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                      <MasterTableSelector
                        organizationId={currentOrg.id}
                        selectedEntityIds={selectedLineItems}
                        onSelectionChange={setSelectedLineItems}
                        filters={{}}
                        multiSelect={true}
                        title="Select Forecast Items"
                        description="Choose line items from any source (revenue, expenses, marketing, etc.) this initiative will impact"
                        onClose={() => setShowLineItemSelector(false)}
                      />
                    </div>
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
