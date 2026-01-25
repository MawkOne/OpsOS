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
  
  // Google Ads specific (only when connected)
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
  spendTrend?: number;
  conversionsTrend?: number;
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

    // Check if Google Ads is connected and has data
    const googleAdsData = await fetchGoogleAdsData(organizationId);
    
    let metrics: AdsMetrics;
    let dataLimitations: string[] = [];
    let campaignBreakdown: CampaignMetrics[] = [];

    if (googleAdsData && googleAdsData.campaigns?.length > 0) {
      // Use campaign data from Firestore (synced from GA4)
      console.log(`Using campaign data from ${googleAdsData.source}, hasCostData: ${googleAdsData.hasCostData}`);
      metrics = buildMetricsFromGoogleAds(googleAdsData);
      campaignBreakdown = googleAdsData.campaigns || [];
      
      if (googleAdsData.hasCostData) {
        dataLimitations = []; // Full data available
      } else {
        // Have campaigns but no spend data (Google Ads not linked to GA4)
        dataLimitations = [
          "Cost data (spend, CPC, CPM) requires Google Ads linked to GA4",
          "ROAS calculation requires ad spend data",
        ];
      }
    } else {
      // Fallback to GA4 traffic data
      console.log("Using GA4 traffic data (no Google Ads connection)");
      const trafficData = await fetchTrafficData(organizationId);
      const { paidTraffic, totalSessions } = separatePaidTraffic(trafficData);
      metrics = calculateMetrics(paidTraffic, totalSessions);
      campaignBreakdown = metrics.campaignMetrics;
      dataLimitations = [
        "Cost data (spend, CPC, CPM) requires Google Ads API connection",
        "ROAS calculation requires ad spend data",
        "Quality Score requires Google Ads API connection",
        "Impression and CTR data requires Google Ads API connection",
      ];
    }
    
    // Generate alerts
    const alerts = generateAlerts(metrics);
    
    // Find opportunities
    const opportunities = findOpportunities(metrics);

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_ads", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      campaignBreakdown,
      dataLimitations,
      calculatedAt: Timestamp.now(),
      dataSource: googleAdsData ? 'google_ads_api' : 'ga4_traffic',
      dataPoints: {
        campaigns: metrics.totalCampaigns,
        hasGoogleAds: !!googleAdsData,
      },
    });

    // Store daily snapshot for historical tracking
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(db, "marketing_metrics_ads", organizationId, "daily", today);
    await setDoc(dailyRef, {
      metrics: {
        totalPaidSessions: metrics.totalPaidSessions,
        totalConversions: metrics.totalConversions,
        conversionRate: metrics.conversionRate,
        totalRevenue: metrics.totalRevenue,
        // Include Google Ads specific metrics if available
        ...(googleAdsData ? {
          totalSpend: googleAdsData.accountMetrics?.totalSpend || 0,
          roas: googleAdsData.accountMetrics?.roas || 0,
          cpc: googleAdsData.accountMetrics?.cpc || 0,
          ctr: googleAdsData.accountMetrics?.ctr || 0,
        } : {}),
      },
      dataSource: googleAdsData ? 'google_ads_api' : 'ga4_traffic',
      calculatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      organizationId,
      metrics,
      alerts,
      opportunities,
      campaignBreakdown,
      dataLimitations,
      dataSource: googleAdsData ? 'google_ads_api' : 'ga4_traffic',
    });

  } catch (error) {
    console.error("Error calculating ads metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate ads metrics" },
      { status: 500 }
    );
  }
}

