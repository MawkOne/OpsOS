"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { Search, TrendingUp, Eye, BarChart } from "lucide-react";

export default function SEOPage() {
  return (
    <AppLayout 
      title="SEO" 
      subtitle="Track organic search performance, rankings, and SEO health"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Organic Traffic</span>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>This month</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Keywords</span>
                <Search className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Ranking keywords</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Impressions</span>
                <Eye className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Search impressions</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>CTR</span>
                <BarChart className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Click-through rate</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader 
            title="SEO Overview" 
            subtitle="Organic search performance and optimization"
            icon={<Search className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Focus Areas</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Profile pages ranking</li>
                  <li>• Blog content optimization</li>
                  <li>• Dynamic page SEO</li>
                  <li>• Technical SEO health</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Key Metrics</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Organic sessions</li>
                  <li>• Keyword rankings</li>
                  <li>• Search impressions</li>
                  <li>• Click-through rate</li>
                  <li>• Backlink profile</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
