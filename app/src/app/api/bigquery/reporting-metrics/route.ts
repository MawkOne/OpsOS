import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "opsos-864a1";
const DATASET = "reporting";

export type ReportingGranularity = "daily" | "weekly" | "monthly";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateOnly(s: string | null): s is string {
  return typeof s === "string" && DATE_ONLY.test(s);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const granularity = (searchParams.get("granularity") || "daily") as ReportingGranularity;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  if (!["daily", "weekly", "monthly"].includes(granularity)) {
    return NextResponse.json({ error: "Invalid granularity; use daily, weekly, or monthly" }, { status: 400 });
  }

  const table =
    granularity === "daily"
      ? "daily_metrics"
      : granularity === "weekly"
        ? "weekly_metrics"
        : "monthly_metrics";

  const dateCol =
    granularity === "daily"
      ? "date"
      : granularity === "weekly"
        ? "week_start"
        : "month_start";

  const orderBy = dateCol;

  const useRange = (startDate && endDate && isValidDateOnly(startDate) && isValidDateOnly(endDate));
  const whereClause = useRange
    ? `WHERE ${dateCol} >= @startDate AND ${dateCol} <= @endDate`
    : "";

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      return NextResponse.json(
        { error: "BigQuery credentials not configured", rows: [] },
        { status: 200 }
      );
    }

    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });

    const query = useRange
      ? {
          query: `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET}.${table}\`
      ${whereClause}
      ORDER BY ${orderBy} DESC
      LIMIT 500
    `,
          params: { startDate, endDate },
        }
      : {
          query: `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET}.${table}\`
      ORDER BY ${orderBy} DESC
      LIMIT 500
    `,
        };

    const [rows] = await bq.query(query);
    
    return NextResponse.json({ 
      rows: rows || [], 
      granularity
    });
  } catch (err) {
    console.error("[reporting-metrics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", rows: [] },
      { status: 500 }
    );
  }
}
