/**
 * Causation Analysis Engine
 * Analyzes relationships between different Master Table entities
 */

import { MasterTableEntity } from "./masterTableData";

export interface CorrelationResult {
  entityA: MasterTableEntity;
  entityB: MasterTableEntity;
  correlation: number; // -1 to 1 (Pearson correlation coefficient)
  pValue: number; // Statistical significance
  strength: "strong" | "moderate" | "weak" | "none";
  direction: "positive" | "negative" | "none";
  lag: number; // Number of months lag (0 = same month, 1 = A leads B by 1 month, -1 = B leads A)
  sharedMonths: number; // Number of months both entities have data
}

export interface TimeSeriesPoint {
  month: string;
  value: number;
}

/**
 * Calculate Pearson correlation coefficient between two time series
 */
export function calculateCorrelation(
  entityA: MasterTableEntity,
  entityB: MasterTableEntity,
  lag: number = 0
): CorrelationResult | null {
  // Get all months that exist in both entities
  const monthsA = Object.keys(entityA.months).sort();
  const monthsB = Object.keys(entityB.months).sort();
  
  // Prepare aligned data with lag
  const alignedData: Array<{ a: number; b: number }> = [];
  
  for (let i = 0; i < monthsA.length; i++) {
    const monthA = monthsA[i];
    const monthBIndex = i + lag;
    
    if (monthBIndex >= 0 && monthBIndex < monthsB.length) {
      const monthB = monthsB[monthBIndex];
      const valueA = entityA.months[monthA];
      const valueB = entityB.months[monthB];
      
      if (valueA !== undefined && valueB !== undefined && valueA !== 0 && valueB !== 0) {
        alignedData.push({ a: valueA, b: valueB });
      }
    }
  }
  
  // Need at least 3 data points for meaningful correlation
  if (alignedData.length < 3) {
    return null;
  }
  
  // Calculate means
  const meanA = alignedData.reduce((sum, d) => sum + d.a, 0) / alignedData.length;
  const meanB = alignedData.reduce((sum, d) => sum + d.b, 0) / alignedData.length;
  
  // Calculate correlation
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  
  for (const point of alignedData) {
    const diffA = point.a - meanA;
    const diffB = point.b - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }
  
  const correlation = numerator / Math.sqrt(denomA * denomB);
  
  // Calculate p-value (simplified t-test)
  const n = alignedData.length;
  const tStat = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
  const pValue = calculatePValue(tStat, n - 2);
  
  // Determine strength and direction
  const absCorr = Math.abs(correlation);
  let strength: CorrelationResult["strength"];
  if (absCorr >= 0.7) strength = "strong";
  else if (absCorr >= 0.4) strength = "moderate";
  else if (absCorr >= 0.2) strength = "weak";
  else strength = "none";
  
  const direction: CorrelationResult["direction"] = 
    correlation > 0.1 ? "positive" : correlation < -0.1 ? "negative" : "none";
  
  return {
    entityA,
    entityB,
    correlation,
    pValue,
    strength,
    direction,
    lag,
    sharedMonths: alignedData.length
  };
}

/**
 * Find optimal lag between two entities (when does A predict B?)
 */
export function findOptimalLag(
  entityA: MasterTableEntity,
  entityB: MasterTableEntity,
  maxLag: number = 6
): CorrelationResult | null {
  let bestResult: CorrelationResult | null = null;
  let bestAbsCorrelation = 0;
  
  // Try different lags
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const result = calculateCorrelation(entityA, entityB, lag);
    if (result && Math.abs(result.correlation) > bestAbsCorrelation) {
      bestAbsCorrelation = Math.abs(result.correlation);
      bestResult = result;
    }
  }
  
  return bestResult;
}

/**
 * Analyze all pairwise correlations in a set of entities
 */
export function analyzeAllCorrelations(
  entities: MasterTableEntity[],
  options: {
    findOptimalLag?: boolean;
    maxLag?: number;
    minSharedMonths?: number;
  } = {}
): CorrelationResult[] {
  const { findOptimalLag: findLag = true, maxLag = 6, minSharedMonths = 3 } = options;
  const results: CorrelationResult[] = [];
  
  // Compare each entity with every other entity
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entityA = entities[i];
      const entityB = entities[j];
      
      let result: CorrelationResult | null;
      
      if (findLag) {
        result = findOptimalLag(entityA, entityB, maxLag);
      } else {
        result = calculateCorrelation(entityA, entityB, 0);
      }
      
      if (result && result.sharedMonths >= minSharedMonths) {
        results.push(result);
      }
    }
  }
  
  // Sort by absolute correlation strength
  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

/**
 * Simplified p-value calculation using t-distribution approximation
 */
function calculatePValue(tStat: number, degreesOfFreedom: number): number {
  // Very simplified approximation - in production, use a proper stats library
  const absTStat = Math.abs(tStat);
  
  // Rough approximation based on common t-distribution values
  if (degreesOfFreedom >= 30) {
    // Use normal approximation for large df
    if (absTStat > 2.576) return 0.01; // 99% confidence
    if (absTStat > 1.96) return 0.05;  // 95% confidence
    if (absTStat > 1.645) return 0.10; // 90% confidence
    return 0.20;
  } else {
    // Conservative estimates for small df
    if (absTStat > 3) return 0.01;
    if (absTStat > 2) return 0.05;
    if (absTStat > 1.5) return 0.10;
    return 0.20;
  }
}

/**
 * Get explanation text for a correlation result
 */
