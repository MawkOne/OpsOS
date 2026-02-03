"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { 
  Search, Target, TrendingUp, Wrench,
  RefreshCw, Zap, ChevronRight, AlertCircle
} from "lucide-react";

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
}

export default function SEOPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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
      
      // Filter for SEO-related opportunities
      const seoOpps = (data.opportunities || []).filter((opp: Opportunity) => 
        opp.entity_type === 'keyword' || 
        opp.entity_type === 'seo_keyword' ||
        opp.category?.startsWith('seo') ||
        opp.category === 'content_decay'
      );
      
      setOpportunities(seoOpps);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

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

  const rankingOpps = opportunities.filter(o => 
    o.title?.toLowerCase().includes('rank') ||
    o.title?.toLowerCase().includes('keyword') ||
    o.title?.toLowerCase().includes('volatility')
  );

  const technicalOpps = opportunities.filter(o => 
    o.title?.toLowerCase().includes('technical') ||
    o.title?.toLowerCase().includes('health') ||
    o.title?.toLowerCase().includes('index')
  );

  return (
    <AppLayout title="Scout AI">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Search className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold">🔍 SEO</h1>
            </div>
            <p className="text-gray-400">
              8 detectors monitoring rankings, keywords, and technical SEO health
            </p>
          </div>
          <button
            onClick={handleRunScoutAI}
            disabled={running}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Opportunities</p>
                <p className="text-2xl font-bold">{opportunities.length}</p>
              </div>
              <Target className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Ranking Issues</p>
                <p className="text-2xl font-bold">{rankingOpps.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Technical Issues</p>
                <p className="text-2xl font-bold">{technicalOpps.length}</p>
              </div>
              <Wrench className="w-8 h-8 text-orange-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Active Detectors</p>
                <p className="text-2xl font-bold">8</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/ai/seo/rankings">
            <Card className="hover:border-blue-500/50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Rankings & Keywords</h3>
                  <p className="text-sm text-gray-400">
                    {rankingOpps.length} opportunities found
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          </Link>
          <Link href="/ai/seo/technical">
            <Card className="hover:border-blue-500/50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Technical Health</h3>
                  <p className="text-sm text-gray-400">
                    {technicalOpps.length} opportunities found
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          </Link>
        </div>

        <Card>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            All SEO Opportunities
          </h2>

          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading opportunities...
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No SEO opportunities found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opp) => {
                const timeframe = getTimeframeBadge(opp);
                return (
                  <div key={opp.id} className="border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-colors">
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
                                  <span className="text-blue-400 mt-1">•</span>
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
                          <p className="text-lg font-bold text-blue-400">{opp.potential_impact_score}/10</p>
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
