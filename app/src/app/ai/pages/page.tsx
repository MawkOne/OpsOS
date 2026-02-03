"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import Link from "next/link";
import { Layers, Target, TrendingUp, Wrench, RefreshCw, Zap, ChevronRight, AlertCircle, Star, ArrowUpDown } from "lucide-react";
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
  evidence?: {
    sessions?: number;
    total_sessions?: number;
    conversion_rate?: number;
    bounce_rate?: number;
    site_avg_cvr?: number;
    traffic_percentile?: number;
    current_exit_rate?: number;
    exit_rate_increase_pct?: number;
    [key: string]: unknown;
  };
  metrics?: {
    current_sessions?: number;
    [key: string]: unknown;
  };
  hypothesis?: string;
}

/**
 * Extract a cleaner page name from entity_id and build a link
 * e.g., "page_hirebestremotevideoeditorsfordocumentary1" → "hire-best-remote-video-editors..."
 */
function formatPageName(entityId: string | undefined): string {
  if (!entityId) return "Unknown Page";
  
  // Remove page_ prefix
  let name = entityId.replace(/^page_/, '');
  
  // Try to add spaces/hyphens at word boundaries (before capitals or numbers)
  name = name
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')   // letters before numbers
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')   // numbers before letters
    .toLowerCase();
  
  // Truncate if too long
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }
  
  return '/' + name;
}

/**
 * Build full URL for the page
 */
function buildPageUrl(entityId: string | undefined, domain: string): string {
  if (!entityId || !domain) return '#';
  
  // Remove page_ prefix
  let path = entityId.replace(/^page_/, '');
  
  // Try to reconstruct a path-like format
  path = path
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .toLowerCase();
  
  // Build full URL
  const cleanDomain = domain.replace(/\/$/, '');
  return `https://${cleanDomain}/${path}`;
}

/**
 * Extract action type from title (e.g., "Scale Winner" from "Scale Winner: page_xyz")
 */
function extractActionType(title: string): string {
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0) {
    return title.substring(0, colonIndex).trim();
  }
  return title;
}

/**
 * Get sessions count from opportunity evidence or metrics
 */
