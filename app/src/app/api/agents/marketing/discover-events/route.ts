import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'opsos-864a1',
});

interface EventInfo {
  eventName: string;
  category: string;
  totalUsers: number;
  totalCount: number;
  lastMonth: string;
  trend: 'up' | 'down' | 'stable';
}

// Categorize events by business function
function categorizeEvent(eventName: string): string {
  const name = eventName.toLowerCase();
  
  // Acquisition (top of funnel)
  if (name.includes('page_view') || name.includes('first_visit') || name.includes('session_start')) {
    return 'Acquisition';
  }
  
  // Activation (conversion events)
  if (name.includes('signup') || name.includes('sign_up') || name.includes('conversion') || 
      name.includes('verified') || name.includes('account') || name.includes('form_submit')) {
    return 'Activation';
  }
  
  // Monetization (revenue events)
  if (name.includes('purchase') || name.includes('checkout') || name.includes('cart') || 
      name.includes('payment') || name.includes('subscription')) {
    return 'Monetization';
  }
  
  // Retention (repeat usage)
  if (name.includes('notification') || name.includes('email') || name.includes('message')) {
    return 'Retention';
  }
  
  // Friction (blockers)
  if (name.includes('paywall') || name.includes('restriction') || name.includes('error')) {
    return 'Friction';
  }
  
  // Default: Engagement
  return 'Engagement';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Query to get all events with their data
    const query = `
      SELECT 
        JSON_VALUE(data, '$.eventName') as event_name,
        JSON_VALUE(data, '$.organizationId') as org_id,
        data
      FROM \`opsos-864a1.firestore_export.ga_events_raw_latest\`
      WHERE JSON_VALUE(data, '$.organizationId') = @orgId
    `;

    const [rows] = await bigquery.query({
      query,
      params: { orgId: organizationId },
    });

    const events: EventInfo[] = [];

    for (const row of rows) {
      const eventName = row.event_name;
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      
      // Extract months data
      const months = data.months || {};
      const monthKeys = Object.keys(months).sort().reverse(); // Most recent first
      const lastMonth = monthKeys[0] || '';
      const lastMonthData = months[lastMonth] || {};
      const prevMonthData = months[monthKeys[1]] || {};
      
      // Calculate trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      const lastCount = lastMonthData.events || lastMonthData.eventCount || 0;
      const prevCount = prevMonthData.events || prevMonthData.eventCount || 0;
      if (lastCount && prevCount) {
        const change = (lastCount - prevCount) / prevCount;
        if (change > 0.1) trend = 'up';
        else if (change < -0.1) trend = 'down';
      }
      
      // Calculate totals across all months
      let totalUsers = 0;
      let totalCount = 0;
      for (const monthData of Object.values(months)) {
        const md = monthData as any;
        totalUsers += md.users || 0;
        totalCount += md.events || md.eventCount || 0;
      }

      events.push({
        eventName,
        category: categorizeEvent(eventName),
        totalUsers,
        totalCount,
        lastMonth,
        trend,
      });
    }

    // Group by category
    const categorized = events.reduce((acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = [];
      }
      acc[event.category].push(event);
      return acc;
    }, {} as Record<string, EventInfo[]>);

    // Sort within each category by total count
    for (const category of Object.keys(categorized)) {
      categorized[category].sort((a, b) => b.totalCount - a.totalCount);
    }

    // Summary stats
    const summary = {
      totalEvents: events.length,
      totalEventCount: events.reduce((sum, e) => sum + e.totalCount, 0),
      totalUsers: events.reduce((sum, e) => sum + e.totalUsers, 0),
      categoryCounts: Object.keys(categorized).reduce((acc, cat) => {
        acc[cat] = categorized[cat].length;
        return acc;
      }, {} as Record<string, number>),
      trendingUp: events.filter(e => e.trend === 'up').length,
      trendingDown: events.filter(e => e.trend === 'down').length,
    };

    return NextResponse.json({
      success: true,
      summary,
      events: categorized,
      organizationId,
    });

  } catch (error) {
    console.error('Error discovering marketing events:', error);
    return NextResponse.json({ 
      error: 'Failed to discover events', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
