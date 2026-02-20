"use client";

import GrowthPageTemplate, { SectionConfig } from "@/components/GrowthPageTemplate";
import { Twitter } from "lucide-react";

const SOCIAL_SECTIONS: SectionConfig[] = [
  {
    id: "social_performance",
    title: "Social Media Performance",
    subtitle: "Twitter, LinkedIn, Telegram, and other social channels",
    icon: <Twitter className="w-5 h-5" />,
    metrics: [
      { key: "social_sessions", label: "Social sessions", format: "number" },
      { key: "social_pct", label: "Social traffic %", format: "pct" },
      { key: "referral_sessions", label: "Referral sessions", format: "number" },
      { key: "total_sessions", label: "Total sessions", format: "number" },
      { key: "organic_sessions", label: "Organic sessions", format: "number" },
    ],
  },
];

export default function SocialMediaPage() {
  return (
    <GrowthPageTemplate
      pageTitle="Social Media"
      pageSubtitle="Track performance across Twitter, Telegram, LinkedIn, and other social channels"
      sections={SOCIAL_SECTIONS}
    />
  );
}
