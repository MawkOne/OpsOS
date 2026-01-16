/**
 * Shared utility for fetching and managing Master Table data
 * This ensures consistency across the app when referencing line items
 */

import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface MasterTableEntity {
  id: string;
  entityId: string;
  entityName: string;
  source: "stripe" | "quickbooks" | "google-analytics" | "google-analytics-organic" | "activecampaign";
  type: string;
  metric: string;
  metricType: "revenue" | "expenses" | "engagement" | "sales" | "sessions" | "pageviews" | "email" | "spend" | "clicks" | "impressions" | "conversions";
  months: Record<string, number>;
  total: number;
}

export interface MasterTableFilters {
  metricType?: MasterTableEntity["metricType"] | MasterTableEntity["metricType"][];
  source?: MasterTableEntity["source"] | MasterTableEntity["source"][];
  minTotal?: number;
  searchTerm?: string;
}

/**
 * Fetch all Master Table entities for an organization
 */
export async function fetchMasterTableEntities(
  organizationId: string,
  filters?: MasterTableFilters
): Promise<MasterTableEntity[]> {
  try {
    console.log("📊 Fetching Master Table entities for org:", organizationId, "with filters:", filters);
    const entities: MasterTableEntity[] = [];

    // Fetch Stripe data
    await fetchStripeEntities(organizationId, entities);
    console.log(`  → After Stripe: ${entities.length} entities`);
    
    // Fetch QuickBooks data
    await fetchQuickBooksEntities(organizationId, entities);
    console.log(`  → After QuickBooks: ${entities.length} entities`);
    
    // Fetch Google Ads data
    await fetchGoogleAdsEntities(organizationId, entities);
    console.log(`  → After Google Ads: ${entities.length} entities`);
    
    // Fetch Google Analytics data
    await fetchGoogleAnalyticsEntities(organizationId, entities);
    console.log(`  → After Google Analytics: ${entities.length} entities`);
    
    // Fetch ActiveCampaign data
    await fetchActiveCampaignEntities(organizationId, entities);
    console.log(`  → After ActiveCampaign: ${entities.length} entities`);

    // Log entity sources before filtering
    const sourceCounts = entities.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("  📋 Entities by source before filtering:", sourceCounts);

    // Apply filters
    let filtered = entities;
    
    if (filters) {
      if (filters.metricType) {
        const metricTypes = Array.isArray(filters.metricType) ? filters.metricType : [filters.metricType];
        const beforeCount = filtered.length;
        filtered = filtered.filter(e => metricTypes.includes(e.metricType));
        console.log(`  🔍 MetricType filter (${metricTypes.join(', ')}): ${beforeCount} → ${filtered.length} entities`);
      }
      
      if (filters.source) {
        const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
        const beforeCount = filtered.length;
        filtered = filtered.filter(e => sources.includes(e.source));
        console.log(`  🔍 Source filter (${sources.join(', ')}): ${beforeCount} → ${filtered.length} entities`);
      }
      
      if (filters.minTotal !== undefined) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(e => e.total >= filters.minTotal!);
        console.log(`  🔍 MinTotal filter (>= ${filters.minTotal}): ${beforeCount} → ${filtered.length} entities`);
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const beforeCount = filtered.length;
        filtered = filtered.filter(e => 
          e.entityName.toLowerCase().includes(term) ||
          e.metric.toLowerCase().includes(term)
        );
        console.log(`  🔍 Search filter ("${term}"): ${beforeCount} → ${filtered.length} entities`);
      }
    }

    // Log final entity sources after filtering
    const filteredSourceCounts = filtered.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("  📋 Entities by source after filtering:", filteredSourceCounts);

    // Sort by total descending
    filtered.sort((a, b) => b.total - a.total);

    console.log(`✅ Loaded ${filtered.length} entities (${entities.length} total before filtering)`);
    return filtered;
  } catch (error) {
    console.error("❌ Error fetching Master Table entities:", error);
    return [];
  }
}

