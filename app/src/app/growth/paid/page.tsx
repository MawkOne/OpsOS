"use client";

import { useMemo } from "react";
import GrowthPageTemplate, { SectionConfig } from "@/components/GrowthPageTemplate";
import { Megaphone } from "lucide-react";

const PAID_SECTIONS: SectionConfig[] = [
  {
    id: "paid_channels",
    title: "Paid Channels Performance",
    subtitle: "Google Ads (Search, PMax) and paid traffic",
    icon: <Megaphone className="w-5 h-5" />,
    metrics: [
      { key: "paid_search_sessions", label: "Paid search sessions", format: "number" },
      { key: "paid_pmax_sessions", label: "PMax sessions", format: "number" },
      { key: "total_paid_sessions", label: "Total paid sessions", format: "number" },
      { key: "paid_pct", label: "Paid traffic %", format: "pct" },
      { key: "gads_sessions", label: "Google Ads sessions", format: "number" },
      { key: "gads_conversions", label: "Google Ads conversions", format: "number" },
      { key: "gads_revenue", label: "Google Ads revenue", format: "currency" },
      { key: "gads_revenue_pct", label: "Google Ads % of total revenue", format: "pct" },
      { key: "gads_pmax_sessions", label: "Google Ads PMax", format: "number" },
      { key: "gads_search_sessions", label: "Google Ads Search", format: "number" },
    ],
  },
];

export default function PaidChannelsPage() {
  const transformData = useMemo(() => {
    return (rows: any[]) => {
      return rows.map(row => {
        const gadsRevenue = Number(row.gads_revenue) || 0;
        const stripeRevenue = Number(row.stripe_revenue) || 0;
        const gadsRevenuePct = stripeRevenue > 0 ? (gadsRevenue / stripeRevenue) * 100 : 0;
        return {
          ...row,
          gads_revenue_pct: gadsRevenuePct
        };
      });
    };
  }, []);

  return (
    <GrowthPageTemplate
      pageTitle="Paid Channels"
      pageSubtitle="Track performance across Google Ads, influencer marketing, sponsorships, and Meta Ads"
      sections={PAID_SECTIONS}
      transformData={transformData}
    />
  );
}