// Fetch Google Ads campaign data from Firestore (synced from GA4)
async function fetchGoogleAdsData(organizationId: string) {
  try {
    // Read from ga_campaigns collection (synced by GA4 sync)
    const campaignsRef = collection(db, "ga_campaigns");
    const q = query(campaignsRef, where("organizationId", "==", organizationId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log("No campaigns found in ga_campaigns collection");
      return null;
    }
    
    const campaigns: any[] = [];
    const allMonths = new Set<string>();
    
    // Aggregate metrics across all campaigns
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;
    let totalRevenue = 0;
    let totalSessions = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const months = data.months || {};
      
      let campaignSpend = 0;
      let campaignClicks = 0;
      let campaignImpressions = 0;
      let campaignConversions = 0;
      let campaignRevenue = 0;
      let campaignSessions = 0;
      
      Object.entries(months).forEach(([month, metrics]: [string, any]) => {
        allMonths.add(month);
        
        // Aggregate totals
        const spend = metrics.spend || 0;
        const clicks = metrics.clicks || 0;
        const impressions = metrics.impressions || 0;
        const conversions = metrics.conversions || 0;
        const revenue = metrics.revenue || 0;
        const sessions = metrics.sessions || 0;
        
        totalSpend += spend;
        totalClicks += clicks;
        totalImpressions += impressions;
        totalConversions += conversions;
        totalRevenue += revenue;
        totalSessions += sessions;
        
        campaignSpend += spend;
        campaignClicks += clicks;
        campaignImpressions += impressions;
        campaignConversions += conversions;
        campaignRevenue += revenue;
        campaignSessions += sessions;
      });
      
      campaigns.push({
        id: data.campaignId,
        name: data.campaignName,
        campaign: data.campaignName, // Alias for frontend compatibility
        spend: campaignSpend,
        clicks: campaignClicks,
        impressions: campaignImpressions,
        conversions: campaignConversions,
        conversionValue: campaignRevenue,
        revenue: campaignRevenue, // Alias for frontend compatibility
        sessions: campaignSessions,
        users: campaignSessions, // Approximate
        bounceRate: 0, // Not available from GA campaigns
        avgSessionDuration: 0, // Not available from GA campaigns
        monthlyData: months,
      });
    });
    
    // Sort months for trend calculation
    const sortedMonths = Array.from(allMonths).sort();
    const currentMonth = sortedMonths[sortedMonths.length - 1];
    const previousMonth = sortedMonths[sortedMonths.length - 2];
    
    // Calculate month-over-month trends
    let currentMonthConversions = 0;
    let previousMonthConversions = 0;
    let currentMonthSessions = 0;
    let previousMonthSessions = 0;
    
    campaigns.forEach(c => {
      if (c.monthlyData[currentMonth]) {
        currentMonthConversions += c.monthlyData[currentMonth].conversions || 0;
        currentMonthSessions += c.monthlyData[currentMonth].sessions || 0;
      }
      if (previousMonth && c.monthlyData[previousMonth]) {
        previousMonthConversions += c.monthlyData[previousMonth].conversions || 0;
        previousMonthSessions += c.monthlyData[previousMonth].sessions || 0;
      }
    });
    
    // Check if we have cost data (spend > 0 means Google Ads is linked)
    const hasCostData = totalSpend > 0;
    
    return {
      source: 'firestore_ga_campaigns',
      hasCostData,
      accountMetrics: {
        totalSpend,
        totalClicks,
        totalImpressions,
        totalConversions,
        totalConversionValue: totalRevenue,
        totalSessions,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        conversionRate: totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0,
      },
      campaigns: campaigns.map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
        roas: c.spend > 0 ? c.conversionValue / c.spend : 0,
        conversionRate: c.sessions > 0 ? (c.conversions / c.sessions) * 100 : 0,
        // Ensure frontend-expected fields exist
        campaign: c.name,
        revenue: c.conversionValue,
        bounceRate: c.bounceRate || 0,
        avgSessionDuration: c.avgSessionDuration || 0,
      })),
      trends: {
        conversionsChange: previousMonthConversions > 0 
          ? ((currentMonthConversions - previousMonthConversions) / previousMonthConversions) * 100 
          : 0,
        sessionsChange: previousMonthSessions > 0 
          ? ((currentMonthSessions - previousMonthSessions) / previousMonthSessions) * 100 
          : 0,
      },
      months: sortedMonths,
    };
  } catch (error) {
    console.error("Error fetching campaign data from Firestore:", error);
    return null;
  }
}

