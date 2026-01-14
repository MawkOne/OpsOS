"use client";

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
  Plus,
  X,
  Check,
  Download,
  Share2,
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
  Legend,
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

interface LineItem {
  productId?: string;
  description?: string;
  amount?: number;
  quantity?: number;
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

interface GASource {
  name: string;
  sessions?: Record<string, number>;
  users?: Record<string, number>;
}

export default function ForecastsPage() {
  const { currentOrg } = useOrganization();
  const { formatAmount } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [baselineEntities, setBaselineEntities] = useState<BaselineEntity[]>([]);
  const [viewMode, setViewMode] = useState<"ttm" | "year">("year");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [availableEntities, setAvailableEntities] = useState<BaselineEntity[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [modalLoading, setModalLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterMetric, setFilterMetric] = useState<string>("all");

  const organizationId = currentOrg?.id || "";

  // Generate month keys based on view mode
  const getMonthKeys = useCallback(() => {
    const keys: string[] = [];
    const now = new Date();
    
    if (viewMode === "ttm") {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else {
      // Selected year
      for (let i = 1; i <= 12; i++) {
        keys.push(`${selectedYear}-${String(i).padStart(2, '0')}`);
      }
    }
    
    return keys;
  }, [viewMode, selectedYear]);

  const monthKeys = getMonthKeys();

  // Generate forecast month keys (next 6 months)
  const forecastMonthKeys = useMemo(() => {
    const keys: string[] = [];
    const lastMonthKey = monthKeys[monthKeys.length - 1];
    const [year, month] = lastMonthKey.split('-');
    const lastDate = new Date(parseInt(year), parseInt(month) - 1);
    
    for (let i = 1; i <= 6; i++) {
      const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i);
      const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      keys.push(nextMonthKey);
    }
    
    return keys;
  }, [monthKeys]);

  // Calculate CMGR (Compound Monthly Growth Rate) and seasonal patterns
  const calculateForecast = (entity: BaselineEntity, monthKeys: string[]) => {
    const values = monthKeys.map(key => entity.months[key] || 0).filter(v => v > 0);
    if (values.length < 3) return { cmgr: 0, seasonalFactors: {} };

    // Calculate CMGR (Compound Monthly Growth Rate)
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const months = values.length - 1;
    const cmgr = months > 0 ? Math.pow(lastValue / firstValue, 1 / months) - 1 : 0;

    // Calculate seasonal factors (average for each month position)
    const monthlyAverages: Record<number, number[]> = {};
    monthKeys.forEach((key) => {
      const value = entity.months[key] || 0;
      if (value > 0) {
        const monthNum = parseInt(key.split('-')[1]);
        if (!monthlyAverages[monthNum]) monthlyAverages[monthNum] = [];
        monthlyAverages[monthNum].push(value);
      }
    });

    // Calculate average for each month and normalize
    const avgByMonth: Record<number, number> = {};
    let overallAvg = 0;
    let monthCount = 0;
    
    Object.entries(monthlyAverages).forEach(([month, vals]) => {
      const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      avgByMonth[parseInt(month)] = avg;
      overallAvg += avg;
      monthCount++;
    });
    
    overallAvg = overallAvg / monthCount;

    // Normalize seasonal factors (1.0 = average, >1 = above average, <1 = below average)
    const seasonalFactors: Record<number, number> = {};
    Object.entries(avgByMonth).forEach(([month, avg]) => {
      seasonalFactors[parseInt(month)] = overallAvg > 0 ? avg / overallAvg : 1.0;
    });

    return { cmgr, seasonalFactors };
  };

  // Pre-calculate forecasts for all entities (memoized for performance)
  const entityForecasts = useMemo(() => {
    const forecasts = new Map<string, Record<string, number>>();
    
    baselineEntities.forEach(entity => {
      const { cmgr, seasonalFactors } = calculateForecast(entity, monthKeys);
      const lastMonthKey = monthKeys[monthKeys.length - 1];
      const lastValue = entity.months[lastMonthKey] || 0;
      
      if (lastValue === 0) {
        forecasts.set(entity.entityId, {});
        return;
      }
      
      const lastDate = new Date(parseInt(lastMonthKey.split('-')[0]), parseInt(lastMonthKey.split('-')[1]) - 1);
      const entityForecastValues: Record<string, number> = {};
      
      forecastMonthKeys.forEach(forecastKey => {
        const forecastDate = new Date(parseInt(forecastKey.split('-')[0]), parseInt(forecastKey.split('-')[1]) - 1);
        const monthsAhead = (forecastDate.getFullYear() - lastDate.getFullYear()) * 12 + (forecastDate.getMonth() - lastDate.getMonth());
        
        // Apply CMGR growth
        const projectedValue = lastValue * Math.pow(1 + cmgr, monthsAhead);
        
        // Apply seasonal factor
        const monthNum = parseInt(forecastKey.split('-')[1]);
        const seasonalFactor = seasonalFactors[monthNum] || 1.0;
        const forecastValue = projectedValue * seasonalFactor;
        
        entityForecastValues[forecastKey] = forecastValue;
      });
      
      forecasts.set(entity.entityId, entityForecastValues);
    });
    
    return forecasts;
  }, [baselineEntities, monthKeys, forecastMonthKeys]);

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
        entities.push({
          id: doc.id,
          entityId: data.entityId,
          entityName: data.entityName,
          source: data.source,
          type: data.type,
          metric: data.metric,
          metricType: data.metricType,
          months: data.months || {},
          total: data.total || 0,
        });
      });
      
