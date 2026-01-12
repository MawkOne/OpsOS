import { Timestamp } from "firebase/firestore";

export type DataSource = "google-analytics" | "advertising" | "activecampaign" | "dataforseo" | "stripe";

export type GAMetric = 
  | "activeUsers"
  | "newUsers"
  | "sessions"
  | "engagementRate"
  | "averageSessionDuration"
  | "eventCount"
  | "conversions"
  | "totalRevenue";

export type AdMetric =
  | "clicks"
  | "impressions"
  | "spend"
  | "cpc"
  | "ctr"
  | "conversions"
  | "revenue"
  | "conversionRate"
  | "roas";

export type GAEventName = string; // Dynamic list from GA

export interface MetricSelector {
  source: DataSource;
  metricType: "metric" | "event";
  
  // For GA metrics
  gaMetric?: GAMetric;
  
  // For Advertising metrics
  adMetric?: AdMetric;
  
  // For GA events
  gaEventName?: string;
  
  // Filters
  filters?: {
    country?: string;
    device?: string;
    eventName?: string; // For filtering specific events
  };
}

export interface CustomMetric {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  section: "marketing" | "revenue" | "leadership" | "custom";
  
  // Numerator (top of fraction)
  numerator: MetricSelector;
  
  // Denominator (bottom of fraction)
  denominator: MetricSelector;
  
  // Calculated monthly values
  monthlyValues?: Record<string, number>; // "2026-01": 3.2 (percentage)
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastCalculated?: Timestamp;
}

export interface MetricCalculationResult {
  metricId: string;
  monthlyValues: Record<string, {
    numerator: number;
    denominator: number;
    percentage: number;
  }>;
  calculatedAt: Timestamp;
}

