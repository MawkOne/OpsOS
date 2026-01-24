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

// Benchmarks for page metrics
const PAGE_BENCHMARKS = {
  bounceRate: { poor: 70, good: 50, excellent: 35, unit: '%', inverse: true },
  engagementRate: { poor: 40, good: 55, excellent: 70, unit: '%' },
  conversionRate: { poor: 1, good: 2.5, excellent: 5, unit: '%' },
  avgTimeOnPage: { poor: 30, good: 120, excellent: 180, unit: 'seconds' },
};

interface PageMetrics {
  // Traffic metrics
  totalPageviews: number;
  uniquePageviews: number;
  totalSessions: number;
  
  // Engagement metrics
  avgEngagementRate: number;
  avgBounceRate: number;
  avgTimeOnPage: number;
  pagesPerSession: number;
  
  // Conversion metrics
  totalConversions: number;
  conversionRate: number;
  
  // Page breakdown
  totalPages: number;
  topPages: number; // Pages with above-average performance
  underperformingPages: number;
  
  // Landing page metrics
  totalLandingPages: number;
  avgLandingBounceRate: number;
  avgLandingConversionRate: number;
  
  // Calculated scores
  overallHealthScore: number;
  engagementScore: number;
  conversionScore: number;
}

interface PageAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
  benchmark?: number;
  pages?: string[];
}

interface PageOpportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  pages?: Array<{ path: string; metric: string; value: number }>;
  estimatedLift?: string;
}

// GET - Retrieve stored page metrics
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
    const metricsRef = doc(db, "marketing_metrics_pages", organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No page metrics calculated yet. Run POST to calculate.",
      });
    }

    const data = metricsDoc.data();
    
    return NextResponse.json({
      hasData: true,
      organizationId,
      metrics: data.metrics,
      alerts: data.alerts || [],
      opportunities: data.opportunities || [],
      topPerformingPages: data.topPerformingPages || [],
      underperformingPages: data.underperformingPages || [],
      benchmarks: PAGE_BENCHMARKS,
      calculatedAt: data.calculatedAt?.toDate?.() || null,
    });

  } catch (error) {
    console.error("Error fetching page metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch page metrics" },
      { status: 500 }
    );
  }
}

// POST - Calculate and store page metrics
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    console.log("Calculating page metrics for:", organizationId);

    // Fetch GA4 data from Firestore
    const [pagesData, landingPageData, eventsData] = await Promise.all([
      fetchPagesAndScreens(organizationId),
      fetchLandingPages(organizationId),
      fetchEvents(organizationId),
    ]);

    // Calculate metrics
    const metrics = calculateMetrics(pagesData, landingPageData, eventsData);
    
    // Generate alerts
    const alerts = generateAlerts(metrics, pagesData, landingPageData);
    
    // Find opportunities
    const opportunities = findOpportunities(pagesData, landingPageData, metrics);
    
    // Get top and bottom performing pages
    const topPerformingPages = getTopPerformingPages(pagesData);
    const underperformingPages = getUnderperformingPages(pagesData, landingPageData);

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_pages", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      topPerformingPages,
      underperformingPages,
      calculatedAt: Timestamp.now(),
      dataPoints: {
        pages: pagesData.length,
        landingPages: landingPageData.length,
        events: eventsData.length,
      },
    });

    // Store daily snapshot
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(db, "marketing_metrics_pages", organizationId, "daily", today);
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
      topPerformingPages,
      underperformingPages,
      dataPoints: {
        pages: pagesData.length,
        landingPages: landingPageData.length,
      },
    });

  } catch (error) {
    console.error("Error calculating page metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate page metrics" },
      { status: 500 }
    );
  }
}

