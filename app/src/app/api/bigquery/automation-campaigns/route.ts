import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "opsos-864a1";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      return NextResponse.json(
        { error: "BigQuery credentials not configured", campaigns: [] },
        { status: 200 }
      );
    }

    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });

    const query = `
      SELECT 
        JSON_EXTRACT_SCALAR(source_breakdown, '$.campaign_id') as campaign_id,
        ANY_VALUE(entity_name) as campaign_name,
        SUM(CAST(sends AS INT64)) as total_sends,
        SUM(CAST(opens AS INT64)) as total_opens,
        SUM(CAST(clicks AS INT64)) as total_clicks,
        ROUND(AVG(CAST(open_rate AS FLOAT64)), 2) as avg_open_rate,
        ROUND(AVG(CAST(click_through_rate AS FLOAT64)), 2) as avg_ctr,
        MAX(date) as last_active_date
      FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
      WHERE entity_type = 'email_campaign_automation'
        AND date >= @startDate
        AND date <= @endDate
      GROUP BY campaign_id
      ORDER BY total_sends DESC
      LIMIT 100
    `;

    const options = {
      query,
      params: { startDate, endDate },
    };

    const [rows] = await bq.query(options);
    
    return NextResponse.json({ 
      campaigns: rows || []
    });
  } catch (err) {
    console.error("[automation-campaigns]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", campaigns: [] },
      { status: 500 }
    );
  }
}
