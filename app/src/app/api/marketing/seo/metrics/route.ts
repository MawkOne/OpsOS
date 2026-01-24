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

// Benchmarks for SEO metrics
const SEO_BENCHMARKS = {
  pageHealthScore: { good: 70, excellent: 85 },
  monthlyTrafficGrowth: { good: 5, excellent: 15 },
  top10KeywordGrowth: { good: 10, excellent: 25 },
};

interface SEOMetrics {
  // Keyword metrics
  totalKeywords: number;
  top3Keywords: number;
  top10Keywords: number;
  top20Keywords: number;
  avgPosition: number;
  totalSearchVolume: number;
  
  // Traffic metrics
  organicTrafficEstimate: number;
  trafficTrend: number; // % change
  
  // Backlink metrics
  totalBacklinks: number;
  referringDomains: number;
  dofollowBacklinks: number;
  backlinkVelocity: number; // new per week
  
  // Page health metrics
  avgPageHealthScore: number;
  pagesWithIssues: number;
  criticalIssues: number;
  
  // Calculated scores
  overallHealthScore: number;
  
  // Movement metrics
  keywordsGained: number;
  keywordsLost: number;
  keywordsImproved: number;
  keywordsDeclined: number;
}

interface SEOAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

interface SEOOpportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  keywords?: string[];
  estimatedTrafficGain?: number;
}

// GET - Retrieve stored SEO metrics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const period = searchParams.get("period") || "latest";

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
    // Get latest metrics
    const metricsRef = doc(db, "marketing_metrics_seo", organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No SEO metrics calculated yet. Run POST to calculate.",
      });
    }

    const data = metricsDoc.data();
    
    return NextResponse.json({
      hasData: true,
      organizationId,
      metrics: data.metrics,
      alerts: data.alerts || [],
      opportunities: data.opportunities || [],
      trends: data.trends || {},
      benchmarks: SEO_BENCHMARKS,
      calculatedAt: data.calculatedAt?.toDate?.() || null,
      period: data.period,
    });

  } catch (error) {
    console.error("Error fetching SEO metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch SEO metrics" },
      { status: 500 }
    );
  }
}

// POST - Calculate and store SEO metrics
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    console.log("Calculating SEO metrics for:", organizationId);

    // Fetch all SEO data from Firestore
    const [keywords, rankHistory, backlinks, referringDomains, pages] = await Promise.all([
      fetchKeywords(organizationId),
      fetchRankHistory(organizationId),
      fetchBacklinks(organizationId),
      fetchReferringDomains(organizationId),
      fetchPages(organizationId),
    ]);

    // Calculate metrics
    const metrics = calculateMetrics(keywords, rankHistory, backlinks, referringDomains, pages);
    
    // Generate alerts
    const alerts = generateAlerts(metrics, keywords);
    
    // Find opportunities
    const opportunities = findOpportunities(keywords, metrics);
    
    // Calculate trends from history
    const trends = calculateTrends(rankHistory);

    // Store in Firestore
    const metricsRef = doc(db, "marketing_metrics_seo", organizationId);
    await setDoc(metricsRef, {
      organizationId,
      metrics,
      alerts,
      opportunities,
      trends,
      period: "current",
      calculatedAt: Timestamp.now(),
      dataPoints: {
        keywords: keywords.length,
        backlinks: backlinks.length,
        referringDomains: referringDomains.length,
        pages: pages.length,
        historyMonths: rankHistory.length,
      },
    });

    // Also store historical snapshot
    const weekNumber = getWeekNumber(new Date());
    const historyRef = doc(
      db, 
      "marketing_metrics_seo", 
      organizationId, 
      "weekly", 
      `${new Date().getFullYear()}-W${weekNumber}`
    );
    await setDoc(historyRef, {
      metrics,
      calculatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      organizationId,
      metrics,
      alerts,
      opportunities,
      trends,
      dataPoints: {
        keywords: keywords.length,
        backlinks: backlinks.length,
        referringDomains: referringDomains.length,
        pages: pages.length,
      },
    });

  } catch (error) {
    console.error("Error calculating SEO metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate SEO metrics" },
      { status: 500 }
    );
  }
}

