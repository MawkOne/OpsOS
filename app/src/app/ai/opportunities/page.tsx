"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { 
  Target, Search, Mail, 
  Zap, RefreshCw, FileText, DollarSign,
  BarChart3, Megaphone
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
        o.entity_type === 'seo_keyword' ||
        o.category.startsWith('seo') ||
        o.category === 'content_decay'
      ),
      email: opportunities.filter(o => 
        o.entity_type === 'email' || 
        o.entity_type === 'email_campaign' ||
        o.category.startsWith('email')
      ),
      ads: opportunities.filter(o => 
        o.entity_type === 'campaign' || 
        o.entity_type === 'ad_campaign' ||
        o.category.startsWith('advertising') ||
        o.category === 'cost_inefficiency'
      ),
      pages: opportunities.filter(o => 
        (o.entity_type === 'page' && (
          o.category.startsWith('page') ||
          o.category === 'scale_winner' ||
          o.category === 'fix_loser'
        ))
      ),
      traffic: opportunities.filter(o =>
        o.entity_type === 'traffic_source' ||
        o.entity_type === 'traffic_channel' ||
        o.entity_type === 'traffic_balance' ||
        o.entity_type === 'traffic_trend' ||
        o.category.startsWith('traffic')
      ),
      revenue: opportunities.filter(o =>
        o.entity_type === 'revenue' ||
        o.entity_type === 'aggregate' ||
        o.category.startsWith('revenue')
      )
    };
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-500/10 text-red-400 border-red-500/20",
      medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      low: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  // Count priorities for a list of opportunities
  const getPriorityCounts = (opps: Opportunity[]) => {
    return {
      high: opps.filter(o => o.priority === 'high').length,
      medium: opps.filter(o => o.priority === 'medium').length,
      low: opps.filter(o => o.priority === 'low').length
    };
  };

  const channelGroups = groupByChannel();
  
  console.log("Render state:", { 
    loading, 
    oppCount: opportunities.length,
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
      id: 'traffic',
      name: 'Traffic',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'bg-cyan-500',
      opportunities: channelGroups.traffic,
      description: 'Traffic Sources & Channels'
    },
    {
      id: 'pages',
      name: 'Pages',
      icon: <FileText className="w-6 h-6" />,
      color: 'bg-purple-500',
      opportunities: channelGroups.pages,
      description: 'Landing Pages & CRO'
    },
    {
      id: 'ads',
      name: 'Advertising',
      icon: <Megaphone className="w-6 h-6" />,
      color: 'bg-green-500',
      opportunities: channelGroups.ads,
      description: 'Paid Campaigns & Spend'
    },
    {
      id: 'revenue',
      name: 'Revenue',
      icon: <DollarSign className="w-6 h-6" />,
      color: 'bg-emerald-500',
      opportunities: channelGroups.revenue,
      description: 'Revenue & Metrics'
    },
    {
      id: 'email',
      name: 'Email',
      icon: <Mail className="w-6 h-6" />,
      color: 'bg-orange-500',
      opportunities: channelGroups.email,
      description: 'Email Campaigns'
    }
  ];

  if (!currentOrg) {
    return (
      <AppLayout title="Scout AI" subtitle="Marketing opportunities detected by AI">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Target className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-subtle)" }} />
            <p style={{ color: "var(--foreground-muted)" }}>Loading organization...</p>
            <p className="text-sm mt-2" style={{ color: "var(--foreground-subtle)" }}>Please log in to view opportunities</p>
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
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <p style={{ color: "var(--foreground-muted)" }}>Loading {opportunities.length || 0} opportunities...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Scout AI" subtitle="Marketing opportunities detected by AI">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="glass">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Target className="w-7 h-7" style={{ color: "var(--accent)" }} />
                {opportunities.length} Opportunities Found
              </h1>
              <p className="mt-1" style={{ color: "var(--foreground-muted)" }}>
                AI-detected opportunities to scale winners, fix losers, and improve performance
              </p>
            </div>
            <button
              onClick={handleRunScoutAI}
              disabled={running}
              className="px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2 font-medium transition-all"
              style={{
                background: "var(--accent)",
                color: "var(--background)"
              }}
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
        </Card>

        {/* Channel Cards Grid */}
        <div>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>Opportunities by Channel</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {channels.map((channel) => (
              <Card key={channel.id} className="glass">
                <div className="space-y-4">
                  {/* Channel Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg`} style={{ background: "var(--accent-muted)" }}>
                        <div style={{ color: "var(--accent)" }}>
                          {channel.icon}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{channel.name}</h3>
                        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{channel.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Opportunity Count & Priority Breakdown */}
                  <div className="py-3 border-t border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
                        {channel.opportunities.length}
                      </span>
                      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {channel.opportunities.length === 0 
                          ? "No issues"
                          : channel.opportunities.length === 1 
                          ? "opportunity"
                          : "opportunities"}
                      </span>
                    </div>
                    {channel.opportunities.length > 0 && (
                      <div className="flex items-center gap-3">
                        {(() => {
                          const counts = getPriorityCounts(channel.opportunities);
                          return (
                            <>
                              {counts.high > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                  <span className="text-sm font-medium text-red-400">{counts.high} High</span>
                                </div>
                              )}
                              {counts.medium > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                  <span className="text-sm font-medium text-yellow-400">{counts.medium} Med</span>
                                </div>
                              )}
                              {counts.low > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  <span className="text-sm font-medium text-blue-400">{counts.low} Low</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Opportunity Breakdown */}
                  {channel.opportunities.length > 0 ? (
                    <div className="space-y-2">
                      {channel.opportunities.slice(0, 3).map((opp) => (
                        <div key={opp.id} className="flex items-start gap-2 p-2 rounded text-sm" style={{ background: "var(--background-tertiary)" }}>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 border ${getPriorityColor(opp.priority)}`}>
                            {opp.priority[0].toUpperCase()}
                          </span>
                          <p className="line-clamp-2" style={{ color: "var(--foreground-muted)" }}>{opp.title}</p>
                        </div>
                      ))}
                      {channel.opportunities.length > 3 && (
                        <div className="text-sm text-center pt-2" style={{ color: "var(--foreground-subtle)" }}>
                          +{channel.opportunities.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: "var(--background-tertiary)" }}>
                        <Target className="w-6 h-6" style={{ color: "var(--foreground-subtle)" }} />
                      </div>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
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