export function getCorrelationExplanation(result: CorrelationResult): string {
  const { entityA, entityB, correlation, strength, direction, lag, pValue } = result;
  
  const strengthText = strength === "strong" ? "strongly" : 
                       strength === "moderate" ? "moderately" : 
                       strength === "weak" ? "weakly" : "not";
  
  const directionText = direction === "positive" ? "increases" : 
                        direction === "negative" ? "decreases" : "changes";
  
  const lagText = lag === 0 ? "in the same month" :
                  lag > 0 ? `${lag} month${lag > 1 ? 's' : ''} later` :
                  `${Math.abs(lag)} month${Math.abs(lag) > 1 ? 's' : ''} earlier`;
  
  const significanceText = pValue < 0.05 ? "statistically significant" : "not statistically significant";
  
  if (strength === "none") {
    return `No meaningful correlation found between ${entityA.entityName} and ${entityB.entityName}.`;
  }
  
  let explanation = `${entityA.entityName} is ${strengthText} correlated with ${entityB.entityName}. `;
  
  if (lag !== 0) {
    const leader = lag > 0 ? entityA.entityName : entityB.entityName;
    explanation += `${leader} appears to lead, with changes reflected ${lagText}. `;
  } else {
    explanation += `When ${entityA.entityName} ${directionText}, ${entityB.entityName} tends to ${directionText} ${lagText}. `;
  }
  
  explanation += `(r = ${correlation.toFixed(3)}, ${significanceText}, n = ${result.sharedMonths})`;
  
  return explanation;
}

/**
 * Find entities that best predict a target entity
 */
export function findPredictors(
  targetEntity: MasterTableEntity,
  candidateEntities: MasterTableEntity[],
  options: {
    maxLag?: number;
    minCorrelation?: number;
    maxResults?: number;
  } = {}
): CorrelationResult[] {
  const { maxLag = 6, minCorrelation = 0.3, maxResults = 10 } = options;
  const results: CorrelationResult[] = [];
  
  for (const candidate of candidateEntities) {
    if (candidate.entityId === targetEntity.entityId) continue;
    
    const result = findOptimalLag(candidate, targetEntity, maxLag);
    
    if (result && Math.abs(result.correlation) >= minCorrelation) {
      results.push(result);
    }
  }
  
  // Sort by correlation strength and limit results
  return results
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, maxResults);
}

/**
 * Calculate growth rate for an entity over time
 */
export function calculateGrowthRate(entity: MasterTableEntity): {
  overallGrowth: number; // Percentage growth from first to last month
  averageMonthlyGrowth: number; // Average MoM growth
  cmgr: number; // Compound Monthly Growth Rate
  trend: "growing" | "declining" | "stable";
} {
  const months = Object.keys(entity.months).sort();
  const values = months.map(m => entity.months[m]).filter(v => v > 0);
  
  if (values.length < 2) {
    return { overallGrowth: 0, averageMonthlyGrowth: 0, cmgr: 0, trend: "stable" };
  }
  
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const overallGrowth = ((lastValue - firstValue) / firstValue) * 100;
  
  // Calculate month-over-month changes
  const momChanges: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const change = ((values[i] - values[i - 1]) / values[i - 1]) * 100;
    if (isFinite(change)) momChanges.push(change);
  }
  const averageMonthlyGrowth = momChanges.length > 0 
    ? momChanges.reduce((sum, c) => sum + c, 0) / momChanges.length 
    : 0;
  
  // Calculate CMGR
  const numPeriods = values.length - 1;
  const cmgr = (Math.pow(lastValue / firstValue, 1 / numPeriods) - 1) * 100;
  
  const trend: "growing" | "declining" | "stable" = 
    cmgr > 2 ? "growing" : cmgr < -2 ? "declining" : "stable";
  
  return { overallGrowth, averageMonthlyGrowth, cmgr, trend };
}

/**
 * Group entities by correlation clusters
 */
export function findCorrelationClusters(
  entities: MasterTableEntity[],
  minCorrelation: number = 0.5
): Array<{ entities: MasterTableEntity[]; avgCorrelation: number }> {
  const correlations = analyzeAllCorrelations(entities, { findOptimalLag: false });
  
  // Build adjacency map of highly correlated entities
  const adjacency = new Map<string, Set<string>>();
  
  for (const result of correlations) {
    if (Math.abs(result.correlation) >= minCorrelation) {
      if (!adjacency.has(result.entityA.entityId)) {
        adjacency.set(result.entityA.entityId, new Set());
      }
      if (!adjacency.has(result.entityB.entityId)) {
        adjacency.set(result.entityB.entityId, new Set());
      }
      adjacency.get(result.entityA.entityId)!.add(result.entityB.entityId);
      adjacency.get(result.entityB.entityId)!.add(result.entityA.entityId);
    }
  }
  
  // Find clusters using simple connected components
  const visited = new Set<string>();
  const clusters: Array<{ entities: MasterTableEntity[]; avgCorrelation: number }> = [];
  
  const entityMap = new Map(entities.map(e => [e.entityId, e]));
  
  for (const entity of entities) {
    if (visited.has(entity.entityId)) continue;
    
    const cluster: MasterTableEntity[] = [];
    const queue = [entity.entityId];
    
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      
      visited.add(id);
      const e = entityMap.get(id);
      if (e) cluster.push(e);
      
      const neighbors = adjacency.get(id);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }
    
    if (cluster.length > 1) {
      // Calculate average correlation within cluster
      let totalCorr = 0;
      let count = 0;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const result = calculateCorrelation(cluster[i], cluster[j], 0);
          if (result) {
            totalCorr += Math.abs(result.correlation);
            count++;
          }
        }
      }
      const avgCorrelation = count > 0 ? totalCorr / count : 0;
      
      clusters.push({ entities: cluster, avgCorrelation });
    }
  }
  
  return clusters.sort((a, b) => b.avgCorrelation - a.avgCorrelation);
}
