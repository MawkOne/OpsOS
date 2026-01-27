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

// Detectors that are fully operational (have all required data columns)
const workingDetectors = [
  // Email (13 working)
  "detect_email_engagement_drop",
  "detect_email_bounce_rate_spike",
  "detect_email_click_to_open_rate_decline",
  "detect_email_high_opens_low_clicks",
  "detect_email_list_health_decline",
  "detect_email_optimal_frequency_deviation",
  "detect_email_spam_complaint_spike",
  "detect_email_trends_multitimeframe",
  "detect_email_volume_gap",
  "detect_revenue_per_subscriber_decline",
  "detect_device_client_performance_gap",
  "detect_ab_test_recommendations",
  "detect_list_segmentation_opportunities",
  
  // Revenue (8 working)
  "detect_revenue_anomaly",
  "detect_metric_anomalies",
  "detect_revenue_trends_multitimeframe",
  "detect_revenue_aov_decline",
  "detect_revenue_new_customer_decline",
  "detect_revenue_discount_cannibalization",
  "detect_revenue_seasonality_deviation",
  "detect_revenue_payment_failure_spike",
  
  // Pages (10 working)
  "detect_high_traffic_low_conversion_pages",
  "detect_page_engagement_decay",
  "detect_scale_winners",
  "detect_fix_losers",
  "detect_scale_winners_multitimeframe",
  "detect_page_form_abandonment_spike",
  "detect_page_cart_abandonment_increase",
  "detect_page_error_rate_spike",
  "detect_page_micro_conversion_drop",
  "detect_page_exit_rate_increase",
  
  // Traffic (7 working)
  "detect_cross_channel_gaps",
  "detect_declining_performers",
  "detect_declining_performers_multitimeframe",
  "detect_traffic_bot_spam_spike",
  "detect_traffic_spike_quality_check",
  "detect_traffic_utm_parameter_gaps",
  "detect_traffic_referral_opportunities",
  
  // SEO (4 working)
  "detect_seo_keyword_cannibalization",
  "detect_seo_striking_distance",
  "detect_seo_rank_drops",
  "detect_seo_rank_trends_multitimeframe",
  
  // Advertising (3 working)
  "detect_cost_inefficiency",
  "detect_paid_waste",
  "detect_paid_campaigns_multitimeframe",
  
  // Content (2 working)
  "detect_content_decay",
  "detect_content_decay_multitimeframe",
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

          // Extract docstring (multiline-compatible without ES2018 flag)
          const docstringMatch = content.match(/"""([\s\S]*?)"""/);
          let docstring = "";
          if (docstringMatch && (docstringMatch[1].includes("Detector") || docstringMatch[1].includes("detector"))) {
            docstring = docstringMatch[1].trim();
          }

          // Parse docstring for metadata
          const lines = docstring.split("\n").map(l => l.trim()).filter(l => l.length > 0);
          
          // Extract name (first line, remove "Detector" suffix)
          let name = lines[0]?.replace(" Detector", "").replace(/^['"]|['"]$/g, "") || "";
          if (!name) {
            // Fallback: convert detector_id to readable name
            name = detectorId
              .replace(/^detect_/, "")
              .split("_")
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          }
          
          // Extract "Detects:" or "Detect:" line for better description
          const detectsLine = lines.find(l => l.startsWith("Detects:") || l.startsWith("Detect:"));
          const detects = detectsLine ? detectsLine.replace(/^Detects?:\s*/i, "") : "";

          // Build description from Category line or other context
          let description = "";
          
          // Try to find Category line
          const categoryLine = lines.find(l => l.startsWith("Category:"));
          
          // Use detects line as description if available, otherwise build from context
          if (detects) {
            description = detects;
          } else if (lines.length > 1) {
            // Use second line or combine context lines
            const contextLines = lines.slice(1, 3).filter(l => 
              !l.startsWith("Category:") && 
              !l.startsWith("Detects:") &&
              !l.startsWith("Detect:") &&
              l.length > 10
            );
            description = contextLines.join(" ").trim();
          }
          
          // Fallback description based on detector name
          if (!description || description.length < 20) {
            description = `Analyzes ${name.toLowerCase()} to identify optimization opportunities and performance issues`;
          }

          // Determine layer from docstring
          let layer: "fast" | "trend" | "strategic" = "strategic";
          if (docstring.includes("Daily check") || docstring.includes("Fast Layer")) {
            layer = "fast";
          } else if (docstring.includes("Weekly check") || docstring.includes("Trend Layer")) {
            layer = "trend";
          } else if (docstring.includes("Monthly check") || docstring.includes("Strategic Layer")) {
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
            description: description.substring(0, 250), // Increased from 200 for better descriptions
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
