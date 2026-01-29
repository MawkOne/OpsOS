import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Sync DataForSEO data from Firestore to BigQuery daily_entity_metrics
 * This bridges the gap between DataForSEO collections and detector queries
 * 
 * POST /api/dataforseo/sync-to-bigquery
 */

const bq = new BigQuery({ projectId: 'opsos-864a1' });

export async function POST(request: NextRequest) {
  try {
    const { organizationId, backfillHistory = true } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    console.log('Syncing DataForSEO data to BigQuery for org:', organizationId, '(backfill:', backfillHistory, ')');

    const results = {
      pagesProcessed: 0,
      keywordsProcessed: 0,
      backlinksProcessed: 0,
      historicalMonthsProcessed: 0,
      rowsInserted: 0,
    };

    // 1. Fetch historical rank data for backfill (if enabled)
    const historicalRows: any[] = [];
    
    if (backfillHistory) {
      console.log('Fetching historical rank data...');
      const historyQuery = query(
        collection(db, 'dataforseo_rank_history'),
        where('organizationId', '==', organizationId)
      );
      const historySnap = await getDocs(historyQuery);
      
      historySnap.forEach(doc => {
        const data = doc.data();
        const year = data.year;
        const month = data.month;
        
        if (!year || !month) return;
        
        // Use last day of month
        const lastDay = new Date(year, month, 0).getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        
        const metrics = data.metrics || {};
        const rankDist = data.rankDistribution || {};
        
        historicalRows.push({
          organization_id: organizationId,
          date: dateStr,
          canonical_entity_id: data.domain || 'domain',
          entity_type: 'domain',
          
          // Aggregate metrics
          sessions: metrics.organicEtv || 0,
          impressions: metrics.organicCount || 0,
          seo_position: 15.0, // Rough average
          seo_search_volume: metrics.organicCount || 0,
          
          // Store distribution in JSON
          source_breakdown: {
            pos1: rankDist.pos1 || 0,
            pos2_3: rankDist.pos2_3 || 0,
            pos4_10: rankDist.pos4_10 || 0,
            pos11_20: rankDist.pos11_20 || 0,
            pos21_30: rankDist.pos21_30 || 0,
            top3_keywords: data.top3Keywords || 0,
            top10_keywords: data.top10Keywords || 0,
            total_keywords: data.totalKeywords || 0,
          },
          
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        results.historicalMonthsProcessed++;
      });
      
      console.log(`Prepared ${historicalRows.length} historical rows`);
    }

    // 2. Fetch DataForSEO pages data from Firestore (current snapshot)
    const pagesQuery = query(
      collection(db, 'dataforseo_pages'),
      where('organizationId', '==', organizationId)
    );
    const pagesSnap = await getDocs(pagesQuery);
    
    // 2. Fetch keyword rankings
    const keywordsQuery = query(
      collection(db, 'dataforseo_keywords'),
      where('organizationId', '==', organizationId)
    );
    const keywordsSnap = await getDocs(keywordsQuery);

    // 3. Fetch backlinks summary (aggregated)
    const backlinksQuery = query(
      collection(db, 'dataforseo_backlinks'),
      where('organizationId', '==', organizationId)
    );
    const backlinksSnap = await getDocs(backlinksQuery);

    // Build lookup maps
    const pagesByUrl = new Map();
    pagesSnap.forEach(doc => {
      const data = doc.data();
      pagesByUrl.set(data.url, data);
      results.pagesProcessed++;
    });

    const keywordsByUrl = new Map();
    keywordsSnap.forEach(doc => {
      const data = doc.data();
      if (!keywordsByUrl.has(data.url)) {
        keywordsByUrl.set(data.url, []);
      }
      keywordsByUrl.get(data.url)!.push(data);
      results.keywordsProcessed++;
    });

    const backlinksByUrl = new Map();
    backlinksSnap.forEach(doc => {
      const data = doc.data();
      const url = data.urlTo;
      if (!backlinksByUrl.has(url)) {
        backlinksByUrl.set(url, { total: 0, domains: new Set() });
      }
      backlinksByUrl.get(url)!.total++;
      backlinksByUrl.get(url)!.domains.add(data.domainFrom);
      results.backlinksProcessed++;
    });

    // Prepare rows for BigQuery insert
    const rows: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    // For each page, create a daily_entity_metrics row
    for (const [url, pageData] of pagesByUrl.entries()) {
      const keywords = keywordsByUrl.get(url) || [];
      const backlinksData = backlinksByUrl.get(url) || { total: 0, domains: new Set() };

      // Get primary keyword (highest search volume)
      const primaryKeyword = keywords.sort((a: any, b: any) => 
        (b.searchVolume || 0) - (a.searchVolume || 0)
      )[0];

      // Calculate position change
      const positionChange = primaryKeyword?.previousPosition 
        ? (primaryKeyword.previousPosition - primaryKeyword.position) 
        : 0;

      const row = {
        organization_id: organizationId,
        date: today,
        canonical_entity_id: url,
        entity_type: 'page',
        
        // SEO Rankings
        seo_position: primaryKeyword?.position || null,
        seo_position_change: positionChange,
        seo_search_volume: primaryKeyword?.searchVolume || null,
        
        // Backlinks
        backlinks_total: backlinksData.total,
        backlinks_change: 0, // Would need historical comparison
        referring_domains: backlinksData.domains.size,
        
        // Page Health
        onpage_score: pageData.onpageScore || null,
        core_web_vitals_lcp: pageData.pageTimings?.largest_contentful_paint || null,
        core_web_vitals_fid: pageData.pageTimings?.first_input_delay || null,
        page_size_bytes: pageData.totalDomSize || null,
        
        // Technical SEO Checks
        has_schema_markup: pageData.checks?.has_schema_markup === true || false,
        broken_links_count: pageData.checks?.broken_links || 0,
        duplicate_content_detected: pageData.checks?.is_duplicate === true || false,
        missing_meta_description: pageData.checks?.no_description === true || false,
        missing_h1_tag: pageData.checks?.no_h1_tag === true || false,
        
        // Traffic metrics (if available from GA4, otherwise null)
        impressions: null,
        clicks: null,
        sessions: null,
        users: null,
        pageviews: null,
        conversions: null,
        revenue: null,
        
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      rows.push(row);
    }

    // Combine historical + current rows
    const allRows = [...historicalRows, ...rows];

    // Insert into BigQuery
    if (allRows.length > 0) {
      const dataset = bq.dataset('marketing_ai');
      const table = dataset.table('daily_entity_metrics');
      
      await table.insert(allRows, {
        skipInvalidRows: true,
        ignoreUnknownValues: true,
      });

      results.rowsInserted = allRows.length;
    }

    console.log(`✅ Sync complete: ${results.rowsInserted} rows (${results.historicalMonthsProcessed} historical + ${rows.length} current)`);

    return NextResponse.json({
      success: true,
      ...results,
      message: `Synced ${results.rowsInserted} rows to BigQuery (${results.historicalMonthsProcessed} historical + ${rows.length} current)`,
    });

  } catch (error) {
    console.error('DataForSEO BigQuery sync error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync DataForSEO to BigQuery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
