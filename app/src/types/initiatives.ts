import { Timestamp } from "firebase/firestore";

// Expense entry for initiatives
export interface InitiativeExpense {
  id: string;
  name: string;
  amount: number;
  category: "software" | "hardware" | "services" | "marketing" | "travel" | "other";
  isRecurring: boolean;
  frequency?: "monthly" | "quarterly" | "annual"; // If recurring
  date?: Date | Timestamp;
  notes?: string;
}

export interface Initiative {
  id: string;
  organizationId: string;
  
  // Basic Info
  name: string;
  description: string;
  type: "new" | "existing"; // NEW: New initiative or existing baseline work
  category: InitiativeCategory;
  priority: "critical" | "high" | "medium" | "low";
  
  // Status & Progress
  status: InitiativeStatus;
  progress: number; // 0-100
  
  // Waterline Position
  isAboveWaterline: boolean; // Can we afford this?
  waterlineScore: number; // Calculated score for ordering
  
  // Revenue Plans (linked to Stripe products or custom)
  linkedProductIds: string[]; // Stripe product IDs from stripe_products collection
  customRevenue?: number; // If not linked to products, custom revenue amount
  actualRevenue?: number; // Tracked actual revenue (calculated from linked products)
  
  // Cost Breakdown - People
  linkedPeopleIds: string[]; // People working on this initiative
  peopleAllocation?: Record<string, number>; // personId -> hours or % allocation
  actualPeopleCost?: number; // Calculated from linkedPeopleIds
  
  // Cost Breakdown - Tools
  linkedToolIds: string[]; // Tools used for this initiative
  toolAllocation?: Record<string, number>; // toolId -> % usage allocation
  actualToolsCost?: number; // Calculated from linkedToolIds
  
  // Cost Breakdown - Other
  expenses?: InitiativeExpense[]; // Custom expenses
  actualExpensesCost?: number; // Sum of expenses
  
  // Legacy fields (kept for backward compatibility)
  estimatedCost: number; // Total estimated cost in org currency
  estimatedPeopleHours: number; // Total hours needed
  estimatedDuration: number; // Weeks
  requiredPeopleIds: string[]; // Deprecated - use linkedPeopleIds
  requiredToolIds: string[]; // Deprecated - use linkedToolIds
  
  // Cost Breakdown (deprecated - use detailed breakdown above)
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
  
  // Forecasting Data
  forecast?: {
    enabled: boolean;
    selectedLineItems?: string[]; // Baseline entity IDs that this initiative impacts
    initiativeImpact?: number; // % growth impact on selected line items
    funnelMode?: boolean; // Whether funnel mode is enabled
    funnelOperations?: Record<number, 'add' | 'subtract' | 'multiply' | 'divide'>; // Operations between funnel stages
    calculatedStages?: Record<number, Record<string, number>>; // Calculated intermediate results per stage
    stageNumberFormats?: Record<number, 'percentage' | 'whole' | 'decimal' | 'currency'>; // Number format for each calculated stage
    itemsInForecast?: string[]; // Which items to display in forecast chart
    targetedItemId?: string | null; // Which item is targeted for month-by-month impacts
    monthlyImpacts?: Record<string, number>; // Month-specific impact percentages
    forecastMethods?: Record<string, 'cmgr' | 'linear' | 'flat'>; // Forecast method per entity
    applySeasonality?: Record<string, boolean>; // Whether to apply seasonality per entity
    monthlyRevenue?: number[]; // 12 months of projected revenue (deprecated)
    monthlyImpact?: number[]; // 12 months of projected impact metric (deprecated)
    assumptions?: string[]; // Key assumptions
    drivers?: Array<{
      name: string;
      impact: number;
      direction: "positive" | "negative" | "neutral";
    }>;
  };
  
  // Scenario Planning
  scenarios?: {
    base?: {
      revenue: number;
      costs: number;
      probability: number;
      description?: string;
    };
    optimistic?: {
      revenue: number;
      costs: number;
      probability: number;
      description?: string;
    };
    pessimistic?: {
      revenue: number;
      costs: number;
      probability: number;
      description?: string;
    };
  };
  
  // Monte Carlo Simulation
  monteCarlo?: {
    simulations: number;
    expectedValue?: number;
    standardDeviation?: number;
    confidenceInterval?: {
      p10: number;
      p50: number;
      p90: number;
    };
    variables?: Array<{
      name: string;
      min: number;
      max: number;
      mean: number;
      distribution: "normal" | "triangular" | "uniform";
    }>;
  };
}

