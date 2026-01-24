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

// Benchmarks for advertising metrics (from Optmyzr/WordStream research)
const ADS_BENCHMARKS = {
  conversionRate: { poor: 1, good: 3, excellent: 5, unit: '%' },
  roas: { poor: 2, good: 4, excellent: 8, unit: 'x' },
  ctr: { poor: 1, good: 2, excellent: 4, unit: '%' },
  qualityScore: { poor: 5, good: 7, excellent: 9, unit: '/10' },
};

interface CampaignMetrics {
  campaign: string;
  sessions: number;
  users: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  bounceRate: number;
  avgSessionDuration: number;
  // These would require Google Ads API:
  // spend, impressions, clicks, cpc, ctr, roas, qualityScore
}

interface AdsMetrics {
  // Traffic metrics (from GA4)
  totalPaidSessions: number;
  totalPaidUsers: number;
  paidTrafficShare: number;
  
  // Conversion metrics (from GA4)
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  
  // Engagement quality
  avgBounceRate: number;
  avgSessionDuration: number;
  avgEngagementRate: number;
  pagesPerSession: number;
  
  // Campaign breakdown
  totalCampaigns: number;
  activeCampaigns: number;
  campaignMetrics: CampaignMetrics[];
  
  // Top performers
  topCampaignByConversions: string;
  topCampaignByRevenue: string;
  
  // Calculated scores (limited without spend data)
  trafficQualityScore: number;
  
  // Missing metrics flag
  hasCostData: boolean;
}

interface AdsAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
  campaign?: string;
}

interface AdsOpportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  campaigns?: string[];
  estimatedLift?: string;
}

// GET - Retrieve stored ads metrics
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
    const metricsRef = doc(db, "marketing_metrics_ads", organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No ads metrics calculated yet. Run POST to calculate.",
      });
    }

    const data = metricsDoc.data();
    
    return NextResponse.json({
      hasData: true,
      organizationId,
      metrics: data.metrics,
      alerts: data.alerts || [],
      opportunities: data.opportunities || [],
      campaignBreakdown: data.campaignBreakdown || [],
      benchmarks: ADS_BENCHMARKS,
      calculatedAt: data.calculatedAt?.toDate?.() || null,
      dataLimitations: data.dataLimitations || [],
    });

  } catch (error) {
    console.error("Error fetching ads metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch ads metrics" },
      { status: 500 }
    );
  }
}

// POST - Calculate and store ads metrics
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    console.log("Calculating ads metrics for:", organizationId);

    // Fetch traffic data
    const trafficData = await fetchTrafficData(organizationId);
    
    // Separate paid traffic
    const { paidTraffic, totalSessions } = separatePaidTraffic(trafficData);

    // Calculate metrics
    const metrics = calculateMetrics(paidTraffic, totalSessions);
    
    // Generate alerts
    const alerts = generateAlerts(metrics);
    
    // Find opportunities
    const opportunities = findOpportunities(metrics);

    // Data limitations
    const dataLimitations = [
      "Cost data (spend, CPC, CPM) requires Google Ads API connection",
      "ROAS calculation requires ad spend data",
      "Quality Score requires Google Ads API connection",
      "Impression and CTR data requires Google Ads API connection",
    ];

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_ads", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      campaignBreakdown: metrics.campaignMetrics,
      dataLimitations,
      calculatedAt: Timestamp.now(),
      dataPoints: {
        totalTrafficSources: trafficData.length,
        paidSources: paidTraffic.length,
        campaigns: metrics.totalCampaigns,
      },
    });

    // Store daily snapshot
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(db, "marketing_metrics_ads", organizationId, "daily", today);
    await setDoc(dailyRef, {
      metrics: {
        totalPaidSessions: metrics.totalPaidSessions,
        totalConversions: metrics.totalConversions,
        conversionRate: metrics.conversionRate,
        totalRevenue: metrics.totalRevenue,
      },
      calculatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      organizationId,
      metrics,
      alerts,
      opportunities,
      campaignBreakdown: metrics.campaignMetrics,
      dataLimitations,
    });

  } catch (error) {
    console.error("Error calculating ads metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate ads metrics" },
      { status: 500 }
    );
  }
}

