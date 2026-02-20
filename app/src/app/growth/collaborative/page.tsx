"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { Network, Users, Gift, TrendingUp, DollarSign } from "lucide-react";

export default function CollaborativePage() {
  return (
    <AppLayout 
      title="Collaborative Marketing" 
      subtitle="Track affiliate partnerships and referral programs"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Affiliates</span>
                <Network className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Active partners</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Referrals</span>
                <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>This month</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Revenue</span>
                <DollarSign className="w-4 h-4" style={{ color: "#10b981" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>From partnerships</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversion</span>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Referral rate</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader 
            title="Collaborative Channels" 
            subtitle="Affiliate and referral marketing programs"
            icon={<Network className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Affiliate Program</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• <strong>ThinkMedia:</strong> $3.3K (last year)</li>
                  <li>• <strong>Nolan Molt:</strong> $0.2K (last year)</li>
                  <li>• <strong>Paddy:</strong> $1.9K (last year)</li>
                  <li>• <strong>Ravi Abuvala:</strong> $0.4K (last year)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Referral Program</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Talent referrals</li>
                  <li>• Channel referrals</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
