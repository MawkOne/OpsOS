"use client";

import AppLayout from "@/components/AppLayout";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import Link from "next/link";

export default function crosschannelanalysisPage() {
  const { currentOrganization } = useOrganization();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetch(`/api/opportunities?organizationId=${currentOrganization.id}&limit=100`)
        .then((res) => res.json())
        .then((data) => {
          setOpportunities(data.opportunities || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [currentOrganization]);

  return (
    <AppLayout
      title="Cross Channel Analysis"
      subtitle="Intelligent analysis for Cross Channel Analysis insights"
    >
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Opportunities</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {opportunities.length} opportunities
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
              <p className="text-gray-600">No opportunities found</p>
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
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
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
