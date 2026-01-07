import { Timestamp } from "firebase/firestore";

export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  salary: number;
  salaryType: "hourly" | "monthly" | "annual";
  currency: string;
  hoursPerWeek: number;
  timezone: string;
  startDate: Timestamp | Date;
  status: "active" | "inactive" | "contractor";
  avatar?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

export const currencies = [
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "EUR", label: "EUR (€)", symbol: "€" },
  { value: "GBP", label: "GBP (£)", symbol: "£" },
  { value: "CAD", label: "CAD ($)", symbol: "$" },
  { value: "AUD", label: "AUD ($)", symbol: "$" },
  { value: "JPY", label: "JPY (¥)", symbol: "¥" },
  { value: "CNY", label: "CNY (¥)", symbol: "¥" },
  { value: "INR", label: "INR (₹)", symbol: "₹" },
  { value: "BRL", label: "BRL (R$)", symbol: "R$" },
  { value: "MXN", label: "MXN ($)", symbol: "$" },
  { value: "CHF", label: "CHF (Fr)", symbol: "Fr" },
  { value: "SGD", label: "SGD ($)", symbol: "$" },
];

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category: "productivity" | "engineering" | "design" | "marketing" | "sales" | "hr" | "finance" | "other";
  cost: number;
  currency: string;
  costType?: "fixed" | "variable";
  billingCycle: "monthly" | "annual" | "one_time";
  isCOGS: boolean; // Cost of Goods Sold
  renewalDate: Timestamp | Date;
  adminId: string; // Person ID who manages this tool
  adminName?: string;
  userIds?: string[]; // People IDs who have access
  userCount?: number;
  vendor?: string;
  website?: string;
  status: "active" | "cancelled" | "trial";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

export const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST)" },
];

export const toolCategories = [
  { value: "productivity", label: "Productivity", color: "#00d4aa" },
  { value: "engineering", label: "Engineering", color: "#3b82f6" },
  { value: "design", label: "Design", color: "#8b5cf6" },
  { value: "marketing", label: "Marketing", color: "#f59e0b" },
  { value: "sales", label: "Sales", color: "#ec4899" },
  { value: "hr", label: "HR", color: "#14b8a6" },
  { value: "finance", label: "Finance", color: "#84cc16" },
  { value: "other", label: "Other", color: "#6b7280" },
];

export const departments = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "Customer Success",
  "HR",
  "Finance",
  "Operations",
  "Executive",
];

