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
    
    // Also fetch product breakdown data
    let productData: any[] = [];
    let productDateColumns: string[] = [];
    
    if (useRange && startDate && endDate) {
      try {
        // Build date aggregation based on granularity
        let dateAggregation: string;
        if (granularity === "weekly") {
          dateAggregation = "DATE_TRUNC(date, WEEK(MONDAY))";
        } else if (granularity === "monthly") {
          dateAggregation = "DATE_TRUNC(date, MONTH)";
        } else {
          dateAggregation = "date";
        }
        
        const productQuery = `
          SELECT 
            ${dateAggregation} as period_date,
            source_breakdown
          FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
          WHERE organization_id = 'ytjobs'
            AND entity_type = 'marketplace_revenue'
            AND date >= @startDate
            AND date <= @endDate
          ORDER BY date
        `;
        
        const [productRows] = await bq.query({
          query: productQuery,
          params: { startDate, endDate },
          location: "northamerica-northeast1",
        });
        
        // Parse and aggregate product data
        const byDate: Record<string, Record<string, { revenue: number; purchases: number }>> = {};
        
        productRows.forEach((row: any) => {
          try {
            const breakdown = typeof row.source_breakdown === 'string' 
              ? JSON.parse(row.source_breakdown) 
              : row.source_breakdown;
            
            if (!breakdown?.by_product) return;
            
            // Use the period_date from BigQuery aggregation
            const dateValue = row.period_date?.value || row.period_date;
            const dateKey = typeof dateValue === 'string' ? dateValue : new Date(dateValue).toISOString().slice(0, 10);
            
            if (!byDate[dateKey]) {
              byDate[dateKey] = {};
            }
            
            Object.entries(breakdown.by_product).forEach(([productName, productDataItem]: [string, any]) => {
              if (!byDate[dateKey][productName]) {
                byDate[dateKey][productName] = { revenue: 0, purchases: 0 };
              }
              byDate[dateKey][productName].revenue += productDataItem.revenue || 0;
              byDate[dateKey][productName].purchases += productDataItem.count || 0;
            });
          } catch (err) {
            console.error("[reporting-metrics] Error processing product row:", err);
          }
        });
        
        // Transform to product rows
        const allProducts = new Set<string>();
        Object.values(byDate).forEach(dateData => {
          Object.keys(dateData).forEach(product => allProducts.add(product));
        });
        
        productData = Array.from(allProducts).map(product => {
          const row: any = { product };
          let totalRevenue = 0;
          let totalPurchases = 0;
          
          Object.keys(byDate).forEach(dateKey => {
            if (byDate[dateKey][product]) {
              row[dateKey] = byDate[dateKey][product].revenue;
              row[`${dateKey}_purchases`] = byDate[dateKey][product].purchases;
              totalRevenue += byDate[dateKey][product].revenue;
              totalPurchases += byDate[dateKey][product].purchases;
            } else {
              row[dateKey] = 0;
              row[`${dateKey}_purchases`] = 0;
            }
          });
          
          row.totalRevenue = totalRevenue;
          row.totalPurchases = totalPurchases;
          return row;
        });
        
        productData.sort((a, b) => b.totalRevenue - a.totalRevenue);
        productDateColumns = Object.keys(byDate).sort();
      } catch (productErr) {
        console.error("[reporting-metrics] Product data error:", productErr);
      }
    }
    
    return NextResponse.json({ 
      rows: rows || [], 
      granularity,
      products: productData,
      productDateColumns
    });
  } catch (err) {
    console.error("[reporting-metrics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", rows: [] },
      { status: 500 }
    );
  }
}

// Helper to get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
