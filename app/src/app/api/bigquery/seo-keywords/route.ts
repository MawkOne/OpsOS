import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "opsos-864a1";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const limit = searchParams.get("limit") || "100";

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      return NextResponse.json(
        { error: "BigQuery credentials not configured", keywords: [] },
        { status: 200 }
      );
    }

    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });

    // Get current keyword rankings
    const keywordsQuery = `
      WITH latest_rankings AS (
        SELECT 
          canonical_entity_id as keyword,
          date,
          seo_position as position,
          seo_position_change as position_change,
          seo_search_volume as search_volume,
          JSON_EXTRACT_SCALAR(source_breakdown, '$.cpc') as cpc,
          JSON_EXTRACT_SCALAR(source_breakdown, '$.competition') as competition,
          ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
        FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
        WHERE entity_type = 'keyword'
          AND date >= @startDate
          AND date <= @endDate
          AND seo_position IS NOT NULL
      )
      SELECT 
        keyword,
        date,
        position,
        position_change,
        search_volume,
        CAST(cpc AS FLOAT64) as cpc,
        CAST(competition AS FLOAT64) as competition
      FROM latest_rankings
      WHERE rn = 1
      ORDER BY position ASC
      LIMIT @limit
    `;

    const [keywordsRaw] = await bq.query({
      query: keywordsQuery,
      params: { startDate, endDate, limit: parseInt(limit) },
    });

    // Fix date formatting for keywords
    const keywords = (keywordsRaw || []).map((row: any) => ({
      ...row,
      date: row.date?.value || row.date,
    }));

    // Get position distribution
    const distributionQuery = `
      WITH latest_data AS (
        SELECT 
          seo_position,
          ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
        FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
        WHERE entity_type = 'keyword'
          AND date >= @startDate
          AND date <= @endDate
          AND seo_position IS NOT NULL
      )
      SELECT 
        CASE 
          WHEN seo_position <= 3 THEN 'top_3'
          WHEN seo_position <= 10 THEN 'top_10'
          WHEN seo_position <= 20 THEN 'striking_distance'
          WHEN seo_position <= 50 THEN 'page_2_5'
          ELSE 'beyond_50'
        END as position_tier,
        COUNT(*) as keyword_count
      FROM latest_data
      WHERE rn = 1
      GROUP BY position_tier
    `;

    const [distribution] = await bq.query({
      query: distributionQuery,
      params: { startDate, endDate },
    });

    // Get overview stats
    const statsQuery = `
      WITH latest_data AS (
        SELECT 
          canonical_entity_id,
          seo_position,
          seo_search_volume,
          ROW_NUMBER() OVER (PARTITION BY canonical_entity_id ORDER BY date DESC) as rn
        FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
        WHERE entity_type = 'keyword'
          AND date >= @startDate
          AND date <= @endDate
          AND seo_position IS NOT NULL
      )
      SELECT 
        COUNT(DISTINCT canonical_entity_id) as total_keywords,
        COUNT(CASE WHEN seo_position <= 10 THEN 1 END) as keywords_top_10,
        COUNT(CASE WHEN seo_position <= 3 THEN 1 END) as keywords_top_3,
        COUNT(CASE WHEN seo_position BETWEEN 11 AND 20 THEN 1 END) as keywords_striking_distance,
        AVG(seo_position) as avg_position,
        SUM(seo_search_volume) as total_search_volume
      FROM latest_data
      WHERE rn = 1
    `;

    const [statsResult] = await bq.query({
      query: statsQuery,
      params: { startDate, endDate },
    });

    const stats = statsResult[0] || {
      total_keywords: 0,
      keywords_top_10: 0,
      keywords_top_3: 0,
      keywords_striking_distance: 0,
      avg_position: 0,
      total_search_volume: 0,
    };

    // Get backlink data
    const backlinksQuery = `
      SELECT 
        date,
        backlinks_total,
        backlinks_change,
        domain_rank
      FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
      WHERE entity_type = 'backlinks'
        AND date >= @startDate
        AND date <= @endDate
      ORDER BY date DESC
      LIMIT 30
    `;

    const [backlinksRaw] = await bq.query({
      query: backlinksQuery,
      params: { startDate, endDate },
    });

    // Fix date formatting for backlinks
    const backlinks = (backlinksRaw || []).map((row: any) => ({
      ...row,
      date: row.date?.value || row.date,
    }));

    // Get biggest movers (last 7 days)
    const moversQuery = `
      WITH recent_positions AS (
        SELECT 
          canonical_entity_id as keyword,
          date,
          seo_position as position,
          LAG(seo_position) OVER (PARTITION BY canonical_entity_id ORDER BY date) as prev_position,
          seo_search_volume as search_volume
        FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
        WHERE entity_type = 'keyword'
          AND date >= DATE_SUB(@endDate, INTERVAL 7 DAY)
          AND date <= @endDate
          AND seo_position IS NOT NULL
      ),
      position_changes AS (
        SELECT 
          keyword,
          MAX(position) as current_position,
          MIN(prev_position) as old_position,
          MAX(search_volume) as search_volume,
          MAX(position) - MIN(prev_position) as position_change
        FROM recent_positions
        WHERE prev_position IS NOT NULL
        GROUP BY keyword
      )
      SELECT 
        keyword,
        current_position,
        old_position,
        position_change,
        search_volume
      FROM position_changes
      WHERE position_change != 0
      ORDER BY ABS(position_change) DESC
      LIMIT 20
    `;

    const [movers] = await bq.query({
      query: moversQuery,
      params: { startDate, endDate },
    });

    return NextResponse.json({
      keywords: keywords || [],
      distribution: distribution || [],
      stats: stats,
      backlinks: backlinks || [],
      movers: movers || [],
    });
  } catch (err) {
    console.error("[seo-keywords]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", keywords: [] },
      { status: 500 }
    );
  }
}
