import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from "firebase/firestore";

// Industry benchmarks for email metrics (from Klaviyo/Mailchimp research)
const EMAIL_BENCHMARKS = {
  openRate: { poor: 15, good: 20, excellent: 30, unit: '%' },
  clickRate: { poor: 1, good: 2.5, excellent: 5, unit: '%' },
  clickToOpenRate: { poor: 5, good: 10, excellent: 15, unit: '%' },
  bounceRate: { poor: 5, good: 2, excellent: 0.5, unit: '%', inverse: true },
  unsubscribeRate: { poor: 1, good: 0.5, excellent: 0.2, unit: '%', inverse: true },
  conversionRate: { poor: 0.5, good: 2, excellent: 5, unit: '%' },
};

interface EmailMetrics {
  // Campaign metrics
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalOpens: number;
  totalClicks: number;
  totalConversions: number;
  
  // Rate metrics
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  conversionRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  
  // List metrics
  totalContacts: number;
  activeContacts: number;
  totalLists: number;
  avgListSize: number;
  listGrowthRate: number;
  
  // Automation metrics
  totalAutomations: number;
  activeAutomations: number;
  automationEntered: number;
  automationCompleted: number;
  automationCompletionRate: number;
  
  // Calculated scores
  overallHealthScore: number;
  engagementScore: number;
  deliverabilityScore: number;
}

interface EmailAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
  benchmark?: number;
}

interface EmailOpportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  campaigns?: string[];
  estimatedLift?: string;
}

// GET - Retrieve stored email metrics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
    const metricsRef = doc(db, "marketing_metrics_email", organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No email metrics calculated yet. Run POST to calculate.",
      });
    }

    const data = metricsDoc.data();
    
    return NextResponse.json({
      hasData: true,
      organizationId,
      metrics: data.metrics,
      alerts: data.alerts || [],
      opportunities: data.opportunities || [],
      topCampaigns: data.topCampaigns || [],
      benchmarks: EMAIL_BENCHMARKS,
      calculatedAt: data.calculatedAt?.toDate?.() || null,
    });

  } catch (error) {
    console.error("Error fetching email metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch email metrics" },
      { status: 500 }
    );
  }
}

// POST - Calculate and store email metrics
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    console.log("Calculating email metrics for:", organizationId);

    // Fetch all email data from Firestore
    const [campaigns, contacts, lists, automations] = await Promise.all([
      fetchCampaigns(organizationId),
      fetchContacts(organizationId),
      fetchLists(organizationId),
      fetchAutomations(organizationId),
    ]);

    // Calculate metrics
    const metrics = calculateMetrics(campaigns, contacts, lists, automations);
    
    // Generate alerts
    const alerts = generateAlerts(metrics);
    
    // Find opportunities
    const opportunities = findOpportunities(campaigns, metrics);
    
    // Get top performing campaigns
    const topCampaigns = getTopCampaigns(campaigns);

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_email", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      topCampaigns,
      calculatedAt: Timestamp.now(),
      dataPoints: {
        campaigns: campaigns.length,
        contacts: contacts.length,
        lists: lists.length,
        automations: automations.length,
      },
    });

    // Also store daily snapshot
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(db, "marketing_metrics_email", organizationId, "daily", today);
    await setDoc(dailyRef, {
      metrics,
      calculatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      organizationId,
      metrics,
      alerts,
      opportunities,
      topCampaigns,
      dataPoints: {
        campaigns: campaigns.length,
        contacts: contacts.length,
        lists: lists.length,
        automations: automations.length,
      },
    });

  } catch (error) {
    console.error("Error calculating email metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate email metrics" },
      { status: 500 }
    );
  }
}