/**
 * Fetch Stripe entities
 */
async function fetchStripeEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    console.log("  💳 Fetching Stripe data for org:", organizationId);
    
    // Fetch products for name lookup
    const productsQuery = query(
      collection(db, "stripe_products"),
      where("organizationId", "==", organizationId)
    );
    const productsSnap = await getDocs(productsQuery);
    const products = new Map<string, string>();
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      products.set(data.stripeId, data.name);
    });
    console.log(`    → Found ${products.size} Stripe products`);

    // Fetch Stripe Invoices
    const invoicesQuery = query(
      collection(db, "stripe_invoices"),
      where("organizationId", "==", organizationId)
    );
    const invoicesSnap = await getDocs(invoicesQuery);
    console.log(`    → Found ${invoicesSnap.size} Stripe invoices`);

    // Group by product
    const productRevenue: Record<string, { name: string; months: Record<string, number>; total: number; count: Record<string, number> }> = {};
    const customerRevenue: Record<string, { name: string; months: Record<string, number>; total: number }> = {};

    let paidStripeInvoicesCount = 0;
    invoicesSnap.docs.forEach(doc => {
      const invoice = doc.data();
      if (invoice.status !== 'paid') return;
      paidStripeInvoicesCount++;

      const invoiceDate = invoice.created?.toDate?.() || new Date();
      const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

      // Track by customer
      const customerId = invoice.customerId || 'unknown';
      const customerName = invoice.customerName || invoice.customerEmail || 'Unknown Customer';
      const invoiceAmount = (invoice.total || 0) / 100;

      if (!customerRevenue[customerId]) {
        customerRevenue[customerId] = { name: customerName, months: {}, total: 0 };
      }
      customerRevenue[customerId].months[monthKey] = (customerRevenue[customerId].months[monthKey] || 0) + invoiceAmount;
      customerRevenue[customerId].total += invoiceAmount;

      // Track by product (from line items)
      const lineItems = invoice.lineItems || [];
      lineItems.forEach((item: any) => {
        const productId = item.productId;
        if (!productId) return;

        const productName = products.get(productId) || item.description || 'Unknown Product';
        const itemAmount = ((item.amount || 0) / 100) * (item.quantity || 1);

        if (!productRevenue[productId]) {
          productRevenue[productId] = { name: productName, months: {}, total: 0, count: {} };
        }

        productRevenue[productId].months[monthKey] = (productRevenue[productId].months[monthKey] || 0) + itemAmount;
        productRevenue[productId].count[monthKey] = (productRevenue[productId].count[monthKey] || 0) + (item.quantity || 1);
        productRevenue[productId].total += itemAmount;
      });
    });

    // Add products to entities
    Object.entries(productRevenue).forEach(([productId, data]) => {
      entities.push({
        id: `stripe_product_${productId}`,
        entityId: `stripe_product_${productId}`,
        entityName: data.name,
        source: "stripe",
        type: "Product",
        metric: "Stripe Revenue",
        metricType: "revenue",
        months: data.months,
        total: data.total
      });
    });

    // Add customers to entities
    Object.entries(customerRevenue).forEach(([customerId, data]) => {
      entities.push({
        id: `stripe_customer_${customerId}`,
        entityId: `stripe_customer_${customerId}`,
        entityName: data.name,
        source: "stripe",
        type: "Customer",
        metric: "Stripe Revenue",
        metricType: "revenue",
        months: data.months,
        total: data.total
      });
    });

    console.log(`    → ${paidStripeInvoicesCount} paid invoices, ${Object.keys(productRevenue).length} products with revenue, ${Object.keys(customerRevenue).length} customers with revenue`);
  } catch (error) {
    console.error("Error fetching Stripe entities:", error);
  }
}

/**
 * Fetch QuickBooks entities
 */
