import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, Timestamp, collection, writeBatch } from "firebase/firestore";

interface OnPageTask {
  id: string;
  status_code: number;
  status_message: string;
  result?: Array<{
    crawl_progress: string;
    crawl_status: {
      max_crawl_pages: number;
      pages_in_queue: number;
      pages_crawled: number;
    };
    items_count?: number;
    items?: Array<{
      resource_type: string;
      url: string;
      meta?: {
        title?: string;
        description?: string;
        canonical?: string;
        h1?: string[];
        h2?: string[];
        h3?: string[];
      };
      page_timing?: {
        time_to_interactive?: number;
        dom_complete?: number;
        largest_contentful_paint?: number;
        first_input_delay?: number;
        connection_time?: number;
        time_to_secure_connection?: number;
        request_sent_time?: number;
        waiting_time?: number;
        download_time?: number;
        duration_time?: number;
        fetch_start?: number;
        fetch_end?: number;
      };
      onpage_score?: number;
      total_dom_size?: number;
      checks?: Record<string, boolean | number | string>;
    }>;
  }>;
}

// Helper to make DataForSEO API calls
async function dataforseoRequest(
  endpoint: string,
  method: "GET" | "POST",
  credentials: string,
  body?: unknown
) {
  const response = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, action } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Get DataForSEO connection
    const connectionRef = doc(db, "dataforseo_connections", organizationId);
    const connectionDoc = await getDoc(connectionRef);

    if (!connectionDoc.exists()) {
      return NextResponse.json(
        { error: "DataForSEO not connected" },
        { status: 404 }
      );
    }

    const connection = connectionDoc.data();
    console.log("DataForSEO connection data:", { 
      login: connection.login, 
      domain: connection.domain,
      hasPassword: !!connection.password 
    });
    const credentials = Buffer.from(`${connection.login}:${connection.password}`).toString("base64");
    const domain = connection.domain;

    // Update status to syncing
    await setDoc(connectionRef, { status: "syncing", updatedAt: Timestamp.now() }, { merge: true });

    if (action === "start_crawl") {
      // Start a new On-Page task with improved settings
      const targetUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      
      // Get priority URLs and prefixes
      let priorityUrls = connection.priorityUrls || [];
      const priorityPrefixes = connection.priorityPrefixes || [];
      
      // If we have prefixes, expand them into actual URLs by fetching from Google Analytics
      if (priorityPrefixes.length > 0) {
        try {
          console.log(`[DataForSEO Sync] Expanding ${priorityPrefixes.length} URL prefixes:`, priorityPrefixes);
          
          // Fetch all pages from Google Analytics (up to 10000 - GA's max)
          const gaUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-analytics/pages?organizationId=${organizationId}&viewMode=ttm&limit=10000`;
          console.log(`[DataForSEO Sync] Fetching GA pages from: ${gaUrl}`);
          
          const gaResponse = await fetch(gaUrl, { 
            headers: { 'Content-Type': 'application/json' } 
          });
          
          if (gaResponse.ok) {
            const gaData = await gaResponse.json();
            const allPages = gaData.pages || [];
            
            console.log(`[DataForSEO Sync] GA API returned ${allPages.length} total pages`);
            console.log(`[DataForSEO Sync] GA API version:`, gaData._meta?.version);
            console.log(`[DataForSEO Sync] First 5 page names:`, allPages.slice(0, 5).map((p: any) => p.name));
            
            // Filter pages that match any prefix
            const matchingPages = allPages.filter((page: any) => 
              priorityPrefixes.some((prefix: string) => page.name.startsWith(prefix))
            );
            
            console.log(`[DataForSEO Sync] Pages matching prefixes:`, matchingPages.length);
            console.log(`[DataForSEO Sync] Matching page samples:`, matchingPages.slice(0, 10).map((p: any) => p.name));
            
            // Convert to full URLs
            const prefixUrls = matchingPages.map((page: any) => 
              targetUrl + page.name
            );
            
            console.log(`[DataForSEO Sync] Expanded prefixes to ${prefixUrls.length} URLs`);
            console.log(`[DataForSEO Sync] First 5 full URLs:`, prefixUrls.slice(0, 5));
            
            // Merge with existing priority URLs (deduplicate)
            priorityUrls = [...new Set([...priorityUrls, ...prefixUrls])];
            
            console.log(`[DataForSEO Sync] Total priority URLs after merge: ${priorityUrls.length}`);
          } else {
            const errorText = await gaResponse.text();
            console.error(`[DataForSEO Sync] GA API failed with status ${gaResponse.status}:`, errorText);
            console.warn('Failed to fetch GA pages for prefix expansion, using prefixes as-is');
          }
        } catch (err) {
          console.error('[DataForSEO Sync] Error expanding URL prefixes:', err);
        }
      }
      
      const hasPriorityUrls = priorityUrls.length > 0;
      
      // Adjust crawl strategy based on priority URLs
      // If we have priority URLs, focus on quality over quantity
      const maxCrawlPages = hasPriorityUrls ? 100 : 500;
      
      console.log(`Starting crawl with ${priorityUrls.length} priority URLs, max pages: ${maxCrawlPages}`);
      
      const taskResponse = await fetch("https://api.dataforseo.com/v3/on_page/task_post", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            target: targetUrl,
            max_crawl_pages: maxCrawlPages,
            priority_urls: hasPriorityUrls ? priorityUrls : undefined, // Crawl these first
            load_resources: true,
            enable_javascript: true,
            enable_browser_rendering: true,
            respect_sitemap: true, // Use sitemap.xml to find pages
            crawl_delay: hasPriorityUrls ? 50 : 100, // Faster crawl for priority pages
            store_raw_html: false, // Don't store raw HTML to save costs
            calculate_keyword_density: true,
            check_spell: false, // Disable spell check to speed up
          },
        ]),
      });

      const taskData = await taskResponse.json();

      if (taskData.status_code !== 20000) {
        await setDoc(connectionRef, { status: "error", updatedAt: Timestamp.now() }, { merge: true });
        return NextResponse.json(
          { error: taskData.status_message || "Failed to start crawl" },
          { status: 400 }
        );
      }

      const taskId = taskData.tasks?.[0]?.id;

      // Store the task ID
      await setDoc(connectionRef, {
        currentTaskId: taskId,
        crawlStartedAt: Timestamp.now(),
        status: "crawling",
        updatedAt: Timestamp.now(),
      }, { merge: true });

      return NextResponse.json({
        success: true,
        message: "Crawl started",
        taskId,
      });
    }

    if (action === "check_status") {
      const taskId = connection.currentTaskId;

      if (!taskId) {
        await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
        return NextResponse.json({ status: "no_task" });
      }

      // Check task status using GET /v3/on_page/summary/{id}
      const summaryResponse = await fetch(`https://api.dataforseo.com/v3/on_page/summary/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      });

      const summaryData = await summaryResponse.json();
      console.log("DataForSEO summary response:", JSON.stringify(summaryData, null, 2));

      if (summaryData.status_code !== 20000) {
        return NextResponse.json({
          status: "error",
          message: summaryData.status_message,
        });
      }

      const task = summaryData.tasks?.[0];
      const result = task?.result?.[0];

      if (!result) {
        return NextResponse.json({ status: "pending" });
      }

      const crawlProgress = result.crawl_progress;

      if (crawlProgress === "in_progress") {
        return NextResponse.json({
          status: "in_progress",
          progress: {
            pagesCrawled: result.crawl_status?.pages_crawled || 0,
            pagesInQueue: result.crawl_status?.pages_in_queue || 0,
            maxPages: result.crawl_status?.max_crawl_pages || 500,
          },
        });
      }

      if (crawlProgress === "finished") {
        // Store the summary data from the response
        const domainInfo = result.domain_info;
        const pageMetrics = result.page_metrics;
        
        // Update connection with rich summary data
        await setDoc(connectionRef, {
          status: "connected",
          lastSyncAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          summary: {
            pagesAnalyzed: domainInfo?.total_pages || 0,
            averageScore: Math.round(pageMetrics?.onpage_score || 0),
            issues: {
              critical: (pageMetrics?.broken_links || 0) + (pageMetrics?.broken_resources || 0) + (pageMetrics?.checks?.is_broken || 0),
              warnings: (pageMetrics?.checks?.no_description || 0) + (pageMetrics?.checks?.title_too_long || 0) + (pageMetrics?.checks?.title_too_short || 0) + (pageMetrics?.checks?.no_h1_tag || 0),
              notices: (pageMetrics?.checks?.no_image_alt || 0) + (pageMetrics?.checks?.low_content_rate || 0) + (pageMetrics?.duplicate_content || 0),
            },
            taskId,
          },
          domainInfo: {
            name: domainInfo?.name,
            cms: domainInfo?.cms,
            ip: domainInfo?.ip,
            server: domainInfo?.server,
            hasSitemap: domainInfo?.checks?.sitemap || false,
            hasRobotsTxt: domainInfo?.checks?.robots_txt || false,
            hasSSL: domainInfo?.checks?.ssl || false,
            hasHttp2: domainInfo?.checks?.http2 || false,
          },
          pageMetrics: {
            linksExternal: pageMetrics?.links_external || 0,
            linksInternal: pageMetrics?.links_internal || 0,
            duplicateTitle: pageMetrics?.duplicate_title || 0,
            duplicateDescription: pageMetrics?.duplicate_description || 0,
            duplicateContent: pageMetrics?.duplicate_content || 0,
            brokenLinks: pageMetrics?.broken_links || 0,
            brokenResources: pageMetrics?.broken_resources || 0,
            onpageScore: pageMetrics?.onpage_score || 0,
            nonIndexable: pageMetrics?.non_indexable || 0,
          },
        }, { merge: true });

        // Also fetch individual pages
        return await fetchAndStoreResults(organizationId, taskId, credentials, connectionRef);
      }

      return NextResponse.json({ status: crawlProgress });
    }

    // Action: Sync keyword rankings
    if (action === "sync_keywords") {
      return await syncKeywordRankings(organizationId, domain, credentials, connectionRef);
    }

    // Action: Sync backlinks
    if (action === "sync_backlinks") {
      return await syncBacklinks(organizationId, domain, credentials, connectionRef);
    }

    // Action: Sync historical SERP rankings for tracked keywords
    if (action === "sync_historical_serps") {
      return await syncHistoricalSerps(organizationId, domain, credentials, connectionRef);
    }

    // Action: Full sync (page health + keywords + backlinks)
    if (action === "full_sync") {
      const results = {
        pageHealth: null as unknown,
        keywords: null as unknown,
        backlinks: null as unknown,
      };

      // Start crawl if no task exists
      if (!connection.currentTaskId) {
        const targetUrl = domain.startsWith("http") ? domain : `https://${domain}`;
        const taskResponse = await dataforseoRequest("on_page/task_post", "POST", credentials, [
          {
            target: targetUrl,
            max_crawl_pages: 500,
            load_resources: true,
            enable_javascript: true,
            enable_browser_rendering: true,
            respect_sitemap: true,
            crawl_delay: 100,
            store_raw_html: false,
            calculate_keyword_density: true,
          },
        ]);

        if (taskResponse.status_code === 20000) {
          await setDoc(connectionRef, {
            currentTaskId: taskResponse.tasks?.[0]?.id,
            crawlStartedAt: Timestamp.now(),
          }, { merge: true });
        }
      }

      // Sync keywords
      try {
        const keywordsResult = await syncKeywordRankings(organizationId, domain, credentials, connectionRef);
        results.keywords = await keywordsResult.json();
      } catch (e) {
        console.error("Keywords sync error:", e);
      }

      // Sync backlinks
      try {
        const backlinksResult = await syncBacklinks(organizationId, domain, credentials, connectionRef);
        results.backlinks = await backlinksResult.json();
      } catch (e) {
        console.error("Backlinks sync error:", e);
      }

      await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });

      return NextResponse.json({
        success: true,
        message: "Full sync initiated",
        results,
      });
    }

    // Default: fetch existing results or start new crawl
    if (connection.currentTaskId) {
      // Check existing task
      const summaryResponse = await fetch(`https://api.dataforseo.com/v3/on_page/summary/${connection.currentTaskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      });

      const summaryData: { status_code: number; tasks?: OnPageTask[] } = await summaryResponse.json();
      const crawlProgress = summaryData.tasks?.[0]?.result?.[0]?.crawl_progress;

      if (crawlProgress === "finished") {
        return await fetchAndStoreResults(organizationId, connection.currentTaskId, credentials, connectionRef);
      }

      await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
      return NextResponse.json({ status: crawlProgress || "unknown" });
    }

    await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json({ status: "ready", message: "Ready to start crawl" });
  } catch (error) {
    console.error("DataForSEO sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync DataForSEO data" },
      { status: 500 }
    );
  }
}

async function fetchAndStoreResults(
  organizationId: string,
  taskId: string,
  credentials: string,
  connectionRef: ReturnType<typeof doc>
) {
  try {
    // Fetch pages data with higher limit
    const pagesResponse = await fetch("https://api.dataforseo.com/v3/on_page/pages", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ id: taskId, limit: 500 }]),
    });
    
    console.log("DataForSEO pages response status:", pagesResponse.status);

    const pagesData = await pagesResponse.json();
    const pages = pagesData.tasks?.[0]?.result?.[0]?.items || [];

    // Store pages in Firestore using batch writes
    const batch = writeBatch(db);
    const pagesCollection = collection(db, "dataforseo_pages");

    let totalScore = 0;
    let pageCount = 0;
    const issues: { critical: number; warnings: number; notices: number } = {
      critical: 0,
      warnings: 0,
      notices: 0,
    };

    for (const page of pages) {
      const pageId = `${organizationId}_${Buffer.from(page.url).toString("base64").slice(0, 50)}`;
      const pageRef = doc(pagesCollection, pageId);

      const score = page.onpage_score || 0;
      totalScore += score;
      pageCount++;

      // Count issues from checks
      if (page.checks) {
        Object.entries(page.checks).forEach(([key, value]) => {
          if (value === false || (typeof value === "number" && value > 0)) {
            if (key.includes("duplicate") || key.includes("missing") || key.includes("broken")) {
              issues.critical++;
            } else if (key.includes("too_long") || key.includes("too_short")) {
              issues.warnings++;
            } else {
              issues.notices++;
            }
          }
        });
      }

      batch.set(pageRef, {
        organizationId,
        taskId,
        url: page.url,
        resourceType: page.resource_type,
        statusCode: page.status_code,
        title: page.meta?.title || null,
        description: page.meta?.description || null,
        h1: page.meta?.h1 || [],
        canonical: page.meta?.canonical || null,
        onpageScore: score,
        totalDomSize: page.total_dom_size || 0,
        pageTimings: page.page_timing || {},
        checks: page.checks || {},
        syncedAt: Timestamp.now(),
      });
    }

    await batch.commit();

    // Calculate average score
    const avgScore = pageCount > 0 ? Math.round(totalScore / pageCount) : 0;

    // Update connection with summary
    await setDoc(connectionRef, {
      status: "connected",
      lastSyncAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      summary: {
        pagesAnalyzed: pageCount,
        averageScore: avgScore,
        issues,
        taskId,
      },
    }, { merge: true });

    return NextResponse.json({
      success: true,
      pagesAnalyzed: pageCount,
      averageScore: avgScore,
      issues,
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    await setDoc(connectionRef, { status: "error", updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json(
      { error: "Failed to fetch crawl results" },
      { status: 500 }
    );
  }
}

// Sync keyword rankings from DataForSEO
async function syncKeywordRankings(
  organizationId: string,
  domain: string,
  credentials: string,
  connectionRef: ReturnType<typeof doc>
) {
  try {
    console.log("Syncing keyword rankings for:", domain);
    
    // Clean domain for API
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Fetch ranked keywords using Domain Analytics API
    // DataForSEO max limit is 1000 per request
    const rankedKeywordsData = await dataforseoRequest(
      "dataforseo_labs/google/ranked_keywords/live",
      "POST",
      credentials,
      [
        {
          target: cleanDomain,
          language_code: "en",
          location_code: 2840, // United States
          limit: 1000, // DataForSEO max is 1000
          order_by: ["keyword_data.keyword_info.search_volume,desc"],
        },
      ]
    );

    console.log("Ranked keywords API response:", JSON.stringify(rankedKeywordsData, null, 2).substring(0, 2000));
    
    if (rankedKeywordsData.status_code !== 20000) {
      console.error("Ranked keywords error:", rankedKeywordsData);
      return NextResponse.json({
        error: rankedKeywordsData.status_message || "Failed to fetch keywords",
        debug: { status_code: rankedKeywordsData.status_code, status_message: rankedKeywordsData.status_message }
      }, { status: 400 });
    }

    const keywords = rankedKeywordsData.tasks?.[0]?.result?.[0]?.items || [];
    const totalCount = rankedKeywordsData.tasks?.[0]?.result?.[0]?.total_count || 0;
    console.log(`Found ${keywords.length} ranked keywords (total_count: ${totalCount})`);
    
    // If no keywords found, return debug info
    if (keywords.length === 0) {
      console.log("No keywords found. Task result:", JSON.stringify(rankedKeywordsData.tasks?.[0]?.result, null, 2));
    }

    // Store keywords in Firestore
    const BATCH_SIZE = 500;
    let keywordCount = 0;
    let totalSearchVolume = 0;
    let top10Count = 0;
    let top3Count = 0;

    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchKeywords = keywords.slice(i, i + BATCH_SIZE);

      for (const item of batchKeywords) {
        const keyword = item.keyword_data?.keyword || "";
        const keywordId = `${organizationId}_${Buffer.from(keyword).toString("base64").slice(0, 40)}`;
        const keywordRef = doc(collection(db, "dataforseo_keywords"), keywordId);

        const searchVolume = item.keyword_data?.keyword_info?.search_volume || 0;
        const position = item.ranked_serp_element?.serp_item?.rank_absolute || 0;

        totalSearchVolume += searchVolume;
        if (position <= 10) top10Count++;
        if (position <= 3) top3Count++;
        keywordCount++;

        batch.set(keywordRef, {
          organizationId,
          domain: cleanDomain,
          keyword,
          position,
          previousPosition: item.ranked_serp_element?.serp_item?.rank_changes?.previous_rank_absolute || null,
          positionChange: position - (item.ranked_serp_element?.serp_item?.rank_changes?.previous_rank_absolute || position),
          url: item.ranked_serp_element?.serp_item?.url || "",
          searchVolume,
          cpc: item.keyword_data?.keyword_info?.cpc || 0,
          competition: item.keyword_data?.keyword_info?.competition || 0,
          competitionLevel: item.keyword_data?.keyword_info?.competition_level || "unknown",
          monthlySearches: item.keyword_data?.keyword_info?.monthly_searches || [],
          serpFeatures: item.ranked_serp_element?.serp_item?.type || "organic",
          lastUpdated: item.keyword_data?.keyword_info?.last_updated_time || null,
          syncedAt: Timestamp.now(),
        });
      }

      await batch.commit();
    }

    // Update connection with keyword summary AND reset status to connected
    await setDoc(connectionRef, {
      status: "connected",
      keywordsSummary: {
        totalKeywords: keywordCount,
        totalSearchVolume,
        top3Keywords: top3Count,
        top10Keywords: top10Count,
        lastSyncAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      keywordsFound: keywordCount,
      totalSearchVolume,
      top3Keywords: top3Count,
      top10Keywords: top10Count,
    });

  } catch (error) {
    console.error("Error syncing keywords:", error);
    // Reset status on error too
    await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json(
      { error: "Failed to sync keywords" },
      { status: 500 }
    );
  }
}

// Sync backlinks from DataForSEO
async function syncBacklinks(
  organizationId: string,
  domain: string,
  credentials: string,
  connectionRef: ReturnType<typeof doc>
) {
  try {
    console.log("Syncing backlinks for:", domain);
    
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Get backlinks summary first
    const summaryData = await dataforseoRequest(
      "backlinks/summary/live",
      "POST",
      credentials,
      [
        {
          target: cleanDomain,
          include_subdomains: true,
        },
      ]
    );
    console.log("Backlinks summary response:", JSON.stringify(summaryData, null, 2).substring(0, 2000));

    // Check for subscription/access errors
    const summaryTask = summaryData.tasks?.[0];
    if (summaryTask?.status_code === 40204) {
      console.log("Backlinks API requires separate subscription");
      return NextResponse.json({
        error: "Backlinks API requires a separate DataForSEO subscription",
        subscriptionUrl: "https://app.dataforseo.com/backlinks-subscription",
        success: false,
        backlinksStored: 0,
        referringDomainsStored: 0,
        summary: { totalBacklinks: 0, referringDomains: 0, rank: 0 },
        requiresSubscription: true
      });
    }

    const summary = summaryData.tasks?.[0]?.result?.[0];
    
    // Get ALL backlinks (dofollow + nofollow) - comprehensive data
    // DataForSEO max limit is 1000 per request
    const backlinksData = await dataforseoRequest(
      "backlinks/backlinks/live",
      "POST",
      credentials,
      [
        {
          target: cleanDomain,
          mode: "as_is",
          limit: 1000, // DataForSEO max is 1000
          order_by: ["rank,desc"],
        },
      ]
    );

    if (backlinksData.status_code !== 20000) {
      console.error("Backlinks error:", backlinksData);
      return NextResponse.json({
        error: backlinksData.status_message || "Failed to fetch backlinks",
      }, { status: 400 });
    }

    const backlinks = backlinksData.tasks?.[0]?.result?.[0]?.items || [];
    console.log(`Found ${backlinks.length} backlinks`);

    // Store backlinks in Firestore
    const BATCH_SIZE = 500;
    let backlinkCount = 0;

    for (let i = 0; i < backlinks.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchBacklinks = backlinks.slice(i, i + BATCH_SIZE);

      for (const item of batchBacklinks) {
        const backlinkId = `${organizationId}_${Buffer.from(item.url_from || "").toString("base64").slice(0, 40)}`;
        const backlinkRef = doc(collection(db, "dataforseo_backlinks"), backlinkId);

        backlinkCount++;

        batch.set(backlinkRef, {
          organizationId,
          domain: cleanDomain,
          urlFrom: item.url_from || "",
          urlTo: item.url_to || "",
          domainFrom: item.domain_from || "",
          anchor: item.anchor || "",
          isDofollow: item.dofollow || false,
          isNewLink: item.is_new || false,
          isLost: item.is_lost || false,
          pageFromRank: item.page_from_rank || 0,
          domainFromRank: item.domain_from_rank || 0,
          domainFromCountry: item.domain_from_country || null,
          firstSeen: item.first_seen || null,
          lastSeen: item.last_seen || null,
          itemType: item.item_type || "anchor",
          linkAttribute: item.link_attribute || [],
          syncedAt: Timestamp.now(),
        });
      }

      await batch.commit();
    }

    // Get ALL referring domains - comprehensive data
    // DataForSEO max limit is 1000 per request
    const refDomainsData = await dataforseoRequest(
      "backlinks/referring_domains/live",
      "POST",
      credentials,
      [
        {
          target: cleanDomain,
          limit: 1000, // DataForSEO max is 1000
          order_by: ["rank,desc"],
        },
      ]
    );

    const referringDomains = refDomainsData.tasks?.[0]?.result?.[0]?.items || [];
    console.log(`Found ${referringDomains.length} referring domains`);

    // Store ALL referring domains (batch in chunks of 500)
    const DOMAIN_BATCH_SIZE = 500;
    let domainCount = 0;
    
    for (let i = 0; i < referringDomains.length; i += DOMAIN_BATCH_SIZE) {
      const domainsBatch = writeBatch(db);
      const batchDomains = referringDomains.slice(i, i + DOMAIN_BATCH_SIZE);
      
      for (const item of batchDomains) {
        const domainId = `${organizationId}_${Buffer.from(item.domain || "").toString("base64").slice(0, 40)}`;
        const domainRef = doc(collection(db, "dataforseo_referring_domains"), domainId);

        domainCount++;
        domainsBatch.set(domainRef, {
          organizationId,
          targetDomain: cleanDomain,
          referringDomain: item.domain || "",
          rank: item.rank || 0,
          backlinks: item.backlinks || 0,
          firstSeen: item.first_seen || null,
          lostDate: item.lost_date || null,
          country: item.country || null,
          syncedAt: Timestamp.now(),
        });
      }
      await domainsBatch.commit();
    }

    // Update connection with backlink summary AND reset status to connected
    await setDoc(connectionRef, {
      status: "connected",
      backlinksSummary: {
        totalBacklinks: summary?.backlinks || 0,
        referringDomains: summary?.referring_domains || 0,
        referringMainDomains: summary?.referring_main_domains || 0,
        referringIps: summary?.referring_ips || 0,
        dofollowBacklinks: summary?.referring_links_types?.anchor || 0,
        nofollowBacklinks: summary?.referring_links_types?.alternate || 0,
        rank: summary?.rank || 0,
        brokenBacklinks: summary?.broken_backlinks || 0,
        newBacklinksLast30Days: summary?.new_backlinks || 0,
        lostBacklinksLast30Days: summary?.lost_backlinks || 0,
        lastSyncAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      backlinksStored: backlinkCount,
      referringDomainsStored: domainCount,
      summary: {
        totalBacklinks: summary?.backlinks || 0,
        referringDomains: summary?.referring_domains || 0,
        rank: summary?.rank || 0,
      },
    });

  } catch (error) {
    console.error("Error syncing backlinks:", error);
    // Reset status on error too
    await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json(
      { error: "Failed to sync backlinks" },
      { status: 500 }
    );
  }
}

// Sync historical rank overview for domain (last 12 months)
async function syncHistoricalSerps(
  organizationId: string,
  domain: string,
  credentials: string,
  connectionRef: ReturnType<typeof doc>
) {
  try {
    console.log("Syncing historical rank overview for:", domain);
    
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    
    // Calculate date_from for last 12 months
    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - 12);
    const dateFromStr = dateFrom.toISOString().split("T")[0];

    // Use Historical Rank Overview endpoint - one API call for full domain history
    const historicalData = await dataforseoRequest(
      "dataforseo_labs/google/historical_rank_overview/live",
      "POST",
      credentials,
      [
        {
          target: cleanDomain,
          language_code: "en",
          location_code: 2840, // United States
          date_from: dateFromStr,
        },
      ]
    );

    if (historicalData.status_code !== 20000) {
      console.error("Historical rank overview error:", historicalData);
      return NextResponse.json({
        error: historicalData.status_message || "Failed to fetch historical data",
      }, { status: 400 });
    }

    const items = historicalData.tasks?.[0]?.result?.[0]?.items || [];
    console.log(`Found ${items.length} months of historical data`);

    // Store monthly historical data in Firestore
    const batch = writeBatch(db);
    const historyCollection = collection(db, "dataforseo_rank_history");

    for (const item of items) {
      const historyId = `${organizationId}_${item.year}_${String(item.month).padStart(2, "0")}`;
      const historyRef = doc(historyCollection, historyId);

      batch.set(historyRef, {
        organizationId,
        domain: cleanDomain,
        year: item.year,
        month: item.month,
        date: `${item.year}-${String(item.month).padStart(2, "0")}-01`,
        
        // Ranking metrics
        metrics: {
          organicEtv: item.metrics?.organic?.etv || 0,
          organicCount: item.metrics?.organic?.count || 0,
          organicEstCost: item.metrics?.organic?.estimated_paid_traffic_cost || 0,
          paidEtv: item.metrics?.paid?.etv || 0,
          paidCount: item.metrics?.paid?.count || 0,
        },
        
        // Rank distribution (positions 1-10, 11-20, etc.)
        rankDistribution: {
          pos1: item.metrics?.organic?.pos_1 || 0,
          pos2_3: item.metrics?.organic?.pos_2_3 || 0,
          pos4_10: item.metrics?.organic?.pos_4_10 || 0,
          pos11_20: item.metrics?.organic?.pos_11_20 || 0,
          pos21_30: item.metrics?.organic?.pos_21_30 || 0,
          pos31_40: item.metrics?.organic?.pos_31_40 || 0,
          pos41_50: item.metrics?.organic?.pos_41_50 || 0,
          pos51_60: item.metrics?.organic?.pos_51_60 || 0,
          pos61_70: item.metrics?.organic?.pos_61_70 || 0,
          pos71_80: item.metrics?.organic?.pos_71_80 || 0,
          pos81_90: item.metrics?.organic?.pos_81_90 || 0,
          pos91_100: item.metrics?.organic?.pos_91_100 || 0,
        },

        // Calculated totals
        totalKeywords: (item.metrics?.organic?.count || 0) + (item.metrics?.paid?.count || 0),
        top3Keywords: (item.metrics?.organic?.pos_1 || 0) + (item.metrics?.organic?.pos_2_3 || 0),
        top10Keywords: (item.metrics?.organic?.pos_1 || 0) + (item.metrics?.organic?.pos_2_3 || 0) + (item.metrics?.organic?.pos_4_10 || 0),
        
        syncedAt: Timestamp.now(),
      });
    }

    await batch.commit();

    // Calculate trends
    const sortedItems = [...items].sort((a, b) => {
      const dateA = a.year * 100 + a.month;
      const dateB = b.year * 100 + b.month;
      return dateA - dateB;
    });

    const latestMonth = sortedItems[sortedItems.length - 1];
    const earliestMonth = sortedItems[0];
    
    const trafficChange = latestMonth && earliestMonth 
      ? ((latestMonth.metrics?.organic?.etv || 0) - (earliestMonth.metrics?.organic?.etv || 0))
      : 0;
    
    const keywordsChange = latestMonth && earliestMonth
      ? ((latestMonth.metrics?.organic?.count || 0) - (earliestMonth.metrics?.organic?.count || 0))
      : 0;

    // Update connection with historical summary AND reset status to connected
    await setDoc(connectionRef, {
      status: "connected",
      historicalSummary: {
        monthsOfData: items.length,
        dateRange: {
          from: earliestMonth ? `${earliestMonth.year}-${String(earliestMonth.month).padStart(2, "0")}` : null,
          to: latestMonth ? `${latestMonth.year}-${String(latestMonth.month).padStart(2, "0")}` : null,
        },
        latestMetrics: latestMonth ? {
          organicTraffic: latestMonth.metrics?.organic?.etv || 0,
          organicKeywords: latestMonth.metrics?.organic?.count || 0,
          top10Keywords: (latestMonth.metrics?.organic?.pos_1 || 0) + 
                        (latestMonth.metrics?.organic?.pos_2_3 || 0) + 
                        (latestMonth.metrics?.organic?.pos_4_10 || 0),
        } : null,
        trends: {
          trafficChange,
          keywordsChange,
        },
        lastSyncAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      monthsOfData: items.length,
      dateRange: {
        from: earliestMonth ? `${earliestMonth.year}-${String(earliestMonth.month).padStart(2, "0")}` : null,
        to: latestMonth ? `${latestMonth.year}-${String(latestMonth.month).padStart(2, "0")}` : null,
      },
      latestMetrics: latestMonth ? {
        organicTraffic: latestMonth.metrics?.organic?.etv || 0,
        organicKeywords: latestMonth.metrics?.organic?.count || 0,
      } : null,
      trends: {
        trafficChange,
        keywordsChange,
      },
    });

  } catch (error) {
    console.error("Error syncing historical rank overview:", error);
    // Reset status on error too
    await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json(
      { error: "Failed to sync historical rank data" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
    const connectionRef = doc(db, "dataforseo_connections", organizationId);
    const connectionDoc = await getDoc(connectionRef);

    if (!connectionDoc.exists()) {
      return NextResponse.json({ connected: false });
    }

    const connection = connectionDoc.data();
    
    // Auto-fix stuck "syncing" status if lastSyncAt was more than 5 minutes ago
    let status = connection.status;
    if (status === "syncing" && connection.lastSyncAt) {
      const lastSync = connection.lastSyncAt.toDate?.() || new Date(0);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastSync < fiveMinutesAgo) {
        // Status is stuck, reset it
        await setDoc(connectionRef, { status: "connected", updatedAt: Timestamp.now() }, { merge: true });
        status = "connected";
        console.log("Auto-reset stuck syncing status for:", organizationId);
      }
    }
    
    return NextResponse.json({
      connected: true,
      status,
      domain: connection.domain,
      summary: connection.summary || null,
      keywordsSummary: connection.keywordsSummary || null,
      backlinksSummary: connection.backlinksSummary || null,
      historicalSummary: connection.historicalSummary || null,
      domainInfo: connection.domainInfo || null,
      pageMetrics: connection.pageMetrics || null,
      lastSyncAt: connection.lastSyncAt?.toDate?.() || null,
    });
  } catch (error) {
    console.error("Error getting DataForSEO status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}

