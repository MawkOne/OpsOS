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

// Benchmarks for content metrics (from Clearscope/MarketMuse research)
const CONTENT_BENCHMARKS = {
  avgTimeOnPage: { poor: 60, good: 180, excellent: 300, unit: 'seconds' },
  bounceRate: { poor: 70, good: 50, excellent: 35, unit: '%', inverse: true },
  organicTrafficPerArticle: { poor: 10, good: 100, excellent: 500, unit: 'sessions' },
  backlinksPerArticle: { poor: 0, good: 3, excellent: 10, unit: 'links' },
  keywordsPerArticle: { poor: 1, good: 5, excellent: 15, unit: 'keywords' },
};

interface ContentMetrics {
  // Content inventory
  totalArticles: number;
  totalPageviews: number;
  totalOrganicSessions: number;
  
  // Engagement metrics
  avgTimeOnPage: number;
  avgBounceRate: number;
  avgEngagementRate: number;
  
  // SEO metrics
  totalKeywordsRanking: number;
  avgKeywordsPerArticle: number;
  totalBacklinks: number;
  avgBacklinksPerArticle: number;
  
  // Performance distribution
  topPerformingArticles: number;
  underperformingArticles: number;
  decayingArticles: number; // Traffic declining
  
  // Conversion metrics
  totalConversions: number;
  conversionRate: number;
  
  // Calculated scores
  overallHealthScore: number;
  engagementScore: number;
  seoScore: number;
}

interface ContentAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
  articles?: string[];
}

interface ContentOpportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  articles?: Array<{ title: string; url?: string; metric: string; value: number }>;
  estimatedLift?: string;
}

// GET - Retrieve stored content metrics
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
    const metricsRef = doc(db, "marketing_metrics_content", organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No content metrics calculated yet. Run POST to calculate.",
      });
    }

    const data = metricsDoc.data();
    
    return NextResponse.json({
      hasData: true,
      organizationId,
      metrics: data.metrics,
      alerts: data.alerts || [],
      opportunities: data.opportunities || [],
      topContent: data.topContent || [],
      underperformingContent: data.underperformingContent || [],
      benchmarks: CONTENT_BENCHMARKS,
      calculatedAt: data.calculatedAt?.toDate?.() || null,
    });

  } catch (error) {
    console.error("Error fetching content metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch content metrics" },
      { status: 500 }
    );
  }
}

// POST - Calculate and store content metrics
export async function POST(request: NextRequest) {
  try {
    const { organizationId, contentPathPattern = '/blog' } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    console.log("Calculating content metrics for:", organizationId);

    // Fetch data
    const [pagesData, trafficData, keywordsData, backlinksData] = await Promise.all([
      fetchPagesData(organizationId),
      fetchTrafficData(organizationId),
      fetchKeywordsData(organizationId),
      fetchBacklinksData(organizationId),
    ]);

    // Filter to content pages (blog, articles, etc.)
    const contentPages = pagesData.filter(p => {
      const path = p.pagePath || p.pageTitle || '';
      return path.includes(contentPathPattern) || 
             path.includes('/article') || 
             path.includes('/post') ||
             path.includes('/news');
    });

    // Calculate metrics
    const metrics = calculateMetrics(contentPages, trafficData, keywordsData, backlinksData);
    
    // Generate alerts
    const alerts = generateAlerts(metrics, contentPages);
    
    // Find opportunities
    const opportunities = findOpportunities(contentPages, keywordsData, metrics);
    
    // Get top and underperforming content
    const topContent = getTopContent(contentPages, keywordsData, backlinksData);
    const underperformingContent = getUnderperformingContent(contentPages);

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_content", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      topContent,
      underperformingContent,
      contentPathPattern,
      calculatedAt: Timestamp.now(),
      dataPoints: {
        totalPages: pagesData.length,
        contentPages: contentPages.length,
        keywords: keywordsData.length,
        backlinks: backlinksData.length,
      },
    });

    // Store weekly snapshot
    const weekNumber = getWeekNumber(new Date());
    const weeklyRef = doc(
      db, 
      "marketing_metrics_content", 
      organizationId, 
      "weekly", 
      `${new Date().getFullYear()}-W${weekNumber}`
    );
    await setDoc(weeklyRef, {
      metrics,
      calculatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      organizationId,
      metrics,
      alerts,
      opportunities,
      topContent,
      underperformingContent,
      dataPoints: {
        totalPages: pagesData.length,
        contentPages: contentPages.length,
        keywords: keywordsData.length,
        backlinks: backlinksData.length,
      },
    });

  } catch (error) {
    console.error("Error calculating content metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate content metrics" },
      { status: 500 }
    );
  }
}

