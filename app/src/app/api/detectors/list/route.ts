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
// Updated 2026-02-02: MAJOR FIX - Fixed entity types and data tables
// Results: Traffic 45, Revenue 3, Email 1, Pages 43, Advertising 101, SEO 40, Content 20
const workingDetectors = [
  // ============================================================
  // SEO (8 working) - DataForSEO integration ✅
  // Fixed: seo_keyword → keyword entity type
  // ============================================================
  "detect_seo_striking_distance",
  "detect_seo_rank_drops",
  "detect_keyword_cannibalization",
  "detect_seo_rank_trends_multitimeframe",
  "detect_content_decay",
  "detect_content_decay_multitimeframe",
  "detect_featured_snippet_opportunities",
  "detect_backlink_opportunities",
  
  // ============================================================
  // Traffic (9 working) - GA4 traffic source data ✅
  // traffic_source entity has 16M sessions
  // ============================================================
  "detect_cross_channel_gaps",
  "detect_declining_performers",
  "detect_declining_performers_multitimeframe",
  "detect_traffic_source_anomalies",
  "detect_channel_mix_shift",
  "detect_new_traffic_opportunities",
  "detect_referral_quality_decline",
  "detect_organic_paid_balance",
  "detect_traffic_trends_multitimeframe",
  
  // ============================================================
  // Pages (15 working) - Monthly table ✅
  // Fixed: Switched to monthly_entity_metrics (has 2.9M sessions)
  // Fixed: Category prefix pages_ for counting
  // ============================================================
  "detect_high_traffic_low_conversion_pages",
  "detect_scale_winners",
  "detect_fix_losers",
  "detect_page_engagement_decay",
  "detect_scale_winners_multitimeframe",
  "detect_ab_test_opportunities",
  "detect_conversion_funnel_dropoff",
  "detect_cta_performance_analysis",
  "detect_page_speed_decline",
  "detect_social_proof_opportunities",
  "detect_trust_signal_gaps",
  "detect_video_engagement_gap",
  "detect_mobile_desktop_cvr_gap",
  "detect_pricing_page_optimization",
  
  // ============================================================
  // Advertising (13 working) - Monthly table ✅
  // Fixed: ad_campaign → campaign entity type
  // Fixed: Switched to monthly_entity_metrics ($47K cost data)
  // Fixed: SQL comma issues
  // ============================================================
  "detect_cost_inefficiency",
  "detect_paid_waste",
  "detect_paid_campaigns_multitimeframe",
  "detect_ad_retargeting_gap",
  "detect_ad_schedule_optimization",
  "detect_audience_saturation_proxy",
  "detect_competitor_activity_alerts",
  "detect_creative_fatigue",
  "detect_device_geo_optimization_gaps",
  "detect_impression_share_loss",
  "detect_landing_page_relevance_gap",
  "detect_negative_keyword_opportunities",
  "detect_quality_score_decline",
  
  // ============================================================
  // Content (4 working) - Page entity data ✅
  // Fixed: content → page entity type
  // ============================================================
  "detect_content_distribution_gap",
  "detect_content_pillar_opportunities",
  "detect_content_to_lead_attribution",
  "detect_topic_gap_analysis",
  
  // ============================================================
  // Revenue (3 working) - Stripe data ✅
  // ============================================================
  "detect_revenue_anomaly",
  "detect_metric_anomalies",
  "detect_revenue_trends_multitimeframe",
  
  // ============================================================
  // Email (13 working) - Email metrics data ✅
  // Fixed: email → IN ('email', 'email_campaign')
  // ============================================================
  "detect_email_engagement_drop",
  "detect_email_high_opens_low_clicks",
  "detect_email_trends_multitimeframe",
  "detect_ab_test_recommendations",
  "detect_device_client_performance_gap",
  "detect_email_bounce_rate_spike",
  "detect_email_click_to_open_rate_decline",
  "detect_email_list_health_decline",
  "detect_email_optimal_frequency_deviation",
  "detect_email_spam_complaint_spike",
  "detect_email_volume_gap",
  "detect_list_segmentation_opportunities",
  "detect_revenue_per_subscriber_decline",
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
