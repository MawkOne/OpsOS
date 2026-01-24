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

// Benchmarks for social traffic metrics
const SOCIAL_BENCHMARKS = {
  socialTrafficShare: { poor: 2, good: 5, excellent: 15, unit: '%' },
  socialConversionRate: { poor: 0.5, good: 1.5, excellent: 3, unit: '%' },
  engagementRate: { poor: 30, good: 50, excellent: 70, unit: '%' },
};

// Known social platforms
const SOCIAL_PLATFORMS = [
  { id: 'facebook', names: ['facebook', 'fb.com', 'm.facebook'] },
  { id: 'twitter', names: ['twitter', 't.co', 'x.com'] },
  { id: 'linkedin', names: ['linkedin', 'lnkd.in'] },
  { id: 'instagram', names: ['instagram', 'l.instagram'] },
  { id: 'youtube', names: ['youtube', 'youtu.be'] },
  { id: 'pinterest', names: ['pinterest'] },
  { id: 'reddit', names: ['reddit'] },
  { id: 'tiktok', names: ['tiktok'] },
  { id: 'telegram', names: ['telegram', 't.me'] },
];

interface PlatformMetrics {
  platform: string;
  sessions: number;
  users: number;
  conversions: number;
  conversionRate: number;
  bounceRate: number;
  avgSessionDuration: number;
  percentOfSocial: number;
}

interface SocialMetrics {
  // Traffic metrics
  totalSocialSessions: number;
  totalSocialUsers: number;
  socialTrafficShare: number; // % of total traffic
  
  // Engagement metrics
  avgBounceRate: number;
  avgSessionDuration: number;
  avgEngagementRate: number;
  pagesPerSession: number;
  
  // Conversion metrics
  totalConversions: number;
  conversionRate: number;
  
  // Platform breakdown
  platformCount: number;
  topPlatform: string;
  platformMetrics: PlatformMetrics[];
  
  // Trends
  trafficTrend: number; // % change (would need historical)
  
  // Calculated scores
  overallHealthScore: number;
  trafficQualityScore: number;
}

interface SocialAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
  platform?: string;
}

interface SocialOpportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  platforms?: string[];
  estimatedLift?: string;
}

// GET - Retrieve stored social metrics
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
    const metricsRef = doc(db, "marketing_metrics_social", organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No social metrics calculated yet. Run POST to calculate.",
      });
    }

    const data = metricsDoc.data();
    
    return NextResponse.json({
      hasData: true,
      organizationId,
      metrics: data.metrics,
      alerts: data.alerts || [],
      opportunities: data.opportunities || [],
      platformBreakdown: data.platformBreakdown || [],
      benchmarks: SOCIAL_BENCHMARKS,
      calculatedAt: data.calculatedAt?.toDate?.() || null,
      dataLimitations: [
        "Only tracking traffic TO site FROM social (via GA4)",
        "Native social metrics (likes, shares, followers) require platform API connections",
      ],
    });

  } catch (error) {
    console.error("Error fetching social metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch social metrics" },
      { status: 500 }
    );
  }
}

// POST - Calculate and store social metrics
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    console.log("Calculating social metrics for:", organizationId);

    // Fetch traffic data
    const trafficData = await fetchTrafficData(organizationId);
    
    // Separate social traffic
    const { socialTraffic, totalTraffic } = separateSocialTraffic(trafficData);

    // Calculate metrics
    const metrics = calculateMetrics(socialTraffic, totalTraffic);
    
    // Generate alerts
    const alerts = generateAlerts(metrics);
    
    // Find opportunities
    const opportunities = findOpportunities(metrics);

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_social", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      platformBreakdown: metrics.platformMetrics,
      calculatedAt: Timestamp.now(),
      dataPoints: {
        totalTrafficSources: trafficData.length,
        socialSources: socialTraffic.length,
      },
    });

    // Store daily snapshot
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(db, "marketing_metrics_social", organizationId, "daily", today);
    await setDoc(dailyRef, {
      metrics: {
        totalSocialSessions: metrics.totalSocialSessions,
        socialTrafficShare: metrics.socialTrafficShare,
        conversionRate: metrics.conversionRate,
        platformMetrics: metrics.platformMetrics,
      },
      calculatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      organizationId,
      metrics,
      alerts,
      opportunities,
      platformBreakdown: metrics.platformMetrics,
      dataLimitations: [
        "Only tracking traffic TO site FROM social (via GA4)",
        "Native social metrics (likes, shares, followers) require platform API connections",
      ],
    });

  } catch (error) {
    console.error("Error calculating social metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate social metrics" },
      { status: 500 }
    );
  }
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
        sessionSource: sourceName,
        source: sourceName,
        sessionDefaultChannelGroup: sourceName,
        channelGroup: sourceName,
        medium: 'referral',
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
        month,
      });
    });
  });
  
  return trafficRecords;
}