// Fetch GA4 pages data
async function fetchPagesData(organizationId: string) {
  const pagesRef = collection(db, "ga_pages");
  const q = query(pagesRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  
  // Transform nested months format to flat page records with aggregated metrics
  const pageRecords: any[] = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const months = data.months || {};
    
    // Aggregate all months for each page
    let totalPageViews = 0;
    let totalUsers = 0;
    let totalDuration = 0;
    let totalConversions = 0;
    let monthCount = 0;
    
    Object.values(months).forEach((metrics: any) => {
      totalPageViews += metrics.pageViews || 0;
      totalUsers += metrics.users || 0;
      totalDuration += metrics.avgSessionDuration || 0;
      totalConversions += metrics.conversions || 0;
      monthCount++;
    });
    
    pageRecords.push({
      organizationId,
      pageId: data.pageId,
      pageTitle: data.pageTitle,
      pagePath: data.pagePath,
      screenPageViews: totalPageViews,
      pageviews: totalPageViews,
      totalUsers,
      users: totalUsers,
      averageSessionDuration: monthCount > 0 ? totalDuration / monthCount : 0,
      conversions: totalConversions,
    });
  });
  
  return pageRecords;
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
    
    // Check if this is organic traffic
    const isOrganic = sourceName.toLowerCase().includes('organic');
    const isGoogle = sourceName.toLowerCase().includes('google') || 
                     sourceName.toLowerCase().includes('search');
    
    // Flatten monthly data into individual records
    Object.entries(months).forEach(([month, metrics]: [string, any]) => {
      trafficRecords.push({
        organizationId,
        sessionSource: isGoogle ? 'google' : sourceName,
        source: isGoogle ? 'google' : sourceName,
        sessionMedium: isOrganic ? 'organic' : 'referral',
        medium: isOrganic ? 'organic' : 'referral',
        sessionDefaultChannelGroup: sourceName,
        sessions: metrics.sessions || 0,
        totalUsers: metrics.users || 0,
        users: metrics.users || 0,
        conversions: metrics.conversions || 0,
        revenue: metrics.revenue || 0,
        month,
      });
    });
  });
  
  return trafficRecords;
}

