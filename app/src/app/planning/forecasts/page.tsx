"use client";

// Forecast page - Revenue projections and analysis
import { useState, useEffect, useCallback, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Calendar,
  X,
  Check,
  Download,
  Share2,
  GitBranch,
  Save,
  History,
} from "lucide-react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { 
  createForecastVersion, 
  getActiveForecastVersion,
  getForecastVersion,
} from "@/lib/forecastVersions";
import { ForecastVersion } from "@/types/forecast";
import ForecastVersionSelector from "@/components/ForecastVersionSelector";

interface BaselineEntity {
  id?: string;
  entityId: string;
  entityName: string;
  source: string;
  type: string;
  metric: string;
  metricType: string;
  months: Record<string, number>;
  total: number;
}

interface GAMetrics {
  sessions?: number;
  pageviews?: number;
  [key: string]: number | undefined;
}

interface GAPage {
  id: string;
  name: string;
  months?: Record<string, GAMetrics>;
}

export default function ForecastsPage() {
  const { currentOrg } = useOrganization();
  const { formatAmount } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [baselineEntities, setBaselineEntities] = useState<BaselineEntity[]>([]);
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [availableEntities] = useState<BaselineEntity[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [modalLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterMetric, setFilterMetric] = useState<string>("all");
  
  // Version control state
  const [activeVersion, setActiveVersion] = useState<ForecastVersion | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<ForecastVersion | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const organizationId = currentOrg?.id || "";
  const hasUnsavedChanges = !loadedVersion; // If no version is loaded, there are unsaved changes

  // Generate month keys - trailing months up to last completed month (not including current)
  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    
    // Last 14 completed months (Nov 2024 through Dec 2025)
    for (let i = 14; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    
    console.log('📅 Generated monthKeys (last 14 completed months, Nov 24 onwards):', keys);
    return keys;
  }, []);

  // Generate forecast month keys - next 12 months (including current month if empty)
  const forecastMonthKeys = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    
    // Include current month (likely empty) + next 11 months = 12 total
    for (let i = 0; i <= 11; i++) {
      const nextDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      keys.push(nextMonthKey);
    }
    
    console.log('🔮 Generated forecastMonthKeys (current + next 11 months):', keys);
    return keys;
  }, []);

  // Calculate CMGR (Compound Monthly Growth Rate) and month-over-month patterns
  const calculateForecast = (entity: BaselineEntity, monthKeys: string[]) => {
    const values = monthKeys.map(key => entity.months[key] || 0).filter(v => v > 0);
    if (values.length < 3) return { cmgr: 0, momPatterns: {}, allTransitions: {} };

    // Calculate CMGR (Compound Monthly Growth Rate)
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const months = values.length - 1;
    const cmgr = months > 0 ? Math.pow(lastValue / firstValue, 1 / months) - 1 : 0;

    // Calculate month-over-month change patterns from TRAILING 12 MONTHS ONLY
    // Use only the most recent 12 months of data for patterns
    const trailing12Months = monthKeys.slice(-12);
    console.log(`  📅 Using trailing 12 months for patterns: ${trailing12Months[0]} to ${trailing12Months[trailing12Months.length - 1]}`);
    
    const momPatterns: Record<string, number> = {}; // Key: "12-1" means Dec to Jan
    const allTransitions: Record<string, Array<{date: string, change: number, prevValue: number, currValue: number}>> = {};
    
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
        
        // Store all transitions for debugging
        if (!allTransitions[transitionKey]) {
          allTransitions[transitionKey] = [];
        }
        allTransitions[transitionKey].push({
          date: `${prevKey} → ${currKey}`,
          change: changePercent,
          prevValue,
          currValue
        });
        
        // Store this pattern (if multiple exist in trailing 12, the last one wins)
        momPatterns[transitionKey] = changePercent;
      }
    }

    return { cmgr, momPatterns, allTransitions };
  };

  // Combine baseline entities (merge YT JOBS and Unlabeled Revenue)
  const processedBaselineEntities = useMemo(() => {
    // Separate revenue entities that should be combined
    const ytJobsEntity = baselineEntities.find(e => e.entityName === "YT JOBS" && e.metricType === "revenue");
    const unlabeledEntity = baselineEntities.find(e => e.entityName === "Unlabeled Revenue" && e.metricType === "revenue");
    
    console.log('🔍 Found entities for combining:', {
      ytJobs: ytJobsEntity ? { name: ytJobsEntity.entityName, months: Object.keys(ytJobsEntity.months) } : null,
      unlabeled: unlabeledEntity ? { name: unlabeledEntity.entityName, months: Object.keys(unlabeledEntity.months) } : null
    });
    
    // If both exist, combine them
    if (ytJobsEntity && unlabeledEntity) {
      const combinedMonths: Record<string, number> = {};
      let combinedTotal = 0;
      
      // Combine monthly values
      [...monthKeys].forEach(key => {
        const ytValue = ytJobsEntity.months[key] || 0;
        const unlabeledValue = unlabeledEntity.months[key] || 0;
        const combined = ytValue + unlabeledValue;
        if (combined > 0) {
          combinedMonths[key] = combined;
        }
        combinedTotal += combined;
      });
      
      console.log('✅ Combined entity months:', Object.keys(combinedMonths), 'Total:', combinedTotal);
      
      // Create combined entity
      const combinedEntity: BaselineEntity = {
        id: `combined_${ytJobsEntity.entityId}_${unlabeledEntity.entityId}`,
        entityId: `combined_${ytJobsEntity.entityId}_${unlabeledEntity.entityId}`,
        entityName: "Total Product Revenue",
        source: "stripe",
        type: "product",
        metric: "Product Revenue",
        metricType: "revenue",
        months: combinedMonths,
        total: combinedTotal,
      };
      
      // Return entities with combined entity, excluding originals
      return [
        ...baselineEntities.filter(e => 
          e.entityId !== ytJobsEntity.entityId && 
          e.entityId !== unlabeledEntity.entityId
        ),
        combinedEntity
      ];
    }
    
    return baselineEntities;
  }, [baselineEntities, monthKeys]);

  // Pre-calculate forecasts for all entities (memoized for performance)
  const entityForecasts = useMemo(() => {
    console.log('🔮 Starting forecast calculation for', processedBaselineEntities.length, 'entities');
    const forecasts = new Map<string, Record<string, number>>();
    
    processedBaselineEntities.forEach(entity => {
      const { cmgr, momPatterns, allTransitions } = calculateForecast(entity, monthKeys);
      
      // Find the last month with actual data (not zero)
      let lastMonthKey = monthKeys[monthKeys.length - 1];
      let lastValue = entity.months[lastMonthKey] || 0;
      
      // If last month is zero, find the most recent month with data
      if (lastValue === 0) {
        for (let i = monthKeys.length - 2; i >= 0; i--) {
          const value = entity.months[monthKeys[i]] || 0;
          if (value > 0) {
            lastMonthKey = monthKeys[i];
            lastValue = value;
            break;
          }
        }
      }
      
      // For volatile products, use 3-month average as baseline instead of just last month
      let baselineValue = lastValue;
      if (entity.metricType === "revenue" && monthKeys.length >= 3) {
        const lastThreeMonths = monthKeys.slice(-3).map(key => entity.months[key] || 0).filter(v => v > 0);
        if (lastThreeMonths.length >= 2) {
          const avgLastThree = lastThreeMonths.reduce((sum, v) => sum + v, 0) / lastThreeMonths.length;
          // Calculate volatility (coefficient of variation)
          const stdDev = Math.sqrt(lastThreeMonths.reduce((sum, v) => sum + Math.pow(v - avgLastThree, 2), 0) / lastThreeMonths.length);
          const cv = stdDev / avgLastThree;
          
          // If volatility is high (CV > 0.5), use 3-month average as baseline
          if (cv > 0.5) {
            baselineValue = avgLastThree;
            console.log(`  📈 High volatility (CV=${(cv*100).toFixed(1)}%), using 3-mo avg: $${avgLastThree.toFixed(0)} instead of last month: $${lastValue.toFixed(0)}`);
          }
        }
      }
      
      console.log(`📊 ${entity.entityName}:`, {
        cmgr: (cmgr * 100).toFixed(2) + '%',
        lastMonthKey,
        lastValue,
        baselineValue: baselineValue !== lastValue ? baselineValue : undefined,
        forecastMonths: forecastMonthKeys.length
      });
      
      // Show transitions from trailing 12 months for debugging
      if (Object.keys(allTransitions).length > 0) {
        console.log(`  📅 Month-over-month transitions (from trailing 12 months ONLY):`);
        Object.entries(allTransitions).forEach(([key, transitions]) => {
          const [fromMonth, toMonth] = key.split('-');
          const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          console.log(`    ${monthNames[parseInt(fromMonth)]} → ${monthNames[parseInt(toMonth)]}:`);
          transitions.forEach(t => {
            console.log(`      ${t.date}: $${t.prevValue.toFixed(0)} → $${t.currValue.toFixed(0)} = ${(t.change * 100).toFixed(1)}%`);
          });
          console.log(`      ✅ Using: ${(transitions[transitions.length - 1].change * 100).toFixed(1)}%`);
        });
      }
      
      if (baselineValue === 0) {
        console.warn(`⚠️ ${entity.entityName} has no data, skipping forecast`);
        forecasts.set(entity.entityId, {});
        return;
      }
      
      const lastMonthNum = parseInt(lastMonthKey.split('-')[1]);
      const entityForecastValues: Record<string, number> = {};
      
      // Build forecast sequentially, month by month
      let previousValue = baselineValue;
      let previousMonthNum = lastMonthNum;
      
      forecastMonthKeys.forEach((forecastKey, idx) => {
        const forecastMonthNum = parseInt(forecastKey.split('-')[1]);
        
        // Step 1: Apply historical month-over-month change pattern
        // e.g., Dec '24 → Jan '25 was +2.7%, so apply that to Dec '25 → Jan '26
        const transitionKey = `${previousMonthNum}-${forecastMonthNum}`;
        const historicalChange = momPatterns[transitionKey];
        
        let forecastValue;
        if (historicalChange !== undefined) {
          // Apply historical percentage change: New = Old × (1 + historical %)
          forecastValue = previousValue * (1 + historicalChange);
        } else {
          // No historical pattern, just keep same value
          forecastValue = previousValue;
        }
        
        // Step 2: Multiply by CMGR growth
        forecastValue = forecastValue * (1 + cmgr);
        
        // Log first forecast month (Jan '26) and December for debugging
        if (idx === 0 || forecastMonthNum === 12) {
          const monthName = forecastMonthNum === 12 ? 'Dec' : 'Jan';
          console.log(`  🔮 ${monthName} '26 forecast (${forecastKey}):`, {
            previousValue: `$${previousValue.toFixed(0)}`,
            historicalChange: historicalChange ? `${(historicalChange * 100).toFixed(2)}%` : 'none',
            afterHistorical: historicalChange ? `$${(previousValue * (1 + historicalChange)).toFixed(0)}` : 'same',
            cmgrMultiplier: `×${(1 + cmgr).toFixed(4)}`,
            finalForecast: `$${forecastValue.toFixed(0)}`
          });
        }
        
        entityForecastValues[forecastKey] = forecastValue;
        
        // Update for next iteration
        previousValue = forecastValue;
        previousMonthNum = forecastMonthNum;
      });
      
      console.log(`  → Generated ${Object.keys(entityForecastValues).length} forecast months`);
      forecasts.set(entity.entityId, entityForecastValues);
    });
    
    console.log('✅ Forecast calculation complete. Total forecasts:', forecasts.size);
    return forecasts;
  }, [processedBaselineEntities, monthKeys, forecastMonthKeys]);

  // Fetch saved baseline entities from Firestore
  const fetchBaselineEntities = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const baselineQuery = query(
        collection(db, "forecast_baseline_rows"),
        where("organizationId", "==", organizationId)
      );
      const baselineSnapshot = await getDocs(baselineQuery);
      const entities: BaselineEntity[] = [];
      
      baselineSnapshot.forEach((doc) => {
        const data = doc.data();
        const entity = {
          id: doc.id,
          entityId: data.entityId,
          entityName: data.entityName,
          source: data.source,
          type: data.type,
          metric: data.metric,
          metricType: data.metricType,
          months: data.months || {},
          total: data.total || 0,
        };
        console.log(`📥 Loaded from Firestore: ${entity.entityName}`, {
          months: Object.keys(entity.months),
          total: entity.total
        });
        entities.push(entity);
      });
      
      console.log(`✅ Loaded ${entities.length} baseline entities from Firestore`);
      setBaselineEntities(entities);
    } catch (error) {
      console.error("Error fetching baseline entities:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Add entity to baseline
  const handleAddEntity = async (entity: BaselineEntity) => {
    if (!organizationId) return;
    
    try {
      await addDoc(collection(db, "forecast_baseline_rows"), {
        organizationId,
        entityId: entity.entityId,
        entityName: entity.entityName,
        source: entity.source,
        type: entity.type,
        metric: entity.metric,
        metricType: entity.metricType,
        months: entity.months,
        total: entity.total,
        createdAt: serverTimestamp(),
      });
      
      setSelectedEntityIds(prev => new Set(prev).add(entity.entityId));
      await fetchBaselineEntities();
    } catch (error) {
      console.error("Error adding baseline entity:", error);
    }
  };

  // Remove entity from baseline
  const handleRemoveEntity = async (entityId: string) => {
    if (!organizationId) return;
    
    try {
      const entity = baselineEntities.find(e => e.entityId === entityId);
      if (entity && entity.id) {
        await deleteDoc(doc(db, "forecast_baseline_rows", entity.id));
        setSelectedEntityIds(prev => {
          const next = new Set(prev);
          next.delete(entityId);
          return next;
        });
        await fetchBaselineEntities();
      }
    } catch (error) {
      console.error("Error removing baseline entity:", error);
    }
  };

  // Manually seed specific baseline rows (temporary function)
  const seedManualBaseline = async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      
      // Clear existing baseline
      const existingQuery = query(
        collection(db, "forecast_baseline_rows"),
        where("organizationId", "==", organizationId)
      );
      const existing = await getDocs(existingQuery);
      for (const doc of existing.docs) {
        await deleteDoc(doc.ref);
      }

      // Fetch Homepage data from Google Analytics (14 months - need both years)
      let homepageRow: BaselineEntity | null = null;
      try {
        const startMonth = monthKeys[0];
        const endMonth = monthKeys[monthKeys.length - 1];
        const [startYear] = startMonth.split('-');
        const [endYear] = endMonth.split('-');
        
        const yearsToFetch = [parseInt(startYear)];
        if (parseInt(endYear) !== parseInt(startYear)) {
          yearsToFetch.push(parseInt(endYear));
        }
        
        let homepageData: GAPage | null = null;
        
        for (const year of yearsToFetch) {
          const gaResponse = await fetch(
            `/api/google-analytics/pages?organizationId=${organizationId}&viewMode=year&year=${year}`
          );
          if (gaResponse.ok) {
            const gaData = await gaResponse.json();
            const pages = gaData.pages || [];
            
            // Find homepage (pagePath === "/" or contains "home")
            const homepage = pages.find((p: GAPage) => 
              p.name === "Homepage" || 
              p.name === "/" || 
              p.name?.toLowerCase().includes("home")
            );
            
            if (homepage) {
              if (!homepageData) {
                homepageData = homepage;
              } else {
                // Merge months from multiple years
                if (homepage.months) {
                  if (!homepageData.months) {
                    homepageData.months = {};
                  }
                  Object.assign(homepageData.months, homepage.months);
                }
              }
            }
          }
        }
        
        if (homepageData) {
          const sessionMonths: Record<string, number> = {};
          let totalSessions = 0;
          
          // Extract sessions per month (only within historical window)
          const monthKeysSet = new Set(monthKeys);
          Object.entries(homepageData.months || {}).forEach(([monthKey, metrics]) => {
            if (monthKeysSet.has(monthKey)) {
              const gaMetrics = metrics as GAMetrics;
              const sessions = gaMetrics.sessions || 0;
              sessionMonths[monthKey] = sessions;
              totalSessions += sessions;
            }
          });
          
          if (totalSessions > 0) {
            homepageRow = {
              entityId: `ga_page_${homepageData.id}_sessions`,
              entityName: "Homepage",
              source: "google-analytics-organic",
              type: "Page",
              metric: "Page Sessions",
              metricType: "sessions",
              months: sessionMonths,
              total: totalSessions,
            };
          }
        }
      } catch (error) {
        console.warn("Could not fetch Homepage data:", error);
      }

      // Build the baseline rows array
      const manualRows: BaselineEntity[] = [];
      
      // Row 1: Homepage (if found)
      if (homepageRow) {
        manualRows.push(homepageRow);
      }
      
      // Rows 2-4: Stripe products with hardcoded data (including Nov-Dec 2024)
      // Nov '24 total: $23.7k, Dec '24 total: $37.0k (split ~70/30 based on 2025 ratios)
      manualRows.push(
        {
          entityId: "stripe_product_descriptor_YT JOBS",
          entityName: "YT JOBS",
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: {
            "2024-11": 16590, // Nov '24: ~70% of $23.7k
            "2024-12": 25900, // Dec '24: ~70% of $37.0k
            "2025-01": 26136,
            "2025-02": 23217,
            "2025-03": 23847,
            "2025-04": 26057,
            "2025-05": 28911,
            "2025-06": 20795,
            "2025-07": 17800,
            "2025-08": 25630,
            "2025-09": 40756,
            "2025-10": 42603,
            "2025-11": 45391,
            "2025-12": 42100,
          },
          total: 405733,
        },
        {
          entityId: "stripe_product_unlabeled",
          entityName: "Unlabeled Revenue",
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: {
            "2024-11": 7110, // Nov '24: ~30% of $23.7k
            "2024-12": 11100, // Dec '24: ~30% of $37.0k
            "2025-01": 11256,
            "2025-02": 11668,
            "2025-03": 15518,
            "2025-04": 11953,
            "2025-05": 15766,
            "2025-06": 15344,
            "2025-07": 17895,
            "2025-08": 23814,
            "2025-09": 6456,
            "2025-10": 0,
            "2025-11": 544,
            "2025-12": 296,
          },
          total: 148720,
        },
        {
          entityId: "stripe_product_3month_recruiter",
          entityName: "3-Month Recruiter Package",
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: {
            "2025-01": 998,
            "2025-02": 1497,
            "2025-03": 1996,
            "2025-04": 998,
            "2025-05": 3992,
            "2025-06": 998,
            "2025-07": 499,
            "2025-08": 5988,
            "2025-09": 2994,
            "2025-10": 998,
            "2025-11": 5489,
            "2025-12": 2994,
          },
          total: 29441,
        }
      );

      // Add each row to Firestore
      for (const row of manualRows) {
        await addDoc(collection(db, "forecast_baseline_rows"), {
          organizationId,
          ...row,
          createdAt: serverTimestamp(),
        });
      }

      alert(`✅ Successfully added ${manualRows.length} baseline rows!`);
      await fetchBaselineEntities();
    } catch (error) {
      console.error("Error seeding baseline:", error);
      alert("❌ Error adding baseline rows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchBaselineEntities();
  }, [organizationId, fetchBaselineEntities]);

  // Update selected IDs when baseline entities change
  useEffect(() => {
    const ids = new Set(baselineEntities.map(e => e.entityId));
    setSelectedEntityIds(ids);
  }, [baselineEntities]);

  // Load active forecast version
  useEffect(() => {
    const loadActiveVersion = async () => {
      if (!organizationId) return;
      
      try {
        const active = await getActiveForecastVersion(organizationId);
        setActiveVersion(active);
        console.log("📊 Loaded active forecast version:", active?.name || "None");
      } catch (error) {
        console.error("Error loading active version:", error);
      }
    };

    loadActiveVersion();
  }, [organizationId]);

  // Calculate growth rate for entity
  const calculateGrowthRate = (entity: BaselineEntity) => {
    const values = monthKeys.map(key => entity.months[key] || 0);
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    if (firstAvg === 0) return 0;
    return ((secondAvg - firstAvg) / firstAvg) * 100;
  };

  // Format value based on metric type
  const formatValue = (value: number, metricType: string) => {
    if (metricType === "revenue" || metricType === "expenses") {
      return formatAmount(value);
    }
    // For counts (sessions, users, pageviews, contacts, etc.)
    return value.toLocaleString();
  };
  // Prepare chart data for revenue entities with forecasts
  const revenueChartData = useMemo(() => {
    const revenueEntities = processedBaselineEntities.filter(e => e.metricType === "revenue");
    console.log('📈 Preparing chart data for', revenueEntities.length, 'revenue entities');
    
    if (revenueEntities.length === 0) {
      console.warn('⚠️ No revenue entities found for chart');
      return [];
    }

    // Combine historical and forecast month keys
    const extendedMonthKeys = [...monthKeys, ...forecastMonthKeys];
    console.log('📊 Chart will plot', monthKeys.length, 'historical +', forecastMonthKeys.length, 'forecast =', extendedMonthKeys.length, 'total months');

    const chartData = extendedMonthKeys.map((monthKey: string, index) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const isHistorical = index < monthKeys.length;
      
      if (isHistorical) {
        // Historical data - sum actual values
        let totalRevenue = 0;
        revenueEntities.forEach(entity => {
          totalRevenue += entity.months[monthKey] || 0;
        });
        
        return {
          month: monthLabel,
          actual: totalRevenue > 0 ? Math.round(totalRevenue / 1000) : null,
          forecast: null,
          lower: null,
          upper: null,
        };
      } else {
        // Forecast data - use pre-calculated forecasts
        let forecastRevenue = 0;
        revenueEntities.forEach(entity => {
          const entityForecast = entityForecasts.get(entity.entityId)?.[monthKey] || 0;
          forecastRevenue += entityForecast;
        });
        
        const forecast = Math.round(forecastRevenue / 1000);
        
        return {
          month: monthLabel,
          actual: null,
          forecast: forecast > 0 ? forecast : null,
          lower: forecast > 0 ? Math.round(forecast * 0.85) : null, // 15% confidence band
          upper: forecast > 0 ? Math.round(forecast * 1.15) : null,
        };
      }
    });

    console.log('✅ Chart data generated:', chartData.length, 'points');
    console.log('  Historical points:', chartData.filter(d => d.actual !== null).length);
    console.log('  Forecast points:', chartData.filter(d => d.forecast !== null).length);
    
    // Show sample data points
    if (chartData.length > 0) {
      console.log('  First historical:', chartData.find(d => d.actual !== null));
      console.log('  First forecast:', chartData.find(d => d.forecast !== null));
      console.log('  Last forecast:', chartData.filter(d => d.forecast !== null).pop());
    }
    
    return chartData;
  }, [processedBaselineEntities, monthKeys, forecastMonthKeys, entityForecasts]);

  // Get unique sources and metrics from available entities
  const uniqueSources = Array.from(new Set(availableEntities.map(e => e.source)));
  const uniqueMetrics = Array.from(new Set(availableEntities.map(e => e.metric)));

  // Filter entities based on source and metric
  const filteredAvailableEntities = availableEntities.filter(entity => {
    const matchesSource = filterSource === "all" || entity.source === filterSource;
    const matchesMetric = filterMetric === "all" || entity.metric === filterMetric;
    return matchesSource && matchesMetric;
  });

  // Save current forecast as a new version
  const handleSaveVersion = async () => {
    if (!organizationId || !currentOrg || !versionName.trim()) {
      alert("Please enter a version name");
      return;
    }

    setSaving(true);
    try {
      const entityIds = Array.from(selectedEntityIds);
      
      const versionId = await createForecastVersion(organizationId, {
        name: versionName.trim(),
        description: versionDescription.trim() || undefined,
        createdBy: "user-id", // TODO: Get from auth context
        createdByName: "Current User", // TODO: Get from auth context
        selectedEntityIds: entityIds,
        forecastMonths: forecastMonthKeys.length,
        startMonth: forecastMonthKeys[0],
        status: "published", // Auto-publish for now
      });

      console.log("✅ Saved forecast version:", versionId);
      
      // Reload active version
      const active = await getActiveForecastVersion(organizationId);
      setActiveVersion(active);
      setLoadedVersion(active);
      
      // Reset form
      setVersionName("");
      setVersionDescription("");
      setShowSaveModal(false);
      
      alert(`Forecast version "${versionName}" saved successfully!`);
    } catch (error) {
      console.error("Error saving version:", error);
      alert("Failed to save forecast version");
    } finally {
      setSaving(false);
    }
  };

  // Load a specific forecast version
  const handleLoadVersion = async (version: ForecastVersion) => {
    try {
      setLoadedVersion(version);
      setShowVersionHistory(false);
      console.log("📂 Loaded forecast version:", version.name);
      
      // TODO: Load the baseline entities from the version
      // For now, just marking it as loaded
    } catch (error) {
      console.error("Error loading version:", error);
      alert("Failed to load forecast version");
    }
  };

  return (
    <AppLayout 
      title="Forecasting Model" 
      subtitle="14-month history (Nov '24 - Dec '25) with 12-month projection using CMGR and seasonal patterns"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Version Control Header */}
        <Card className="border-l-4 border-l-[#00d4aa]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[#00d4aa]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {loadedVersion ? `Version: ${loadedVersion.name}` : "Current Forecast"}
                    </span>
                    {hasUnsavedChanges && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                        Unsaved
                      </span>
                    )}
                    {loadedVersion?.status === "published" && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[#00d4aa]/20 text-[#00d4aa]">
                        Published
                      </span>
                    )}
                  </div>
                  {loadedVersion && (
                    <p className="text-xs text-gray-500 mt-1">
                      {loadedVersion.description || "No description"}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVersionHistory(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
                style={{ 
                  background: "var(--muted)",
                  color: "var(--foreground-muted)",
                }}
              >
                <History className="w-4 h-4" />
                <span className="text-sm">Version History</span>
              </button>
              
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90"
              >
                <Save className="w-4 h-4" />
                <span className="text-sm">Save Version</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Revenue Forecast Visualization */}
        {revenueChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    Revenue Forecast
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    className="p-2 rounded-lg transition-all duration-200"
                    style={{ 
                      background: "var(--muted)",
                      color: "var(--foreground-muted)",
                    }}
                    title="Download chart"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 rounded-lg transition-all duration-200"
                    style={{ 
                      background: "var(--muted)",
                      color: "var(--foreground-muted)",
                    }}
                    title="Share chart"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="h-80 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="month" 
                      stroke="var(--foreground-muted)"
                      tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="var(--foreground-muted)"
                      tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                      tickFormatter={(value: number) => `$${value}K`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: "var(--card)", 
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--foreground)",
                      }}
                      formatter={(value) => `$${value ?? 0}K`}
                    />
                    <Area
                      type="monotone"
                      dataKey="upper"
                      stroke="transparent"
                      fill="url(#colorConfidence)"
                      name=""
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      stroke="transparent"
                      fill="var(--background)"
                      name=""
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#00d4aa"
                      strokeWidth={3}
                      dot={{ fill: "#00d4aa", strokeWidth: 2, r: 4 }}
                      name=""
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                      name=""
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Totals */}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="grid grid-cols-2 gap-6">
                  {/* Historical Total */}
                  <div className="text-center p-4 rounded-lg" style={{ background: "rgba(0, 212, 170, 0.05)" }}>
                    <div className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                      Historical Revenue (12 months)
                    </div>
                    <div className="text-2xl font-bold" style={{ color: "#00d4aa" }}>
                      {(() => {
                        const revenueEntities = processedBaselineEntities.filter(e => e.metricType === "revenue");
                        const lastTwelveMonths = monthKeys.slice(-12);
                        const total = revenueEntities.reduce((sum, entity) => {
                          return sum + lastTwelveMonths.reduce((monthSum, key) => monthSum + (entity.months[key] || 0), 0);
                        }, 0);
                        return formatAmount(total);
                      })()}
                    </div>
                  </div>
                  
                  {/* Forecast Total */}
                  <div className="text-center p-4 rounded-lg" style={{ background: "rgba(59, 130, 246, 0.05)" }}>
                    <div className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                      Projected Revenue (12 months)
                    </div>
                    <div className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
                      {(() => {
                        const revenueEntities = processedBaselineEntities.filter(e => e.metricType === "revenue");
                        const total = revenueEntities.reduce((sum, entity) => {
                          return sum + forecastMonthKeys.reduce((monthSum, key) => {
                            const entityForecast = entityForecasts.get(entity.entityId)?.[key] || 0;
                            return monthSum + entityForecast;
                          }, 0);
                        }, 0);
                        return formatAmount(total);
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Baseline Revenue Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Baseline Forecast Data
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Traffic → Signups → Revenue patterns and seasonality
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={seedManualBaseline}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
                  style={{ 
                    background: "#10b981",
                    color: "white"
                  }}
                  title="Add sample funnel: Homepage traffic + 3 revenue products"
                >
                  <Zap className="w-4 h-4" />
                  Seed Baseline
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    await fetchBaselineEntities();
                    setLoading(false);
                  }}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
                  style={{ 
                    background: "#3b82f6",
                    color: "white"
                  }}
                  title="Recalculate forecasts with current baseline data"
                >
                  <TrendingUp className="w-4 h-4" />
                  Regenerate Forecast
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading baseline data...</p>
              </div>
            ) : processedBaselineEntities.length === 0 ? (
              <div className="text-center py-12" style={{ background: "var(--muted)", borderRadius: "8px" }}>
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  No baseline metrics selected
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                  Build your funnel: Add traffic (GA Sessions), signups (Contacts), and revenue (Products)
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)", fontStyle: "italic" }}>
                  Tip: Include multiple metrics to see conversion rates and seasonal patterns
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-3 px-4 text-xs font-semibold sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground-muted)" }}>
                        Entity
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        Metric
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        Growth
                      </th>
                      {monthKeys.map((key) => {
                        const [year, month] = key.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1);
                        return (
                          <th key={key} className="text-right py-3 px-4 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--foreground-muted)" }}>
                            {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                          </th>
                        );
                      })}
                      {forecastMonthKeys.map((key) => {
                        const [year, month] = key.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1);
                        return (
                          <th key={key} className="text-right py-3 px-4 text-xs font-semibold whitespace-nowrap" style={{ color: "#3b82f6", background: "rgba(59, 130, 246, 0.05)" }}>
                            {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                          </th>
                        );
                      })}
                      <th className="text-center py-3 px-4 text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedBaselineEntities.map((entity) => {
                      const growth = calculateGrowthRate(entity);
                      
                      return (
                        <tr key={entity.entityId} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="py-3 px-4 text-sm sticky left-0 z-10" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                            {entity.entityName}
                          </td>
                          <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-muted)" }}>
                            {entity.metric}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium"
                              style={{ color: growth >= 0 ? "#00d4aa" : "#ef4444" }}
                            >
                              {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(growth).toFixed(1)}%
                            </span>
                          </td>
                          {monthKeys.map((key) => {
                            const value = entity.months[key] || 0;
                            return (
                              <td key={key} className="py-3 px-4 text-sm text-right whitespace-nowrap" style={{ color: value > 0 ? "var(--foreground)" : "var(--foreground-muted)" }}>
                                {value > 0 ? formatValue(value, entity.metricType) : "—"}
                              </td>
                            );
                          })}
                          {forecastMonthKeys.map((key) => {
                            const forecastValue = entityForecasts.get(entity.entityId)?.[key] || 0;
                            return (
                              <td key={key} className="py-3 px-4 text-sm text-right whitespace-nowrap font-medium" style={{ color: "#3b82f6", background: "rgba(59, 130, 246, 0.05)" }}>
                                {forecastValue > 0 ? formatValue(forecastValue, entity.metricType) : "—"}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleRemoveEntity(entity.entityId)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              style={{ color: "#ef4444" }}
                              title="Remove from baseline"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Initiative Forecasts Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Initiative Forecasts
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Expected revenue impact from planned initiatives
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
                style={{ 
                  background: "#3b82f6",
                  color: "white"
                }}
              >
                Add Forecast
              </button>
            </div>

            <div className="text-center py-12" style={{ background: "var(--muted)", borderRadius: "8px" }}>
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                No initiative forecasts yet
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                Add revenue forecasts for your initiatives to see their projected impact
              </p>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Entity Selector Modal */}
      {showSelectorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl"
            style={{ background: "white" }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    Build Your Forecast Model
                  </h3>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Select traffic, signups, revenue, and other metrics to analyze patterns and seasonality
                  </p>
                </div>
                <button
                  onClick={() => setShowSelectorModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--foreground-muted)" }}>
                    Source
                  </label>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="all">All Sources ({availableEntities.length})</option>
                    {uniqueSources.map((source) => {
                      const count = availableEntities.filter(e => e.source === source).length;
                      return (
                        <option key={source} value={source}>
                          {source.charAt(0).toUpperCase() + source.slice(1)} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--foreground-muted)" }}>
                    Metric
                  </label>
                  <select
                    value={filterMetric}
                    onChange={(e) => setFilterMetric(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="all">All Metrics ({availableEntities.length})</option>
                    {uniqueMetrics.map((metric) => {
                      const count = availableEntities.filter(e => e.metric === metric).length;
                      return (
                        <option key={metric} value={metric}>
                          {metric} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {(filterSource !== "all" || filterMetric !== "all") && (
                  <button
                    onClick={() => {
                      setFilterSource("all");
                      setFilterMetric("all");
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100 self-end"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {modalLoading ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading available entities...</p>
                </div>
              ) : availableEntities.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    No entities available
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Connect data sources to view available entities
                  </p>
                </div>
              ) : filteredAvailableEntities.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    No entities match your filters
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Try adjusting your source or metric filters
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                      Showing {filteredAvailableEntities.length} of {availableEntities.length} entities
                    </p>
                  </div>
                  <div className="space-y-2">
                    {filteredAvailableEntities.map((entity) => {
                      const isSelected = selectedEntityIds.has(entity.entityId);
                      
                      return (
                        <div
                          key={entity.entityId}
                          className="flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm cursor-pointer"
                          style={{
                            borderColor: isSelected ? "#3b82f6" : "var(--border)",
                            background: isSelected ? "rgba(59, 130, 246, 0.05)" : "var(--background)",
                          }}
                          onClick={() => {
                            if (isSelected) {
                              handleRemoveEntity(entity.entityId);
                            } else {
                              handleAddEntity(entity);
                            }
                          }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ 
                                  background: isSelected ? "rgba(59, 130, 246, 0.1)" : "var(--muted)",
                                  color: isSelected ? "#3b82f6" : "var(--foreground-muted)"
                                }}
                              >
                                {isSelected ? <Check className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                                  {entity.entityName}
                                </p>
                                <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>
                                  {entity.metric} • {entity.source.toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                            {formatValue(entity.total, entity.metricType)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                            {entity.metricType === "revenue" ? "Total" : "Count"}
                          </p>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {selectedEntityIds.size} row{selectedEntityIds.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => setShowSelectorModal(false)}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
                  style={{ 
                    background: "#3b82f6",
                    color: "white"
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Save Version Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full"
          >
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Save Forecast Version
                </h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    Version Name *
                  </label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="e.g., Q1 2026 Conservative"
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    Description (Optional)
                  </label>
                  <textarea
                    value={versionDescription}
                    onChange={(e) => setVersionDescription(e.target.value)}
                    placeholder="What assumptions or changes does this version include?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border resize-none"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <div className="p-3 rounded-lg" style={{ background: "var(--muted)" }}>
                  <div className="flex items-start gap-2">
                    <GitBranch className="w-4 h-4 text-[#00d4aa] mt-0.5" />
                    <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      <p className="mb-1">This will save the current forecast as a new version, including:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>{selectedEntityIds.size} selected entities</li>
                        <li>{forecastMonthKeys.length} months of projections</li>
                        <li>All CMGR calculations and seasonal patterns</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--foreground-muted)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveVersion}
                    disabled={!versionName.trim() || saving}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "Saving..." : "Save Version"}
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl w-full max-h-[80vh]"
          >
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Forecast Version History
                </h3>
                <button
                  onClick={() => setShowVersionHistory(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ForecastVersionSelector
                organizationId={organizationId}
                onSelect={handleLoadVersion}
                selectedVersionId={loadedVersion?.id}
              />
            </Card>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
