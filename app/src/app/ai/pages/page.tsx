"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { Layers, Target, TrendingUp, Wrench, RefreshCw, Zap, ChevronRight, AlertCircle, Star } from "lucide-react";
import { usePriorityPages, isPriorityPage } from "@/hooks/usePriorityPages";
import AIRecommendations from "@/components/AIRecommendations";

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
  entity_id?: string;
  category: string;
  detector_name?: string;
  detected_at?: string;
  data_period_end?: string;
}

export default function PagesConversionPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [priorityPagesOnly, setPriorityPagesOnly] = useState(false);

  // Fetch priority pages for filtering
  const { priorityUrls, priorityPrefixes, domain } = usePriorityPages(currentOrg?.id);
  const hasPriorityPages = priorityUrls.length > 0 || priorityPrefixes.length > 0;

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
      
      // Filter for page-related opportunities
      const filtered = (data.opportunities || []).filter((opp: Opportunity) => 
        opp.entity_type === 'page' && (
          opp.category?.startsWith('page') ||
          opp.category === 'scale_winner' ||
          opp.category === 'fix_loser'
        )
      );
      
      setOpportunities(filtered);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply priority pages filter to opportunities
  const filteredOpportunities = priorityPagesOnly && hasPriorityPages
    ? opportunities.filter(opp => isPriorityPage(opp.entity_id || '', priorityUrls, priorityPrefixes, domain))
    : opportunities;

  const handleRunScoutAI = async () => {
    if (!currentOrg) return;
    
    setRunning(true);
    try {
      const response = await fetch("/api/opportunities/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Scout AI found ${result.total_opportunities} opportunities!`);
        fetchOpportunities();
      }
    } catch (error) {
      console.error("Error running Scout AI:", error);
    } finally {
      setRunning(false);
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

  const formatDataDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <AppLayout title="Scout AI">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Layers className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold">📄 Pages & Conversion</h1>
            </div>
            <p className="text-gray-400">
              5 detectors monitoring page performance and conversion optimization
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Priority Pages Toggle */}
            {hasPriorityPages && (
              <button
                onClick={() => setPriorityPagesOnly(!priorityPagesOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  priorityPagesOnly 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300 border border-gray-600'
                }`}
              >
                <Star className={`w-4 h-4 ${priorityPagesOnly ? 'fill-amber-400' : ''}`} />
                Priority Pages Only
              </button>
            )}
            <button
              onClick={handleRunScoutAI}
              disabled={running}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Scout AI
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">
                  {priorityPagesOnly ? 'Priority Page Opportunities' : 'Total Opportunities'}
                </p>
                <p className="text-2xl font-bold">{filteredOpportunities.length}</p>
                {priorityPagesOnly && opportunities.length !== filteredOpportunities.length && (
                  <p className="text-xs text-gray-500 mt-1">
                    {opportunities.length} total, {filteredOpportunities.length} on priority pages
                  </p>
                )}
              </div>
              <Target className="w-8 h-8 text-indigo-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Active Detectors</p>
                <p className="text-2xl font-bold">5</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400" />
            </div>
          </Card>
        </div>

        {/* AI Recommendations */}
        {!loading && filteredOpportunities.length > 0 && (
          <AIRecommendations 
            opportunities={filteredOpportunities}
            category="pages"
            context={priorityPagesOnly ? "Focus on priority pages only" : undefined}
          />
        )}

        <Card>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            All Pages & Conversion Opportunities
          </h2>

          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{priorityPagesOnly ? 'No opportunities on priority pages' : 'No opportunities found'}</p>
              {priorityPagesOnly && opportunities.length > 0 && (
                <p className="text-sm mt-2">
                  {opportunities.length} opportunities on other pages.{' '}
                  <button 
                    onClick={() => setPriorityPagesOnly(false)}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Show all pages
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map((opp) => {
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
                              {opp.recommended_actions.slice(0, 3).map((action, idx) => (
                                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                  <span className="text-indigo-400 mt-1">•</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Data through</p>
                          <p className="text-sm font-semibold">{formatDataDate(opp.data_period_end)}</p>
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
