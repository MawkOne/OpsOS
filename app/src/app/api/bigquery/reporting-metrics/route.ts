import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "opsos-864a1";
const DATASET = "reporting";

export type ReportingGranularity = "daily" | "weekly" | "monthly";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateOnly(s: string | null): s is string {
  return typeof s === "string" && DATE_ONLY.test(s);
}

interface CompanySnapshot {
  traffic: number;
  new_visitors: number;
  talent_signups: number;
  talent_conv_rate: number;
  company_signups: number;
  company_conv_rate: number;
  new_job_posts: number;
  revenue: number;
  live_jobs: number | null;
  job_views: number;
  applications: number;
  applications_per_job: number;
  hires: number;
  hire_rate: number;
}

function calculateSnapshot(rows: any[]): CompanySnapshot {
  if (!rows || rows.length === 0) {
    return {
      traffic: 0,
      new_visitors: 0,
      talent_signups: 0,
      talent_conv_rate: 0,
      company_signups: 0,
      company_conv_rate: 0,
      new_job_posts: 0,
      revenue: 0,
      live_jobs: null,
      job_views: 0,
      applications: 0,
      applications_per_job: 0,
      hires: 0,
      hire_rate: 0,
    };
  }

  // Sum metrics across the period
  const totals = rows.reduce(
    (acc, row) => ({
      sessions: acc.sessions + (Number(row.sessions) || 0),
      new_users: acc.new_users + (Number(row.new_users) || 0),
      talent_signups: acc.talent_signups + (Number(row.talent_signups) || 0),
      company_signups: acc.company_signups + (Number(row.company_signups) || 0),
      jobs_posted: acc.jobs_posted + (Number(row.jobs_posted) || 0),
      stripe_revenue: acc.stripe_revenue + (Number(row.stripe_revenue) || 0),
      job_views: acc.job_views + (Number(row.job_views) || 0),
      applications: acc.applications + (Number(row.applications) || 0),
      hires: acc.hires + (Number(row.hires) || 0),
    }),
    {
      sessions: 0,
      new_users: 0,
      talent_signups: 0,
      company_signups: 0,
      jobs_posted: 0,
      stripe_revenue: 0,
      job_views: 0,
      applications: 0,
      hires: 0,
    }
  );

  // Calculate conversion rates (excluding the other signup type from denominator)
  const talent_potential_visitors = totals.new_users - totals.company_signups;
  const company_potential_visitors = totals.new_users - totals.talent_signups;
  
  const talent_conv_rate = talent_potential_visitors > 0 
    ? (totals.talent_signups / talent_potential_visitors) * 100 
    : 0;
  
  const company_conv_rate = company_potential_visitors > 0 
    ? (totals.company_signups / company_potential_visitors) * 100 
    : 0;
  
  const applications_per_job = totals.jobs_posted > 0 
    ? totals.applications / totals.jobs_posted 
    : 0;
  
  const hire_rate = totals.applications > 0 
    ? (totals.hires / totals.applications) * 100 
    : 0;

  return {
    traffic: totals.sessions,
    new_visitors: totals.new_users,
    talent_signups: totals.talent_signups,
    talent_conv_rate: Math.round(talent_conv_rate * 100) / 100, // 2 decimal places
    company_signups: totals.company_signups,
    company_conv_rate: Math.round(company_conv_rate * 100) / 100,
    new_job_posts: totals.jobs_posted,
    revenue: Math.round(totals.stripe_revenue * 100) / 100,
    live_jobs: null, // TODO: Add live_jobs metric to reporting table
    job_views: totals.job_views,
    applications: totals.applications,
    applications_per_job: Math.round(applications_per_job * 100) / 100,
    hires: totals.hires,
    hire_rate: Math.round(hire_rate * 100) / 100,
  };
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
    
    // Calculate company snapshot (high-level KPIs)
    const snapshot = calculateSnapshot(rows);
    
    return NextResponse.json({ 
      rows: rows || [], 
      granularity,
      company_snapshot: snapshot
    });
  } catch (err) {
    console.error("[reporting-metrics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", rows: [] },
      { status: 500 }
    );
  }
}
