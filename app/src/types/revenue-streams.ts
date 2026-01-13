import { Timestamp } from "firebase/firestore";

export interface RevenueStream {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  color: string;
  productIds: string[]; // Array of Stripe product IDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface RevenueStreamWithMetrics extends RevenueStream {
  totalRevenue: number;
  monthlyRevenue: Record<string, number>; // "2026-01": 1250
  productCount: number;
}

