"use client";

import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import Link from "next/link";

export default function TrendAnalysisPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchData();
    }
  }, [currentOrg]);

  async function fetchData() {
    try {
      const response = await fetch(
        `/api/opportunities?organizationId=${currentOrg?.id}&limit=100`
      );
      const data = await response.json();

      // Filter for trend-related opportunities
      const filtered = data.opportunities?.filter(
        (opp: any) =>
          opp.description?.toLowerCase().includes("consecutive") ||
          opp.description?.toLowerCase().includes("accelerating") ||
          opp.description?.toLowerCase().includes("decelerating") ||
          opp.description?.toLowerCase().includes("steady") ||
          opp.description?.toLowerCase().includes("momentum") ||
          opp.type?.includes("decay") ||
          opp.type?.includes("decline") ||
          opp.type?.includes("improving")
      ) || [];

      setOpportunities(filtered);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-500/10 text-red-400 border-red-500/20",
      medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      low: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  return (
    <AppLayout
      title="Trend Analysis"
      subtitle="Multi-month patterns showing acceleration, deceleration, and momentum"
    >
      {/* What This Detects */}
      <Card className="glass mb-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>What Trend Analysis Finds</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Consecutive Month Patterns</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>2-4+ months declining/improving</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Acceleration Detection</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Getting worse/better faster each month</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Momentum Analysis</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Improving, stable, or declining trends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--accent)" }}></div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>Pattern Classification</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Accelerating, steady, or decelerating</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Opportunities */}
      <Card className="glass">
        <div className="mb-6">
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Detected Trends</h2>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            {opportunities.length} multi-month patterns found
          </p>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "var(--accent)" }}></div>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-subtle)" }} />
              <p style={{ color: "var(--foreground-muted)" }}>No significant trends detected</p>
            </div>
          ) : (
            opportunities.map((opp: any) => (
              <Link
                key={opp.id}
                href={`/ai/opportunities?id=${opp.id}`}
                className="block p-6 rounded-lg transition-all border"
                style={{
                  background: "var(--background-secondary)",
                  borderColor: "var(--border)"
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{opp.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(opp.priority)}`}>
                    {opp.priority}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{opp.description}</p>
              </Link>
            ))
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