// Fetch keywords from DataForSEO
async function fetchKeywordsData(organizationId: string) {
  const keywordsRef = collection(db, "dataforseo_keywords");
  const q = query(keywordsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch backlinks from DataForSEO
async function fetchBacklinksData(organizationId: string) {
  const backlinksRef = collection(db, "dataforseo_backlinks");
  const q = query(backlinksRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Calculate all metrics
function calculateMetrics(
  contentPages: any[],
  trafficData: any[],
  keywords: any[],
  backlinks: any[]
): ContentMetrics {
  const totalArticles = contentPages.length;
  
  // Page metrics
  const totalPageviews = contentPages.reduce((sum, p) => sum + (p.screenPageViews || p.pageviews || 0), 0);
  
  // Organic traffic (from traffic acquisition data)
  const organicTraffic = trafficData.filter(t => 
    (t.sessionMedium === 'organic' || t.medium === 'organic') &&
    (t.sessionSource?.includes('google') || t.source?.includes('google'))
  );
  const totalOrganicSessions = organicTraffic.reduce((sum, t) => sum + (t.sessions || 0), 0);

  // Engagement metrics
  let totalTime = 0;
  let totalBounce = 0;
  let totalEngagement = 0;
  let weightedCount = 0;

  contentPages.forEach(p => {
    const views = p.screenPageViews || p.pageviews || 0;
    if (views > 0) {
      totalTime += (p.averageSessionDuration || p.avgTimeOnPage || 0) * views;
      totalBounce += (p.bounceRate || 0) * views;
      totalEngagement += (p.engagementRate || 0) * views;
      weightedCount += views;
    }
  });

  const avgTimeOnPage = weightedCount > 0 ? totalTime / weightedCount : 0;
  const avgBounceRate = weightedCount > 0 ? (totalBounce / weightedCount) * 100 : 0;
  const avgEngagementRate = weightedCount > 0 ? (totalEngagement / weightedCount) * 100 : 0;

  // SEO metrics - match keywords to content URLs
  const contentUrls = contentPages.map(p => p.pagePath || '').filter(Boolean);
  const contentKeywords = keywords.filter(k => {
    const url = k.url || '';
    return contentUrls.some(cu => url.includes(cu));
  });
  
  const totalKeywordsRanking = contentKeywords.length;
  const avgKeywordsPerArticle = totalArticles > 0 ? totalKeywordsRanking / totalArticles : 0;

  // Backlinks to content
  const contentBacklinks = backlinks.filter(b => {
    const urlTo = b.urlTo || '';
    return contentUrls.some(cu => urlTo.includes(cu));
  });
  const totalBacklinks = contentBacklinks.length;
  const avgBacklinksPerArticle = totalArticles > 0 ? totalBacklinks / totalArticles : 0;

  // Performance distribution
  const avgTrafficPerArticle = totalArticles > 0 ? totalPageviews / totalArticles : 0;
  const topPerformingArticles = contentPages.filter(p => 
    (p.screenPageViews || p.pageviews || 0) > avgTrafficPerArticle * 1.5
  ).length;
  const underperformingArticles = contentPages.filter(p => 
    (p.screenPageViews || p.pageviews || 0) < avgTrafficPerArticle * 0.3 &&
    (p.screenPageViews || p.pageviews || 0) > 0
  ).length;
  
  // Decaying content (would need historical data to properly calculate)
  const decayingArticles = 0; // TODO: Compare with previous period

  // Conversion metrics (placeholder - would need conversion tracking per page)
  const totalConversions = 0;
  const conversionRate = 0;

  // Calculate scores
  const engagementScore = calculateEngagementScore(avgTimeOnPage, avgBounceRate, avgEngagementRate);
  const seoScore = calculateSEOScore(avgKeywordsPerArticle, avgBacklinksPerArticle, totalArticles);
  const overallHealthScore = (engagementScore * 0.5 + seoScore * 0.5);

  return {
    totalArticles,
    totalPageviews,
    totalOrganicSessions,
    avgTimeOnPage: Math.round(avgTimeOnPage),
    avgBounceRate: round(avgBounceRate),
    avgEngagementRate: round(avgEngagementRate),
    totalKeywordsRanking,
    avgKeywordsPerArticle: round(avgKeywordsPerArticle),
    totalBacklinks,
    avgBacklinksPerArticle: round(avgBacklinksPerArticle),
    topPerformingArticles,
    underperformingArticles,
    decayingArticles,
    totalConversions,
    conversionRate: round(conversionRate),
    overallHealthScore: Math.round(overallHealthScore),
    engagementScore: Math.round(engagementScore),
    seoScore: Math.round(seoScore),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateEngagementScore(timeOnPage: number, bounceRate: number, engagementRate: number): number {
  const timeScore = Math.min(100, (timeOnPage / CONTENT_BENCHMARKS.avgTimeOnPage.excellent) * 100);
  const bounceScore = Math.max(0, 100 - (bounceRate / CONTENT_BENCHMARKS.bounceRate.poor) * 100);
  const engageScore = Math.min(100, engagementRate * 1.5); // Scale to 100
  
  return (timeScore * 0.4 + bounceScore * 0.3 + engageScore * 0.3);
}

function calculateSEOScore(keywordsPerArticle: number, backlinksPerArticle: number, totalArticles: number): number {
  if (totalArticles === 0) return 0;
  
  const keywordScore = Math.min(100, (keywordsPerArticle / CONTENT_BENCHMARKS.keywordsPerArticle.excellent) * 100);
  const backlinkScore = Math.min(100, (backlinksPerArticle / CONTENT_BENCHMARKS.backlinksPerArticle.excellent) * 100);
  
  return (keywordScore * 0.6 + backlinkScore * 0.4);
}

// Generate alerts
function generateAlerts(metrics: ContentMetrics, contentPages: any[]): ContentAlert[] {
  const alerts: ContentAlert[] = [];

  // No content alert
  if (metrics.totalArticles === 0) {
    alerts.push({
      type: 'info',
      category: 'inventory',
      message: 'No content/blog pages found. Consider creating content to drive organic traffic.',
    });
    return alerts;
  }

  // Low time on page
  if (metrics.avgTimeOnPage < CONTENT_BENCHMARKS.avgTimeOnPage.poor) {
    alerts.push({
      type: 'warning',
      category: 'engagement',
      message: `Average time on content pages (${metrics.avgTimeOnPage}s) is low. Content may not be engaging enough.`,
      metric: 'avgTimeOnPage',
      value: metrics.avgTimeOnPage,
    });
  }

  // High bounce rate
  if (metrics.avgBounceRate > CONTENT_BENCHMARKS.bounceRate.poor) {
    alerts.push({
      type: 'warning',
      category: 'engagement',
      message: `Content bounce rate (${metrics.avgBounceRate}%) is high. Consider improving content quality or relevance.`,
      metric: 'avgBounceRate',
      value: metrics.avgBounceRate,
    });
  }

  // Low keywords per article
  if (metrics.avgKeywordsPerArticle < CONTENT_BENCHMARKS.keywordsPerArticle.poor) {
    alerts.push({
      type: 'warning',
      category: 'seo',
      message: `Content is ranking for few keywords (avg ${metrics.avgKeywordsPerArticle} per article). Consider SEO optimization.`,
      metric: 'avgKeywordsPerArticle',
      value: metrics.avgKeywordsPerArticle,
    });
  }

  // No backlinks
  if (metrics.totalBacklinks === 0 && metrics.totalArticles > 0) {
    alerts.push({
      type: 'info',
      category: 'seo',
      message: 'No backlinks to content detected. Consider content promotion and link building.',
      metric: 'totalBacklinks',
      value: 0,
    });
  }

  // High underperforming ratio
  if (metrics.underperformingArticles > metrics.totalArticles * 0.5) {
    alerts.push({
      type: 'warning',
      category: 'performance',
      message: `${metrics.underperformingArticles} of ${metrics.totalArticles} articles are underperforming. Consider updating or consolidating.`,
    });
  }

  return alerts;
}

// Find opportunities
function findOpportunities(
  contentPages: any[], 
  keywords: any[],
  metrics: ContentMetrics
): ContentOpportunity[] {
  const opportunities: ContentOpportunity[] = [];

  if (metrics.totalArticles === 0) {
    opportunities.push({
      type: 'content_creation',
      title: 'Start Content Marketing',
      description: 'No blog/content pages found. Content marketing can drive 3x more leads than paid ads.',
      impact: 'high',
      estimatedLift: '3x lead generation potential',
    });
    return opportunities;
  }

  // Content optimization opportunity
  if (metrics.avgTimeOnPage < CONTENT_BENCHMARKS.avgTimeOnPage.good) {
    opportunities.push({
      type: 'content_depth',
      title: 'Increase Content Depth',
      description: `Average time on page (${metrics.avgTimeOnPage}s) suggests shallow content. Add more detail, examples, and visuals.`,
      impact: 'high',
      estimatedLift: '+50% time on page with richer content',
    });
  }

  // SEO optimization for content
  if (metrics.avgKeywordsPerArticle < CONTENT_BENCHMARKS.keywordsPerArticle.good) {
    opportunities.push({
      type: 'content_seo',
      title: 'Optimize Content for SEO',
      description: 'Articles are ranking for few keywords. Add related terms, improve headings, and enhance meta descriptions.',
      impact: 'high',
      estimatedLift: '+200% organic traffic with proper optimization',
    });
  }

  // Internal linking opportunity
  if (metrics.totalArticles >= 5) {
    opportunities.push({
      type: 'internal_linking',
      title: 'Improve Internal Linking',
      description: `With ${metrics.totalArticles} articles, ensure strong internal linking to distribute page authority and improve navigation.`,
      impact: 'medium',
      estimatedLift: '+15% pageviews per session',
    });
  }

  // Content promotion
  if (metrics.totalBacklinks === 0) {
    opportunities.push({
      type: 'content_promotion',
      title: 'Promote Content for Backlinks',
      description: 'No backlinks detected. Share content on social media, reach out to industry sites, and consider guest posting.',
      impact: 'high',
      estimatedLift: 'Each quality backlink = ~3% ranking boost',
    });
  }

  return opportunities;
}

// Get top performing content
function getTopContent(contentPages: any[], keywords: any[], backlinks: any[]) {
  return contentPages
    .map(p => {
      const path = p.pagePath || '';
      const pageKeywords = keywords.filter(k => (k.url || '').includes(path));
      const pageBacklinks = backlinks.filter(b => (b.urlTo || '').includes(path));
      
      return {
        title: p.pageTitle || p.pagePath || 'Unknown',
        path,
        pageviews: p.screenPageViews || p.pageviews || 0,
        avgTimeOnPage: Math.round(p.averageSessionDuration || p.avgTimeOnPage || 0),
        bounceRate: round((p.bounceRate || 0) * 100),
        keywords: pageKeywords.length,
        backlinks: pageBacklinks.length,
      };
    })
    .filter(p => p.pageviews > 0)
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 10);
}

// Get underperforming content
function getUnderperformingContent(contentPages: any[]) {
  const avgPageviews = contentPages.length > 0
    ? contentPages.reduce((sum, p) => sum + (p.screenPageViews || p.pageviews || 0), 0) / contentPages.length
    : 0;

  return contentPages
    .filter(p => {
      const views = p.screenPageViews || p.pageviews || 0;
      const bounce = (p.bounceRate || 0) * 100;
      return (views < avgPageviews * 0.3 && views > 0) || bounce > 80;
    })
    .map(p => ({
      title: p.pageTitle || p.pagePath || 'Unknown',
      path: p.pagePath || '',
      pageviews: p.screenPageViews || p.pageviews || 0,
      bounceRate: round((p.bounceRate || 0) * 100),
      issue: (p.screenPageViews || p.pageviews || 0) < avgPageviews * 0.3 
        ? 'Low traffic' 
        : 'High bounce rate',
    }))
    .sort((a, b) => a.pageviews - b.pageviews)
    .slice(0, 10);
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