// Separate social traffic from total
function separateSocialTraffic(trafficData: any[]) {
  const socialTraffic: any[] = [];
  let totalSessions = 0;

  trafficData.forEach(t => {
    const source = (t.sessionSource || t.source || '').toLowerCase();
    const medium = (t.sessionMedium || t.medium || '').toLowerCase();
    const channel = (t.sessionDefaultChannelGroup || t.channelGroup || '').toLowerCase();
    const sessions = t.sessions || 0;
    
    totalSessions += sessions;

    // Check if it's social traffic
    const isSocial = 
      channel.includes('social') ||
      medium === 'social' ||
      medium === 'referral' && SOCIAL_PLATFORMS.some(p => 
        p.names.some(name => source.includes(name))
      ) ||
      SOCIAL_PLATFORMS.some(p => p.names.some(name => source.includes(name)));

    if (isSocial) {
      // Identify the platform
      let platform = 'other';
      for (const p of SOCIAL_PLATFORMS) {
        if (p.names.some(name => source.includes(name))) {
          platform = p.id;
          break;
        }
      }
      
      socialTraffic.push({
        ...t,
        identifiedPlatform: platform,
      });
    }
  });

  return { socialTraffic, totalTraffic: { sessions: totalSessions, sources: trafficData } };
}

// Calculate all metrics
function calculateMetrics(
  socialTraffic: any[],
  totalTraffic: { sessions: number; sources: any[] }
): SocialMetrics {
  // Aggregate social metrics
  const totalSocialSessions = socialTraffic.reduce((sum, t) => sum + (t.sessions || 0), 0);
  const totalSocialUsers = socialTraffic.reduce((sum, t) => sum + (t.totalUsers || t.users || 0), 0);
  const socialTrafficShare = totalTraffic.sessions > 0 
    ? (totalSocialSessions / totalTraffic.sessions) * 100 
    : 0;

  // Engagement metrics (weighted by sessions)
  let totalBounce = 0;
  let totalDuration = 0;
  let totalEngagement = 0;
  let totalPageviews = 0;
  let weightedSessions = 0;

  socialTraffic.forEach(t => {
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

  // Conversions
  const totalConversions = socialTraffic.reduce((sum, t) => sum + (t.keyEvents || t.conversions || 0), 0);
  const conversionRate = totalSocialSessions > 0 ? (totalConversions / totalSocialSessions) * 100 : 0;

  // Platform breakdown
  const platformMap = new Map<string, any>();
  socialTraffic.forEach(t => {
    const platform = t.identifiedPlatform || 'other';
    const existing = platformMap.get(platform) || {
      platform,
      sessions: 0,
      users: 0,
      conversions: 0,
      bounceSum: 0,
      durationSum: 0,
    };
    
    existing.sessions += t.sessions || 0;
    existing.users += t.totalUsers || t.users || 0;
    existing.conversions += t.keyEvents || t.conversions || 0;
    existing.bounceSum += (t.bounceRate || 0) * (t.sessions || 0);
    existing.durationSum += (t.averageSessionDuration || 0) * (t.sessions || 0);
    
    platformMap.set(platform, existing);
  });

  const platformMetrics: PlatformMetrics[] = Array.from(platformMap.values())
    .map(p => ({
      platform: p.platform,
      sessions: p.sessions,
      users: p.users,
      conversions: p.conversions,
      conversionRate: p.sessions > 0 ? round((p.conversions / p.sessions) * 100) : 0,
      bounceRate: p.sessions > 0 ? round((p.bounceSum / p.sessions) * 100) : 0,
      avgSessionDuration: p.sessions > 0 ? Math.round(p.durationSum / p.sessions) : 0,
      percentOfSocial: totalSocialSessions > 0 ? round((p.sessions / totalSocialSessions) * 100) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const platformCount = platformMetrics.length;
  const topPlatform = platformMetrics[0]?.platform || 'none';

  // Calculate scores
  const trafficQualityScore = calculateTrafficQualityScore(
    avgBounceRate, 
    avgEngagementRate, 
    conversionRate
  );
  const overallHealthScore = trafficQualityScore;

  return {
    totalSocialSessions,
    totalSocialUsers,
    socialTrafficShare: round(socialTrafficShare),
    avgBounceRate: round(avgBounceRate),
    avgSessionDuration: Math.round(avgSessionDuration),
    avgEngagementRate: round(avgEngagementRate),
    pagesPerSession: round(pagesPerSession),
    totalConversions,
    conversionRate: round(conversionRate),
    platformCount,
    topPlatform,
    platformMetrics,
    trafficTrend: 0, // Would need historical comparison
    overallHealthScore: Math.round(overallHealthScore),
    trafficQualityScore: Math.round(trafficQualityScore),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateTrafficQualityScore(bounceRate: number, engagementRate: number, conversionRate: number): number {
  const bounceScore = Math.max(0, 100 - bounceRate);
  const engagementScore = Math.min(100, engagementRate * 1.5);
  const conversionScore = Math.min(100, (conversionRate / SOCIAL_BENCHMARKS.socialConversionRate.excellent) * 100);
  
  return (bounceScore * 0.3 + engagementScore * 0.3 + conversionScore * 0.4);
}

// Generate alerts
function generateAlerts(metrics: SocialMetrics): SocialAlert[] {
  const alerts: SocialAlert[] = [];

  // No social traffic
  if (metrics.totalSocialSessions === 0) {
    alerts.push({
      type: 'info',
      category: 'traffic',
      message: 'No social traffic detected. Consider promoting your content on social media.',
      metric: 'totalSocialSessions',
      value: 0,
    });
    return alerts;
  }

  // Low social traffic share
  if (metrics.socialTrafficShare < SOCIAL_BENCHMARKS.socialTrafficShare.poor) {
    alerts.push({
      type: 'warning',
      category: 'traffic',
      message: `Social traffic (${metrics.socialTrafficShare}%) is below average. Consider increasing social media activity.`,
      metric: 'socialTrafficShare',
      value: metrics.socialTrafficShare,
    });
  }

  // Low conversion from social
  if (metrics.conversionRate < SOCIAL_BENCHMARKS.socialConversionRate.poor && metrics.totalSocialSessions > 100) {
    alerts.push({
      type: 'warning',
      category: 'conversion',
      message: `Social traffic conversion rate (${metrics.conversionRate}%) is low. Review landing pages and offers.`,
      metric: 'conversionRate',
      value: metrics.conversionRate,
    });
  }

  // High bounce rate from specific platform
  metrics.platformMetrics.forEach(p => {
    if (p.bounceRate > 70 && p.sessions > 50) {
      alerts.push({
        type: 'warning',
        category: 'platform_quality',
        message: `${p.platform} traffic has high bounce rate (${p.bounceRate}%). Review content relevance for this audience.`,
        platform: p.platform,
        value: p.bounceRate,
      });
    }
  });

  // Platform dependency
  const topPlatformShare = metrics.platformMetrics[0]?.percentOfSocial || 0;
  if (topPlatformShare > 80 && metrics.platformCount > 1) {
    alerts.push({
      type: 'info',
      category: 'diversification',
      message: `${metrics.topPlatform} accounts for ${topPlatformShare}% of social traffic. Consider diversifying.`,
      platform: metrics.topPlatform,
      value: topPlatformShare,
    });
  }

  return alerts;
}

// Find opportunities
function findOpportunities(metrics: SocialMetrics): SocialOpportunity[] {
  const opportunities: SocialOpportunity[] = [];

  // No social traffic
  if (metrics.totalSocialSessions === 0) {
    opportunities.push({
      type: 'start_social',
      title: 'Start Social Media Marketing',
      description: 'No social traffic detected. Create profiles and share content to drive traffic.',
      impact: 'high',
      estimatedLift: 'Social can drive 5-15% of traffic with consistent effort',
    });
    return opportunities;
  }

  // Low-performing platforms with potential
  const underperformingPlatforms = metrics.platformMetrics.filter(p => 
    p.sessions > 0 && p.conversionRate < metrics.conversionRate * 0.5
  );
  if (underperformingPlatforms.length > 0) {
    opportunities.push({
      type: 'platform_optimization',
      title: 'Optimize Underperforming Platforms',
      description: `Some platforms have low conversion rates. Review content strategy for: ${underperformingPlatforms.map(p => p.platform).join(', ')}`,
      impact: 'medium',
      platforms: underperformingPlatforms.map(p => p.platform),
      estimatedLift: '+50% conversions with better targeting',
    });
  }

  // Missing major platforms
  const activePlatforms = new Set(metrics.platformMetrics.map(p => p.platform));
  const majorPlatforms = ['facebook', 'linkedin', 'twitter'];
  const missingPlatforms = majorPlatforms.filter(p => !activePlatforms.has(p));
  
  if (missingPlatforms.length > 0) {
    opportunities.push({
      type: 'platform_expansion',
      title: 'Expand to More Platforms',
      description: `Not seeing traffic from: ${missingPlatforms.join(', ')}. These platforms could drive additional traffic.`,
      impact: 'medium',
      platforms: missingPlatforms,
      estimatedLift: '+20-30% social traffic per new active platform',
    });
  }

  // High-converting platform - double down
  const topConverter = metrics.platformMetrics
    .filter(p => p.sessions > 50)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];
  
  if (topConverter && topConverter.conversionRate > SOCIAL_BENCHMARKS.socialConversionRate.good) {
    opportunities.push({
      type: 'double_down',
      title: `Increase ${topConverter.platform} Investment`,
      description: `${topConverter.platform} has a ${topConverter.conversionRate}% conversion rate. Consider increasing content and ad spend here.`,
      impact: 'high',
      platforms: [topConverter.platform],
      estimatedLift: 'Higher ROI from proven channel',
    });
  }

  return opportunities;
}
