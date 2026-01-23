import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'opsos-864a1',
});

interface TrafficSourceAnalysis {
  sourceName: string;
  sourceId: string;
  totalUsers: number;
  totalSessions: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  revenuePerUser: number;
  trend: 'up' | 'down' | 'stable';
  qualityScore: number; // 0-10
  monthlyData: Array<{
    month: string;
    users: number;
    sessions: number;
    conversions: number;
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const months = parseInt(searchParams.get('months') || '3'); // Default: last 3 months
  
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Query traffic sources
    const query = `
      SELECT 
        JSON_VALUE(data, '$.sourceName') as source_name,
        JSON_VALUE(data, '$.sourceId') as source_id,
        JSON_VALUE(data, '$.organizationId') as org_id,
        data
      FROM \`opsos-864a1.firestore_export.ga_traffic_sources_raw_latest\`
      WHERE JSON_VALUE(data, '$.organizationId') = @orgId
      ORDER BY source_name
    `;

    const [rows] = await bigquery.query({
      query,
      params: { orgId: organizationId },
    });

    const sources: TrafficSourceAnalysis[] = [];

    for (const row of rows) {
      const sourceName = row.source_name;
      const sourceId = row.source_id;
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      
      // Extract months data
      const monthsData = data.months || {};
      const monthKeys = Object.keys(monthsData).sort().reverse(); // Most recent first
      const recentMonths = monthKeys.slice(0, months);
      
      // Calculate totals
      let totalUsers = 0;
      let totalSessions = 0;
      let totalConversions = 0;
      let totalRevenue = 0;
      
      const monthlyData = recentMonths.map(month => {
        const monthData = monthsData[month] || {};
        const users = monthData.users || 0;
        const sessions = monthData.sessions || 0;
        const conversions = monthData.conversions || 0;
        const revenue = monthData.revenue || 0;
        
        totalUsers += users;
        totalSessions += sessions;
        totalConversions += conversions;
        totalRevenue += revenue;
        
        return {
          month,
          users,
          sessions,
          conversions,
        };
      });
      
      // Calculate conversion rate
      const conversionRate = totalUsers > 0 ? (totalConversions / totalUsers) * 100 : 0;
      const revenuePerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;
      
      // Calculate trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (monthlyData.length >= 2) {
        const latest = monthlyData[0].users;
        const previous = monthlyData[1].users;
        if (previous > 0) {
          const change = (latest - previous) / previous;
          if (change > 0.1) trend = 'up';
          else if (change < -0.1) trend = 'down';
        }
      }
      
      // Calculate quality score (0-10)
      // Factors: conversion rate, revenue per user, session depth
      const avgSessionsPerUser = totalUsers > 0 ? totalSessions / totalUsers : 0;
      const conversionScore = Math.min(conversionRate * 2, 4); // Max 4 points for 2%+ conversion
      const revenueScore = Math.min(revenuePerUser / 10, 3); // Max 3 points
      const engagementScore = Math.min(avgSessionsPerUser, 3); // Max 3 points
      const qualityScore = Math.round((conversionScore + revenueScore + engagementScore) * 10) / 10;
      
      sources.push({
        sourceName,
        sourceId,
        totalUsers,
        totalSessions,
        totalConversions,
        totalRevenue,
        conversionRate,
        revenuePerUser,
        trend,
        qualityScore,
        monthlyData,
      });
    }

    // Sort by quality score descending
    sources.sort((a, b) => b.qualityScore - a.qualityScore);

    // Calculate summary stats
    const summary = {
      totalSources: sources.length,
      totalUsers: sources.reduce((sum, s) => sum + s.totalUsers, 0),
      totalConversions: sources.reduce((sum, s) => sum + s.totalConversions, 0),
      totalRevenue: sources.reduce((sum, s) => sum + s.totalRevenue, 0),
      avgConversionRate: sources.length > 0 
        ? sources.reduce((sum, s) => sum + s.conversionRate, 0) / sources.length 
        : 0,
      topSource: sources.length > 0 ? sources[0].sourceName : null,
      lowestQualitySource: sources.length > 0 ? sources[sources.length - 1].sourceName : null,
    };

    // Identify insights
    const insights = [];
    
    // High-performing source
    if (sources.length > 0 && sources[0].qualityScore >= 7) {
      insights.push({
        type: 'success',
        title: `${sources[0].sourceName} is your highest quality source`,
        description: `${sources[0].conversionRate.toFixed(2)}% conversion rate, ${sources[0].totalConversions} conversions from ${sources[0].totalUsers} users`,
        recommendation: `Double down on ${sources[0].sourceName}. This source drives your best users.`,
      });
    }
    
    // Low-performing source
    if (sources.length > 0 && sources[sources.length - 1].qualityScore < 3) {
      const worst = sources[sources.length - 1];
      insights.push({
        type: 'warning',
        title: `${worst.sourceName} underperforming`,
        description: `Only ${worst.conversionRate.toFixed(2)}% conversion rate, quality score ${worst.qualityScore}/10`,
        recommendation: worst.sourceId.includes('paid') 
          ? `Review ad targeting and landing pages for paid campaigns.`
          : `Improve content quality or user experience for ${worst.sourceName} traffic.`,
      });
    }
    
    // Compare organic vs paid
    const organic = sources.find(s => s.sourceId === 'organic-search');
    const paid = sources.find(s => s.sourceId === 'paid-search');
    if (organic && paid && organic.conversionRate > paid.conversionRate * 2) {
      insights.push({
        type: 'info',
        title: 'Organic Search outperforms Paid Search',
        description: `Organic: ${organic.conversionRate.toFixed(2)}% vs Paid: ${paid.conversionRate.toFixed(2)}%`,
        recommendation: `Consider reallocating budget from paid search to SEO and content marketing.`,
      });
    }

    return NextResponse.json({
      success: true,
      summary,
      sources,
      insights,
      organizationId,
      analyzedMonths: months,
    });

  } catch (error) {
    console.error('Error analyzing traffic sources:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze traffic', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