      setBaselineEntities(entities);
    } catch (error) {
      console.error("Error fetching baseline entities:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Fetch available entities from Master Table sources (ALL metrics, not just revenue)
  const fetchAvailableEntities = useCallback(async () => {
    if (!organizationId) return;
    
    setModalLoading(true);
    try {
      const entities: BaselineEntity[] = [];
      
      console.log("🔍 Fetching all available entities for forecast model...");
      
      // Fetch Stripe products for name lookup
      const productsQuery = query(
        collection(db, "stripe_products"),
        where("organizationId", "==", organizationId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const products = new Map<string, string>();
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        products.set(data.stripeId, data.name);
      });

      // Fetch all invoices
      const invoicesQuery = query(
        collection(db, "stripe_invoices"),
        where("organizationId", "==", organizationId)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);

      // Calculate revenue by product and month
      const productRevenue: Record<string, { name: string; months: Record<string, number>; total: number; count: Record<string, number> }> = {};
      
      // Track which invoices we've processed
      const countedInvoiceIds = new Set<string>();
      
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data();
        if (invoice.status !== "paid") return;

        if (invoice.stripeId) countedInvoiceIds.add(invoice.stripeId);

        const invoiceDate = invoice.created?.toDate();
        if (!invoiceDate) return;

        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        const invoiceAmount = (invoice.total || 0) / 100;

        const lineItems = invoice.lineItems || [];
        
        if (lineItems.length > 0) {
          let hasValidProduct = false;
          
          lineItems.forEach((item: LineItem) => {
            const productId = item.productId;
            
            if (productId) {
              hasValidProduct = true;
              const productName = products.get(productId) || item.description || 'Unknown Product';
              const itemAmount = ((item.amount || 0) / 100) * (item.quantity || 1);
              
              if (!productRevenue[productId]) {
                productRevenue[productId] = {
                  name: productName,
                  months: {},
                  total: 0,
                  count: {},
                };
              }
              
              productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + itemAmount;
              productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + (item.quantity || 1);
              productRevenue[productId].total += itemAmount;
            }
          });
          
          // If line items exist but none have productId
          if (!hasValidProduct) {
            const unlabeledId = 'unlabeled';
            if (!productRevenue[unlabeledId]) {
              productRevenue[unlabeledId] = {
                name: 'Unlabeled Revenue',
                months: {},
                total: 0,
                count: {},
              };
            }
            productRevenue[unlabeledId].months[monthKey] = (productRevenue[unlabeledId].months[monthKey] || 0) + invoiceAmount;
            productRevenue[unlabeledId].count[monthKey] = (productRevenue[unlabeledId].count[monthKey] || 0) + 1;
            productRevenue[unlabeledId].total += invoiceAmount;
          }
        } else {
          // No line items at all
          const unlabeledId = 'unlabeled';
          if (!productRevenue[unlabeledId]) {
            productRevenue[unlabeledId] = {
              name: 'Unlabeled Revenue',
              months: {},
              total: 0,
              count: {},
            };
          }
          productRevenue[unlabeledId].months[monthKey] = (productRevenue[unlabeledId].months[monthKey] || 0) + invoiceAmount;
          productRevenue[unlabeledId].count[monthKey] = (productRevenue[unlabeledId].count[monthKey] || 0) + 1;
          productRevenue[unlabeledId].total += invoiceAmount;
        }
      });

      // Fetch Stripe payments (direct charges without invoices)
      const paymentsQuery = query(
        collection(db, "stripe_payments"),
        where("organizationId", "==", organizationId),
        where("status", "==", "succeeded")
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data();
        
        // Skip if this payment's invoice was already counted
        if (payment.invoiceId && countedInvoiceIds.has(payment.invoiceId)) {
          return;
        }
        
        const paymentDate = payment.created?.toDate?.() || new Date();
        const monthKey = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, "0")}`;
        const paymentAmount = (payment.amount || 0) / 100;
        
        const lineItems = payment.lineItems || [];
        
        if (lineItems.length > 0) {
          // Has line items
          lineItems.forEach((item: LineItem) => {
            const productId = item.productId;
            
            if (productId) {
              const productName = products.get(productId) || item.description || 'Unknown Product';
              const itemAmount = ((item.amount || 0) / 100) * (item.quantity || 1);
              
              if (!productRevenue[productId]) {
                productRevenue[productId] = {
                  name: productName,
                  months: {},
                  total: 0,
                  count: {},
                };
              }
              
              productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + itemAmount;
              productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + (item.quantity || 1);
              productRevenue[productId].total += itemAmount;
            }
          });
        } else {
          // No line items - use statement descriptor or categorize as unlabeled
          const statementDescriptor = payment.calculatedStatementDescriptor || payment.statementDescriptor;
          
          if (statementDescriptor) {
            // Use statement descriptor as product identifier
            const productId = `descriptor_${statementDescriptor}`;
            const productName = statementDescriptor;
            
            if (!productRevenue[productId]) {
              productRevenue[productId] = {
                name: productName,
                months: {},
                total: 0,
                count: {},
              };
            }
            
            productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + paymentAmount;
            productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + 1;
            productRevenue[productId].total += paymentAmount;
          } else {
            // Truly unlabeled
            const unlabeledId = 'unlabeled';
            if (!productRevenue[unlabeledId]) {
              productRevenue[unlabeledId] = {
                name: 'Unlabeled Revenue',
                months: {},
                total: 0,
                count: {},
              };
            }
            productRevenue[unlabeledId].months[monthKey] = (productRevenue[unlabeledId].months[monthKey] || 0) + paymentAmount;
            productRevenue[unlabeledId].count[monthKey] = (productRevenue[unlabeledId].count[monthKey] || 0) + 1;
            productRevenue[unlabeledId].total += paymentAmount;
          }
        }
      });

      // Convert Stripe products to entities
      Object.entries(productRevenue).forEach(([productId, data]) => {
        entities.push({
          entityId: `stripe_product_${productId}`,
          entityName: data.name,
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: data.months,
          total: data.total,
        });
      });

      console.log(`✅ Added ${Object.keys(productRevenue).length} Stripe product entities`);

      // Fetch Google Analytics traffic/organic data
      try {
        const gaResponse = await fetch(
          `/api/google-analytics/organic?organizationId=${organizationId}`
        );
        if (gaResponse.ok) {
          const gaData = await gaResponse.json();
          const sources = gaData.data || [];
          
          sources.forEach((sourceData: GASource) => {
            const sourceName = sourceData.name || "Unknown Source";
            
            // Sessions metric
            if (sourceData.sessions) {
              const sessionMonths: Record<string, number> = {};
              let totalSessions = 0;
              
              Object.entries(sourceData.sessions || {}).forEach(([monthKey, value]: [string, number]) => {
                sessionMonths[monthKey] = value as number;
                totalSessions += value as number;
              });
              
              if (totalSessions > 0) {
                entities.push({
                  entityId: `ga_organic_${sourceName}_sessions`,
                  entityName: sourceName,
                  source: "google-analytics-organic",
                  type: "Traffic Source",
                  metric: "Sessions",
                  metricType: "sessions",
                  months: sessionMonths,
                  total: totalSessions,
                });
              }
            }
            
            // Users metric
            if (sourceData.users) {
              const userMonths: Record<string, number> = {};
              let totalUsers = 0;
              
              Object.entries(sourceData.users || {}).forEach(([monthKey, value]: [string, number]) => {
                userMonths[monthKey] = value as number;
                totalUsers += value as number;
              });
              
              if (totalUsers > 0) {
                entities.push({
                  entityId: `ga_organic_${sourceName}_users`,
                  entityName: sourceName,
                  source: "google-analytics-organic",
                  type: "Traffic Source",
                  metric: "Users",
                  metricType: "users",
                  months: userMonths,
                  total: totalUsers,
                });
              }
            }
          });
          
          console.log(`✅ Added ${sources.length * 2} Google Analytics traffic entities`);
        }
      } catch (error) {
        console.warn("Could not fetch GA organic data:", error);
      }

      // Fetch Google Analytics page data
      try {
        const gaPagesResponse = await fetch(
          `/api/google-analytics/pages?organizationId=${organizationId}&viewMode=year&year=2025`
        );
        if (gaPagesResponse.ok) {
          const gaData = await gaPagesResponse.json();
          const pages = gaData.pages || [];
          
          pages.forEach((pageData: GAPage) => {
            const pageName = pageData.name || "Unknown Page";
            
            // Page Sessions
            const sessionMonths: Record<string, number> = {};
            let totalSessions = 0;
            
            Object.entries(pageData.months || {}).forEach(([monthKey, metrics]: [string, GAMetrics]) => {
              const sessions = metrics.sessions || 0;
              sessionMonths[monthKey] = sessions;
              totalSessions += sessions;
            });
            
            if (totalSessions > 0) {
              entities.push({
                entityId: `ga_page_${pageData.id}_sessions`,
                entityName: pageName,
                source: "google-analytics-organic",
                type: "Page",
                metric: "Page Sessions",
                metricType: "sessions",
                months: sessionMonths,
                total: totalSessions,
              });
            }
            
            // Pageviews
            const pageviewMonths: Record<string, number> = {};
            let totalPageviews = 0;
            
            Object.entries(pageData.months || {}).forEach(([monthKey, metrics]: [string, GAMetrics]) => {
              const pageviews = metrics.pageviews || 0;
              pageviewMonths[monthKey] = pageviews;
              totalPageviews += pageviews;
            });
            
            if (totalPageviews > 0) {
              entities.push({
                entityId: `ga_page_${pageData.id}_pageviews`,
                entityName: pageName,
                source: "google-analytics-organic",
                type: "Page",
                metric: "Pageviews",
                metricType: "pageviews",
                months: pageviewMonths,
                total: totalPageviews,
              });
            }
          });
          
          console.log(`✅ Added ${pages.length * 2} Google Analytics page entities`);
        }
      } catch (error) {
        console.warn("Could not fetch GA pages data:", error);
      }

      // Fetch ActiveCampaign contact growth (signups)
      try {
        const contactCountsQuery = query(
          collection(db, "activecampaign_contact_counts"),
          where("organizationId", "==", organizationId)
        );
        const contactCountsSnapshot = await getDocs(contactCountsQuery);
        
        if (contactCountsSnapshot.size > 0) {
          const contactGrowth: Record<string, number> = {};
          const sortedCounts = contactCountsSnapshot.docs
            .map((doc) => doc.data())
            .sort((a, b) => a.date.localeCompare(b.date));

          for (let i = 1; i < sortedCounts.length; i++) {
            const current = sortedCounts[i];
            const previous = sortedCounts[i - 1];
            const growth = Math.max(0, current.count - previous.count);
            const date = new Date(current.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

            if (growth > 0) {
              contactGrowth[monthKey] = (contactGrowth[monthKey] || 0) + growth;
            }
          }

          const totalGrowth = Object.values(contactGrowth).reduce((sum, val) => sum + val, 0);
          if (totalGrowth > 0) {
            entities.push({
              entityId: "activecampaign_contacts_growth",
              entityName: "Contact Growth",
              source: "activecampaign",
              type: "Contacts",
              metric: "New Contacts",
              metricType: "newContacts",
              months: contactGrowth,
              total: totalGrowth,
            });
            console.log(`✅ Added ActiveCampaign contact growth entity`);
          }
        }
      } catch (error) {
        console.warn("Could not fetch ActiveCampaign contact data:", error);
      }

      // Sort by total (descending)
      entities.sort((a, b) => b.total - a.total);
      
      console.log(`📊 Total entities available for forecast: ${entities.length}`);
      setAvailableEntities(entities);
    } catch (error) {
      console.error("Error fetching available entities:", error);
    } finally {
      setModalLoading(false);
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

      // Fetch Homepage data from Google Analytics
      let homepageRow: BaselineEntity | null = null;
      try {
        const gaResponse = await fetch(
          `/api/google-analytics/pages?organizationId=${organizationId}&viewMode=year&year=2025`
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
            const sessionMonths: Record<string, number> = {};
            let totalSessions = 0;
            
            // Extract sessions per month
            Object.entries(homepage.months || {}).forEach(([monthKey, metrics]) => {
              const gaMetrics = metrics as GAMetrics;
              const sessions = gaMetrics.sessions || 0;
              sessionMonths[monthKey] = sessions;
              totalSessions += sessions;
            });
            
            if (totalSessions > 0) {
              homepageRow = {
                entityId: `ga_page_${homepage.id}_sessions`,
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
      
      // Rows 2-4: Stripe products with hardcoded data
      manualRows.push(
        {
          entityId: "stripe_product_descriptor_YT JOBS",
          entityName: "YT JOBS",
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: {
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
          total: 363243,
        },
        {
          entityId: "stripe_product_unlabeled",
          entityName: "Unlabeled Revenue",
          source: "stripe",
          type: "Product",
          metric: "Product Revenue",
          metricType: "revenue",
          months: {
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
          total: 130510,
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
    const revenueEntities = baselineEntities.filter(e => e.metricType === "revenue");
    if (revenueEntities.length === 0) return [];

    // Combine historical and forecast month keys
    const extendedMonthKeys = [...monthKeys, ...forecastMonthKeys];

    const chartData = extendedMonthKeys.map((monthKey: string, index) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
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

    return chartData;
  }, [baselineEntities, monthKeys, forecastMonthKeys, entityForecasts]);

  // Get unique sources and metrics from available entities
  const uniqueSources = Array.from(new Set(availableEntities.map(e => e.source)));
  const uniqueMetrics = Array.from(new Set(availableEntities.map(e => e.metric)));

  // Filter entities based on source and metric
  const filteredAvailableEntities = availableEntities.filter(entity => {
    const matchesSource = filterSource === "all" || entity.source === filterSource;
    const matchesMetric = filterMetric === "all" || entity.metric === filterMetric;
    return matchesSource && matchesMetric;
  });

  return (
    <AppLayout 
      title="Forecasting Model" 
      subtitle="Traffic, signups, revenue patterns and initiative impacts"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("ttm")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "ttm"
                  ? "shadow-sm"
                  : ""
              }`}
              style={{
                background: viewMode === "ttm" ? "var(--accent)" : "var(--muted)",
                color: viewMode === "ttm" ? "white" : "var(--foreground-muted)",
              }}
            >
              Last 12 Months
            </button>
            <button
              onClick={() => setViewMode("year")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "year"
                  ? "shadow-sm"
                  : ""
              }`}
              style={{
                background: viewMode === "year" ? "var(--accent)" : "var(--muted)",
                color: viewMode === "year" ? "white" : "var(--foreground-muted)",
              }}
            >
              Year
            </button>
          </div>

          {viewMode === "year" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: "var(--foreground-muted)" }}
              >
                ←
              </button>
              <span className="text-sm font-medium px-4" style={{ color: "var(--foreground)" }}>
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: "var(--foreground-muted)" }}
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Revenue Forecast Visualization */}
        {revenueChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                    Revenue Forecast
                  </h2>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    Historical revenue with projected growth patterns
                  </p>
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
                      formatter={(value) => [`$${value ?? 0}K`, ""]}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="upper"
                      stroke="transparent"
                      fill="url(#colorConfidence)"
                      name="Upper Bound"
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      stroke="transparent"
                      fill="var(--background)"
                      name="Lower Bound"
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#00d4aa"
                      strokeWidth={3}
                      dot={{ fill: "#00d4aa", strokeWidth: 2, r: 4 }}
                      name="Actual Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                      name="Forecast"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#00d4aa" }} />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Historical Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#3b82f6" }} />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Forecast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-3 rounded" style={{ background: "rgba(59, 130, 246, 0.2)" }} />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>95% Confidence</span>
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
                  onClick={() => {
                    setShowSelectorModal(true);
                    setFilterSource("all");
                    setFilterMetric("all");
                    fetchAvailableEntities();
                  }}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
                  style={{ 
                    background: "#3b82f6",
                    color: "white"
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Manage Baseline
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading baseline data...</p>
              </div>
            ) : baselineEntities.length === 0 ? (
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
                    {baselineEntities.map((entity) => {
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
    </AppLayout>
  );
}