// Fetch traffic acquisition data
async function fetchTrafficData(organizationId: string) {
  const trafficRef = collection(db, "ga_traffic");
  const q = query(trafficRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Separate paid traffic from total
function separatePaidTraffic(trafficData: any[]) {
  const paidTraffic: any[] = [];
  let totalSessions = 0;

  trafficData.forEach(t => {
    const medium = (t.sessionMedium || t.medium || '').toLowerCase();
    const channel = (t.sessionDefaultChannelGroup || t.channelGroup || '').toLowerCase();
    const campaign = t.sessionCampaignName || t.campaign || '';
    const sessions = t.sessions || 0;
    
    totalSessions += sessions;

    // Check if it's paid traffic
    const isPaid = 
      medium === 'cpc' ||
      medium === 'ppc' ||
      medium === 'paid' ||
      medium === 'paidsearch' ||
      medium === 'paid_social' ||
      medium === 'display' ||
      medium === 'cpm' ||
      channel.includes('paid') ||
      channel.includes('display') ||
      (campaign && campaign !== '(not set)' && medium !== 'organic');

    if (isPaid) {
      paidTraffic.push({
        ...t,
        campaign: campaign || '(direct paid)',
      });
    }
  });

  return { paidTraffic, totalSessions };
}

// Calculate all metrics
function calculateMetrics(paidTraffic: any[], totalSessions: number): AdsMetrics {
  // Aggregate paid metrics
  const totalPaidSessions = paidTraffic.reduce((sum, t) => sum + (t.sessions || 0), 0);
  const totalPaidUsers = paidTraffic.reduce((sum, t) => sum + (t.totalUsers || t.users || 0), 0);
  const paidTrafficShare = totalSessions > 0 
    ? (totalPaidSessions / totalSessions) * 100 
    : 0;

  // Conversion metrics
  const totalConversions = paidTraffic.reduce((sum, t) => sum + (t.keyEvents || t.conversions || 0), 0);
  const conversionRate = totalPaidSessions > 0 ? (totalConversions / totalPaidSessions) * 100 : 0;
  const totalRevenue = paidTraffic.reduce((sum, t) => sum + (t.totalRevenue || t.revenue || 0), 0);

  // Engagement metrics (weighted by sessions)
  let totalBounce = 0;
  let totalDuration = 0;
  let totalEngagement = 0;
  let totalPageviews = 0;
  let weightedSessions = 0;

  paidTraffic.forEach(t => {
    const sessions = t.sessions || 0;
    if (sessions > 0) {
      totalBounce += (t.bounceRate || 0) * sessions;
      totalDuration += (t.averageSessionDuration || t.avgSessionDuration || 0) * sessions;
      totalEngagement += (t.engagementRate || 0) * sessions;
      totalPageviews += (t.screenPageViewsPerSession || t.pagesPerSession || 1) * sessions;
      weightedSessions += sessions;
    }
  });

  const avgBounceRate = weightedSessions > 0 ? (totalBounce / weightedSessions) * 100 : 0;
  const avgSessionDuration = weightedSessions > 0 ? totalDuration / weightedSessions : 0;
  const avgEngagementRate = weightedSessions > 0 ? (totalEngagement / weightedSessions) * 100 : 0;
  const pagesPerSession = weightedSessions > 0 ? totalPageviews / weightedSessions : 0;

  // Campaign breakdown
  const campaignMap = new Map<string, any>();
  paidTraffic.forEach(t => {
    const campaign = t.campaign || '(unknown)';
    const existing = campaignMap.get(campaign) || {
      campaign,
      sessions: 0,
      users: 0,
      conversions: 0,
      revenue: 0,
      bounceSum: 0,
      durationSum: 0,
    };
    
    existing.sessions += t.sessions || 0;
    existing.users += t.totalUsers || t.users || 0;
    existing.conversions += t.keyEvents || t.conversions || 0;
    existing.revenue += t.totalRevenue || t.revenue || 0;
    existing.bounceSum += (t.bounceRate || 0) * (t.sessions || 0);
    existing.durationSum += (t.averageSessionDuration || 0) * (t.sessions || 0);
    
    campaignMap.set(campaign, existing);
  });

  const campaignMetrics: CampaignMetrics[] = Array.from(campaignMap.values())
    .map(c => ({
      campaign: c.campaign,
      sessions: c.sessions,
      users: c.users,
      conversions: c.conversions,
      conversionRate: c.sessions > 0 ? round((c.conversions / c.sessions) * 100) : 0,
      revenue: round(c.revenue),
      bounceRate: c.sessions > 0 ? round((c.bounceSum / c.sessions) * 100) : 0,
      avgSessionDuration: c.sessions > 0 ? Math.round(c.durationSum / c.sessions) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const totalCampaigns = campaignMetrics.length;
  const activeCampaigns = campaignMetrics.filter(c => c.sessions > 0).length;

  // Top performers
  const topByConversions = [...campaignMetrics].sort((a, b) => b.conversions - a.conversions)[0];
  const topByRevenue = [...campaignMetrics].sort((a, b) => b.revenue - a.revenue)[0];

  // Traffic quality score
  const trafficQualityScore = calculateTrafficQualityScore(
    avgBounceRate, 
    avgEngagementRate, 
    conversionRate
  );

  return {
    totalPaidSessions,
    totalPaidUsers,
    paidTrafficShare: round(paidTrafficShare),
    totalConversions,
    conversionRate: round(conversionRate),
    totalRevenue: round(totalRevenue),
    avgBounceRate: round(avgBounceRate),
    avgSessionDuration: Math.round(avgSessionDuration),
    avgEngagementRate: round(avgEngagementRate),
    pagesPerSession: round(pagesPerSession),
    totalCampaigns,
    activeCampaigns,
    campaignMetrics,
    topCampaignByConversions: topByConversions?.campaign || 'none',
    topCampaignByRevenue: topByRevenue?.campaign || 'none',
    trafficQualityScore: Math.round(trafficQualityScore),
    hasCostData: false, // Would be true if Google Ads API is connected
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateTrafficQualityScore(bounceRate: number, engagementRate: number, conversionRate: number): number {
  const bounceScore = Math.max(0, 100 - bounceRate);
  const engagementScore = Math.min(100, engagementRate * 1.5);
  const conversionScore = Math.min(100, (conversionRate / ADS_BENCHMARKS.conversionRate.excellent) * 100);
  
  return (bounceScore * 0.25 + engagementScore * 0.25 + conversionScore * 0.5);
}

// Generate alerts
function generateAlerts(metrics: AdsMetrics): AdsAlert[] {
  const alerts: AdsAlert[] = [];

  // No paid traffic
  if (metrics.totalPaidSessions === 0) {
    alerts.push({
      type: 'info',
      category: 'traffic',
      message: 'No paid advertising traffic detected. Consider running ads to accelerate growth.',
      metric: 'totalPaidSessions',
      value: 0,
    });
    return alerts;
  }

  // Missing cost data warning
  if (!metrics.hasCostData) {
    alerts.push({
      type: 'info',
      category: 'data',
      message: 'Connect Google Ads API to see ROAS, CPC, and Quality Score metrics.',
    });
  }

  // Low conversion rate
  if (metrics.conversionRate < ADS_BENCHMARKS.conversionRate.poor && metrics.totalPaidSessions > 100) {
    alerts.push({
      type: 'warning',
      category: 'conversion',
      message: `Paid traffic conversion rate (${metrics.conversionRate}%) is below average. Review landing pages and targeting.`,
      metric: 'conversionRate',
      value: metrics.conversionRate,
    });
  }

  // High bounce rate
  if (metrics.avgBounceRate > 60 && metrics.totalPaidSessions > 50) {
    alerts.push({
      type: 'warning',
      category: 'quality',
      message: `Paid traffic bounce rate (${metrics.avgBounceRate}%) is high. Check ad-to-landing-page relevance.`,
      metric: 'avgBounceRate',
      value: metrics.avgBounceRate,
    });
  }

  // Low-performing campaigns
  const lowPerformers = metrics.campaignMetrics.filter(c => 
    c.sessions > 50 && c.conversionRate < metrics.conversionRate * 0.5
  );
  if (lowPerformers.length > 0) {
    alerts.push({
      type: 'warning',
      category: 'campaign',
      message: `${lowPerformers.length} campaigns have below-average conversion rates. Consider pausing or optimizing.`,
      campaign: lowPerformers.map(c => c.campaign).join(', '),
    });
  }

  return alerts;
}

// Find opportunities
function findOpportunities(metrics: AdsMetrics): AdsOpportunity[] {
  const opportunities: AdsOpportunity[] = [];

  // No paid traffic
  if (metrics.totalPaidSessions === 0) {
    opportunities.push({
      type: 'start_ads',
      title: 'Start Paid Advertising',
      description: 'No paid traffic detected. Paid ads can accelerate growth and provide predictable traffic.',
      impact: 'high',
      estimatedLift: 'Paid channels can scale traffic 10x faster than organic',
    });
    return opportunities;
  }

  // High-converting campaigns - scale up
  const topConverters = metrics.campaignMetrics
    .filter(c => c.sessions > 20 && c.conversionRate > ADS_BENCHMARKS.conversionRate.good)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 3);

  if (topConverters.length > 0) {
    opportunities.push({
      type: 'scale_winners',
      title: 'Scale Top-Performing Campaigns',
      description: `${topConverters.length} campaigns have above-average conversion rates. Increase budget on these winners.`,
      impact: 'high',
      campaigns: topConverters.map(c => c.campaign),
      estimatedLift: '+50% conversions by reallocating budget to winners',
    });
  }

  // Poor performers - pause or optimize
  const poorPerformers = metrics.campaignMetrics
    .filter(c => c.sessions > 50 && c.conversionRate < ADS_BENCHMARKS.conversionRate.poor)
    .sort((a, b) => a.conversionRate - b.conversionRate)
    .slice(0, 3);

  if (poorPerformers.length > 0) {
    opportunities.push({
      type: 'optimize_losers',
      title: 'Fix or Pause Underperforming Campaigns',
      description: `${poorPerformers.length} campaigns have low conversion rates. Review targeting, ads, and landing pages.`,
      impact: 'medium',
      campaigns: poorPerformers.map(c => c.campaign),
      estimatedLift: 'Save wasted spend, improve overall ROAS',
    });
  }

  // Landing page optimization (high traffic, high bounce)
  const highBounce = metrics.campaignMetrics.filter(c => 
    c.sessions > 30 && c.bounceRate > 60
  );
  if (highBounce.length > 0) {
    opportunities.push({
      type: 'landing_page_optimization',
      title: 'Improve Landing Page Experience',
      description: `${highBounce.length} campaigns have high bounce rates. Test new landing pages or improve ad-to-page relevance.`,
      impact: 'high',
      campaigns: highBounce.map(c => c.campaign),
      estimatedLift: '-20% bounce rate = +30% conversion rate',
    });
  }

  // Connect Google Ads
  if (!metrics.hasCostData) {
    opportunities.push({
      type: 'connect_google_ads',
      title: 'Connect Google Ads for Complete Picture',
      description: 'Connect Google Ads API to see ROAS, CPC, Quality Score, and impression share metrics.',
      impact: 'medium',
      estimatedLift: 'Full visibility into ad spend efficiency',
    });
  }

  return opportunities;
}