// Build metrics from campaign data (from Firestore ga_campaigns collection)
function buildMetricsFromGoogleAds(googleAdsData: any): AdsMetrics {
  const accountMetrics = googleAdsData.accountMetrics || {};
  const campaigns = googleAdsData.campaigns || [];
  const trends = googleAdsData.trends || {};
  const hasCostData = googleAdsData.hasCostData || false;
  
  // Map campaigns to our format
  const campaignMetrics: CampaignMetrics[] = campaigns
    .map((c: any) => ({
      campaign: c.name || c.id,
      sessions: c.sessions || 0,
      users: c.sessions || 0,
      conversions: c.conversions || 0,
      conversionRate: c.conversionRate || (c.sessions > 0 ? round((c.conversions / c.sessions) * 100) : 0),
      revenue: c.conversionValue || 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      // Cost data (may be 0 if Google Ads not linked)
      spend: c.spend || 0,
      impressions: c.impressions || 0,
      clicks: c.clicks || 0,
      ctr: c.ctr || 0,
      cpc: c.cpc || 0,
      cpa: c.cpa || 0,
      roas: c.roas || 0,
    }))
    .sort((a: any, b: any) => (b.sessions || 0) - (a.sessions || 0)); // Sort by sessions if no spend
  
  // Find top campaigns
  const sortedByConversions = [...campaigns].sort((a: any, b: any) => (b.conversions || 0) - (a.conversions || 0));
  const sortedByRevenue = [...campaigns].sort((a: any, b: any) => (b.conversionValue || 0) - (a.conversionValue || 0));
  
  return {
    totalPaidSessions: accountMetrics.totalSessions || 0,
    totalPaidUsers: accountMetrics.totalSessions || 0,
    paidTrafficShare: 0,
    totalConversions: accountMetrics.totalConversions || 0,
    conversionRate: accountMetrics.conversionRate || 0,
    totalRevenue: accountMetrics.totalConversionValue || 0,
    avgBounceRate: 0,
    avgSessionDuration: 0,
    avgEngagementRate: 0,
    pagesPerSession: 0,
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c: any) => (c.sessions || 0) > 0).length,
    campaignMetrics,
    topCampaignByConversions: sortedByConversions[0]?.name || 'none',
    topCampaignByRevenue: sortedByRevenue[0]?.name || 'none',
    trafficQualityScore: hasCostData 
      ? calculateQualityScoreFromAds(accountMetrics) 
      : Math.min(100, (accountMetrics.conversionRate || 0) * 20), // Simple score from conversion rate
    hasCostData,
    // Cost metrics (will be 0 if Google Ads not linked to GA4)
    totalSpend: accountMetrics.totalSpend || 0,
    totalImpressions: accountMetrics.totalImpressions || 0,
    totalClicks: accountMetrics.totalClicks || 0,
    ctr: accountMetrics.ctr || 0,
    cpc: accountMetrics.cpc || 0,
    cpa: accountMetrics.cpa || 0,
    roas: accountMetrics.roas || 0,
    spendTrend: trends.spendChange || 0,
    conversionsTrend: trends.conversionsChange || 0,
  };
}

function calculateQualityScoreFromAds(accountMetrics: any): number {
  const roas = accountMetrics.roas || 0;
  const convRate = accountMetrics.conversionRate || 0;
  const ctr = accountMetrics.ctr || 0;
  
  // Score based on ROAS, conversion rate, and CTR
  const roasScore = Math.min(100, (roas / ADS_BENCHMARKS.roas.excellent) * 100);
  const convScore = Math.min(100, (convRate / ADS_BENCHMARKS.conversionRate.excellent) * 100);
  const ctrScore = Math.min(100, (ctr / ADS_BENCHMARKS.ctr.excellent) * 100);
  
  return Math.round((roasScore * 0.4 + convScore * 0.4 + ctrScore * 0.2));
}

// Fetch traffic acquisition data
async function fetchTrafficData(organizationId: string) {
  // Try ga_traffic_sources first (from GA sync)
  const trafficRef = collection(db, "ga_traffic_sources");
  const q = query(trafficRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    // Fallback to ga_traffic if it exists
    const fallbackRef = collection(db, "ga_traffic");
    const fallbackQ = query(fallbackRef, where("organizationId", "==", organizationId));
    const fallbackSnapshot = await getDocs(fallbackQ);
    return fallbackSnapshot.docs.map(doc => doc.data());
  }
  
  // Transform ga_traffic_sources format to flat traffic records
  const trafficRecords: any[] = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const sourceName = data.sourceName || data.sourceId;
    const months = data.months || {};
    
    // Flatten monthly data into individual records
    Object.entries(months).forEach(([month, metrics]: [string, any]) => {
      trafficRecords.push({
        organizationId,
        sessionDefaultChannelGroup: sourceName,
        channelGroup: sourceName,
        medium: sourceName.toLowerCase().includes('paid') ? 'cpc' : 'organic',
        campaign: data.campaignName || '(not set)',
        sessions: metrics.sessions || 0,
        totalUsers: metrics.users || 0,
        users: metrics.users || 0,
        keyEvents: metrics.conversions || 0,
        conversions: metrics.conversions || 0,
        totalRevenue: metrics.revenue || 0,
        revenue: metrics.revenue || 0,
        bounceRate: metrics.bounceRate || 0,
        averageSessionDuration: metrics.avgEngagementTime || 0,
        engagementRate: (metrics.engagementRate || 0) / 100,
        screenPageViewsPerSession: metrics.eventsPerSession || 1,
        month,
      });
    });
  });
  
  return trafficRecords;
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
