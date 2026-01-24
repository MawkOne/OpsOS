import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import {
  runComprehensiveAnalysis,
  fetchHistoricalMetrics,
  TimeSeriesPoint,
  ComprehensiveAnalysis,
} from "@/lib/marketingAnalysis";

/**
 * Marketing Analysis API
 * 
 * Runs comprehensive analysis for any marketing channel:
 * 1. Fetches historical metrics data
 * 2. Analyzes trends, seasonality, anomalies
 * 3. Finds causal relationships between metrics
 * 4. Checks related initiatives
 * 5. Generates forecasts
 * 6. Ranks by impact
 * 
 * Usage:
 *   POST /api/marketing/analyze
 *   Body: { organizationId, channel, kpis?: string[] }
 * 
 *   GET /api/marketing/analyze?organizationId=xxx&channel=seo
 */

const VALID_CHANNELS = ['seo', 'email', 'pages', 'content', 'social', 'ads'];

// GET - Retrieve stored analysis
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const channel = searchParams.get("channel");

  if (!organizationId || !channel) {
    return NextResponse.json(
      { error: "organizationId and channel are required" },
      { status: 400 }
    );
  }

  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: `Invalid channel. Valid options: ${VALID_CHANNELS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const analysisRef = doc(db, "marketing_analysis", `${organizationId}_${channel}`);
    const analysisDoc = await getDoc(analysisRef);

    if (!analysisDoc.exists()) {
      return NextResponse.json({
        hasData: false,
        message: "No analysis found. Run POST to generate analysis.",
      });
    }

    const data = analysisDoc.data();

    return NextResponse.json({
      hasData: true,
      organizationId,
      channel,
      analysis: data,
      analyzedAt: data.analyzedAt?.toDate?.() || null,
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

// POST - Run comprehensive analysis
export async function POST(request: NextRequest) {
  try {
    const { organizationId, channel, kpis = [] } = await request.json();

    if (!organizationId || !channel) {
      return NextResponse.json(
        { error: "organizationId and channel are required" },
        { status: 400 }
      );
    }

    if (!VALID_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Valid options: ${VALID_CHANNELS.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`Running comprehensive analysis for ${channel}...`);

    // Step 1: Fetch current metrics
    const currentMetrics = await fetchCurrentMetrics(organizationId, channel);
    if (!currentMetrics) {
      return NextResponse.json({
        error: `No metrics found for ${channel}. Run the ${channel}/metrics endpoint first.`,
      }, { status: 400 });
    }

    // Step 2: Fetch historical data
    const dailyHistory = await fetchHistoricalMetrics(organizationId, channel, 'daily');
    const weeklyHistory = await fetchHistoricalMetrics(organizationId, channel, 'weekly');
    
    // Merge historical data (prefer daily, fall back to weekly)
    const historicalData = mergeHistoricalData(dailyHistory, weeklyHistory);

    // Step 3: Fetch granular event data if available
    const eventData = await fetchEventData(organizationId, channel);

    // Step 4: Build KPI time series for causation analysis
    const kpiTimeSeries = buildKpiTimeSeries(historicalData, kpis);

    // Step 5: Run comprehensive analysis
    const analysis = await runComprehensiveAnalysis(
      organizationId,
      channel,
      historicalData,
      currentMetrics,
      kpiTimeSeries
    );

    // Step 6: Enhance with event-level insights
    if (Object.keys(eventData).length > 0) {
      analysis.summary.keyInsights.push(
        `Analyzed ${Object.keys(eventData).length} event types for deeper insights`
      );
    }

    // Step 7: Store analysis results
    const analysisRef = doc(db, "marketing_analysis", `${organizationId}_${channel}`);
    await setDoc(analysisRef, {
      ...analysis,
      analyzedAt: Timestamp.now(),
      dataPoints: {
        historicalMetrics: Object.keys(historicalData).length,
        historicalPeriods: Object.values(historicalData)[0]?.length || 0,
        eventTypes: Object.keys(eventData).length,
        relatedInitiatives: analysis.relatedInitiatives.length,
      },
    });

    // Return analysis
    return NextResponse.json({
      success: true,
      organizationId,
      channel,
      analysis: {
        // Summary for quick consumption
        summary: analysis.summary,
        impactRankings: analysis.impactRankings,
        
        // Detailed analysis
        trends: analysis.trends,
        seasonality: analysis.seasonality,
        anomalies: analysis.anomalies,
        causationAnalysis: analysis.causationAnalysis.slice(0, 10),
        
        // Initiative awareness
        relatedInitiatives: analysis.relatedInitiatives,
        
        // Forecasts
        forecasts: analysis.forecasts,
      },
      analyzedAt: new Date().toISOString(),
      dataPoints: {
        historicalMetrics: Object.keys(historicalData).length,
        historicalPeriods: Object.values(historicalData)[0]?.length || 0,
        eventTypes: Object.keys(eventData).length,
      },
    });

  } catch (error) {
    console.error("Error running analysis:", error);
    return NextResponse.json(
      { error: "Failed to run analysis", details: String(error) },
      { status: 500 }
    );
  }
}

// Fetch current metrics from the channel's metrics collection
async function fetchCurrentMetrics(
  organizationId: string,
  channel: string
): Promise<Record<string, number> | null> {
  try {
    const metricsRef = doc(db, `marketing_metrics_${channel}`, organizationId);
    const metricsDoc = await getDoc(metricsRef);

    if (!metricsDoc.exists()) return null;

    const data = metricsDoc.data();
    if (!data.metrics) return null;

    // Extract numeric metrics
    const numericMetrics: Record<string, number> = {};
    Object.entries(data.metrics).forEach(([key, value]) => {
      if (typeof value === 'number' && !key.includes('Score')) {
        numericMetrics[key] = value;
      }
    });

    return numericMetrics;
  } catch (error) {
    console.error("Error fetching current metrics:", error);
    return null;
  }
}

// Fetch event-level data for deeper analysis
async function fetchEventData(
  organizationId: string,
  channel: string
): Promise<Record<string, any[]>> {
  const eventData: Record<string, any[]> = {};

  try {
    // Channel-specific event sources
    const eventCollections: Record<string, string[]> = {
      seo: ['dataforseo_keywords', 'dataforseo_rank_history'],
      email: ['activecampaign_campaigns', 'activecampaign_automation_runs'],
      pages: ['ga_events', 'ga_pages'],
      content: ['ga_pages', 'dataforseo_keywords'],
      social: ['ga_traffic'],
      ads: ['ga_traffic', 'ga_events'],
    };

    const collections = eventCollections[channel] || [];

    for (const collName of collections) {
      try {
        const { collection, query, where, getDocs, limit } = await import("firebase/firestore");
        const ref = collection(db, collName);
        const q = query(
          ref, 
          where("organizationId", "==", organizationId),
          limit(1000) // Limit for performance
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          eventData[collName] = snapshot.docs.map(d => d.data());
        }
      } catch {
        // Collection may not exist
      }
    }
  } catch (error) {
    console.error("Error fetching event data:", error);
  }

  return eventData;
}

// Merge daily and weekly historical data
function mergeHistoricalData(
  daily: Record<string, TimeSeriesPoint[]>,
  weekly: Record<string, TimeSeriesPoint[]>
): Record<string, TimeSeriesPoint[]> {
  const merged: Record<string, TimeSeriesPoint[]> = { ...daily };

  // Add weekly data for metrics not in daily
  Object.entries(weekly).forEach(([metric, points]) => {
    if (!merged[metric]) {
      merged[metric] = points;
    } else if (points.length > merged[metric].length) {
      // Use weekly if it has more history
      merged[metric] = points;
    }
  });

  return merged;
}

// Build KPI time series for causation analysis
function buildKpiTimeSeries(
  historicalData: Record<string, TimeSeriesPoint[]>,
  kpiNames: string[]
): Record<string, TimeSeriesPoint[]> {
  const kpis: Record<string, TimeSeriesPoint[]> = {};

  // Default KPIs if none specified
  const defaultKpis = ['conversionRate', 'revenue', 'conversions', 'sessions', 'totalUsers'];
  const targetKpis = kpiNames.length > 0 ? kpiNames : defaultKpis;

  targetKpis.forEach(kpi => {
    if (historicalData[kpi]) {
      kpis[kpi] = historicalData[kpi];
    }
  });

  return kpis;
}