async function fetchQuickBooksEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    console.log("  📒 Fetching QuickBooks data for org:", organizationId);
    
    // Fetch QB Invoices (revenue by customer)
    const invoicesQuery = query(
      collection(db, "quickbooks_invoices"),
      where("organizationId", "==", organizationId)
    );
    const invoicesSnap = await getDocs(invoicesQuery);
    console.log(`    → Found ${invoicesSnap.size} QuickBooks invoices`);

    const customerRevenue: Record<string, { name: string; months: Record<string, number>; total: number }> = {};

    let paidInvoicesCount = 0;
    invoicesSnap.docs.forEach(doc => {
      const invoice = doc.data();
      if (invoice.status !== 'paid') return;
      paidInvoicesCount++;

      const customerId = invoice.customerId || 'unknown';
      const customerName = invoice.customerName || 'Unknown Customer';
      const amount = invoice.totalAmount || 0;
      const date = invoice.txnDate?.toDate?.() || new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!customerRevenue[customerId]) {
        customerRevenue[customerId] = { name: customerName, months: {}, total: 0 };
      }

      customerRevenue[customerId].months[monthKey] = (customerRevenue[customerId].months[monthKey] || 0) + amount;
      customerRevenue[customerId].total += amount;
    });
    console.log(`    → ${paidInvoicesCount} paid invoices, ${Object.keys(customerRevenue).length} customers with revenue`);

    Object.entries(customerRevenue).forEach(([customerId, data]) => {
      entities.push({
        id: `quickbooks_customer_${customerId}`,
        entityId: `quickbooks_customer_${customerId}`,
        entityName: data.name,
        source: "quickbooks",
        type: "Customer",
        metric: "QuickBooks Revenue",
        metricType: "revenue",
        months: data.months,
        total: data.total
      });
    });

    // Fetch QB Expenses (by vendor)
    const expensesQuery = query(
      collection(db, "quickbooks_expenses"),
      where("organizationId", "==", organizationId)
    );
    const expensesSnap = await getDocs(expensesQuery);

    const vendorExpenses: Record<string, { name: string; months: Record<string, number>; total: number }> = {};

    expensesSnap.docs.forEach(doc => {
      const expense = doc.data();
      const vendorId = expense.vendorId || 'unknown';
      const vendorName = expense.vendorName || 'Unknown Vendor';
      const amount = expense.totalAmount || 0;
      const date = expense.txnDate?.toDate?.() || new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!vendorExpenses[vendorId]) {
        vendorExpenses[vendorId] = { name: vendorName, months: {}, total: 0 };
      }

      vendorExpenses[vendorId].months[monthKey] = (vendorExpenses[vendorId].months[monthKey] || 0) + amount;
      vendorExpenses[vendorId].total += amount;
    });

    Object.entries(vendorExpenses).forEach(([vendorId, data]) => {
      entities.push({
        id: `quickbooks_vendor_${vendorId}`,
        entityId: `quickbooks_vendor_${vendorId}`,
        entityName: data.name,
        source: "quickbooks",
        type: "Vendor",
        metric: "QuickBooks Expenses",
        metricType: "expenses",
        months: data.months,
        total: data.total
      });
    });

    console.log(`📒 Loaded ${Object.keys(customerRevenue).length} QuickBooks customers, ${Object.keys(vendorExpenses).length} vendors`);
  } catch (error) {
    console.error("Error fetching QuickBooks entities:", error);
  }
}

/**
 * Fetch Google Ads entities
 */
