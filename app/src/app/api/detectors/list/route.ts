import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Map Python detector categories to UI categories
const categoryMap: Record<string, string> = {
  email: "email",
  revenue: "revenue",
  pages: "pages",
  traffic: "traffic",
  seo: "seo",
  advertising: "advertising",
  content: "content",
  system: "system",
};

// Detectors that are ACTUALLY operational (verified with real data + opportunities)
// Updated 2026-02-02: Verified after SQL fixes - 23 working detectors
const workingDetectors = [
  // ============================================================
  // SEO (4 working) - DataForSEO integration VERIFIED ✅
  // SQL queries fixed 2026-02-02
  // ============================================================
  "detect_seo_striking_distance",
  "detect_seo_rank_drops",
  "detect_keyword_cannibalization",
  "detect_seo_rank_trends_multitimeframe",
  
  // ============================================================
  // Content (2 working) - GA4 data ✅
  // SQL queries fixed 2026-02-02
  // ============================================================
  "detect_content_decay",
  "detect_content_decay_multitimeframe",
  
  // ============================================================
  // Revenue (3 working) - Stripe data ✅
  // SQL queries fixed 2026-02-02
  // ============================================================
  "detect_revenue_anomaly",
  "detect_metric_anomalies",
  "detect_revenue_trends_multitimeframe",
  
  // ============================================================
  // Pages (5 working) - GA4 page data ✅
  // SQL queries fixed 2026-02-02
  // ============================================================
  "detect_high_traffic_low_conversion_pages",
  "detect_scale_winners",
  "detect_fix_losers",
  "detect_page_engagement_decay",
  "detect_scale_winners_multitimeframe",
  
  // ============================================================
  // Traffic (3 working) - GA4 traffic source data ✅
  // SQL queries fixed 2026-02-02
  // ============================================================
  "detect_cross_channel_gaps",
  "detect_declining_performers",
  "detect_declining_performers_multitimeframe",
  
  // ============================================================
  // Advertising (3 working) - Cost/ROAS data ✅
  // SQL queries fixed 2026-02-02
  // ============================================================
  "detect_cost_inefficiency",
  "detect_paid_waste",
  "detect_paid_campaigns_multitimeframe",
  
  // ============================================================
  // Email (3 working) - Email metrics data ✅
  // ============================================================
  "detect_email_engagement_drop",
  "detect_email_high_opens_low_clicks",
  "detect_email_trends_multitimeframe",
  
  // ============================================================
  // BLOCKED - Missing specific data columns
  // ============================================================
  // Pages: Need form_starts, exit_rate, cart_abandonment_rate
  // "detect_page_form_abandonment_spike",
  // "detect_page_cart_abandonment_increase",
  // "detect_page_exit_rate_increase",
  
  // Revenue: Seasonality detector has SQL bug
  // "detect_revenue_seasonality_deviation",
];

interface DetectorInfo {
  id: string;
  name: string;
  category: string;
  status: "active" | "planned";
  layer: "fast" | "trend" | "strategic";
  description: string;
  detects: string;
  pythonFile: string;
}

async function scanDetectorFiles(): Promise<DetectorInfo[]> {
  const detectors: DetectorInfo[] = [];
  const detectorsPath = path.join(process.cwd(), "..", "cloud-functions", "scout-ai-engine", "detectors");

  try {
    // Read all category directories
    const categories = await fs.readdir(detectorsPath);

    for (const category of categories) {
      if (category.startsWith(".") || category.endsWith(".py") || category.endsWith(".md")) continue;

      const categoryPath = path.join(detectorsPath, category);
      const stat = await fs.stat(categoryPath);

      if (!stat.isDirectory()) continue;

      // Read detector files in this category
      const files = await fs.readdir(categoryPath);

      for (const file of files) {
        if (!file.startsWith("detect_") || !file.endsWith(".py")) continue;
        if (file === "__init__.py") continue;

        const detectorId = file.replace(".py", "");
        const filePath = path.join(categoryPath, file);

        try {
          // Read the Python file to extract metadata
          const content = await fs.readFile(filePath, "utf-8");

          // Extract docstring
          const docstringMatch = content.match(/"""([\s\S]*?)"""/);
          let docstring = "";
          if (docstringMatch) {
            docstring = docstringMatch[1].trim();
          }

          // Parse docstring for metadata
          const lines = docstring.split("\n").map(l => l.trim()).filter(l => l.length > 0);
          
          // Extract name (first line, remove "Detector" suffix)
          let name = lines[0]?.replace(" Detector", "").replace(/^['"]|['"]$/g, "") || "";
          if (!name || name.length < 3) {
            name = detectorId
              .replace(/^detect_/, "")
              .split("_")
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          }
          
          // Extract "Detects:" or "Detect:" line
          const detectsLine = lines.find(l => l.startsWith("Detects:") || l.startsWith("Detect:"));
          const detects = detectsLine ? detectsLine.replace(/^Detects?:\s*/i, "") : "";

          // Build description
          let description = detects;
          if (!description || description.length < 20) {
            const contextLines = lines.slice(1, 3).filter(l => 
              !l.startsWith("Category:") && 
              !l.startsWith("Detects:") &&
              !l.startsWith("Detect:") &&
              l.length > 10
            );
            description = contextLines.join(" ").trim() || `Analyzes ${name.toLowerCase()} to identify optimization opportunities`;
          }

          // Determine layer from docstring
          let layer: "fast" | "trend" | "strategic" = "strategic";
          if (docstring.includes("Daily check") || docstring.includes("Fast Layer")) {
            layer = "fast";
          } else if (docstring.includes("Weekly check") || docstring.includes("Trend Layer")) {
            layer = "trend";
          } else if (docstring.includes("Monthly check") || docstring.includes("Strategic Layer") || docstring.includes("Multi-Timeframe")) {
            layer = "strategic";
          }

          // Determine status (active if in working list)
          const status = workingDetectors.includes(detectorId) ? "active" : "planned";

          detectors.push({
            id: detectorId,
            name,
            category: categoryMap[category] || category,
            status,
            layer,
            description: description.substring(0, 250),
            detects: detects || description,
            pythonFile: `${category}/${file}`,
          });
        } catch (err) {
          console.error(`Error reading detector file ${file}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Error scanning detector files:", err);
  }

  return detectors.sort((a, b) => {
    // Sort by category, then by name
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });
}

export async function GET() {
  try {
    const detectors = await scanDetectorFiles();

    const stats = {
      total: detectors.length,
      active: detectors.filter(d => d.status === "active").length,
      planned: detectors.filter(d => d.status === "planned").length,
      byCategory: detectors.reduce((acc, d) => {
        acc[d.category] = (acc[d.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      success: true,
      detectors,
      stats,
    });
  } catch (error) {
    console.error("Error listing detectors:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list detectors" },
      { status: 500 }
    );
  }
}
