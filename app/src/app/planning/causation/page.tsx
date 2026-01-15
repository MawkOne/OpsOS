"use client";

import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import MasterTableSelector from "@/components/MasterTableSelector";
import { useOrganization } from "@/contexts/OrganizationContext";
import { MasterTableEntity, fetchMasterTableEntities } from "@/lib/masterTableData";
import {
  analyzeAllCorrelations,
  findPredictors,
  getCorrelationExplanation,
  calculateGrowthRate,
  findCorrelationClusters,
  CorrelationResult,
} from "@/lib/causationAnalysis";
import { TrendingUp, TrendingDown, Minus, Target, Network, Sparkles } from "lucide-react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from "recharts";

export default function CausationAnalysisPage() {
  const { currentOrg } = useOrganization();
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [entities, setEntities] = useState<MasterTableEntity[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<CorrelationResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null);
  const [predictors, setPredictors] = useState<CorrelationResult[]>([]);
  const [activeView, setActiveView] = useState<"all" | "target" | "clusters">("all");

  // Load selected entities
  const loadEntities = async () => {
    if (!currentOrg || selectedEntityIds.length === 0) {
      setEntities([]);
      return;
    }

    const allEntities = await fetchMasterTableEntities(currentOrg.id);
    const selected = allEntities.filter(e => selectedEntityIds.includes(e.entityId));
    setEntities(selected);
  };

  // Run correlation analysis
  const runAnalysis = async () => {
    if (entities.length < 2) {
      alert("Please select at least 2 entities to analyze correlations");
      return;
    }

    setAnalyzing(true);
    setActiveView("all");
    
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const results = analyzeAllCorrelations(entities, {
      findOptimalLag: true,
      maxLag: 6,
      minSharedMonths: 3
    });
    
    setAnalysisResults(results);
    setAnalyzing(false);
  };

  // Find predictors for a target
  const analyzePredictors = async (entityId: string) => {
    setTargetEntityId(entityId);
    setAnalyzing(true);
    setActiveView("target");
    
    const target = entities.find(e => e.entityId === entityId);
    if (!target) return;
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const results = findPredictors(target, entities, {
      maxLag: 6,
      minCorrelation: 0.2,
      maxResults: 10
    });
    
    setPredictors(results);
    setAnalyzing(false);
  };

  // Find correlation clusters
  const clusters = useMemo(() => {
    if (entities.length < 3 || activeView !== "clusters") return [];
    return findCorrelationClusters(entities, 0.5);
  }, [entities, activeView]);

  // Get color for correlation strength
  const getCorrelationColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return correlation > 0 ? "text-green-400" : "text-red-400";
    if (abs >= 0.4) return correlation > 0 ? "text-blue-400" : "text-orange-400";
    return "text-gray-400";
  };

  // Get background color for correlation strength
  const getCorrelationBg = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return correlation > 0 ? "bg-green-400/10" : "bg-red-400/10";
    if (abs >= 0.4) return correlation > 0 ? "bg-blue-400/10" : "bg-orange-400/10";
    return "bg-gray-400/10";
  };

  // Get trend icon
  const getTrendIcon = (trend: "growing" | "declining" | "stable") => {
    if (trend === "growing") return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  // Prepare scatter plot data
  const scatterData = useMemo(() => {
    return analysisResults
      .filter(r => Math.abs(r.correlation) >= 0.2)
      .map(r => ({
        x: r.lag,
        y: r.correlation,
        z: r.sharedMonths * 10, // Size based on data points
        name: `${r.entityA.entityName} → ${r.entityB.entityName}`,
        correlation: r.correlation,
        strength: r.strength
      }));
  }, [analysisResults]);

  return (
    <AppLayout
      title="Causation Analysis"
      subtitle="Discover relationships between your metrics"
    >
      <div className="space-y-6">
        {/* Entity Selection */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Selected Entities</h2>
              <p className="text-sm text-gray-400">
                {selectedEntityIds.length === 0 
                  ? "Select entities to analyze"
                  : `${selectedEntityIds.length} entities selected`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSelector(true)}
                className="px-4 py-2 bg-[#00d4aa] text-black rounded font-medium hover:bg-[#00b894]"
              >
                {selectedEntityIds.length === 0 ? "Select Entities" : "Edit Selection"}
              </button>
              {selectedEntityIds.length >= 2 && (
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {analyzing ? "Analyzing..." : "Run Analysis"}
                </button>
              )}
            </div>
          </div>

          {/* Selected entities list */}
          {entities.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {entities.map(entity => {
                const growth = calculateGrowthRate(entity);
                return (
                  <div
                    key={entity.entityId}
                    className="p-3 rounded bg-gray-900/50 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white truncate">{entity.entityName}</div>
                        <div className="text-xs text-gray-400">{entity.source} • {entity.metricType}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(growth.trend)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      CMGR: {growth.cmgr.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Analysis Results */}
        {analysisResults.length > 0 && (
          <>
            {/* View Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveView("all")}
                className={`px-4 py-2 rounded font-medium ${
                  activeView === "all"
                    ? "bg-[#00d4aa] text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <Network className="w-4 h-4 inline mr-2" />
                All Correlations
              </button>
              <button
                onClick={() => setActiveView("target")}
                className={`px-4 py-2 rounded font-medium ${
                  activeView === "target"
                    ? "bg-[#00d4aa] text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <Target className="w-4 h-4 inline mr-2" />
                Find Predictors
              </button>
              <button
                onClick={() => setActiveView("clusters")}
                className={`px-4 py-2 rounded font-medium ${
                  activeView === "clusters"
                    ? "bg-[#00d4aa] text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                Clusters
              </button>
            </div>

            {/* All Correlations View */}
            {activeView === "all" && (
              <>
                {/* Scatter Plot */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Correlation Landscape</h3>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="Lag (months)"
                          stroke="#9ca3af"
                          label={{ value: "Lag (months)", position: "insideBottom", offset: -10, fill: "#9ca3af" }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name="Correlation"
                          stroke="#9ca3af"
                          domain={[-1, 1]}
                          label={{ value: "Correlation", angle: -90, position: "insideLeft", fill: "#9ca3af" }}
                        />
                        <ZAxis type="number" dataKey="z" range={[50, 400]} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-gray-800 border border-gray-700 rounded p-3">
                                  <div className="text-xs text-white font-medium mb-1">{data.name}</div>
                                  <div className="text-xs text-gray-400">
                                    Correlation: {data.correlation.toFixed(3)}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    Lag: {data.x} months
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    Strength: {data.strength}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter
                          data={scatterData}
                          fill="#00d4aa"
                          fillOpacity={0.6}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 text-xs text-gray-400">
                    <p>• Bubble size indicates number of shared data points</p>
                    <p>• Positive correlation: metrics move together</p>
                    <p>• Negative correlation: metrics move in opposite directions</p>
                    <p>• Lag: positive values mean first metric leads, negative means second metric leads</p>
                  </div>
                </Card>

                {/* Top Correlations */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Top Correlations ({analysisResults.filter(r => Math.abs(r.correlation) >= 0.3).length})
                  </h3>
                  <div className="space-y-3">
                    {analysisResults
                      .filter(r => Math.abs(r.correlation) >= 0.3)
                      .slice(0, 10)
                      .map((result, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded border ${getCorrelationBg(result.correlation)} border-gray-700`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white mb-1">
                                {result.entityA.entityName} ↔ {result.entityB.entityName}
                              </div>
                              <div className="text-xs text-gray-400">
                                {getCorrelationExplanation(result)}
                              </div>
                            </div>
                            <div className={`text-2xl font-bold ${getCorrelationColor(result.correlation)}`}>
                              {result.correlation.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>Strength: {result.strength}</span>
                            <span>Lag: {result.lag === 0 ? "same month" : `${Math.abs(result.lag)} month${Math.abs(result.lag) > 1 ? 's' : ''}`}</span>
                            <span>n = {result.sharedMonths}</span>
                            <span className={result.pValue < 0.05 ? "text-green-400" : ""}>
                              p = {result.pValue.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              </>
            )}

            {/* Target Predictor View */}
            {activeView === "target" && (
              <Card className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Find Predictors</h3>
                
                {!targetEntityId ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 mb-4">
                      Select a target metric to find what predicts it:
                    </p>
                    {entities.map(entity => (
                      <button
                        key={entity.entityId}
                        onClick={() => analyzePredictors(entity.entityId)}
                        className="w-full p-3 rounded bg-gray-900/50 border border-gray-700 hover:border-gray-600 text-left"
                      >
                        <div className="text-sm font-medium text-white">{entity.entityName}</div>
                        <div className="text-xs text-gray-400">{entity.source} • {entity.metricType}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 p-4 rounded bg-blue-400/10 border border-blue-400/30">
                      <div className="text-sm font-medium text-white mb-1">
                        Target: {entities.find(e => e.entityId === targetEntityId)?.entityName}
                      </div>
                      <button
                        onClick={() => setTargetEntityId(null)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Change target
                      </button>
                    </div>

                    {predictors.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        No strong predictors found
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {predictors.map((result, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded border ${getCorrelationBg(result.correlation)} border-gray-700`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-white mb-1">
                                  {result.entityA.entityName}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {getCorrelationExplanation(result)}
                                </div>
                              </div>
                              <div className={`text-2xl font-bold ${getCorrelationColor(result.correlation)}`}>
                                {result.correlation.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Clusters View */}
            {activeView === "clusters" && (
              <Card className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Correlation Clusters ({clusters.length})
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Metrics that move together are grouped into clusters
                </p>
                
                {clusters.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No clusters found. Try selecting more entities.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clusters.map((cluster, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded bg-gray-900/50 border border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-white">
                            Cluster {idx + 1}
                          </h4>
                          <div className="text-xs text-gray-400">
                            Avg correlation: {cluster.avgCorrelation.toFixed(2)}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {cluster.entities.map(entity => (
                            <div
                              key={entity.entityId}
                              className="p-2 rounded bg-gray-800/50 border border-gray-600"
                            >
                              <div className="text-xs font-medium text-white">{entity.entityName}</div>
                              <div className="text-xs text-gray-500">{entity.source}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {/* Master Table Selector Modal */}
        {showSelector && currentOrg && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSelector(false)}>
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <MasterTableSelector
                organizationId={currentOrg.id}
                selectedEntityIds={selectedEntityIds}
                onSelectionChange={(ids) => {
                  setSelectedEntityIds(ids);
                  loadEntities();
                }}
                multiSelect={true}
                title="Select Entities to Analyze"
                description="Choose metrics to find correlations and causal relationships"
                onClose={() => setShowSelector(false)}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
