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
  metricType: "revenue" | "expenses" | "engagement" | "sales" | "sessions" | "pageviews" | "email";
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
    console.log("📊 Fetching Master Table entities for org:", organizationId);
    const entities: MasterTableEntity[] = [];

    // Fetch Stripe data
    await fetchStripeEntities(organizationId, entities);
    
    // Fetch QuickBooks data
    await fetchQuickBooksEntities(organizationId, entities);
    
    // Fetch Google Analytics data
    await fetchGoogleAnalyticsEntities(organizationId, entities);
    
    // Fetch ActiveCampaign data
    await fetchActiveCampaignEntities(organizationId, entities);

    // Apply filters
    let filtered = entities;
    
    if (filters) {
      if (filters.metricType) {
        const metricTypes = Array.isArray(filters.metricType) ? filters.metricType : [filters.metricType];
        filtered = filtered.filter(e => metricTypes.includes(e.metricType));
      }
      
      if (filters.source) {
        const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
        filtered = filtered.filter(e => sources.includes(e.source));
      }
      
      if (filters.minTotal !== undefined) {
        filtered = filtered.filter(e => e.total >= filters.minTotal!);
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(e => 
          e.entityName.toLowerCase().includes(term) ||
          e.metric.toLowerCase().includes(term)
        );
      }
    }

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

    // Fetch Stripe Invoices
    const invoicesQuery = query(
      collection(db, "stripe_invoices"),
      where("organizationId", "==", organizationId)
    );
    const invoicesSnap = await getDocs(invoicesQuery);

    // Group by product
    const productRevenue: Record<string, { name: string; months: Record<string, number>; total: number; count: Record<string, number> }> = {};
    const customerRevenue: Record<string, { name: string; months: Record<string, number>; total: number }> = {};

    invoicesSnap.docs.forEach(doc => {
      const invoice = doc.data();
      if (invoice.status !== 'paid') return;

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

    console.log(`💳 Loaded ${Object.keys(productRevenue).length} Stripe products, ${Object.keys(customerRevenue).length} customers`);
  } catch (error) {
    console.error("Error fetching Stripe entities:", error);
  }
}

/**
 * Fetch QuickBooks entities
 */
async function fetchQuickBooksEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    // Fetch QB Invoices (revenue by customer)
    const invoicesQuery = query(
      collection(db, "quickbooks_invoices"),
      where("organizationId", "==", organizationId)
    );
    const invoicesSnap = await getDocs(invoicesQuery);

    const customerRevenue: Record<string, { name: string; months: Record<string, number>; total: number }> = {};

    invoicesSnap.docs.forEach(doc => {
      const invoice = doc.data();
      if (invoice.status !== 'paid') return;

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
 * Fetch Google Analytics entities
 */
async function fetchGoogleAnalyticsEntities(organizationId: string, entities: MasterTableEntity[]) {
  try {
    // Fetch GA Pages
    const pagesQuery = query(
      collection(db, "google_analytics_pages"),
      where("organizationId", "==", organizationId)
    );
    const pagesSnap = await getDocs(pagesQuery);

    const pageMetrics: Record<string, { name: string; sessions: Record<string, number>; pageviews: Record<string, number>; totalSessions: number; totalPageviews: number }> = {};

    pagesSnap.docs.forEach(doc => {
      const page = doc.data();
      const pageId = page.pagePath || 'unknown';
      const monthKey = `${page.year}-${String(page.month).padStart(2, '0')}`;

      if (!pageMetrics[pageId]) {
        pageMetrics[pageId] = {
          name: page.pageTitle || page.pagePath || 'Unknown Page',
          sessions: {},
          pageviews: {},
          totalSessions: 0,
          totalPageviews: 0
        };
      }

      pageMetrics[pageId].sessions[monthKey] = (pageMetrics[pageId].sessions[monthKey] || 0) + (page.sessions || 0);
      pageMetrics[pageId].pageviews[monthKey] = (pageMetrics[pageId].pageviews[monthKey] || 0) + (page.pageviews || 0);
      pageMetrics[pageId].totalSessions += page.sessions || 0;
      pageMetrics[pageId].totalPageviews += page.pageviews || 0;
    });

    Object.entries(pageMetrics).forEach(([pageId, data]) => {
      // Add sessions metric
      entities.push({
        id: `ga_page_${pageId}_sessions`,
        entityId: `ga_page_${pageId}_sessions`,
        entityName: data.name,
        source: "google-analytics",
        type: "Page",
        metric: "Page Sessions",
        metricType: "sessions",
        months: data.sessions,
        total: data.totalSessions
      });

      // Add pageviews metric
      entities.push({
        id: `ga_page_${pageId}_pageviews`,
        entityId: `ga_page_${pageId}_pageviews`,
        entityName: data.name,
        source: "google-analytics",
        type: "Page",
        metric: "Page Views",
        metricType: "pageviews",
        months: data.pageviews,
        total: data.totalPageviews
      });
    });

    console.log(`📊 Loaded ${Object.keys(pageMetrics).length} Google Analytics pages`);
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