async function fetchGoogleAdsEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    console.log("  📈 Fetching Google Ads data for org:", organizationId);
    
    // Fetch Google Ads campaign data via API
    const adsResponse = await fetch(
      `/api/google-analytics/ads?organizationId=${organizationId}&viewMode=all`
    );

    if (!adsResponse.ok) {
      console.warn("    ⚠️ Could not fetch Google Ads data:", adsResponse.status);
      return;
    }

    const adsData = await adsResponse.json();
    const campaigns = adsData.campaigns || [];
    console.log(`    → Found ${campaigns.length} Google Ads campaigns from API`);

    let addedEntities = 0;

    // First, create aggregated summary rows for all campaigns combined
    const metricsToTrack = ['spend', 'clicks', 'impressions', 'conversions', 'sessions', 'revenue'];
    const aggregatedMetrics: Record<string, { months: Record<string, number>; total: number }> = {};

    // Initialize aggregated metrics
    metricsToTrack.forEach(metricName => {
      aggregatedMetrics[metricName] = { months: {}, total: 0 };
    });

    // Aggregate all campaigns
    campaigns.forEach((campaign: any) => {
      metricsToTrack.forEach(metricName => {
        // Extract metric value for each month
        Object.entries(campaign.months || {}).forEach(([monthKey, metrics]: [string, any]) => {
          const value = metrics[metricName] || 0;
          if (value > 0) {
            aggregatedMetrics[metricName].months[monthKey] = 
              (aggregatedMetrics[metricName].months[monthKey] || 0) + value;
            aggregatedMetrics[metricName].total += value;
          }
        });
      });
    });

    // Add aggregated summary entities
    metricsToTrack.forEach(metricName => {
      const metricData = aggregatedMetrics[metricName];
      
      if (metricData.total > 0) {
        // Determine metric type
        let metricType: MasterTableEntity["metricType"];
        let metricTitle: string;
        
        switch (metricName) {
          case 'spend':
            metricType = 'spend';
            metricTitle = 'Total Ad Spend';
            break;
          case 'clicks':
            metricType = 'clicks';
            metricTitle = 'Total Ad Clicks';
            break;
          case 'impressions':
            metricType = 'impressions';
            metricTitle = 'Total Ad Impressions';
            break;
          case 'conversions':
            metricType = 'conversions';
            metricTitle = 'Total Ad Conversions';
            break;
          case 'sessions':
            metricType = 'sessions';
            metricTitle = 'Total Ad Sessions';
            break;
          case 'revenue':
            metricType = 'revenue';
            metricTitle = 'Total Ad Revenue';
            break;
          default:
            metricType = 'engagement';
            metricTitle = `Total ${metricName}`;
        }

        entities.push({
          id: `ga_ads_total_${metricName}`,
          entityId: `ga_ads_total_${metricName}`,
          entityName: 'All Google Ads Campaigns',
          source: "google-analytics",
          type: "Ad Campaign Summary",
          metric: metricTitle,
          metricType: metricType,
          months: metricData.months,
          total: metricData.total
        });
        addedEntities++;
      }
    });

    // Also add individual campaigns (optional - can be removed if only summaries are needed)
    campaigns.forEach((campaign: any) => {
      const campaignName = campaign.name || 'Unknown Campaign';
      const campaignId = campaign.id || campaignName.replace(/\s+/g, '_').toLowerCase();
      
      metricsToTrack.forEach(metricName => {
        const campaignMonths: Record<string, number> = {};
        let total = 0;

        // Extract metric value for each month
        Object.entries(campaign.months || {}).forEach(([monthKey, metrics]: [string, any]) => {
          const value = metrics[metricName] || 0;
          if (value > 0) {
            campaignMonths[monthKey] = value;
            total += value;
          }
        });

        // Only add if there's data
        if (total > 0) {
          // Determine metric type
          let metricType: MasterTableEntity["metricType"];
          let metricTitle: string;
          
          switch (metricName) {
            case 'spend':
              metricType = 'spend';
              metricTitle = 'Ad Spend';
              break;
            case 'clicks':
              metricType = 'clicks';
              metricTitle = 'Ad Clicks';
              break;
            case 'impressions':
              metricType = 'impressions';
              metricTitle = 'Ad Impressions';
              break;
            case 'conversions':
              metricType = 'conversions';
              metricTitle = 'Ad Conversions';
              break;
            case 'sessions':
              metricType = 'sessions';
              metricTitle = 'Ad Sessions';
              break;
            case 'revenue':
              metricType = 'revenue';
              metricTitle = 'Ad Revenue';
              break;
            default:
              metricType = 'engagement';
              metricTitle = metricName;
          }

          entities.push({
            id: `ga_ads_${campaignId}_${metricName}`,
            entityId: `ga_ads_${campaignId}_${metricName}`,
            entityName: campaignName,
            source: "google-analytics",
            type: "Ad Campaign",
            metric: metricTitle,
            metricType: metricType,
            months: campaignMonths,
            total: total
          });
          addedEntities++;
        }
      });
    });

    console.log(`    → Added ${addedEntities} Google Ads entity rows (6 summary + ${campaigns.length} campaigns × metrics)`);
  } catch (error) {
    console.error("Error fetching Google Ads entities:", error);
  }
}