// Fetch pages and screens data from Firestore (synced from GA4)
async function fetchPagesAndScreens(organizationId: string) {
  const pagesRef = collection(db, "ga_pages");
  const q = query(pagesRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch landing page data
async function fetchLandingPages(organizationId: string) {
  const landingRef = collection(db, "ga_landing_pages");
  const q = query(landingRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch events data
async function fetchEvents(organizationId: string) {
  const eventsRef = collection(db, "ga_events");
  const q = query(eventsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Calculate all metrics
function calculateMetrics(
  pages: any[],
  landingPages: any[],
  events: any[]
): PageMetrics {
  // Traffic metrics
  const totalPageviews = pages.reduce((sum, p) => sum + (p.screenPageViews || p.pageviews || 0), 0);
  const uniquePageviews = pages.reduce((sum, p) => sum + (p.totalUsers || p.users || 0), 0);
  const totalSessions = pages.reduce((sum, p) => sum + (p.sessions || 0), 0);

  // Engagement metrics (weighted by pageviews)
  let totalEngagementRate = 0;
  let totalBounceRate = 0;
  let totalTimeOnPage = 0;
  let weightedCount = 0;

  pages.forEach(p => {
    const views = p.screenPageViews || p.pageviews || 0;
    if (views > 0) {
      totalEngagementRate += (p.engagementRate || 0) * views;
      totalBounceRate += (p.bounceRate || 0) * views;
      totalTimeOnPage += (p.averageSessionDuration || p.avgTimeOnPage || 0) * views;
      weightedCount += views;
    }
  });

  const avgEngagementRate = weightedCount > 0 ? (totalEngagementRate / weightedCount) * 100 : 0;
  const avgBounceRate = weightedCount > 0 ? (totalBounceRate / weightedCount) * 100 : 0;
  const avgTimeOnPage = weightedCount > 0 ? totalTimeOnPage / weightedCount : 0;
  const pagesPerSession = totalSessions > 0 ? totalPageviews / totalSessions : 0;

  // Conversion metrics
  const conversionEvents = events.filter(e => 
    e.eventName === 'conversion' || 
    e.eventName === 'purchase' || 
    e.eventName === 'sign_up' ||
    e.eventName === 'generate_lead' ||
    e.isConversion
  );
  const totalConversions = conversionEvents.reduce((sum, e) => sum + (e.eventCount || 1), 0);
  const conversionRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;

  // Page breakdown
  const totalPages = pages.length;
  const avgPerformanceScore = pages.reduce((sum, p) => {
    const engagement = p.engagementRate || 0;
    const bounce = p.bounceRate || 1;
    return sum + (engagement * 100 / Math.max(bounce * 100, 1));
  }, 0) / Math.max(totalPages, 1);

  const topPages = pages.filter(p => {
    const score = (p.engagementRate || 0) * 100 / Math.max((p.bounceRate || 1) * 100, 1);
    return score > avgPerformanceScore;
  }).length;
  const underperformingPages = totalPages - topPages;

  // Landing page metrics
  const totalLandingPages = landingPages.length;
  let landingBounceSum = 0;
  let landingConversionSum = 0;
  let landingSessionSum = 0;

  landingPages.forEach(lp => {
    const sessions = lp.sessions || 0;
    landingBounceSum += (lp.bounceRate || 0) * sessions;
    landingConversionSum += (lp.conversions || 0);
    landingSessionSum += sessions;
  });

  const avgLandingBounceRate = landingSessionSum > 0 ? (landingBounceSum / landingSessionSum) * 100 : 0;
  const avgLandingConversionRate = landingSessionSum > 0 ? (landingConversionSum / landingSessionSum) * 100 : 0;

  // Calculate scores
  const engagementScore = calculateEngagementScore(avgEngagementRate, avgBounceRate, avgTimeOnPage);
  const conversionScore = calculateConversionScore(conversionRate, avgLandingConversionRate);
  const overallHealthScore = (engagementScore * 0.5 + conversionScore * 0.5);

  return {
    totalPageviews,
    uniquePageviews,
    totalSessions,
    avgEngagementRate: round(avgEngagementRate),
    avgBounceRate: round(avgBounceRate),
    avgTimeOnPage: Math.round(avgTimeOnPage),
    pagesPerSession: round(pagesPerSession),
    totalConversions,
    conversionRate: round(conversionRate),
    totalPages,
    topPages,
    underperformingPages,
    totalLandingPages,
    avgLandingBounceRate: round(avgLandingBounceRate),
    avgLandingConversionRate: round(avgLandingConversionRate),
    overallHealthScore: Math.round(overallHealthScore),
    engagementScore: Math.round(engagementScore),
    conversionScore: Math.round(conversionScore),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateEngagementScore(engagementRate: number, bounceRate: number, timeOnPage: number): number {
  const engagementScore = Math.min(100, (engagementRate / PAGE_BENCHMARKS.engagementRate.excellent) * 100);
  const bounceScore = Math.max(0, 100 - (bounceRate / PAGE_BENCHMARKS.bounceRate.poor) * 100);
  const timeScore = Math.min(100, (timeOnPage / PAGE_BENCHMARKS.avgTimeOnPage.excellent) * 100);
  
  return (engagementScore * 0.4 + bounceScore * 0.35 + timeScore * 0.25);
}

function calculateConversionScore(overallRate: number, landingRate: number): number {
  const overallScore = Math.min(100, (overallRate / PAGE_BENCHMARKS.conversionRate.excellent) * 100);
  const landingScore = Math.min(100, (landingRate / PAGE_BENCHMARKS.conversionRate.excellent) * 100);
  
  return (overallScore * 0.5 + landingScore * 0.5);
}

// Generate alerts
function generateAlerts(metrics: PageMetrics, pages: any[], landingPages: any[]): PageAlert[] {
  const alerts: PageAlert[] = [];

  // High bounce rate alert
  if (metrics.avgBounceRate > PAGE_BENCHMARKS.bounceRate.poor) {
    alerts.push({
      type: 'critical',
      category: 'engagement',
      message: `Average bounce rate (${metrics.avgBounceRate}%) is critically high`,
      metric: 'avgBounceRate',
      value: metrics.avgBounceRate,
      benchmark: PAGE_BENCHMARKS.bounceRate.poor,
    });
  } else if (metrics.avgBounceRate > PAGE_BENCHMARKS.bounceRate.good) {
    alerts.push({
      type: 'warning',
      category: 'engagement',
      message: `Average bounce rate (${metrics.avgBounceRate}%) is above target`,
      metric: 'avgBounceRate',
      value: metrics.avgBounceRate,
      benchmark: PAGE_BENCHMARKS.bounceRate.good,
    });
  }

  // Low engagement alert
  if (metrics.avgEngagementRate < PAGE_BENCHMARKS.engagementRate.poor) {
    alerts.push({
      type: 'critical',
      category: 'engagement',
      message: `Engagement rate (${metrics.avgEngagementRate}%) is critically low`,
      metric: 'avgEngagementRate',
      value: metrics.avgEngagementRate,
      benchmark: PAGE_BENCHMARKS.engagementRate.poor,
    });
  }

  // Low conversion alert
  if (metrics.conversionRate < PAGE_BENCHMARKS.conversionRate.poor && metrics.totalSessions > 100) {
    alerts.push({
      type: 'warning',
      category: 'conversion',
      message: `Conversion rate (${metrics.conversionRate}%) is below industry average`,
      metric: 'conversionRate',
      value: metrics.conversionRate,
      benchmark: PAGE_BENCHMARKS.conversionRate.good,
    });
  }

  // Find pages with very high bounce rates
  const highBouncepages = pages.filter(p => 
    (p.bounceRate || 0) > 0.8 && (p.screenPageViews || p.pageviews || 0) > 50
  );
  if (highBouncepages.length > 0) {
    alerts.push({
      type: 'warning',
      category: 'page_specific',
      message: `${highBouncepages.length} pages have bounce rates above 80%`,
      pages: highBouncepages.slice(0, 5).map(p => p.pagePath || p.pageTitle),
    });
  }

  return alerts;
}

// Find opportunities
function findOpportunities(
  pages: any[], 
  landingPages: any[], 
  metrics: PageMetrics
): PageOpportunity[] {
  const opportunities: PageOpportunity[] = [];

  // High traffic, high bounce pages (optimization targets)
  const highTrafficHighBounce = pages
    .filter(p => {
      const views = p.screenPageViews || p.pageviews || 0;
      const bounce = (p.bounceRate || 0) * 100;
      return views > 100 && bounce > 60;
    })
    .sort((a, b) => (b.screenPageViews || 0) - (a.screenPageViews || 0))
    .slice(0, 5);

  if (highTrafficHighBounce.length > 0) {
    opportunities.push({
      type: 'bounce_optimization',
      title: 'Reduce Bounce Rate on High-Traffic Pages',
      description: `${highTrafficHighBounce.length} high-traffic pages have bounce rates above 60%. Improving these could significantly increase engagement.`,
      impact: 'high',
      pages: highTrafficHighBounce.map(p => ({
        path: p.pagePath || p.pageTitle || 'Unknown',
        metric: 'bounceRate',
        value: round((p.bounceRate || 0) * 100),
      })),
      estimatedLift: '-20% bounce rate = +25% pages per session',
    });
  }

  // Landing pages with low conversion
  const lowConversionLanding = landingPages
    .filter(lp => {
      const sessions = lp.sessions || 0;
      const conversions = lp.conversions || 0;
      const rate = sessions > 0 ? (conversions / sessions) * 100 : 0;
      return sessions > 50 && rate < 1;
    })
    .sort((a, b) => (b.sessions || 0) - (a.sessions || 0))
    .slice(0, 5);

  if (lowConversionLanding.length > 0) {
    opportunities.push({
      type: 'landing_page_optimization',
      title: 'Improve Landing Page Conversions',
      description: `${lowConversionLanding.length} landing pages have conversion rates below 1% despite significant traffic.`,
      impact: 'high',
      pages: lowConversionLanding.map(lp => ({
        path: lp.landingPage || 'Unknown',
        metric: 'conversionRate',
        value: round(((lp.conversions || 0) / Math.max(lp.sessions || 1, 1)) * 100),
      })),
      estimatedLift: '+1% conversion rate on these pages could double conversions',
    });
  }

  // Low time on page (content not engaging)
  if (metrics.avgTimeOnPage < PAGE_BENCHMARKS.avgTimeOnPage.good) {
    opportunities.push({
      type: 'content_engagement',
      title: 'Increase Time on Page',
      description: `Average time on page (${metrics.avgTimeOnPage}s) is below target. Consider adding more engaging content, videos, or interactive elements.`,
      impact: 'medium',
      estimatedLift: '+30 seconds avg time = better SEO rankings',
    });
  }

  return opportunities;
}

// Get top performing pages
function getTopPerformingPages(pages: any[]) {
  return pages
    .map(p => ({
      path: p.pagePath || p.pageTitle || 'Unknown',
      pageviews: p.screenPageViews || p.pageviews || 0,
      engagementRate: round((p.engagementRate || 0) * 100),
      bounceRate: round((p.bounceRate || 0) * 100),
      avgTimeOnPage: Math.round(p.averageSessionDuration || p.avgTimeOnPage || 0),
    }))
    .filter(p => p.pageviews > 50)
    .sort((a, b) => {
      // Score by engagement / bounce ratio
      const scoreA = a.engagementRate / Math.max(a.bounceRate, 1);
      const scoreB = b.engagementRate / Math.max(b.bounceRate, 1);
      return scoreB - scoreA;
    })
    .slice(0, 10);
}

// Get underperforming pages
function getUnderperformingPages(pages: any[], landingPages: any[]) {
  const underperforming: any[] = [];

  // High traffic, poor engagement pages
  pages
    .filter(p => {
      const views = p.screenPageViews || p.pageviews || 0;
      const bounce = (p.bounceRate || 0) * 100;
      const engagement = (p.engagementRate || 0) * 100;
      return views > 100 && (bounce > 70 || engagement < 40);
    })
    .forEach(p => {
      underperforming.push({
        path: p.pagePath || p.pageTitle || 'Unknown',
        pageviews: p.screenPageViews || p.pageviews || 0,
        issue: (p.bounceRate || 0) * 100 > 70 ? 'High bounce rate' : 'Low engagement',
        value: (p.bounceRate || 0) * 100 > 70 
          ? round((p.bounceRate || 0) * 100) 
          : round((p.engagementRate || 0) * 100),
      });
    });

  return underperforming
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 10);
}
