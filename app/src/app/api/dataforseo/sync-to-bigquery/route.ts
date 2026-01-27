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
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    console.log('Syncing DataForSEO data to BigQuery for org:', organizationId);

    const results = {
      pagesProcessed: 0,
      keywordsProcessed: 0,
      backlinksProcessed: 0,
      rowsInserted: 0,
    };

    // 1. Fetch DataForSEO pages data from Firestore
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
      const primaryKeyword = keywords.sort((a, b) => 
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

    // Insert into BigQuery
    if (rows.length > 0) {
      const dataset = bq.dataset('marketing_ai');
      const table = dataset.table('daily_entity_metrics');
      
      await table.insert(rows, {
        skipInvalidRows: true,
        ignoreUnknownValues: true,
      });

      results.rowsInserted = rows.length;
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Synced ${results.rowsInserted} rows to BigQuery`,
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
