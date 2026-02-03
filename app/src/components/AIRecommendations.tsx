"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { 
  Sparkles, 
  Zap, 
  Target, 
  AlertTriangle, 
  Lightbulb, 
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  entity_type: string;
  entity_id?: string;
  confidence_score: number;
  potential_impact_score: number;
  urgency_score: number;
  recommended_actions: string[];
  metrics?: Record<string, any>;
  evidence?: Record<string, any>;
}

interface PrioritizedAction {
  action: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeframe: string;
}

interface AIRecommendation {
  summary: string;
  prioritizedActions: PrioritizedAction[];
  quickWins: string[];
  strategicInsights: string[];
  riskAssessment: string;
}

interface AIRecommendationsProps {
  opportunities: Opportunity[];
  category?: string;
  context?: string;
}

export default function AIRecommendations({ 
  opportunities, 
  category,
  context 
}: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const fetchRecommendations = async () => {
    if (opportunities.length === 0) {
      setError("No opportunities to analyze");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          opportunities, 
          category,
          context 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI recommendations");
      }

      setRecommendations(data.recommendations);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'low': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (!recommendations && !loading) {
    return (
      <Card className="glass">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>AI Analysis</h3>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Get AI-powered recommendations based on {opportunities.length} opportunities
              </p>
            </div>
          </div>
          <button
            onClick={fetchRecommendations}
            disabled={opportunities.length === 0}
            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50"
            style={{ 
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              color: "white"
            }}
          >
            <Sparkles className="w-4 h-4" />
            Analyze with AI
          </button>
        </div>
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="glass">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" 
                style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}>
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin absolute -bottom-1 right-1/2 translate-x-1/2" />
            </div>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>Analyzing opportunities...</p>
            <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
              AI is reviewing {opportunities.length} items
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>AI Recommendations</h3>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              Based on {opportunities.length} opportunities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchRecommendations();
            }}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Refresh analysis"
          >
            <RefreshCw className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
          )}
        </div>
      </div>

      {expanded && recommendations && (
        <div className="mt-6 space-y-6">
          {/* Executive Summary */}
          <div className="p-4 rounded-xl" style={{ background: "var(--background-tertiary)" }}>
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Executive Summary</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                  {recommendations.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Prioritized Actions */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Prioritized Actions
            </h4>
            <div className="space-y-3">
              {recommendations.prioritizedActions.map((action, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-lg border"
                  style={{ 
                    background: "var(--background-tertiary)",
                    borderColor: "var(--border)"
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {action.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getImpactColor(action.impact)}`}>
                        {action.impact} impact
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getEffortColor(action.effort)}`}>
                        {action.effort} effort
                      </span>
                    </div>
                  </div>
                  <p className="text-sm ml-9 mb-2" style={{ color: "var(--foreground-muted)" }}>
                    {action.rationale}
                  </p>
                  <div className="flex items-center gap-1 ml-9 text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    <Clock className="w-3 h-3" />
                    {action.timeframe}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Wins */}
          {recommendations.quickWins.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Zap className="w-4 h-4 text-yellow-400" />
                Quick Wins
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recommendations.quickWins.map((win, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-lg flex items-start gap-2"
                    style={{ background: "rgba(234, 179, 8, 0.05)", border: "1px solid rgba(234, 179, 8, 0.2)" }}
                  >
                    <Zap className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm" style={{ color: "var(--foreground)" }}>{win}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic Insights */}
          {recommendations.strategicInsights.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Lightbulb className="w-4 h-4 text-blue-400" />
                Strategic Insights
              </h4>
              <div className="space-y-2">
                {recommendations.strategicInsights.map((insight, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-lg flex items-start gap-2"
                    style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }}
                  >
                    <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm" style={{ color: "var(--foreground)" }}>{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1 text-red-400">Risk Assessment</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                  {recommendations.riskAssessment}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
