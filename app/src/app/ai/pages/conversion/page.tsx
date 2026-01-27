"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { Target, RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  priority: string;
  confidence_score: number;
  potential_impact_score: number;
  urgency_score: number;
  recommended_actions: string[];
  entity_type: string;
  category: string;
  detector_name?: string;
}

export default function ConversionOptimizationPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrg) {
      fetchOpportunities();
    }
  }, [currentOrg]);

  const fetchOpportunities = async () => {
    if (!currentOrg) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/opportunities?organizationId=${currentOrg.id}&status=new`);
      const data = await response.json();
      
      const filtered = (data.opportunities || []).filter((opp: Opportunity) => 
        (opp.entity_type === 'page' || opp.title?.toLowerCase().includes('page')) && (opp.title?.toLowerCase().includes('conversion') || opp.title?.toLowerCase().includes('cvr') || opp.title?.toLowerCase().includes('test'))
      );
      
      setOpportunities(filtered);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  const getTimeframeBadge = (opp: Opportunity) => {
    const name = opp.detector_name || opp.category || '';
    if (name.includes('daily') || opp.urgency_score >= 8) {
      return { label: 'Daily', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    } else if (name.includes('weekly') || name.includes('trend')) {
      return { label: 'Weekly', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    }
    return { label: 'Monthly', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-500/10 text-red-400 border-red-500/20",
      medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      low: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  return (
    <AppLayout module="ai">
      <div className="space-y-6">
        <div>
          <Link href="/ai/pages" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Pages Overview
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Target className="w-6 h-6 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold">Conversion Optimization</h1>
          </div>
          <p className="text-gray-400">
            Monitor conversion rates, A/B tests, and optimization opportunities
          </p>
        </div>

        <Card>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-400" />
            Opportunities
          </h2>

          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No opportunities found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opp) => {
                const timeframe = getTimeframeBadge(opp);
                return (
                  <div key={opp.id} className="border border-white/10 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(opp.priority)}`}>
                            {opp.priority.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${timeframe.color}`}>
                            {timeframe.label}
                          </span>
                        </div>
                        <h3 className="font-semibold mb-1">{opp.title}</h3>
                        <p className="text-sm text-gray-400 mb-3">{opp.description}</p>
                        
                        {opp.recommended_actions && opp.recommended_actions.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-400 mb-2">Recommended Actions:</p>
                            <ul className="space-y-1">
                              {opp.recommended_actions.map((action, idx) => (
                                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                  <span className="text-green-400 mt-1">•</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Impact</p>
                          <p className="text-lg font-bold text-green-400">{opp.potential_impact_score}/10</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Confidence</p>
                          <p className="text-sm font-semibold">{Math.round(opp.confidence_score * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
