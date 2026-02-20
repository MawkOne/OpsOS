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
        { error: "BigQuery credentials not configured", lists: [] },
        { status: 200 }
      );
    }

    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });

    const query = `
      SELECT 
        JSON_EXTRACT_SCALAR(source_breakdown, '$.list_id') as list_id,
        JSON_EXTRACT_SCALAR(source_breakdown, '$.list_name') as list_name,
        MAX(CAST(JSON_EXTRACT_SCALAR(source_breakdown, '$.subscriber_count') AS INT64)) as subscriber_count,
        COUNT(DISTINCT date) as days_active,
        MAX(date) as last_updated
      FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
      WHERE entity_type = 'email_list'
        AND date >= @startDate
        AND date <= @endDate
      GROUP BY list_id, list_name
      ORDER BY subscriber_count DESC, list_name ASC
    `;

    const options = {
      query,
      params: { startDate, endDate },
    };

    const [rows] = await bq.query(options);
    
    return NextResponse.json({ 
      lists: rows || []
    });
  } catch (err) {
    console.error("[email-lists]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", lists: [] },
      { status: 500 }
    );
  }
}