/**
 * Fetch Google Analytics entities
 */
async function fetchGoogleAnalyticsEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    console.log("  📊 Fetching Google Analytics data for org:", organizationId);
    
    // Fetch Google Analytics Pages via API (matches Master Table approach)
    const pagesResponse = await fetch(
      `/api/google-analytics/pages?organizationId=${organizationId}&viewMode=all`
    );

    if (!pagesResponse.ok) {
      console.warn("    ⚠️ Could not fetch Google Analytics pages:", pagesResponse.status);
      return;
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.pages || [];
    console.log(`    → Found ${pages.length} Google Analytics pages from API`);

    // Process pages
    pages.forEach((pageData: any) => {
      const pageName = pageData.name || 'Unknown Page';
      const months = pageData.months || {};
      
      // Calculate totals
      const pageviews = Object.values(months).reduce((sum: number, data: any) => sum + (data.pageviews || 0), 0);
      const sessions = Object.values(months).reduce((sum: number, data: any) => sum + (data.sessions || 0), 0);
      
      // Create month records
      const pageviewMonths: Record<string, number> = {};
      const sessionMonths: Record<string, number> = {};
      
      Object.entries(months).forEach(([monthKey, data]: [string, any]) => {
        pageviewMonths[monthKey] = data.pageviews || 0;
        sessionMonths[monthKey] = data.sessions || 0;
      });

      // Add pageviews entity
      if (pageviews > 0) {
        entities.push({
          id: `ga_page_${pageData.id}_pageviews`,
          entityId: `ga_page_${pageData.id}_pageviews`,
          entityName: pageName,
          source: "google-analytics-organic",
          type: "Page",
          metric: "Pageviews",
          metricType: "pageviews",
          months: pageviewMonths,
          total: pageviews
        });
      }

      // Add sessions entity
      if (sessions > 0) {
        entities.push({
          id: `ga_page_${pageData.id}_sessions`,
          entityId: `ga_page_${pageData.id}_sessions`,
          entityName: pageName,
          source: "google-analytics-organic",
          type: "Page",
          metric: "Page Sessions",
          metricType: "sessions",
          months: sessionMonths,
          total: sessions
        });
      }
    });

    // Fetch Google Analytics Traffic Sources via API
    const trafficResponse = await fetch(
      `/api/google-analytics/traffic-sources?organizationId=${organizationId}&viewMode=all`
    );

    if (!trafficResponse.ok) {
      console.warn("    ⚠️ Could not fetch Google Analytics traffic sources:", trafficResponse.status);
      return;
    }

    const trafficData = await trafficResponse.json();
    const sources = trafficData.sources || [];
    console.log(`    → Found ${sources.length} Google Analytics traffic sources from API`);

    // Process traffic sources
    sources.forEach((sourceData: any) => {
      const sourceName = sourceData.name || 'Unknown Source';
      const months = sourceData.months || {};
      
      // Calculate totals
      const sessions = Object.values(months).reduce((sum: number, data: any) => sum + (data.sessions || 0), 0);
      const users = Object.values(months).reduce((sum: number, data: any) => sum + (data.users || 0), 0);
      
      // Create month records
      const sessionMonths: Record<string, number> = {};
      const userMonths: Record<string, number> = {};
      
      Object.entries(months).forEach(([monthKey, data]: [string, any]) => {
        sessionMonths[monthKey] = data.sessions || 0;
        userMonths[monthKey] = data.users || 0;
      });

      // Add sessions entity
      if (sessions > 0) {
        entities.push({
          id: `ga_traffic_${sourceData.id}_sessions`,
          entityId: `ga_traffic_${sourceData.id}_sessions`,
          entityName: sourceName,
          source: "google-analytics-organic",
          type: "Traffic Source",
          metric: "Sessions",
          metricType: "sessions",
          months: sessionMonths,
          total: sessions
        });
      }

      // Add users entity
      if (users > 0) {
        entities.push({
          id: `ga_traffic_${sourceData.id}_users`,
          entityId: `ga_traffic_${sourceData.id}_users`,
          entityName: sourceName,
          source: "google-analytics-organic",
          type: "Traffic Source",
          metric: "Users",
          metricType: "sessions",
          months: userMonths,
          total: users
        });
      }
    });

    console.log(`    → Added ${pages.length * 2} page entities and ${sources.length * 2} traffic source entities`);
  } catch (error) {
    console.error("Error fetching Google Analytics entities:", error);
  }
}

