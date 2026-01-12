import { Timestamp } from "firebase/firestore";

export interface Initiative {
  id: string;
  organizationId: string;
  
  // Basic Info
  name: string;
  description: string;
  category: InitiativeCategory;
  priority: "critical" | "high" | "medium" | "low";
  
  // Status & Progress
  status: InitiativeStatus;
  progress: number; // 0-100
  
  // Waterline Position
  isAboveWaterline: boolean; // Can we afford this?
  waterlineScore: number; // Calculated score for ordering
  
  // Resource Requirements
  estimatedCost: number; // Total estimated cost in org currency
  estimatedPeopleHours: number; // Total hours needed
  estimatedDuration: number; // Weeks
  requiredPeopleIds: string[]; // People who need to work on this
  requiredToolIds: string[]; // Tools needed
  
  // Cost Breakdown
  costBreakdown?: {
    peopleTime: number;
    toolsOneTime: number;
    toolsRecurring: number;
    other: number;
  };
  
  // Ownership & Dates
  ownerId: string; // Person ID
  ownerName?: string;
  teamIds?: string[];
  startDate?: Timestamp | Date | null;
  targetDate?: Timestamp | Date | null;
  completedDate?: Timestamp | Date | null;
  
  // Business Impact
  expectedRevenue?: number;
  expectedSavings?: number;
  impactDescription?: string;
  
  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
  
  // Tags & Links
  tags?: string[];
  relatedInitiativeIds?: string[];
  notes?: string;
}

export type InitiativeStatus = 
  | "idea"           // Just an idea, not planned yet
  | "proposed"       // Formally proposed
  | "above-waterline" // Above waterline, can be executed
  | "below-waterline" // Below waterline, waiting for capacity
  | "planned"        // Scheduled to start
  | "in-progress"    // Currently executing
  | "on-hold"        // Paused
  | "completed"      // Done
  | "cancelled";     // Cancelled

export type InitiativeCategory =
  | "product"        // Product features
  | "engineering"    // Technical improvements
  | "operations"     // Operational efficiency
  | "marketing"      // Marketing & growth
  | "sales"          // Sales enablement
  | "customer"       // Customer success
  | "people"         // People & culture
  | "finance"        // Financial operations
  | "other";

export const initiativeCategories: { value: InitiativeCategory; label: string; icon?: string }[] = [
  { value: "product", label: "Product" },
  { value: "engineering", label: "Engineering" },
  { value: "operations", label: "Operations" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "customer", label: "Customer Success" },
  { value: "people", label: "People & Culture" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

export const statusConfig: Record<
  InitiativeStatus,
  { label: string; color: string; bg: string }
> = {
  "idea": { label: "Idea", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)" },
  "proposed": { label: "Proposed", color: "#6366f1", bg: "rgba(99, 102, 241, 0.15)" },
  "above-waterline": { label: "Above Waterline", color: "#00d4aa", bg: "rgba(0, 212, 170, 0.15)" },
  "below-waterline": { label: "Below Waterline", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  "planned": { label: "Planned", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  "in-progress": { label: "In Progress", color: "#00d4aa", bg: "rgba(0, 212, 170, 0.15)" },
  "on-hold": { label: "On Hold", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  "completed": { label: "Completed", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
  "cancelled": { label: "Cancelled", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
};

export const priorityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#8b5cf6",
};

/**
 * Calculate if an initiative is above the waterline based on available resources
 */
export function calculateWaterlinePosition(
  initiative: Partial<Initiative>,
  availableResources: {
    totalBudget: number;
    allocatedBudget: number;
    availablePeopleHours: number;
    allocatedPeopleHours: number;
  }
): { isAbove: boolean; score: number; reason: string } {
  const estimatedCost = initiative.estimatedCost || 0;
  const estimatedHours = initiative.estimatedPeopleHours || 0;
  
  const remainingBudget = availableResources.totalBudget - availableResources.allocatedBudget;
  const remainingHours = availableResources.availablePeopleHours - availableResources.allocatedPeopleHours;
  
  // Can we afford it?
  const canAffordBudget = estimatedCost <= remainingBudget;
  const canAffordHours = estimatedHours <= remainingHours;
  
  const isAbove = canAffordBudget && canAffordHours;
  
  // Calculate a score for prioritization (higher = more important)
  const priority = initiative.priority || "low";
  const priorityScore = { critical: 100, high: 75, medium: 50, low: 25 }[priority];
  
  const expectedRevenue = initiative.expectedRevenue || 0;
  const expectedSavings = initiative.expectedSavings || 0;
  const roi = estimatedCost > 0 ? (expectedRevenue + expectedSavings) / estimatedCost : 0;
  
  // Final score: priority + ROI + progress
  const score = priorityScore + (roi * 10) + (initiative.progress || 0) * 0.1;
  
  let reason = "";
  if (!canAffordBudget) reason = `Needs $${(estimatedCost - remainingBudget).toFixed(0)} more budget`;
  if (!canAffordHours) reason += (reason ? ", " : "") + `Needs ${(estimatedHours - remainingHours).toFixed(0)} more hours`;
  if (isAbove) reason = "Resources available";
  
  return { isAbove, score, reason };
}

