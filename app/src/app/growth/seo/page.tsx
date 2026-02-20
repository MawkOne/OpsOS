"use client";

import GrowthPageTemplate, { SectionConfig } from "@/components/GrowthPageTemplate";
import { Search } from "lucide-react";

const SEO_SECTIONS: SectionConfig[] = [
  {
    id: "seo_performance",
    title: "Organic Search Performance",
    subtitle: "Organic traffic and search visibility",
    icon: <Search className="w-5 h-5" />,
    metrics: [
      { key: "organic_sessions", label: "Organic sessions", format: "number" },
      { key: "organic_pct", label: "Organic traffic %", format: "pct" },
      { key: "direct_sessions", label: "Direct sessions", format: "number" },
      { key: "referral_sessions", label: "Referral sessions", format: "number" },
      { key: "total_sessions", label: "Total sessions", format: "number" },
    ],
  },
];

export default function SEOPage() {
  return (
    <GrowthPageTemplate
      pageTitle="SEO"
      pageSubtitle="Track organic search performance and traffic sources"
      sections={SEO_SECTIONS}
    />
  );
}
