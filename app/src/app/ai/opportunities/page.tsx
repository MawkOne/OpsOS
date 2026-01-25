"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { 
  Target, TrendingUp, AlertCircle, CheckCircle, X, 
  Zap, RefreshCw, Filter, ChevronDown, ChevronUp,
  Clock, DollarSign, Activity
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
  const [filterStatus, setFilterStatus] = useState<string>("new");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentOrg) {
      fetchOpportunities();
    }
  }, [currentOrg, filterStatus, filterPriority, filterCategory]);

  const fetchOpportunities = async () => {
    if (!currentOrg) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId: currentOrg.id,
        ...(filterStatus !== "all" && { status: filterStatus }),
        ...(filterPriority !== "all" && { priority: filterPriority }),
        ...(filterCategory !== "all" && { category: filterCategory })
      });

      const response = await fetch(`/api/opportunities?${params}`);
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
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
        alert(`✅ Scout AI found ${result.total_opportunities} opportunities!\n\n` +
              `Scale Winners: ${result.breakdown.scale_winners}\n` +
              `Fix Losers: ${result.breakdown.fix_losers}\n` +
              `Declining: ${result.breakdown.declining_performers}`);
        fetchOpportunities();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error running Scout AI:", error);
      alert("❌ Failed to run Scout AI. Check console for details.");
    } finally {
      setRunning(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetch("/api/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      
      fetchOpportunities();
    } catch (error) {
      console.error("Error updating opportunity:", error);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-100 text-red-700 border-red-300",
      medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
      low: "bg-blue-100 text-blue-700 border-blue-300"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-700";
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      scale_winner: <TrendingUp className="w-5 h-5" />,
      fix_loser: <AlertCircle className="w-5 h-5" />,
      declining_performer: <Activity className="w-5 h-5" />
    };
    return icons[category as keyof typeof icons] || <Target className="w-5 h-5" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      scale_winner: "text-green-600",
      fix_loser: "text-orange-600",
      declining_performer: "text-red-600"
    };
    return colors[category as keyof typeof colors] || "text-gray-600";
  };

  const stats = {
    total: opportunities.length,
    high: opportunities.filter(o => o.priority === "high").length,
    medium: opportunities.filter(o => o.priority === "medium").length,
    low: opportunities.filter(o => o.priority === "low").length,
    avgImpact: opportunities.length > 0 
      ? (opportunities.reduce((sum, o) => sum + o.potential_impact_score, 0) / opportunities.length).toFixed(0)
      : 0
  };

  return (
    <AppLayout title="Marketing Opportunities" subtitle="AI-detected opportunities to improve performance">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6" />
                Scout AI Opportunities
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Automatically detected opportunities to scale winners, fix losers, and improve performance
              </p>
            </div>
            <button
              onClick={handleRunScoutAI}
              disabled={running}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{stats.high}</p>
              <p className="text-sm text-gray-600">High Priority</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{stats.medium}</p>
              <p className="text-sm text-gray-600">Medium</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.low}</p>
              <p className="text-sm text-gray-600">Low</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats.avgImpact}</p>
              <p className="text-sm text-gray-600">Avg Impact</p>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-5 h-5 text-gray-500" />
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Categories</option>
              <option value="scale_winner">Scale Winners</option>
              <option value="fix_loser">Fix Losers</option>
              <option value="declining_performer">Declining</option>
            </select>

            <button
              onClick={fetchOpportunities}
              className="ml-auto px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </Card>

        {/* Opportunities List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-600 mt-2">Loading opportunities...</p>
              </div>
            </Card>
          ) : opportunities.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No opportunities found.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Click &quot;Run Scout AI&quot; to detect opportunities.
                </p>
              </div>
            </Card>
          ) : (
            opportunities.map((opp) => {
              const isExpanded = expandedIds.has(opp.id);
              
              return (
                <Card key={opp.id}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-lg ${getCategoryColor(opp.category)}`}>
                          {getCategoryIcon(opp.category)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(opp.priority)}`}>
                              {opp.priority.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">
                              {opp.entity_type} • {new Date(opp.detected_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-semibold mb-2">{opp.title}</h3>
                          <p className="text-gray-700 mb-3">{opp.description}</p>
                          
                          {/* Scores */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="text-gray-600">Impact: </span>
                              <span className="font-semibold">{opp.potential_impact_score.toFixed(0)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Target className="w-4 h-4 text-blue-600" />
                              <span className="text-gray-600">Confidence: </span>
                              <span className="font-semibold">{(opp.confidence_score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-orange-600" />
                              <span className="text-gray-600">Urgency: </span>
                              <span className="font-semibold">{opp.urgency_score.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleExpanded(opp.id)}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t pt-4 space-y-4">
                        {/* Hypothesis */}
                        <div>
                          <h4 className="font-semibold mb-2">💡 Analysis</h4>
                          <p className="text-gray-700">{opp.hypothesis}</p>
                        </div>

                        {/* Recommended Actions */}
                        <div>
                          <h4 className="font-semibold mb-2">✅ Recommended Actions</h4>
                          <ul className="space-y-2">
                            {opp.recommended_actions.map((action, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-600 mt-1">•</span>
                                <span className="text-gray-700">{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Effort & Timeline */}
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-gray-600">Effort: </span>
                            <span className="font-semibold capitalize">{opp.estimated_effort}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Timeline: </span>
                            <span className="font-semibold">{opp.estimated_timeline}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-4 border-t">
                          {opp.status === "new" && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(opp.id, "acknowledged")}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Acknowledge
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(opp.id, "dismissed")}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Dismiss
                              </button>
                            </>
                          )}
                          {opp.status === "acknowledged" && (
                            <button
                              onClick={() => handleUpdateStatus(opp.id, "in_progress")}
                              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Start Working
                            </button>
                          )}
                          {opp.status === "in_progress" && (
                            <button
                              onClick={() => handleUpdateStatus(opp.id, "completed")}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