/**
 * Fetch ActiveCampaign entities
 */
async function fetchActiveCampaignEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    // Fetch AC Campaigns
    const campaignsQuery = query(
      collection(db, "activecampaign_campaigns"),
      where("organizationId", "==", organizationId)
    );
    const campaignsSnap = await getDocs(campaignsQuery);

    const campaignMetrics: Record<string, { name: string; sends: Record<string, number>; opens: Record<string, number>; clicks: Record<string, number>; totalSends: number; totalOpens: number; totalClicks: number }> = {};

    campaignsSnap.docs.forEach(doc => {
      const campaign = doc.data();
      const campaignId = campaign.campaignId || doc.id;
      const monthKey = `${campaign.year}-${String(campaign.month).padStart(2, '0')}`;

      if (!campaignMetrics[campaignId]) {
        campaignMetrics[campaignId] = {
          name: campaign.campaignName || 'Unknown Campaign',
          sends: {},
          opens: {},
          clicks: {},
          totalSends: 0,
          totalOpens: 0,
          totalClicks: 0
        };
      }

      campaignMetrics[campaignId].sends[monthKey] = (campaignMetrics[campaignId].sends[monthKey] || 0) + (campaign.sends || 0);
      campaignMetrics[campaignId].opens[monthKey] = (campaignMetrics[campaignId].opens[monthKey] || 0) + (campaign.opens || 0);
      campaignMetrics[campaignId].clicks[monthKey] = (campaignMetrics[campaignId].clicks[monthKey] || 0) + (campaign.clicks || 0);
      campaignMetrics[campaignId].totalSends += campaign.sends || 0;
      campaignMetrics[campaignId].totalOpens += campaign.opens || 0;
      campaignMetrics[campaignId].totalClicks += campaign.clicks || 0;
    });

    Object.entries(campaignMetrics).forEach(([campaignId, data]) => {
      // Add email sends
      entities.push({
        id: `ac_campaign_${campaignId}_sends`,
        entityId: `ac_campaign_${campaignId}_sends`,
        entityName: data.name,
        source: "activecampaign",
        type: "Campaign",
        metric: "Email Sends",
        metricType: "email",
        months: data.sends,
        total: data.totalSends
      });
    });

    console.log(`📧 Loaded ${Object.keys(campaignMetrics).length} ActiveCampaign campaigns`);
  } catch (error) {
    console.error("Error fetching ActiveCampaign entities:", error);
  }
}

/**
 * Get entities by their IDs
 */
export async function getEntitiesByIds(
  organizationId: string,
  entityIds: string[]
): Promise<MasterTableEntity[]> {
  const allEntities = await fetchMasterTableEntities(organizationId);
  return allEntities.filter(e => entityIds.includes(e.entityId));
}
