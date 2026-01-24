/**
 * Marketing Analysis Engine
 * Comprehensive analysis for marketing expert tools:
 * 1. Time series analysis (trends, seasonality, anomalies)
 * 2. Pattern detection and change point analysis
 * 3. Causation analysis with event-level data
 * 4. Cluster analysis for user groups
 * 5. Initiative awareness and recommendations
 * 6. Forecasting and impact projection
 * 7. Impact ranking and prioritization
 */

import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp 
} from "firebase/firestore";

// ============================================================================
// TYPES
// ============================================================================

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD or YYYY-MM
  value: number;
  label?: string;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number; // Change per period
  rSquared: number; // Fit quality (0-1)
  changePercent: number; // Overall change percentage
  volatility: number; // Standard deviation / mean
  confidence: 'high' | 'medium' | 'low';
}

export interface SeasonalityAnalysis {
  hasSeasonality: boolean;
  pattern: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'none';
  peakPeriods: string[];
  troughPeriods: string[];
  seasonalIndices: Record<string, number>; // Period -> multiplier
  strength: number; // 0-1 strength of seasonality
}

export interface AnomalyDetection {
  anomalies: Array<{
    date: string;
    value: number;
    expectedValue: number;
    deviation: number; // Standard deviations from expected
    type: 'spike' | 'drop' | 'shift';
    significance: 'high' | 'medium' | 'low';
  }>;
  changePoints: Array<{
    date: string;
    beforeMean: number;
    afterMean: number;
    changePercent: number;
    significance: number;
  }>;
}

export interface CausationResult {
  metric: string;
  kpi: string;
  correlation: number;
  pValue: number;
  lag: number; // Days/periods that metric leads KPI
  direction: 'positive' | 'negative';
  strength: 'strong' | 'moderate' | 'weak';
  explanation: string;
}

export interface ClusterResult {
  clusterId: string;
  name: string;
  size: number;
  percentOfTotal: number;
  characteristics: Record<string, number | string>;
  behavior: {
    avgValue: number;
    conversionRate: number;
    retention: number;
  };
  recommendations: string[];
}

export interface InitiativeImpact {
  initiativeId: string;
  initiativeName: string;
  category: string;
  status: string;
  relevantMetrics: string[];
  expectedImpact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercent: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  recommendation: string;
  priority: number;
}

export interface ForecastResult {
  metric: string;
  currentValue: number;
  projectedValues: Array<{
    period: string;
    value: number;
    lowerBound: number;
    upperBound: number;
  }>;
  expectedChange: number;
  changePercent: number;
  method: 'cmgr' | 'linear' | 'seasonal' | 'ml';
  confidence: number;
}

export interface ImpactRanking {
  rank: number;
  item: string;
  type: 'opportunity' | 'risk' | 'initiative';
  category: string;
  impactScore: number; // 0-100
  estimatedValue: number; // $ or % impact
  effort: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  recommendation: string;
  supportingData: any;
}

export interface ComprehensiveAnalysis {
  channel: string;
  organizationId: string;
  analyzedAt: Date;
  
  // Historical data
  historicalData: Record<string, TimeSeriesPoint[]>;
  
  // Analysis results
  trends: Record<string, TrendAnalysis>;
  seasonality: Record<string, SeasonalityAnalysis>;
  anomalies: Record<string, AnomalyDetection>;
  
  // Causation & clusters
  causationAnalysis: CausationResult[];
  userClusters: ClusterResult[];
  
  // Initiative awareness
  relatedInitiatives: InitiativeImpact[];
  
  // Forecasts
  forecasts: ForecastResult[];
  
  // Final ranking
  impactRankings: ImpactRanking[];
  
  // Summary
  summary: {
    keyInsights: string[];
    topOpportunities: string[];
    topRisks: string[];
    recommendedActions: string[];
  };
}

// ============================================================================
// TIME SERIES ANALYSIS
// ============================================================================

/**
 * Analyze trend direction and strength
 */
