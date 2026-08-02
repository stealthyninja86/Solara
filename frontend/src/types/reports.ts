export type TimePeriod = "weekly" | "monthly" | "yearly";

export interface FinancialSummary {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
}

export interface SpendingChange {
  category: string;
  amount: number;
  previousAmount: number;
  changePercent: number;
}

export interface TrendPoint {
  label: string;
  income: number;
  expenses: number;
}

export interface SpendingVelocity {
  label: string;
  amount: number;
}

export interface SolaraInsight {
  type: "spending_change" | "anomaly" | "suggestion";
  headline: string;
  reasons: string[];
  suggestion: string;
}

export interface Subscription {
  merchant: string;
  amount: number;
  interval: string;
  category: string;
}
