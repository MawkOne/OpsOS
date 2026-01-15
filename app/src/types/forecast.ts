/**
 * Forecast Version Control System
 * Treats forecasts like code commits - versioned, immutable snapshots
 */

import { Timestamp } from "firebase/firestore";

export interface ForecastAdjustment {
  entityId: string;
  type: "cmgr_override" | "manual_override" | "seasonal_adjustment";
  value: number;
  description?: string;
}

export interface ForecastVersion {
  id: string;
  organizationId: string;
  
  // Version metadata (like a git commit)
  version: number; // Auto-incrementing version number
  name: string; // e.g., "Q1 2026 Base Plan"
  description?: string; // What changed in this version
  createdAt: Timestamp;
  createdBy: string; // User ID
  createdByName: string; // User name for display
  
  // Parent version (for branching/comparison)
  parentVersionId?: string;
  
  // Status
  status: "draft" | "published" | "archived";
  isActive: boolean; // Only one active version at a time (the "main" branch)
  
  // Baseline configuration
  selectedEntityIds: string[]; // Which Master Table entities are included
  
  // Forecast parameters
  forecastMonths: number; // How many months to forecast (default 12)
  startMonth: string; // First forecast month (YYYY-MM)
  
  // Adjustments and overrides
  adjustments?: ForecastAdjustment[];
  
  // Calculated forecast data (snapshot at time of creation)
  forecastData: {
    entityId: string;
    entityName: string;
    source: string;
    baseline: Record<string, number>; // Historical data
    forecast: Record<string, number>; // Projected data
    cmgr: number;
    total: number;
  }[];
  
  // Summary metrics
  summary: {
    totalHistoricalRevenue: number;
    totalForecastedRevenue: number;
    averageMonthlyRevenue: number;
    overallGrowthRate: number;
  };
  
  // Tags for organization
  tags?: string[];
}

export interface ForecastComparison {
  versionA: ForecastVersion;
  versionB: ForecastVersion;
  differences: {
    entityId: string;
    entityName: string;
    changeInForecast: number; // Absolute difference
    changeInForecastPercent: number; // Percentage difference
    changeInCMGR: number;
  }[];
  summaryDifference: {
    totalRevenueDiff: number;
    totalRevenueDiffPercent: number;
    avgMonthlyDiff: number;
  };
}

export interface InitiativeForecastImpact {
  initiativeId: string;
  baseForecastVersionId: string; // Which version is this based on
  
  // Impact configuration
  impactedEntityIds: string[];
  impactPercentage: number; // % growth/reduction
  
  // Calculated impact (forecast with initiative vs without)
  projectedImpact: {
    entityId: string;
    baselineForecast: Record<string, number>;
    withInitiativeForecast: Record<string, number>;
    incrementalRevenue: number;
  }[];
  
  totalIncrementalRevenue: number;
}

export const FORECAST_VERSION_TYPES = {
  DRAFT: "draft" as const,
  PUBLISHED: "published" as const,
  ARCHIVED: "archived" as const,
};

export const FORECAST_ADJUSTMENT_TYPES = {
  CMGR_OVERRIDE: "cmgr_override" as const,
  MANUAL_OVERRIDE: "manual_override" as const,
  SEASONAL_ADJUSTMENT: "seasonal_adjustment" as const,
};