export function analyzeTrend(data: TimeSeriesPoint[]): TrendAnalysis {
  if (data.length < 3) {
    return {
      direction: 'stable',
      slope: 0,
      rSquared: 0,
      changePercent: 0,
      volatility: 0,
      confidence: 'low',
    };
  }

  const values = data.map(d => d.value);
  const n = values.length;

  // Linear regression
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // R-squared calculation
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }

  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Volatility (coefficient of variation)
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - yMean) ** 2, 0) / n);
  const volatility = yMean !== 0 ? stdDev / Math.abs(yMean) : 0;

  // Overall change
  const firstValue = values[0];
  const lastValue = values[n - 1];
  const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  // Determine direction
  const slopePercent = yMean !== 0 ? (slope / yMean) * 100 : 0;
  let direction: 'increasing' | 'decreasing' | 'stable';
  if (Math.abs(slopePercent) < 1) {
    direction = 'stable';
  } else if (slopePercent > 0) {
    direction = 'increasing';
  } else {
    direction = 'decreasing';
  }

  // Confidence based on R-squared and data points
  let confidence: 'high' | 'medium' | 'low';
  if (rSquared > 0.7 && n >= 12) {
    confidence = 'high';
  } else if (rSquared > 0.4 && n >= 6) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    direction,
    slope,
    rSquared,
    changePercent,
    volatility,
    confidence,
  };
}

/**
 * Detect seasonality patterns
 */
export function analyzeSeasonality(data: TimeSeriesPoint[]): SeasonalityAnalysis {
  if (data.length < 12) {
    return {
      hasSeasonality: false,
      pattern: 'none',
      peakPeriods: [],
      troughPeriods: [],
      seasonalIndices: {},
      strength: 0,
    };
  }

  // Group by month
  const monthlyData: Record<number, number[]> = {};
  data.forEach(d => {
    const month = new Date(d.date).getMonth();
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(d.value);
  });

  // Calculate seasonal indices
  const overallMean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
  const seasonalIndices: Record<string, number> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let month = 0; month < 12; month++) {
    if (monthlyData[month] && monthlyData[month].length > 0) {
      const monthMean = monthlyData[month].reduce((a, b) => a + b, 0) / monthlyData[month].length;
      seasonalIndices[monthNames[month]] = overallMean !== 0 ? monthMean / overallMean : 1;
    }
  }

  // Find peaks and troughs
  const sortedMonths = Object.entries(seasonalIndices).sort((a, b) => b[1] - a[1]);
  const peakPeriods = sortedMonths.slice(0, 3).filter(([, v]) => v > 1.1).map(([k]) => k);
  const troughPeriods = sortedMonths.slice(-3).filter(([, v]) => v < 0.9).map(([k]) => k);

  // Calculate seasonality strength (variance of indices)
  const indexValues = Object.values(seasonalIndices);
  const indexMean = indexValues.reduce((a, b) => a + b, 0) / indexValues.length;
  const indexVariance = indexValues.reduce((sum, v) => sum + (v - indexMean) ** 2, 0) / indexValues.length;
  const strength = Math.min(1, Math.sqrt(indexVariance) * 3); // Scale to 0-1

  const hasSeasonality = strength > 0.15;

  return {
    hasSeasonality,
    pattern: hasSeasonality ? 'monthly' : 'none',
    peakPeriods,
    troughPeriods,
    seasonalIndices,
    strength,
  };
}

/**
 * Detect anomalies and change points
 */