// Fetch keywords from Firestore
async function fetchKeywords(organizationId: string) {
  const keywordsRef = collection(db, "dataforseo_keywords");
  const q = query(keywordsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch rank history from Firestore
async function fetchRankHistory(organizationId: string) {
  const historyRef = collection(db, "dataforseo_rank_history");
  const q = query(
    historyRef, 
    where("organizationId", "==", organizationId)
  );
  const snapshot = await getDocs(q);
  // Sort in memory to avoid needing composite index
  return snapshot.docs
    .map(doc => doc.data())
    .sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA); // Descending
    })
    .slice(0, 13); // Last 13 months
}

// Fetch backlinks from Firestore
async function fetchBacklinks(organizationId: string) {
  const backlinksRef = collection(db, "dataforseo_backlinks");
  const q = query(backlinksRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch referring domains from Firestore
async function fetchReferringDomains(organizationId: string) {
  const domainsRef = collection(db, "dataforseo_referring_domains");
  const q = query(domainsRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Fetch pages from Firestore
async function fetchPages(organizationId: string) {
  const pagesRef = collection(db, "dataforseo_pages");
  const q = query(pagesRef, where("organizationId", "==", organizationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Calculate all metrics
function calculateMetrics(
  keywords: any[],
  rankHistory: any[],
  backlinks: any[],
  referringDomains: any[],
  pages: any[]
): SEOMetrics {
  // Keyword metrics
  const totalKeywords = keywords.length;
  const top3Keywords = keywords.filter(k => k.position <= 3).length;
  const top10Keywords = keywords.filter(k => k.position <= 10).length;
  const top20Keywords = keywords.filter(k => k.position <= 20).length;
  const avgPosition = totalKeywords > 0 
    ? keywords.reduce((sum, k) => sum + (k.position || 100), 0) / totalKeywords 
    : 0;
  const totalSearchVolume = keywords.reduce((sum, k) => sum + (k.searchVolume || 0), 0);

  // Traffic from history
  const latestHistory = rankHistory[0];
  const previousHistory = rankHistory[1];
  const organicTrafficEstimate = latestHistory?.metrics?.organicEtv || 0;
  const previousTraffic = previousHistory?.metrics?.organicEtv || 0;
  const trafficTrend = previousTraffic > 0 
    ? ((organicTrafficEstimate - previousTraffic) / previousTraffic) * 100 
    : 0;

  // Backlink metrics
  const totalBacklinks = backlinks.length;
  const dofollowBacklinks = backlinks.filter(b => b.isDofollow).length;
  const referringDomainsCount = referringDomains.length;
  
  // Estimate backlink velocity (would need historical data)
  const backlinkVelocity = 0; // TODO: Calculate from historical snapshots

  // Page health metrics
  const avgPageHealthScore = pages.length > 0
    ? pages.reduce((sum, p) => sum + (p.onpageScore || 0), 0) / pages.length
    : 0;
  const pagesWithIssues = pages.filter(p => (p.onpageScore || 0) < 70).length;
  const criticalIssues = pages.reduce((sum, p) => {
    const checks = p.checks || {};
    let issues = 0;
    if (checks.is_broken) issues++;
    if (checks.no_title) issues++;
    if (checks.no_description) issues++;
    if (checks.no_h1_tag) issues++;
    return sum + issues;
  }, 0);

  // Position movement (comparing to previous position)
  let keywordsImproved = 0;
  let keywordsDeclined = 0;
  keywords.forEach(k => {
    if (k.previousPosition && k.position) {
      if (k.position < k.previousPosition) keywordsImproved++;
      if (k.position > k.previousPosition) keywordsDeclined++;
    }
  });

  // Overall health score (weighted average)
  const overallHealthScore = calculateHealthScore({
    keywordScore: top10Keywords > 0 ? Math.min(100, (top10Keywords / totalKeywords) * 200) : 0,
    trafficScore: Math.min(100, organicTrafficEstimate / 10), // Scale based on expected traffic
    backlinkScore: Math.min(100, referringDomainsCount * 2), // 50 domains = 100%
    pageHealthScore: avgPageHealthScore,
  });

  return {
    totalKeywords,
    top3Keywords,
    top10Keywords,
    top20Keywords,
    avgPosition: Math.round(avgPosition * 10) / 10,
    totalSearchVolume,
    organicTrafficEstimate: Math.round(organicTrafficEstimate * 100) / 100,
    trafficTrend: Math.round(trafficTrend * 10) / 10,
    totalBacklinks,
    referringDomains: referringDomainsCount,
    dofollowBacklinks,
    backlinkVelocity,
    avgPageHealthScore: Math.round(avgPageHealthScore * 10) / 10,
    pagesWithIssues,
    criticalIssues,
    overallHealthScore: Math.round(overallHealthScore),
    keywordsGained: 0, // Would need comparison to previous period
    keywordsLost: 0,
    keywordsImproved,
    keywordsDeclined,
  };
}

// Calculate weighted health score
function calculateHealthScore(scores: {
  keywordScore: number;
  trafficScore: number;
  backlinkScore: number;
  pageHealthScore: number;
}): number {
  const weights = {
    keywordScore: 0.3,
    trafficScore: 0.3,
    backlinkScore: 0.2,
    pageHealthScore: 0.2,
  };
  
  return (
    scores.keywordScore * weights.keywordScore +
    scores.trafficScore * weights.trafficScore +
    scores.backlinkScore * weights.backlinkScore +
    scores.pageHealthScore * weights.pageHealthScore
  );
}

// Generate alerts based on metrics
function generateAlerts(metrics: SEOMetrics, keywords: any[]): SEOAlert[] {
  const alerts: SEOAlert[] = [];

  // Traffic decline alert
  if (metrics.trafficTrend < -10) {
    alerts.push({
      type: 'critical',
      category: 'traffic',
      message: `Organic traffic declined ${Math.abs(metrics.trafficTrend).toFixed(1)}% vs last month`,
      metric: 'trafficTrend',
      value: metrics.trafficTrend,
      threshold: -10,
    });
  } else if (metrics.trafficTrend < -5) {
    alerts.push({
      type: 'warning',
      category: 'traffic',
      message: `Organic traffic declined ${Math.abs(metrics.trafficTrend).toFixed(1)}% vs last month`,
      metric: 'trafficTrend',
      value: metrics.trafficTrend,
      threshold: -5,
    });
  }

  // Page health alert
  if (metrics.avgPageHealthScore < 60) {
    alerts.push({
      type: 'critical',
      category: 'technical',
      message: `Average page health score is ${metrics.avgPageHealthScore}% (below 60% threshold)`,
      metric: 'avgPageHealthScore',
      value: metrics.avgPageHealthScore,
      threshold: 60,
    });
  } else if (metrics.avgPageHealthScore < 70) {
    alerts.push({
      type: 'warning',
      category: 'technical',
      message: `Average page health score is ${metrics.avgPageHealthScore}% (below 70% target)`,
      metric: 'avgPageHealthScore',
      value: metrics.avgPageHealthScore,
      threshold: 70,
    });
  }

  // Critical issues alert
  if (metrics.criticalIssues > 0) {
    alerts.push({
      type: 'critical',
      category: 'technical',
      message: `${metrics.criticalIssues} critical technical SEO issues found`,
      metric: 'criticalIssues',
      value: metrics.criticalIssues,
      threshold: 0,
    });
  }

  // Keyword decline alert
  if (metrics.keywordsDeclined > metrics.keywordsImproved) {
    alerts.push({
      type: 'warning',
      category: 'rankings',
      message: `More keywords declining (${metrics.keywordsDeclined}) than improving (${metrics.keywordsImproved})`,
      metric: 'keywordsDeclined',
      value: metrics.keywordsDeclined,
    });
  }

  // No backlinks alert
  if (metrics.totalBacklinks === 0) {
    alerts.push({
      type: 'info',
      category: 'backlinks',
      message: 'No backlinks data available. Consider link building efforts.',
      metric: 'totalBacklinks',
      value: 0,
    });
  }

  return alerts;
}

// Find opportunities
function findOpportunities(keywords: any[], metrics: SEOMetrics): SEOOpportunity[] {
  const opportunities: SEOOpportunity[] = [];

  // Page 2 opportunities (positions 11-20 with good search volume)
  const page2Keywords = keywords.filter(k => 
    k.position >= 11 && k.position <= 20 && (k.searchVolume || 0) >= 50
  ).sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0));

  if (page2Keywords.length > 0) {
    const estimatedGain = page2Keywords.slice(0, 5).reduce((sum, k) => {
      // Estimate CTR improvement from position 15 to position 5
      return sum + (k.searchVolume || 0) * 0.05; // ~5% CTR gain
    }, 0);

    opportunities.push({
      type: 'ranking_opportunity',
      title: 'Page 2 to Page 1 Opportunities',
      description: `${page2Keywords.length} keywords are ranking on page 2 with good search volume. Optimizing content could push them to page 1.`,
      impact: page2Keywords.length >= 5 ? 'high' : 'medium',
      keywords: page2Keywords.slice(0, 5).map(k => k.keyword),
      estimatedTrafficGain: Math.round(estimatedGain),
    });
  }

  // High volume, poor position keywords
  const highVolumeKeywords = keywords.filter(k =>
    (k.searchVolume || 0) >= 100 && k.position > 20
  ).sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0));

  if (highVolumeKeywords.length > 0) {
    opportunities.push({
      type: 'content_opportunity',
      title: 'High Volume Keywords Need Optimization',
      description: `${highVolumeKeywords.length} high-volume keywords are ranking beyond position 20. Consider creating dedicated content.`,
      impact: 'high',
      keywords: highVolumeKeywords.slice(0, 5).map(k => k.keyword),
    });
  }

  // Technical optimization
  if (metrics.avgPageHealthScore < 80) {
    opportunities.push({
      type: 'technical_opportunity',
      title: 'Improve Page Health Scores',
      description: `Average page health is ${metrics.avgPageHealthScore}%. Fixing technical issues could improve rankings across all keywords.`,
      impact: metrics.avgPageHealthScore < 60 ? 'high' : 'medium',
    });
  }

  return opportunities;
}

// Calculate trends from history
function calculateTrends(rankHistory: any[]) {
  if (rankHistory.length < 2) {
    return { traffic: 'stable', keywords: 'stable', rankings: 'stable' };
  }

  const latest = rankHistory[0];
  const previous = rankHistory[1];
  const oldest = rankHistory[rankHistory.length - 1];

  const trafficChange = latest?.metrics?.organicEtv - (previous?.metrics?.organicEtv || 0);
  const keywordsChange = (latest?.totalKeywords || 0) - (previous?.totalKeywords || 0);
  
  return {
    traffic: trafficChange > 0 ? 'up' : trafficChange < 0 ? 'down' : 'stable',
    keywords: keywordsChange > 0 ? 'up' : keywordsChange < 0 ? 'down' : 'stable',
    rankings: 'stable', // Would need position data comparison
    monthOverMonth: {
      trafficChange,
      keywordsChange,
    },
    threeMonthTrend: rankHistory.length >= 3 ? {
      startTraffic: rankHistory[2]?.metrics?.organicEtv || 0,
      endTraffic: latest?.metrics?.organicEtv || 0,
    } : null,
  };
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
