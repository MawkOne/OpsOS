import { NextRequest, NextResponse } from 'next/server';

/**
 * Calculate traffic quality scores for all traffic sources
 * Phase 6.5: Traffic Quality Scoring
 * 
 * POST /api/traffic-quality/calculate
 */

interface TrafficQualityInput {
  sessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
  pagesPerSession: number;
  revenue: number;
}

function calculateTrafficQualityScore(metrics: TrafficQualityInput): number {
  // Traffic Quality Score Algorithm (0-100)
  // Weighted scoring across multiple dimensions
  
  let score = 0;
  
  // 1. Engagement Quality (30 points)
  // Low bounce rate is good
  const bounceScore = Math.max(0, (100 - metrics.bounceRate) * 0.3);
  score += bounceScore;
  
  // 2. Session Depth (25 points)  
  // More pages per session = higher quality
  const depthScore = Math.min(25, (metrics.pagesPerSession / 5) * 25); // Cap at 5 pages
  score += depthScore;
  
  // 3. Session Duration (20 points)
  // Longer sessions = higher quality (cap at 5 minutes)
  const durationScore = Math.min(20, (metrics.avgSessionDuration / 300) * 20);
  score += durationScore;
  
  // 4. Conversion Rate (15 points)
  // Direct conversion impact
  const conversionRate = metrics.sessions > 0 ? (metrics.conversions / metrics.sessions) * 100 : 0;
  const conversionScore = Math.min(15, conversionRate * 10); // 1.5% CVR = full points
  score += conversionScore;
  
  // 5. Revenue per Session (10 points)
  // Economic value of traffic
  const revenuePerSession = metrics.sessions > 0 ? metrics.revenue / metrics.sessions : 0;
  const revenueScore = Math.min(10, (revenuePerSession / 50) * 10); // $50/session = full points
  score += revenueScore;
  
  return Math.round(score);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, startDate, endDate } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // This would query BigQuery, calculate scores, and update the traffic_quality_score column
    // For now, return the calculation function for the ETL to use

    return NextResponse.json({
      success: true,
      message: 'Traffic quality calculation function ready',
      algorithm: {
        engagement: '30 points - based on bounce rate',
        depth: '25 points - pages per session (cap at 5)',
        duration: '20 points - session duration (cap at 5 min)',
        conversion: '15 points - conversion rate (1.5% = full)',
        revenue: '10 points - revenue per session ($50 = full)',
        totalPoints: 100,
      },
      note: 'This calculation is applied by the ETL function when aggregating daily metrics',
    });

  } catch (error) {
    console.error('Traffic quality calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate traffic quality' },
      { status: 500 }
    );
  }
}

// Export the calculation function for use by ETL
export { calculateTrafficQualityScore };
