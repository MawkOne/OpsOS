"use client";

import GrowthPageTemplate, { SectionConfig } from "@/components/GrowthPageTemplate";
import { Network } from "lucide-react";

const PARTNERSHIPS_SECTIONS: SectionConfig[] = [
  {
    id: "partnerships_performance",
    title: "Affiliate & Partnership Performance",
    subtitle: "Referral programs and partner-driven growth",
    icon: <Network className="w-5 h-5" />,
    metrics: [
      { key: "referral_sessions", label: "Referral sessions", format: "number" },
      { key: "partner_revenue", label: "Partner revenue", format: "currency" },
      { key: "affiliate_conversions", label: "Affiliate conversions", format: "number" },
      { key: "referral_pct", label: "Referral %", format: "pct" },
      { key: "total_sessions", label: "Total sessions", format: "number" },
    ],
  },
];

export default function PartnershipsPage() {
  return (
    <GrowthPageTemplate
      pageTitle="Partnerships"
      pageSubtitle="Track affiliate partnerships and referral programs"
      sections={PARTNERSHIPS_SECTIONS}
    />
  );
}