// Fetch campaigns from Firestore
async function fetchCampaigns(organizationId: string) {
  const campaignsRef = collection(db, "activecampaign_campaigns");
  const q = query(campaignsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch contacts from Firestore
async function fetchContacts(organizationId: string) {
  const contactsRef = collection(db, "activecampaign_contacts");
  const q = query(contactsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch lists from Firestore
async function fetchLists(organizationId: string) {
  const listsRef = collection(db, "activecampaign_lists");
  const q = query(listsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch automations from Firestore
async function fetchAutomations(organizationId: string) {
  const automationsRef = collection(db, "activecampaign_automations");
  const q = query(automationsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Calculate all metrics
function calculateMetrics(
  campaigns: any[],
  contacts: any[],
  lists: any[],
  automations: any[]
): EmailMetrics {
  // Campaign aggregates
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((sum, c) => sum + (c.send_amt || c.sendAmt || 0), 0);
  const totalDelivered = campaigns.reduce((sum, c) => {
    const sent = c.send_amt || c.sendAmt || 0;
    const bounced = c.bounces || c.bounce_amt || 0;
    return sum + (sent - bounced);
  }, 0);
  const totalOpens = campaigns.reduce((sum, c) => sum + (c.opens || c.open_amt || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || c.click_amt || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
  const totalBounces = campaigns.reduce((sum, c) => sum + (c.bounces || c.bounce_amt || 0), 0);
  const totalUnsubscribes = campaigns.reduce((sum, c) => sum + (c.unsubscribes || c.unsub_amt || 0), 0);

  // Rate calculations
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const openRate = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0;
  const clickRate = totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0;
  const clickToOpenRate = totalOpens > 0 ? (totalClicks / totalOpens) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;
  const unsubscribeRate = totalDelivered > 0 ? (totalUnsubscribes / totalDelivered) * 100 : 0;

  // Contact/List metrics
  const totalContacts = contacts.length;
  const activeContacts = contacts.filter(c => 
    c.status === 'active' || c.status === 1 || c.status === '1'
  ).length;
  const totalLists = lists.length;
  const avgListSize = totalLists > 0 
    ? lists.reduce((sum, l) => sum + (l.subscriber_count || l.subscriberCount || 0), 0) / totalLists 
    : 0;
  
  // List growth (would need historical data)
  const listGrowthRate = 0; // TODO: Calculate from historical snapshots

  // Automation metrics
  const totalAutomations = automations.length;
  const activeAutomations = automations.filter(a => 
    a.status === 'active' || a.status === 1 || a.status === '1'
  ).length;
  const automationEntered = automations.reduce((sum, a) => sum + (a.entered || 0), 0);
  const automationCompleted = automations.reduce((sum, a) => sum + (a.completed || 0), 0);
  const automationCompletionRate = automationEntered > 0 
    ? (automationCompleted / automationEntered) * 100 
    : 0;

  // Calculate scores
  const engagementScore = calculateEngagementScore(openRate, clickRate, clickToOpenRate);
  const deliverabilityScore = calculateDeliverabilityScore(deliveryRate, bounceRate);
  const overallHealthScore = (engagementScore * 0.6 + deliverabilityScore * 0.4);

  return {
    totalCampaigns,
    totalSent,
    totalDelivered,
    totalOpens,
    totalClicks,
    totalConversions,
    deliveryRate: round(deliveryRate),
    openRate: round(openRate),
    clickRate: round(clickRate),
    clickToOpenRate: round(clickToOpenRate),
    conversionRate: round(conversionRate),
    bounceRate: round(bounceRate),
    unsubscribeRate: round(unsubscribeRate),
    totalContacts,
    activeContacts,
    totalLists,
    avgListSize: Math.round(avgListSize),
    listGrowthRate: round(listGrowthRate),
    totalAutomations,
    activeAutomations,
    automationEntered,
    automationCompleted,
    automationCompletionRate: round(automationCompletionRate),
    overallHealthScore: Math.round(overallHealthScore),
    engagementScore: Math.round(engagementScore),
    deliverabilityScore: Math.round(deliverabilityScore),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateEngagementScore(openRate: number, clickRate: number, clickToOpenRate: number): number {
  // Score based on benchmarks
  const openScore = Math.min(100, (openRate / EMAIL_BENCHMARKS.openRate.excellent) * 100);
  const clickScore = Math.min(100, (clickRate / EMAIL_BENCHMARKS.clickRate.excellent) * 100);
  const ctoScore = Math.min(100, (clickToOpenRate / EMAIL_BENCHMARKS.clickToOpenRate.excellent) * 100);
  
  return (openScore * 0.4 + clickScore * 0.35 + ctoScore * 0.25);
}

function calculateDeliverabilityScore(deliveryRate: number, bounceRate: number): number {
  // Delivery rate should be >95%
  const deliveryScore = Math.min(100, (deliveryRate / 99) * 100);
  // Bounce rate should be <2%
  const bounceScore = bounceRate <= 0.5 ? 100 : bounceRate <= 2 ? 75 : bounceRate <= 5 ? 50 : 25;
  
  return (deliveryScore * 0.6 + bounceScore * 0.4);
}

// Generate alerts based on metrics
function generateAlerts(metrics: EmailMetrics): EmailAlert[] {
  const alerts: EmailAlert[] = [];

  // Open rate alert
  if (metrics.openRate < EMAIL_BENCHMARKS.openRate.poor) {
    alerts.push({
      type: 'critical',
      category: 'engagement',
      message: `Open rate (${metrics.openRate}%) is below industry standard (${EMAIL_BENCHMARKS.openRate.poor}%)`,
      metric: 'openRate',
      value: metrics.openRate,
      benchmark: EMAIL_BENCHMARKS.openRate.poor,
    });
  } else if (metrics.openRate < EMAIL_BENCHMARKS.openRate.good) {
    alerts.push({
      type: 'warning',
      category: 'engagement',
      message: `Open rate (${metrics.openRate}%) is below target (${EMAIL_BENCHMARKS.openRate.good}%)`,
      metric: 'openRate',
      value: metrics.openRate,
      benchmark: EMAIL_BENCHMARKS.openRate.good,
    });
  }

  // Click rate alert
  if (metrics.clickRate < EMAIL_BENCHMARKS.clickRate.poor) {
    alerts.push({
      type: 'critical',
      category: 'engagement',
      message: `Click rate (${metrics.clickRate}%) is below industry standard (${EMAIL_BENCHMARKS.clickRate.poor}%)`,
      metric: 'clickRate',
      value: metrics.clickRate,
      benchmark: EMAIL_BENCHMARKS.clickRate.poor,
    });
  }

  // Bounce rate alert
  if (metrics.bounceRate > EMAIL_BENCHMARKS.bounceRate.poor) {
    alerts.push({
      type: 'critical',
      category: 'deliverability',
      message: `Bounce rate (${metrics.bounceRate}%) is critically high (>${EMAIL_BENCHMARKS.bounceRate.poor}%)`,
      metric: 'bounceRate',
      value: metrics.bounceRate,
      benchmark: EMAIL_BENCHMARKS.bounceRate.poor,
    });
  } else if (metrics.bounceRate > EMAIL_BENCHMARKS.bounceRate.good) {
    alerts.push({
      type: 'warning',
      category: 'deliverability',
      message: `Bounce rate (${metrics.bounceRate}%) is above target (<${EMAIL_BENCHMARKS.bounceRate.good}%)`,
      metric: 'bounceRate',
      value: metrics.bounceRate,
      benchmark: EMAIL_BENCHMARKS.bounceRate.good,
    });
  }

  // Unsubscribe rate alert
  if (metrics.unsubscribeRate > EMAIL_BENCHMARKS.unsubscribeRate.poor) {
    alerts.push({
      type: 'warning',
      category: 'list_health',
      message: `Unsubscribe rate (${metrics.unsubscribeRate}%) is high - review email frequency and content`,
      metric: 'unsubscribeRate',
      value: metrics.unsubscribeRate,
      benchmark: EMAIL_BENCHMARKS.unsubscribeRate.poor,
    });
  }

  // Automation completion alert
  if (metrics.totalAutomations > 0 && metrics.automationCompletionRate < 30) {
    alerts.push({
      type: 'warning',
      category: 'automation',
      message: `Automation completion rate (${metrics.automationCompletionRate}%) is low - review automation flows`,
      metric: 'automationCompletionRate',
      value: metrics.automationCompletionRate,
      benchmark: 50,
    });
  }

  // Low activity alert
  if (metrics.totalCampaigns === 0) {
    alerts.push({
      type: 'info',
      category: 'activity',
      message: 'No email campaigns found. Consider starting email marketing.',
    });
  }

  return alerts;
}

// Find opportunities
function findOpportunities(campaigns: any[], metrics: EmailMetrics): EmailOpportunity[] {
  const opportunities: EmailOpportunity[] = [];

  // Subject line optimization
  if (metrics.openRate < EMAIL_BENCHMARKS.openRate.good && metrics.totalCampaigns > 0) {
    // Find campaigns with below-average open rates
    const avgOpenRate = metrics.openRate;
    const lowOpenCampaigns = campaigns.filter(c => {
      const sent = c.send_amt || c.sendAmt || 0;
      const opens = c.opens || c.open_amt || 0;
      const rate = sent > 0 ? (opens / sent) * 100 : 0;
      return rate < avgOpenRate * 0.8 && sent > 100; // 20% below average, meaningful size
    });

    if (lowOpenCampaigns.length > 0) {
      opportunities.push({
        type: 'subject_line',
        title: 'Optimize Subject Lines',
        description: `${lowOpenCampaigns.length} campaigns have below-average open rates. A/B test subject lines to improve.`,
        impact: 'high',
        campaigns: lowOpenCampaigns.slice(0, 3).map(c => c.name || c.subject),
        estimatedLift: '+20-30% open rate with good subject lines',
      });
    }
  }

  // CTA optimization
  if (metrics.clickToOpenRate < EMAIL_BENCHMARKS.clickToOpenRate.good) {
    opportunities.push({
      type: 'cta_optimization',
      title: 'Improve Email CTAs',
      description: `Click-to-open rate (${metrics.clickToOpenRate}%) is below target. People open but don't click.`,
      impact: 'high',
      estimatedLift: '+50% more clicks with clear CTAs',
    });
  }

  // List cleaning
  if (metrics.bounceRate > 2 || metrics.activeContacts < metrics.totalContacts * 0.7) {
    opportunities.push({
      type: 'list_hygiene',
      title: 'Clean Email List',
      description: 'High bounce rate or many inactive contacts. Remove invalid emails to improve deliverability.',
      impact: 'medium',
      estimatedLift: 'Better inbox placement, lower costs',
    });
  }

  // Automation opportunity
  if (metrics.totalAutomations < 3) {
    opportunities.push({
      type: 'automation',
      title: 'Add Email Automations',
      description: 'Email automations (welcome series, abandoned cart, re-engagement) generate 18x more revenue per recipient.',
      impact: 'high',
      estimatedLift: '18x revenue per recipient vs campaigns',
    });
  }

  return opportunities;
}

// Get top performing campaigns
function getTopCampaigns(campaigns: any[]) {
  return campaigns
    .map(c => {
      const sent = c.send_amt || c.sendAmt || 0;
      const opens = c.opens || c.open_amt || 0;
      const clicks = c.clicks || c.click_amt || 0;
      return {
        name: c.name || c.subject || 'Unnamed',
        sent,
        openRate: sent > 0 ? round((opens / sent) * 100) : 0,
        clickRate: sent > 0 ? round((clicks / sent) * 100) : 0,
        conversions: c.conversions || 0,
      };
    })
    .filter(c => c.sent > 50) // Only meaningful campaigns
    .sort((a, b) => b.clickRate - a.clickRate)
    .slice(0, 5);
}