export function detectAnomalies(data: TimeSeriesPoint[]): AnomalyDetection {
  if (data.length < 5) {
    return { anomalies: [], changePoints: [] };
  }

  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

  // Detect anomalies (values > 2.5 std dev from mean)
  const anomalies = data
    .map((d, i) => {
      const deviation = stdDev !== 0 ? (d.value - mean) / stdDev : 0;
      if (Math.abs(deviation) > 2.5) {
        return {
          date: d.date,
          value: d.value,
          expectedValue: mean,
          deviation,
          type: (deviation > 0 ? 'spike' : 'drop') as 'spike' | 'drop',
          significance: (Math.abs(deviation) > 3.5 ? 'high' : Math.abs(deviation) > 3 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        };
      }
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // Detect change points (significant shifts in mean)
  const changePoints: AnomalyDetection['changePoints'] = [];
  const windowSize = Math.min(5, Math.floor(data.length / 3));

  for (let i = windowSize; i < data.length - windowSize; i++) {
    const beforeWindow = values.slice(i - windowSize, i);
    const afterWindow = values.slice(i, i + windowSize);

    const beforeMean = beforeWindow.reduce((a, b) => a + b, 0) / beforeWindow.length;
    const afterMean = afterWindow.reduce((a, b) => a + b, 0) / afterWindow.length;

    const changePercent = beforeMean !== 0 ? ((afterMean - beforeMean) / beforeMean) * 100 : 0;

    // T-test approximation for significance
    const beforeStd = Math.sqrt(beforeWindow.reduce((sum, v) => sum + (v - beforeMean) ** 2, 0) / beforeWindow.length);
    const afterStd = Math.sqrt(afterWindow.reduce((sum, v) => sum + (v - afterMean) ** 2, 0) / afterWindow.length);
    const pooledStd = Math.sqrt((beforeStd ** 2 + afterStd ** 2) / 2);
    const significance = pooledStd !== 0 ? Math.abs(afterMean - beforeMean) / (pooledStd * Math.sqrt(2 / windowSize)) : 0;

    if (Math.abs(changePercent) > 20 && significance > 2) {
      changePoints.push({
        date: data[i].date,
        beforeMean,
        afterMean,
        changePercent,
        significance,
      });
    }
  }

  return { anomalies, changePoints };
}

// ============================================================================
// CAUSATION ANALYSIS
// ============================================================================

/**
 * Find causal relationships between metrics and KPIs
 */
export function analyzeCausation(
  metrics: Record<string, TimeSeriesPoint[]>,
  kpis: Record<string, TimeSeriesPoint[]>,
  maxLag: number = 7
): CausationResult[] {
  const results: CausationResult[] = [];

  for (const [metricName, metricData] of Object.entries(metrics)) {
    for (const [kpiName, kpiData] of Object.entries(kpis)) {
      // Align data by date
      const aligned = alignTimeSeries(metricData, kpiData);
      if (aligned.length < 10) continue;

      // Test different lags
      let bestResult: CausationResult | null = null;
      let bestAbsCorr = 0;

      for (let lag = 0; lag <= maxLag; lag++) {
        const corr = calculateLaggedCorrelation(aligned.map(d => d.a), aligned.map(d => d.b), lag);
        if (corr && Math.abs(corr.correlation) > bestAbsCorr) {
          bestAbsCorr = Math.abs(corr.correlation);
          bestResult = {
            metric: metricName,
            kpi: kpiName,
            correlation: corr.correlation,
            pValue: corr.pValue,
            lag,
            direction: corr.correlation > 0 ? 'positive' : 'negative',
            strength: bestAbsCorr > 0.7 ? 'strong' : bestAbsCorr > 0.4 ? 'moderate' : 'weak',
            explanation: generateCausationExplanation(metricName, kpiName, corr.correlation, lag),
          };
        }
      }

      if (bestResult && bestAbsCorr > 0.3) {
        results.push(bestResult);
      }
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

function alignTimeSeries(a: TimeSeriesPoint[], b: TimeSeriesPoint[]): Array<{ date: string; a: number; b: number }> {
  const aMap = new Map(a.map(d => [d.date, d.value]));
  return b
    .filter(d => aMap.has(d.date))
    .map(d => ({ date: d.date, a: aMap.get(d.date)!, b: d.value }));
}

function calculateLaggedCorrelation(a: number[], b: number[], lag: number): { correlation: number; pValue: number } | null {
  if (a.length - lag < 5) return null;

  const x = a.slice(0, a.length - lag);
  const y = b.slice(lag);
  const n = x.length;

  const xMean = x.reduce((sum, v) => sum + v, 0) / n;
  const yMean = y.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    numerator += dx * dy;
    denomX += dx ** 2;
    denomY += dy ** 2;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;

  const correlation = numerator / denom;
  const tStat = correlation * Math.sqrt((n - 2) / (1 - correlation ** 2));
  const pValue = tStat > 2 ? 0.05 : tStat > 1.5 ? 0.1 : 0.2;

  return { correlation, pValue };
}

function generateCausationExplanation(metric: string, kpi: string, correlation: number, lag: number): string {
  const direction = correlation > 0 ? 'increases' : 'decreases';
  const strength = Math.abs(correlation) > 0.7 ? 'strongly' : Math.abs(correlation) > 0.4 ? 'moderately' : 'weakly';
  const lagText = lag === 0 ? 'immediately' : `after ${lag} period${lag > 1 ? 's' : ''}`;

  return `${metric} ${strength} ${direction} ${kpi} ${lagText} (r=${correlation.toFixed(2)})`;
}

// ============================================================================
// CLUSTER ANALYSIS
// ============================================================================

/**
 * Cluster users/entities by behavior
 */
export function performClusterAnalysis(
  data: Array<{ id: string; features: Record<string, number> }>,
  numClusters: number = 4
): ClusterResult[] {
  if (data.length < numClusters * 2) {
    return [{
      clusterId: 'all',
      name: 'All Users',
      size: data.length,
      percentOfTotal: 100,
      characteristics: {},
      behavior: { avgValue: 0, conversionRate: 0, retention: 0 },
      recommendations: ['Need more data for segmentation'],
    }];
  }

  // Simple k-means-like clustering using feature normalization
  const featureNames = Object.keys(data[0].features);
  
  // Normalize features
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};
  
  featureNames.forEach(f => {
    const values = data.map(d => d.features[f] || 0);
    mins[f] = Math.min(...values);
    maxs[f] = Math.max(...values);
  });

  const normalized = data.map(d => ({
    id: d.id,
    features: Object.fromEntries(
      featureNames.map(f => {
        const range = maxs[f] - mins[f];
        return [f, range !== 0 ? (d.features[f] - mins[f]) / range : 0];
      })
    ),
    original: d.features,
  }));

  // Simple clustering by primary feature quartiles
  const primaryFeature = featureNames[0];
  const sorted = [...normalized].sort((a, b) => a.features[primaryFeature] - b.features[primaryFeature]);
  const clusterSize = Math.ceil(sorted.length / numClusters);

  const clusters: ClusterResult[] = [];
  const clusterNames = ['Low Engagement', 'Growing', 'Active', 'Power Users'];

  for (let i = 0; i < numClusters; i++) {
    const members = sorted.slice(i * clusterSize, (i + 1) * clusterSize);
    if (members.length === 0) continue;

    const avgFeatures: Record<string, number> = {};
    featureNames.forEach(f => {
      avgFeatures[f] = members.reduce((sum, m) => sum + m.original[f], 0) / members.length;
    });

    clusters.push({
      clusterId: `cluster_${i}`,
      name: clusterNames[i] || `Segment ${i + 1}`,
      size: members.length,
      percentOfTotal: (members.length / data.length) * 100,
      characteristics: avgFeatures,
      behavior: {
        avgValue: avgFeatures['value'] || avgFeatures['revenue'] || 0,
        conversionRate: avgFeatures['conversionRate'] || avgFeatures['conversions'] || 0,
        retention: avgFeatures['retention'] || avgFeatures['sessions'] || 0,
      },
      recommendations: generateClusterRecommendations(i, avgFeatures),
    });
  }

  return clusters;
}

function generateClusterRecommendations(clusterIndex: number, features: Record<string, number>): string[] {
  switch (clusterIndex) {
    case 0: // Low engagement
      return [
        'Target with re-engagement campaigns',
        'Offer incentives to increase activity',
        'Survey to understand barriers',
      ];
    case 1: // Growing
      return [
        'Nurture with educational content',
        'Encourage feature adoption',
        'Personalized recommendations',
      ];
    case 2: // Active
      return [
        'Upsell premium features',
        'Encourage referrals',
        'Gather testimonials',
      ];
    case 3: // Power users
      return [
        'VIP treatment and early access',
        'Case study opportunities',
        'Ambassador program',
      ];
    default:
      return ['Analyze segment characteristics'];
  }
}

// ============================================================================
// INITIATIVE AWARENESS
// ============================================================================

/**
 * Find initiatives related to a marketing channel
 */
export async function findRelatedInitiatives(
  organizationId: string,
  channel: string,
  currentMetrics: Record<string, number>
): Promise<InitiativeImpact[]> {
  const initiativesRef = collection(db, "initiatives");
  const q = query(
    initiativesRef,
    where("organizationId", "==", organizationId)
  );
  const snapshot = await getDocs(q);

  const channelKeywords = {
    seo: ['seo', 'search', 'organic', 'keywords', 'ranking', 'backlink'],
    email: ['email', 'newsletter', 'campaign', 'automation', 'subscriber'],
    ads: ['ads', 'advertising', 'ppc', 'paid', 'spend', 'roas', 'campaign'],
    social: ['social', 'facebook', 'twitter', 'linkedin', 'instagram'],
    content: ['content', 'blog', 'article', 'post', 'video'],
    pages: ['page', 'landing', 'conversion', 'ux', 'cro'],
  };

  const keywords = channelKeywords[channel as keyof typeof channelKeywords] || [];

  const impacts: InitiativeImpact[] = [];

  snapshot.docs.forEach(doc => {
    const init = doc.data();
    const name = (init.name || '').toLowerCase();
    const description = (init.description || '').toLowerCase();
    const category = init.category || '';

    // Check if initiative is related to this channel
    const isRelated = 
      category === 'marketing' ||
      keywords.some(kw => name.includes(kw) || description.includes(kw));

    if (!isRelated) return;

    // Calculate expected impact
    const expectedImpact = calculateExpectedImpact(init, currentMetrics);

    impacts.push({
      initiativeId: doc.id,
      initiativeName: init.name,
      category: init.category,
      status: init.status,
      relevantMetrics: Object.keys(currentMetrics).slice(0, 5),
      expectedImpact,
      recommendation: generateInitiativeRecommendation(init, expectedImpact),
      priority: calculateInitiativePriority(init, expectedImpact),
    });
  });

  return impacts.sort((a, b) => b.priority - a.priority);
}

function calculateExpectedImpact(
  initiative: any,
  currentMetrics: Record<string, number>
): InitiativeImpact['expectedImpact'] {
  const impacts: InitiativeImpact['expectedImpact'] = [];

  // Use initiative's forecast data if available
  if (initiative.forecast?.enabled) {
    const impactPercent = Object.values(initiative.forecast.initiativeImpacts || {})[0] as number || 10;
    
    Object.entries(currentMetrics).slice(0, 3).forEach(([metric, value]) => {
      impacts.push({
        metric,
        currentValue: value,
        projectedValue: value * (1 + impactPercent / 100),
        changePercent: impactPercent,
        confidence: 'medium',
      });
    });
  } else {
    // Default estimate based on priority
    const impactMultiplier = { critical: 25, high: 15, medium: 10, low: 5 }[initiative.priority || 'medium'] || 10;
    
    const primaryMetric = Object.entries(currentMetrics)[0];
    if (primaryMetric) {
      impacts.push({
        metric: primaryMetric[0],
        currentValue: primaryMetric[1],
        projectedValue: primaryMetric[1] * (1 + impactMultiplier / 100),
        changePercent: impactMultiplier,
        confidence: 'low',
      });
    }
  }

  return impacts;
}

function generateInitiativeRecommendation(initiative: any, impacts: InitiativeImpact['expectedImpact']): string {
  const status = initiative.status;
  const avgImpact = impacts.length > 0 
    ? impacts.reduce((sum, i) => sum + i.changePercent, 0) / impacts.length 
    : 0;

  if (status === 'idea' || status === 'proposed') {
    return avgImpact > 15 
      ? 'High-impact opportunity - prioritize for approval'
      : 'Evaluate ROI before committing resources';
  } else if (status === 'in-progress') {
    return 'Monitor progress and track leading indicators';
  } else if (status === 'completed') {
    return 'Measure actual vs expected impact';
  }

  return 'Review and update initiative status';
}

function calculateInitiativePriority(initiative: any, impacts: InitiativeImpact['expectedImpact']): number {
  let score = 0;

  // Status weight
  const statusScores: Record<string, number> = {
    'in-progress': 90,
    'planned': 80,
    'approved': 70,
    'proposed': 50,
    'idea': 30,
    'completed': 10,
  };
  score += statusScores[initiative.status] || 40;

  // Priority weight
  const priorityScores: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10 };
  score += priorityScores[initiative.priority] || 20;

  // Impact weight
  const avgImpact = impacts.length > 0 
    ? impacts.reduce((sum, i) => sum + i.changePercent, 0) / impacts.length 
    : 0;
  score += Math.min(30, avgImpact);

  return score;
}

// ============================================================================
// FORECASTING
// ============================================================================

/**
 * Generate forecasts for metrics
 */
export function generateForecasts(
  historicalData: Record<string, TimeSeriesPoint[]>,
  periods: number = 6
): ForecastResult[] {
  const forecasts: ForecastResult[] = [];

  for (const [metric, data] of Object.entries(historicalData)) {
    if (data.length < 3) continue;

    const trend = analyzeTrend(data);
    const seasonality = analyzeSeasonality(data);
    const currentValue = data[data.length - 1].value;

    // Calculate CMGR
    const firstValue = data[0].value;
    const lastValue = currentValue;
    const numPeriods = data.length - 1;
    const cmgr = firstValue > 0 ? Math.pow(lastValue / firstValue, 1 / numPeriods) - 1 : 0;

    // Generate projections
    const projectedValues: ForecastResult['projectedValues'] = [];
    let projectedValue = currentValue;

    for (let i = 1; i <= periods; i++) {
      // Apply growth
      projectedValue *= (1 + cmgr);

      // Apply seasonality if present
      if (seasonality.hasSeasonality) {
        const monthIndex = (new Date().getMonth() + i) % 12;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const seasonalIndex = seasonality.seasonalIndices[monthNames[monthIndex]] || 1;
        projectedValue *= seasonalIndex;
      }

      // Calculate confidence interval
      const uncertainty = trend.volatility * Math.sqrt(i);
      const lowerBound = projectedValue * (1 - uncertainty);
      const upperBound = projectedValue * (1 + uncertainty);

      projectedValues.push({
        period: `Period ${i}`,
        value: Math.round(projectedValue * 100) / 100,
        lowerBound: Math.round(lowerBound * 100) / 100,
        upperBound: Math.round(upperBound * 100) / 100,
      });
    }

    const finalValue = projectedValues[projectedValues.length - 1]?.value || currentValue;
    const expectedChange = finalValue - currentValue;
    const changePercent = currentValue !== 0 ? (expectedChange / currentValue) * 100 : 0;

    forecasts.push({
      metric,
      currentValue,
      projectedValues,
      expectedChange,
      changePercent,
      method: seasonality.hasSeasonality ? 'seasonal' : 'cmgr',
      confidence: trend.confidence === 'high' ? 0.8 : trend.confidence === 'medium' ? 0.6 : 0.4,
    });
  }

  return forecasts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

// ============================================================================
// IMPACT RANKING
// ============================================================================

/**
 * Generate prioritized impact rankings
 */
export function generateImpactRankings(
  analysis: {
    trends: Record<string, TrendAnalysis>;
    anomalies: Record<string, AnomalyDetection>;
    causation: CausationResult[];
    initiatives: InitiativeImpact[];
    forecasts: ForecastResult[];
  },
  currentMetrics: Record<string, number>
): ImpactRanking[] {
  const rankings: ImpactRanking[] = [];
  let rank = 0;

  // Add declining metrics as risks
  Object.entries(analysis.trends).forEach(([metric, trend]) => {
    if (trend.direction === 'decreasing' && Math.abs(trend.changePercent) > 10) {
      rank++;
      rankings.push({
        rank,
        item: `${metric} Declining`,
        type: 'risk',
        category: 'performance',
        impactScore: Math.min(100, Math.abs(trend.changePercent)),
        estimatedValue: currentMetrics[metric] * (trend.changePercent / 100),
        effort: 'medium',
        timeframe: 'immediate',
        recommendation: `Investigate ${metric} decline (${trend.changePercent.toFixed(1)}% change). Check recent changes and external factors.`,
        supportingData: trend,
      });
    }
  });

  // Add anomalies as immediate attention items
  Object.entries(analysis.anomalies).forEach(([metric, anomalyData]) => {
    anomalyData.changePoints.forEach(cp => {
      if (cp.changePercent < -15) {
        rank++;
        rankings.push({
          rank,
          item: `${metric} Drop Detected`,
          type: 'risk',
          category: 'anomaly',
          impactScore: Math.min(100, Math.abs(cp.changePercent)),
          estimatedValue: cp.changePercent,
          effort: 'low',
          timeframe: 'immediate',
          recommendation: `Significant drop in ${metric} around ${cp.date}. Investigate root cause.`,
          supportingData: cp,
        });
      }
    });
  });

  // Add high-impact initiatives as opportunities
  analysis.initiatives.forEach(init => {
    if (init.status === 'in-progress' || init.status === 'planned') {
      const avgImpact = init.expectedImpact.length > 0
        ? init.expectedImpact.reduce((sum, i) => sum + i.changePercent, 0) / init.expectedImpact.length
        : 0;
      
      if (avgImpact > 10) {
        rank++;
        rankings.push({
          rank,
          item: init.initiativeName,
          type: 'initiative',
          category: init.category,
          impactScore: Math.min(100, avgImpact * 3),
          estimatedValue: avgImpact,
          effort: 'high',
          timeframe: 'short-term',
          recommendation: init.recommendation,
          supportingData: init,
        });
      }
    }
  });

  // Add strong causal relationships as optimization opportunities
  analysis.causation.slice(0, 5).forEach(causal => {
    if (causal.strength === 'strong') {
      rank++;
      rankings.push({
        rank,
        item: `Optimize ${causal.metric}`,
        type: 'opportunity',
        category: 'optimization',
        impactScore: Math.min(100, Math.abs(causal.correlation) * 100),
        estimatedValue: causal.correlation * 10,
        effort: 'medium',
        timeframe: 'short-term',
        recommendation: causal.explanation,
        supportingData: causal,
      });
    }
  });

  // Add positive forecast trends as opportunities
  analysis.forecasts.forEach(forecast => {
    if (forecast.changePercent > 20 && forecast.confidence > 0.5) {
      rank++;
      rankings.push({
        rank,
        item: `${forecast.metric} Growth Trend`,
        type: 'opportunity',
        category: 'growth',
        impactScore: Math.min(100, forecast.changePercent),
        estimatedValue: forecast.expectedChange,
        effort: 'low',
        timeframe: 'long-term',
        recommendation: `${forecast.metric} projected to grow ${forecast.changePercent.toFixed(1)}%. Maintain current strategy.`,
        supportingData: forecast,
      });
    }
  });

  // Sort by impact score
  return rankings.sort((a, b) => b.impactScore - a.impactScore).map((r, i) => ({ ...r, rank: i + 1 }));
}

// ============================================================================
// COMPREHENSIVE ANALYSIS
// ============================================================================

/**
 * Run comprehensive analysis for a marketing channel
 */
export async function runComprehensiveAnalysis(
  organizationId: string,
  channel: string,
  historicalData: Record<string, TimeSeriesPoint[]>,
  currentMetrics: Record<string, number>,
  kpis: Record<string, TimeSeriesPoint[]> = {}
): Promise<ComprehensiveAnalysis> {
  // 1. Trend analysis
  const trends: Record<string, TrendAnalysis> = {};
  Object.entries(historicalData).forEach(([metric, data]) => {
    trends[metric] = analyzeTrend(data);
  });

  // 2. Seasonality analysis
  const seasonality: Record<string, SeasonalityAnalysis> = {};
  Object.entries(historicalData).forEach(([metric, data]) => {
    seasonality[metric] = analyzeSeasonality(data);
  });

  // 3. Anomaly detection
  const anomalies: Record<string, AnomalyDetection> = {};
  Object.entries(historicalData).forEach(([metric, data]) => {
    anomalies[metric] = detectAnomalies(data);
  });

  // 4. Causation analysis
  const causationAnalysis = analyzeCausation(historicalData, kpis.length ? kpis : historicalData);

  // 5. Cluster analysis (if user data available)
  const userClusters: ClusterResult[] = []; // Would need user-level data

  // 6. Initiative awareness
  const relatedInitiatives = await findRelatedInitiatives(organizationId, channel, currentMetrics);

  // 7. Forecasting
  const forecasts = generateForecasts(historicalData);

  // 8. Impact rankings
  const impactRankings = generateImpactRankings(
    { trends, anomalies, causation: causationAnalysis, initiatives: relatedInitiatives, forecasts },
    currentMetrics
  );

  // 9. Generate summary
  const summary = generateSummary(trends, anomalies, causationAnalysis, relatedInitiatives, forecasts, impactRankings);

  return {
    channel,
    organizationId,
    analyzedAt: new Date(),
    historicalData,
    trends,
    seasonality,
    anomalies,
    causationAnalysis,
    userClusters,
    relatedInitiatives,
    forecasts,
    impactRankings,
    summary,
  };
}

function generateSummary(
  trends: Record<string, TrendAnalysis>,
  anomalies: Record<string, AnomalyDetection>,
  causation: CausationResult[],
  initiatives: InitiativeImpact[],
  forecasts: ForecastResult[],
  rankings: ImpactRanking[]
): ComprehensiveAnalysis['summary'] {
  const keyInsights: string[] = [];
  const topOpportunities: string[] = [];
  const topRisks: string[] = [];
  const recommendedActions: string[] = [];

  // Insights from trends
  const improvingMetrics = Object.entries(trends).filter(([, t]) => t.direction === 'increasing' && t.changePercent > 15);
  const decliningMetrics = Object.entries(trends).filter(([, t]) => t.direction === 'decreasing' && Math.abs(t.changePercent) > 15);

  if (improvingMetrics.length > 0) {
    keyInsights.push(`${improvingMetrics.length} metric(s) showing strong growth: ${improvingMetrics.map(([m]) => m).join(', ')}`);
  }
  if (decliningMetrics.length > 0) {
    keyInsights.push(`${decliningMetrics.length} metric(s) declining: ${decliningMetrics.map(([m]) => m).join(', ')}`);
    topRisks.push(`Address declining ${decliningMetrics[0][0]} (${decliningMetrics[0][1].changePercent.toFixed(1)}%)`);
  }

  // Insights from causation
  const strongCausal = causation.filter(c => c.strength === 'strong');
  if (strongCausal.length > 0) {
    keyInsights.push(`Found ${strongCausal.length} strong driver(s): ${strongCausal.slice(0, 2).map(c => c.metric).join(', ')}`);
    topOpportunities.push(`Focus on ${strongCausal[0].metric} - strongly impacts ${strongCausal[0].kpi}`);
  }

  // Insights from initiatives
  const activeInitiatives = initiatives.filter(i => i.status === 'in-progress');
  const proposedInitiatives = initiatives.filter(i => i.status === 'proposed' || i.status === 'idea');
  
  if (activeInitiatives.length > 0) {
    keyInsights.push(`${activeInitiatives.length} active initiative(s) in progress`);
  }
  if (proposedInitiatives.length > 0) {
    topOpportunities.push(`${proposedInitiatives.length} proposed initiative(s) awaiting approval`);
  }

  // Insights from forecasts
  const positiveForecasts = forecasts.filter(f => f.changePercent > 10);
  const negativeForecasts = forecasts.filter(f => f.changePercent < -10);

  if (positiveForecasts.length > 0) {
    keyInsights.push(`Positive outlook for: ${positiveForecasts.slice(0, 2).map(f => f.metric).join(', ')}`);
  }
  if (negativeForecasts.length > 0) {
    topRisks.push(`Projected decline in: ${negativeForecasts.slice(0, 2).map(f => f.metric).join(', ')}`);
  }

  // Top actions from rankings
  rankings.slice(0, 5).forEach(r => {
    recommendedActions.push(r.recommendation);
  });

  return {
    keyInsights: keyInsights.slice(0, 5),
    topOpportunities: topOpportunities.slice(0, 5),
    topRisks: topRisks.slice(0, 5),
    recommendedActions: recommendedActions.slice(0, 5),
  };
}

// ============================================================================
// HISTORY FETCHING
// ============================================================================

/**
 * Fetch historical metric snapshots
 */
export async function fetchHistoricalMetrics(
  organizationId: string,
  channel: string,
  periodType: 'daily' | 'weekly' = 'daily'
): Promise<Record<string, TimeSeriesPoint[]>> {
  const collectionName = `marketing_metrics_${channel}`;
  const subCollection = periodType;

  try {
    const historyRef = collection(db, collectionName, organizationId, subCollection);
    const snapshot = await getDocs(historyRef);

    const metricsHistory: Record<string, TimeSeriesPoint[]> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = doc.id; // Date is used as document ID

      if (data.metrics) {
        Object.entries(data.metrics).forEach(([metric, value]) => {
          if (typeof value === 'number') {
            if (!metricsHistory[metric]) metricsHistory[metric] = [];
            metricsHistory[metric].push({ date, value });
          }
        });
      }
    });

    // Sort by date
    Object.values(metricsHistory).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));

    return metricsHistory;
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    return {};
  }
}
