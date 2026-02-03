"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { 
  Mail, Target, TrendingUp, AlertCircle, 
  Clock, DollarSign, Activity, ChevronRight,
  RefreshCw, Zap
} from "lucide-react";

interface Opportunity {
  id: string;
  category: string;
  type: string;
  priority: string;
  status: string;
  entity_id: string;
  entity_type: string;
  title: string;
  description: string;
  evidence: any;
  metrics: any;
  hypothesis: string;
  confidence_score: number;
  potential_impact_score: number;
  urgency_score: number;
  recommended_actions: string[];
  estimated_effort: string;
  estimated_timeline: string;
  detected_at: string;
  detector_name?: string;
  timeframe?: string;
}

export default function EmailPage() {
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
      
      // Filter for email-related opportunities
      const emailOpps = (data.opportunities || []).filter((opp: Opportunity) => 
        opp.entity_type === 'email' || 
        opp.entity_type === 'email_campaign' ||
        opp.category?.startsWith('email')
      );
      
      setOpportunities(emailOpps);
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
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error running Scout AI:", error);
      alert("❌ Failed to run Scout AI.");
    } finally {
      setRunning(false);
    }
  };

  const getTimeframeBadge = (opp: Opportunity) => {
    // Determine timeframe from detector name or evidence
    const name = opp.detector_name || opp.type || '';
    if (name.includes('daily') || opp.urgency_score >= 8) {
      return { label: 'Daily', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    } else if (name.includes('weekly') || name.includes('trend')) {
      return { label: 'Weekly', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    } else if (name.includes('monthly') || name.includes('strategic') || name.includes('gap')) {
      return { label: 'Monthly', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }
    return { label: 'Periodic', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-500/10 text-red-400 border-red-500/20",
      medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      low: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  // Group opportunities by sub-category
  const engagementOpps = opportunities.filter(o => 
    o.title?.toLowerCase().includes('engagement') ||
    o.title?.toLowerCase().includes('open') ||
    o.title?.toLowerCase().includes('click') ||
    o.title?.toLowerCase().includes('volume')
  );

  const revenueOpps = opportunities.filter(o => 
    o.title?.toLowerCase().includes('revenue') ||
    o.title?.toLowerCase().includes('attribution')
  );

  const otherOpps = opportunities.filter(o => 
    !engagementOpps.includes(o) && !revenueOpps.includes(o)
  );

  return (
    <AppLayout title="Scout AI">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <h1 className="text-3xl font-bold">📧 Email Marketing</h1>
            </div>
            <p className="text-gray-400">
              6 detectors monitoring email campaigns, engagement, and revenue attribution
            </p>
          </div>
          <button
            onClick={handleRunScoutAI}
            disabled={running}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Opportunities</p>
                <p className="text-2xl font-bold">{opportunities.length}</p>
              </div>
              <Target className="w-8 h-8 text-purple-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Engagement Issues</p>
                <p className="text-2xl font-bold">{engagementOpps.length}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Revenue Opportunities</p>
                <p className="text-2xl font-bold">{revenueOpps.length}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Active Detectors</p>
                <p className="text-2xl font-bold">6</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400" />
            </div>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/ai/email/engagement">
            <Card className="hover:border-purple-500/50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Engagement & Volume</h3>
                  <p className="text-sm text-gray-400">
                    {engagementOpps.length} opportunities found
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          </Link>
          <Link href="/ai/email/revenue">
            <Card className="hover:border-purple-500/50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Revenue Attribution</h3>
                  <p className="text-sm text-gray-400">
                    {revenueOpps.length} opportunities found
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          </Link>
        </div>

        {/* All Email Opportunities */}
        <Card>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-400" />
            All Email Opportunities
          </h2>

          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading opportunities...
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No email opportunities found</p>
              <p className="text-sm mt-1">Run Scout AI to discover new opportunities</p>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opp) => {
                const timeframe = getTimeframeBadge(opp);
                return (
                  <div key={opp.id} className="border border-white/10 rounded-lg p-4 hover:border-purple-500/50 transition-colors">
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
                                  <span className="text-purple-400 mt-1">•</span>
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
                          <p className="text-lg font-bold text-purple-400">{opp.potential_impact_score}/10</p>
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
