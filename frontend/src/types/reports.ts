export type TimePeriod = "weekly" | "monthly" | "yearly";

export interface DateRange {
  from: string;
  to: string;
}

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

export type InsightType = "STATUS" | "ACTION" | "NEXT";

export interface CardText {
  headline: string;
  body: string;
  suggestion: string;
}

export interface InsightCard {
  factId: string;
  type: InsightType;
  label: string;
  text: CardText;
  value: string;
  changePercent: string | null;
  action: string | null;
}

export interface Recommendation {
  card: InsightCard;
  action: string;
}

export interface Subscription {
  merchant: string;
  amount: number;
  interval: string;
  category: string;
  occurrences: number;
  lastPaid: string;
}

export type SubscriptionFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type SubscriptionKind = "SUBSCRIPTION" | "BILL" | "RENT" | "EMI";
export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "PAID_OFF";
export type SubscriptionCycleState =
  | "AWAITING_FIRST_CHARGE"
  | "ON_SCHEDULE"
  | "LATE"
  | "NOT_SEEN"
  | "CANCELLED"
  | "PAID_OFF";

export interface TrackedSubscription {
  id: string;
  merchant: string;
  frequency: SubscriptionFrequency;
  amount: number;
  nextExpectedDate: string;
  lastChargeDate: string | null;
  lastChargeAmount: number | null;
  kind: SubscriptionKind;
  amountTolerancePercent: number | null;
  tenureMonths: number | null;
  paidMonths: number | null;
  payeeMerchant: string | null;
  status: SubscriptionStatus;
  cycleState: SubscriptionCycleState;
}