function getSessionsCount(opp: Opportunity): number | null {
  // Try evidence first (most common)
  if (opp.evidence?.total_sessions) return opp.evidence.total_sessions;
  if (opp.evidence?.sessions) return opp.evidence.sessions;
  // Try metrics
  if (opp.metrics?.current_sessions) return opp.metrics.current_sessions;
  return null;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get detector display info - what we checked and why it was flagged
 */
function getDetectorInfo(opp: Opportunity): { check: string; reason: string; color: string } {
  const category = opp.category || '';
  const evidence = opp.evidence || {};
  
  if (category.includes('fix_loser') || category.includes('high_traffic_low_conversion')) {
    const cvr = evidence.conversion_rate;
    const siteAvg = evidence.site_avg_cvr as number | undefined;
    return {
      check: 'Low Conversion Rate',
      reason: cvr !== undefined 
        ? `CVR is ${cvr.toFixed(2)}%${siteAvg ? ` vs site avg ${siteAvg.toFixed(2)}%` : ''}`
        : 'Converting below potential',
      color: 'text-red-400'
    };
  }
  
  if (category.includes('scale_winner')) {
    const cvr = evidence.conversion_rate;
    return {
      check: 'High CVR, Low Traffic',
      reason: cvr !== undefined 
        ? `CVR is ${cvr.toFixed(2)}% - scale this page`
        : 'Strong conversion, needs more traffic',
      color: 'text-green-400'
    };
  }
  
  if (category.includes('engagement') || category.includes('exit_rate')) {
    const exitRate = evidence.current_exit_rate as number | undefined;
    const increase = evidence.exit_rate_increase_pct as number | undefined;
    return {
      check: 'Exit Rate Issue',
      reason: exitRate !== undefined 
        ? `Exit rate at ${exitRate.toFixed(1)}%${increase ? ` (+${increase.toFixed(1)}% increase)` : ''}`
        : 'Users leaving without converting',
      color: 'text-orange-400'
    };
  }
  
  if (category.includes('optimization')) {
    return {
      check: 'Optimization Opportunity',
      reason: opp.hypothesis || 'Room for improvement identified',
      color: 'text-blue-400'
    };
  }
  
  // Default
  return {
    check: extractActionType(opp.title),
    reason: opp.hypothesis || opp.description || 'Opportunity detected',
    color: 'text-gray-400'
  };
}

type SortOption = 'priority' | 'sessions' | 'impact';

export default function PagesConversionPage() {
  const { currentOrg } = useOrganization();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [priorityPagesOnly, setPriorityPagesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('sessions');

  // Fetch priority pages for filtering
  const { priorityUrls, priorityPrefixes, excludePatterns, domain } = usePriorityPages(currentOrg?.id);
  const hasPriorityPages = priorityUrls.length > 0 || priorityPrefixes.length > 0 || excludePatterns.length > 0;

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
      // Categories from detectors: pages_scale_winner, pages_fix_loser, engagement_optimization, etc.
      const filtered = (data.opportunities || []).filter((opp: Opportunity) => 
        opp.entity_type === 'page' || (
          opp.category?.startsWith('page') ||
          opp.category?.includes('scale_winner') ||
          opp.category?.includes('fix_loser') ||
          opp.category === 'engagement_optimization' ||
          opp.category === 'high_traffic_low_conversion'
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
  const filteredByPriority = priorityPagesOnly && hasPriorityPages
    ? opportunities.filter(opp => isPriorityPage(opp.entity_id || '', priorityUrls, priorityPrefixes, domain, excludePatterns))
    : opportunities;

  // Group opportunities by page (entity_id)
  const groupedByPage = filteredByPriority.reduce((acc, opp) => {
    const pageId = opp.entity_id || 'unknown';
    if (!acc[pageId]) {
      acc[pageId] = {
        entity_id: pageId,
        opportunities: [],
        maxSessions: 0,
        highestPriority: 'low' as string,
      };
    }
    acc[pageId].opportunities.push(opp);
    const sessions = getSessionsCount(opp) || 0;
    if (sessions > acc[pageId].maxSessions) {
      acc[pageId].maxSessions = sessions;
    }
    // Track highest priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const currentPriorityRank = priorityOrder[acc[pageId].highestPriority as keyof typeof priorityOrder] ?? 2;
    const newPriorityRank = priorityOrder[opp.priority as keyof typeof priorityOrder] ?? 2;
    if (newPriorityRank < currentPriorityRank) {
      acc[pageId].highestPriority = opp.priority;
    }
    return acc;
  }, {} as Record<string, { entity_id: string; opportunities: Opportunity[]; maxSessions: number; highestPriority: string }>);

  // Convert to array and sort
  const groupedPages = Object.values(groupedByPage).sort((a, b) => {
    if (sortBy === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.highestPriority as keyof typeof priorityOrder] ?? 3;
      const bPriority = priorityOrder[b.highestPriority as keyof typeof priorityOrder] ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.maxSessions - a.maxSessions;
    } else if (sortBy === 'sessions') {
      return b.maxSessions - a.maxSessions;
    }
    return b.maxSessions - a.maxSessions;
  });

  // Flatten for count
  const filteredOpportunities = filteredByPriority;

  const handleRunScoutAI = async () => {
    if (!currentOrg) return;
    
    setRunning(true);
    try {
      // Build request body - include priority pages filter if toggle is on
      const requestBody: any = { organizationId: currentOrg.id };
      
      if (priorityPagesOnly && hasPriorityPages) {
        requestBody.priorityPages = {
          urls: priorityUrls,
          prefixes: priorityPrefixes,
          excludePatterns: excludePatterns,
          domain: domain
        };
      }
      
      const response = await fetch("/api/opportunities/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.success) {
        const filterNote = priorityPagesOnly ? ' (priority pages only)' : '';
        alert(`✅ Scout AI found ${result.total_opportunities} opportunities${filterNote}!`);
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
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-gray-700/50 border border-gray-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="sessions">Sort by Sessions</option>
                <option value="priority">Sort by Priority</option>
                <option value="impact">Sort by Impact</option>
              </select>
            </div>
            
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
                  {priorityPagesOnly ? 'Priority Pages' : 'Pages with Issues'}
                </p>
                <p className="text-2xl font-bold">{groupedPages.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredOpportunities.length} total findings
                </p>
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
              {groupedPages.map((pageGroup) => {
                return (
                  <div key={pageGroup.entity_id} className="border border-white/10 rounded-lg overflow-hidden">
                    {/* Page Header - URL and Sessions */}
                    <div className="p-4 border-b border-white/10 bg-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <a 
                            href={buildPageUrl(pageGroup.entity_id, domain)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-lg font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            {formatPageName(pageGroup.entity_id)}
                          </a>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(pageGroup.highestPriority)}`}>
                            {pageGroup.highestPriority.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatNumber(pageGroup.maxSessions)}</p>
                          <p className="text-xs text-gray-400">sessions</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Detections List */}
                    <div className="divide-y divide-white/5">
                      {pageGroup.opportunities.map((opp) => {
                        const detectorInfo = getDetectorInfo(opp);
                        return (
                          <div key={opp.id} className="p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-medium ${detectorInfo.color}`}>
                                    {detectorInfo.check}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400">{detectorInfo.reason}</p>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                {opp.evidence?.conversion_rate !== undefined && (
                                  <span>CVR: {opp.evidence.conversion_rate.toFixed(2)}%</span>
                                )}
                                {opp.evidence?.bounce_rate !== undefined && (
                                  <span>Bounce: {opp.evidence.bounce_rate.toFixed(1)}%</span>
                                )}
                                {opp.evidence?.current_exit_rate !== undefined && (
                                  <span>Exit: {(opp.evidence.current_exit_rate as number).toFixed(1)}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