export type InitiativeStatus = 
  | "draft"          // Work in progress, not ready for review
  | "ready"          // Ready for review and prioritization
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
  "draft": { label: "Draft", color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)" },
  "ready": { label: "Ready", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
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
 * Calculate actual costs from linked resources
 */
export function calculateInitiativeCosts(
  initiative: Partial<Initiative>,
  people: Array<{ id: string; salary: number; salaryType: string; hoursPerWeek: number }>,
  tools: Array<{ id: string; cost: number; billingCycle: string }>
): {
  peopleCost: number;
  toolsCost: number;
  expensesCost: number;
  totalCost: number;
} {
  // Calculate people cost
  let peopleCost = 0;
  if (initiative.linkedPeopleIds) {
    initiative.linkedPeopleIds.forEach(personId => {
      const person = people.find(p => p.id === personId);
      if (person) {
        let annualCost = 0;
        if (person.salaryType === "annual") {
          annualCost = person.salary;
        } else if (person.salaryType === "monthly") {
          annualCost = person.salary * 12;
        } else {
          // hourly
          annualCost = person.salary * person.hoursPerWeek * 52;
        }
        
        // Apply allocation percentage if specified
        const allocation = initiative.peopleAllocation?.[personId] || 100;
        peopleCost += (annualCost * allocation) / 100;
      }
    });
  }

  // Calculate tools cost (annualized)
  let toolsCost = 0;
  if (initiative.linkedToolIds) {
    initiative.linkedToolIds.forEach(toolId => {
      const tool = tools.find(t => t.id === toolId);
      if (tool) {
        let annualCost = 0;
        if (tool.billingCycle === "annual") {
          annualCost = tool.cost;
        } else if (tool.billingCycle === "monthly") {
          annualCost = tool.cost * 12;
        }
        // one_time costs are not recurring
        
        // Apply allocation percentage if specified
        const allocation = initiative.toolAllocation?.[toolId] || 100;
        toolsCost += (annualCost * allocation) / 100;
      }
    });
  }

  // Calculate expenses cost
  const expensesCost = initiative.expenses?.reduce((sum, exp) => {
    let annualized = exp.amount;
    if (exp.isRecurring) {
      if (exp.frequency === "monthly") annualized = exp.amount * 12;
      else if (exp.frequency === "quarterly") annualized = exp.amount * 4;
      // annual stays as is
    }
    return sum + annualized;
  }, 0) || 0;

  const totalCost = peopleCost + toolsCost + expensesCost;

  return { peopleCost, toolsCost, expensesCost, totalCost };
}

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
  
  // Handle NaN values by defaulting to 0
  const totalBudget = isNaN(availableResources.totalBudget) ? 0 : availableResources.totalBudget;
  const allocatedBudget = isNaN(availableResources.allocatedBudget) ? 0 : availableResources.allocatedBudget;
  const availablePeopleHours = isNaN(availableResources.availablePeopleHours) ? 0 : availableResources.availablePeopleHours;
  const allocatedPeopleHours = isNaN(availableResources.allocatedPeopleHours) ? 0 : availableResources.allocatedPeopleHours;
  
  const remainingBudget = totalBudget - allocatedBudget;
  const remainingHours = availablePeopleHours - allocatedPeopleHours;
  
  // Can we afford it?
  const canAffordBudget = estimatedCost <= remainingBudget;
  const canAffordHours = estimatedHours <= remainingHours || estimatedHours === 0;
  
  const isAbove = canAffordBudget && canAffordHours;
  
  // Calculate a score for prioritization (higher = more important)
  const priority = initiative.priority || "medium";
  const priorityScore = { critical: 100, high: 75, medium: 50, low: 25 }[priority];
  
  const expectedRevenue = initiative.expectedRevenue || 0;
  const expectedSavings = initiative.expectedSavings || 0;
  const roi = estimatedCost > 0 ? (expectedRevenue + expectedSavings) / estimatedCost : 0;
  
  // Final score: priority + ROI + progress
  const score = priorityScore + (roi * 10) + (initiative.progress || 0) * 0.1;
  
  let reason = "";
  if (!canAffordBudget && estimatedCost > 0) {
    const shortfall = estimatedCost - remainingBudget;
    reason = `Needs $${shortfall.toFixed(0)} more budget`;
  }
  if (!canAffordHours && estimatedHours > 0) {
    const shortfall = estimatedHours - remainingHours;
    if (!isNaN(shortfall) && shortfall > 0) {
      reason += (reason ? ", " : "") + `Needs ${shortfall.toFixed(0)} more hours`;
    }
  }
  if (isAbove) reason = "Resources available";
  if (!reason) reason = "Ready to plan";
  
  return { isAbove, score, reason };
}

