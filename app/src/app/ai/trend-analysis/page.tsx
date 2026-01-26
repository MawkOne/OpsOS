"use client";

import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function TrendAnalysisPage() {
  const { currentOrganization } = useOrganization();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchData();
    }
  }, [currentOrganization]);

  async function fetchData() {
    try {
      const response = await fetch(
        `/api/opportunities?organizationId=${currentOrganization?.id}&limit=100`
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

  return (
    <AppLayout
      title="Trend Analysis"
      subtitle="Multi-month patterns showing acceleration, deceleration, and momentum"
    >
      {/* What This Detects */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">What Trend Analysis Finds</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Consecutive Month Patterns</p>
              <p className="text-sm text-gray-600">2-4+ months declining/improving</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Acceleration Detection</p>
              <p className="text-sm text-gray-600">Getting worse/better faster each month</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Momentum Analysis</p>
              <p className="text-sm text-gray-600">Improving, stable, or declining trends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Pattern Classification</p>
              <p className="text-sm text-gray-600">Accelerating, steady, or decelerating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Detected Trends</h2>
          <p className="text-sm text-gray-600 mt-1">
            {opportunities.length} multi-month patterns found
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No significant trends detected</p>
            </div>
          ) : (
            opportunities.map((opp: any) => (
              <Link
                key={opp.id}
                href={`/ai/opportunities?id=${opp.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{opp.title}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      opp.priority === "high"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {opp.priority}
                  </span>
                </div>
                <p className="text-gray-700 text-sm">{opp.description}</p>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
