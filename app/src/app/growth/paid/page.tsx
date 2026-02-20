"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { Megaphone, DollarSign, Users, TrendingUp, Target } from "lucide-react";

export default function PaidChannelsPage() {
  return (
    <AppLayout 
      title="Paid Channels" 
      subtitle="Track performance across Google Ads, influencer marketing, sponsorships, and Meta Ads"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Ad Spend</span>
                <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>This month</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversions</span>
                <Target className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Total</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Revenue</span>
                <DollarSign className="w-4 h-4" style={{ color: "#10b981" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>From paid channels</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>ROAS</span>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Return on ad spend</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader 
            title="Paid Marketing Channels" 
            subtitle="All paid advertising and promotion channels"
            icon={<Megaphone className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Google Ads</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Search Campaigns (Channels)</li>
                  <li>• PMax Campaigns (Channels)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Influencer Marketing</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Partnerships and sponsored content</p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Sponsorship</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Event and content sponsorships</p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Meta Ads</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Facebook and Instagram advertising (paused)</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
