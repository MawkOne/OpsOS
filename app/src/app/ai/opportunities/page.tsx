"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { 
  Target, TrendingUp, AlertCircle, Search, Mail, 
  Zap, RefreshCw, FileText, Share2, DollarSign,
  Clock, ChevronRight, BarChart3, Megaphone
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
}

export default function OpportunitiesPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [topListView, setTopListView] = useState<"top10" | "all" | "new">("top10");

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
      console.log("API Response:", { total: data.total, count: data.opportunities?.length });
      setOpportunities(data.opportunities || []);
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

  // Group opportunities by channel
  const groupByChannel = () => {
    return {
      seo: opportunities.filter(o => 
        o.entity_type === 'keyword' || 
        o.category === 'seo_issues' ||
        (o.entity_type === 'page' && o.category === 'declining_performer')
      ),
      email: opportunities.filter(o => 
        o.entity_type === 'email' || 
        o.category === 'email_issues'
      ),
      ads: opportunities.filter(o => 
        o.entity_type === 'campaign' || 
        o.category === 'cost_inefficiency'
      ),
      pages: opportunities.filter(o => 
        o.entity_type === 'page' && 
        ['scale_winner', 'fix_loser', 'cross_channel'].includes(o.category)
      ),
      content: opportunities.filter(o => 
        o.entity_type === 'page' && 
        o.category === 'declining_performer'
      ),
      social: [] // Coming soon
    };
  };

  // Get top opportunities by priority
  const getTopOpportunities = () => {
    const sorted = [...opportunities].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.potential_impact_score - a.potential_impact_score;
    });

    if (topListView === "top10") return sorted.slice(0, 10);
    if (topListView === "new") return sorted.filter(o => o.status === "new");
    return sorted;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-50 text-red-700 border-red-200",
      medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
      low: "bg-blue-50 text-blue-700 border-blue-200"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  const channelGroups = groupByChannel();
  const topOpportunities = getTopOpportunities();
  
  console.log("Render state:", { 
    loading, 
    oppCount: opportunities.length,
    topCount: topOpportunities.length,
    channels: Object.keys(channelGroups).map(k => ({ [k]: channelGroups[k as keyof typeof channelGroups].length }))
  });

  const channels = [
    {
      id: 'seo',
      name: 'SEO',
      icon: <Search className="w-6 h-6" />,
      color: 'bg-blue-500',
      opportunities: channelGroups.seo,
      description: 'Keywords & Search Rankings'
    },
    {
      id: 'pages',
      name: 'Pages',
      icon: <FileText className="w-6 h-6" />,
      color: 'bg-purple-500',
      opportunities: channelGroups.pages,
      description: 'Landing Pages & Content'
    },
    {
      id: 'ads',
      name: 'Ads',
      icon: <Megaphone className="w-6 h-6" />,
      color: 'bg-green-500',
      opportunities: channelGroups.ads,
      description: 'Paid Campaigns & Spend'
    },
    {
      id: 'email',
      name: 'Email',
      icon: <Mail className="w-6 h-6" />,
      color: 'bg-orange-500',
      opportunities: channelGroups.email,
      description: 'Email Campaigns'
    },
    {
      id: 'content',
      name: 'Content',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'bg-pink-500',
      opportunities: channelGroups.content,
      description: 'Blog & Content Performance'
    },
    {
      id: 'social',
      name: 'Social',
      icon: <Share2 className="w-6 h-6" />,
      color: 'bg-indigo-500',
      opportunities: channelGroups.social,
      description: 'Social Media (Coming Soon)'
    }
  ];

  if (!currentOrg) {
    return (
      <AppLayout title="Scout AI" subtitle="Marketing opportunities detected by AI">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Loading organization...</p>
            <p className="text-sm text-gray-500 mt-2">Please log in to view opportunities</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Scout AI" subtitle="Marketing opportunities detected by AI">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading {opportunities.length || 0} opportunities...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Scout AI" subtitle="Marketing opportunities detected by AI">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="w-7 h-7 text-purple-600" />
              {opportunities.length} Opportunities Found
            </h1>
            <p className="text-gray-600 mt-1">
              AI-detected opportunities to scale winners, fix losers, and improve performance
            </p>
          </div>
          <button
            onClick={handleRunScoutAI}
            disabled={running}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
          >
            {running ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Run Scout AI
              </>
            )}
          </button>
        </div>

        {/* Top Opportunities List */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Priority Opportunities
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTopListView("top10")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    topListView === "top10"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Top 10
                </button>
                <button
                  onClick={() => setTopListView("new")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    topListView === "new"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  New
                </button>
                <button
                  onClick={() => setTopListView("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    topListView === "all"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {topOpportunities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No opportunities found. Run Scout AI to detect opportunities.
              </div>
            ) : (
              <div className="space-y-2">
                {topOpportunities.map((opp, index) => (
                  <div
                    key={opp.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-purple-600">{index + 1}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(opp.priority)}`}>
                          {opp.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">{opp.entity_type}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{opp.title}</h3>
                      <p className="text-sm text-gray-600 truncate">{opp.description}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-bold text-gray-900">{opp.potential_impact_score.toFixed(0)}</span>
                        </div>
                        <div className="text-xs text-gray-500">Impact</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{(opp.confidence_score * 100).toFixed(0)}%</div>
                        <div className="text-xs text-gray-500">Confidence</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{opp.recommended_actions.length}</div>
                        <div className="text-xs text-gray-500">Actions</div>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Channel Cards Grid */}
        <div>
          <h2 className="text-xl font-bold mb-4">Opportunities by Channel</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map((channel) => (
              <Card key={channel.id}>
                <div className="space-y-4">
                  {/* Channel Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 ${channel.color} rounded-lg text-white`}>
                        {channel.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{channel.name}</h3>
                        <p className="text-sm text-gray-500">{channel.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Opportunity Count */}
                  <div className="flex items-center justify-between py-3 border-t border-b">
                    <span className="text-3xl font-bold text-gray-900">
                      {channel.opportunities.length}
                    </span>
                    <span className="text-sm text-gray-600">
                      {channel.opportunities.length === 0 
                        ? "No issues"
                        : channel.opportunities.length === 1 
                        ? "opportunity"
                        : "opportunities"}
                    </span>
                  </div>

                  {/* Opportunity Breakdown */}
                  {channel.opportunities.length > 0 ? (
                    <div className="space-y-2">
                      {channel.opportunities.slice(0, 3).map((opp) => (
                        <div key={opp.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getPriorityColor(opp.priority)}`}>
                            {opp.priority[0].toUpperCase()}
                          </span>
                          <p className="text-gray-700 line-clamp-2">{opp.title}</p>
                        </div>
                      ))}
                      {channel.opportunities.length > 3 && (
                        <div className="text-sm text-gray-500 text-center pt-2">
                          +{channel.opportunities.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Target className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">
                        {channel.id === 'social' ? 'Coming Soon' : 'All clear!'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
