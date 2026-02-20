"use client";

import GrowthPageTemplate, { SectionConfig } from "@/components/GrowthPageTemplate";
import { FileText } from "lucide-react";

const CONTENT_SECTIONS: SectionConfig[] = [
  {
    id: "content_performance",
    title: "Content Marketing Performance",
    subtitle: "Blog posts, UGC, and dynamic content engagement",
    icon: <FileText className="w-5 h-5" />,
    metrics: [
      { key: "blog_sessions", label: "Blog sessions", format: "number" },
      { key: "content_sessions", label: "Content sessions", format: "number" },
      { key: "organic_sessions", label: "Organic sessions", format: "number" },
      { key: "total_sessions", label: "Total sessions", format: "number" },
      { key: "organic_pct", label: "Organic %", format: "pct" },
    ],
  },
];

export default function ContentPage() {
  return (
    <GrowthPageTemplate
      pageTitle="Content Marketing"
      pageSubtitle="Track performance across blog posts, UGC, dynamic pages, and on-product content"
      sections={CONTENT_SECTIONS}
    />
  );
}
