import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "opsos-864a1";

// Helper to get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const granularity = searchParams.get("granularity") || "daily";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "Start and end dates are required" },
      { status: 400 }
    );
  }

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    if (!credentials) {
      return NextResponse.json(
        { error: "BigQuery credentials not configured", products: [], dateColumns: [], granularity, totalProducts: 0 },
        { status: 200 }
      );
    }

    const bigquery = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });

    let dateGroupBy: string;
    let dateSelect: string;
    
    if (granularity === "weekly") {
      dateGroupBy = "week_num";
      dateSelect = `
        EXTRACT(ISOWEEK FROM date) as week_num,
        MIN(date) as week_start
      `;
    } else if (granularity === "monthly") {
      dateGroupBy = "month_num";
      dateSelect = `
        EXTRACT(MONTH FROM date) as month_num,
        MIN(date) as month_start
      `;
    } else {
      dateGroupBy = "date";
      dateSelect = "date";
    }

    const query = `
      SELECT 
        date,
        source_breakdown
      FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
      WHERE organization_id = 'ytjobs'
        AND entity_type = 'marketplace_revenue'
        AND date >= @startDate
        AND date <= @endDate
      ORDER BY date
    `;

    const options = {
      query,
      params: { startDate, endDate },
      location: "northamerica-northeast1",
    };

    const [rows] = await bigquery.query(options);

    // Parse product data from JSON and aggregate by time period
    const byDate: Record<string, Record<string, { revenue: number; purchases: number }>> = {};
    
    rows.forEach((row: any) => {
      try {
        const breakdown = typeof row.source_breakdown === 'string' 
          ? JSON.parse(row.source_breakdown) 
          : row.source_breakdown;
        
        if (!breakdown?.by_product) return;
        
        // Handle date - it might be a string, Date object, or have a .value property
        const dateValue = row.date?.value || row.date;
        const date = new Date(dateValue);
        let dateKey: string;
        
        if (granularity === "weekly") {
          const weekNum = getISOWeek(date);
          dateKey = `W${weekNum}`;
        } else if (granularity === "monthly") {
          const monthNum = date.getMonth() + 1;
          dateKey = `M${monthNum}`;
        } else {
          dateKey = typeof dateValue === 'string' ? dateValue : dateValue.toISOString().slice(0, 10);
        }
        
        if (!byDate[dateKey]) {
          byDate[dateKey] = {};
        }
        
        // Aggregate product data
        Object.entries(breakdown.by_product).forEach(([productName, productData]: [string, any]) => {
          if (!byDate[dateKey][productName]) {
            byDate[dateKey][productName] = { revenue: 0, purchases: 0 };
          }
          byDate[dateKey][productName].revenue += productData.revenue || 0;
          byDate[dateKey][productName].purchases += productData.count || 0;
        });
      } catch (err) {
        console.error("[product-revenue] Error processing row:", err, row);
      }
    });

    // Get all unique products
    const allProducts = new Set<string>();
    Object.values(byDate).forEach(dateData => {
      Object.keys(dateData).forEach(product => allProducts.add(product));
    });
    
    // Transform to table format: rows = products, columns = dates
    const productRows = Array.from(allProducts).map(product => {
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

    // Sort by total revenue descending
    productRows.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const dateColumns = Object.keys(byDate).sort();

    return NextResponse.json({
      products: productRows,
      dateColumns,
      granularity,
      totalProducts: productRows.length,
    });
  } catch (error: any) {
    console.error("[product-revenue] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch product revenue" },
      { status: 500 }
    );
  }
}
