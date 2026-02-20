"use client";

import GrowthPageTemplate, { SectionConfig } from "@/components/GrowthPageTemplate";
import { Share2 } from "lucide-react";

const COMMUNITY_SECTIONS: SectionConfig[] = [
  {
    id: "community_growth",
    title: "Community-Driven Growth",
    subtitle: "Organic sharing and community engagement",
    icon: <Share2 className="w-5 h-5" />,
    metrics: [
      { key: "referral_sessions", label: "Referral sessions", format: "number" },
      { key: "organic_sessions", label: "Organic sessions", format: "number" },
      { key: "direct_sessions", label: "Direct sessions", format: "number" },
      { key: "total_sessions", label: "Total sessions", format: "number" },
      { key: "referral_pct", label: "Referral %", format: "pct" },
    ],
  },
];

export default function CommunityPage() {
  return (
    <GrowthPageTemplate
      pageTitle="Community"
      pageSubtitle="Track organic sharing and community-driven growth across talent profiles, reviews, and company pages"
      sections={COMMUNITY_SECTIONS}
    />
  );
}
