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
    const credentials = Buffer.from(`${connection.login}:${connection.password}`).toString("base64");
    const domain = connection.domain;

    // Update status to syncing
    await setDoc(connectionRef, { status: "syncing", updatedAt: Timestamp.now() }, { merge: true });

    if (action === "start_crawl") {
      // Start a new On-Page task with improved settings
      const targetUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      
      const taskResponse = await fetch("https://api.dataforseo.com/v3/on_page/task_post", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            target: targetUrl,
            max_crawl_pages: 500, // Increased crawl limit
            load_resources: true,
            enable_javascript: true,
            enable_browser_rendering: true,
            respect_sitemap: true, // Use sitemap.xml to find pages
            crawl_delay: 100, // 100ms delay between requests
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

      // Check task status
      const summaryResponse = await fetch(`https://api.dataforseo.com/v3/on_page/summary/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      });

      const summaryData: { status_code: number; status_message?: string; tasks?: OnPageTask[] } = await summaryResponse.json();

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
          pagesCrawled: result.crawl_status?.pages_crawled || 0,
          pagesInQueue: result.crawl_status?.pages_in_queue || 0,
          maxPages: result.crawl_status?.max_crawl_pages || 100,
        });
      }

      if (crawlProgress === "finished") {
        // Fetch the results
        return await fetchAndStoreResults(organizationId, taskId, credentials, connectionRef);
      }

      return NextResponse.json({ status: crawlProgress });
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
    return NextResponse.json({
      connected: true,
      status: connection.status,
      domain: connection.domain,
      summary: connection.summary || null,
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

