import type {
  FinancialSummary,
  SpendingChange,
  TrendPoint,
  SpendingVelocity,
  SolaraInsight,
  Subscription,
  TimePeriod,
} from "../types/reports";

export const MOCK_FINANCIAL_SUMMARY: Record<TimePeriod, FinancialSummary> = {
  weekly: {
    income: 21250,
    expenses: 10575,
    savings: 10675,
    savingsRate: 50,
  },
  monthly: {
    income: 85000,
    expenses: 42300,
    savings: 42700,
    savingsRate: 50,
  },
  yearly: {
    income: 1020000,
    expenses: 510000,
    savings: 510000,
    savingsRate: 50,
  },
};

export const MOCK_SPENDING_CHANGES: Record<TimePeriod, SpendingChange[]> = {
  weekly: [
    { category: "FOOD_DINING", amount: 2100, previousAmount: 1800, changePercent: 17 },
    { category: "TRANSPORT", amount: 1300, previousAmount: 1450, changePercent: -10 },
    { category: "SHOPPING", amount: 975, previousAmount: 700, changePercent: 39 },
    { category: "BILLS_UTILITIES", amount: 1875, previousAmount: 1875, changePercent: 0 },
    { category: "ENTERTAINMENT", amount: 700, previousAmount: 550, changePercent: 27 },
    { category: "GROCERIES", amount: 1050, previousAmount: 950, changePercent: 11 },
  ],
  monthly: [
    { category: "FOOD_DINING", amount: 8400, previousAmount: 6560, changePercent: 28 },
    { category: "TRANSPORT", amount: 5200, previousAmount: 5780, changePercent: -10 },
    { category: "SHOPPING", amount: 3900, previousAmount: 2890, changePercent: 35 },
    { category: "BILLS_UTILITIES", amount: 7500, previousAmount: 7500, changePercent: 0 },
    { category: "ENTERTAINMENT", amount: 2800, previousAmount: 2200, changePercent: 27 },
    { category: "GROCERIES", amount: 4200, previousAmount: 3800, changePercent: 11 },
  ],
  yearly: [
    { category: "FOOD_DINING", amount: 96000, previousAmount: 78000, changePercent: 23 },
    { category: "TRANSPORT", amount: 58000, previousAmount: 62000, changePercent: -6 },
    { category: "SHOPPING", amount: 42000, previousAmount: 35000, changePercent: 20 },
    { category: "BILLS_UTILITIES", amount: 84000, previousAmount: 78000, changePercent: 8 },
    { category: "ENTERTAINMENT", amount: 30000, previousAmount: 24000, changePercent: 25 },
    { category: "GROCERIES", amount: 48000, previousAmount: 42000, changePercent: 14 },
  ],
};

export const MOCK_TRENDS: Record<TimePeriod, TrendPoint[]> = {
  weekly: [
    { label: "W1", income: 21250, expenses: 9500 },
    { label: "W2", income: 21250, expenses: 11200 },
    { label: "W3", income: 21250, expenses: 13800 },
    { label: "W4", income: 21250, expenses: 7800 },
  ],
  monthly: [
    { label: "Oct", income: 82000, expenses: 38000 },
    { label: "Nov", income: 85000, expenses: 41000 },
    { label: "Dec", income: 90000, expenses: 52000 },
    { label: "Jan", income: 85000, expenses: 44000 },
    { label: "Feb", income: 85000, expenses: 39500 },
    { label: "Mar", income: 85000, expenses: 42300 },
  ],
  yearly: [
    { label: "2021", income: 720000, expenses: 480000 },
    { label: "2022", income: 840000, expenses: 540000 },
    { label: "2023", income: 960000, expenses: 600000 },
    { label: "2024", income: 1020000, expenses: 580000 },
    { label: "2025", income: 1020000, expenses: 510000 },
  ],
};

export const MOCK_SPENDING_VELOCITY: SpendingVelocity[] = [
  { label: "Week 1", amount: 8200 },
  { label: "Week 2", amount: 11400 },
  { label: "Week 3", amount: 15800 },
  { label: "Week 4", amount: 6900 },
];

export const MOCK_INSIGHTS: Record<TimePeriod, SolaraInsight[]> = {
  weekly: [
    {
      type: "spending_change",
      headline: "Food spending increased 17% this week.",
      reasons: [
        "Zomato orders increased from 2 to 4",
        "Weekend spending is 2x higher than weekdays",
      ],
      suggestion: "Reducing 1 delivery per week saves ~\u20B9300/week",
    },
    {
      type: "anomaly",
      headline: "Shopping spike detected this week.",
      reasons: [
        "2x higher than your 4-week average",
        "Amazon accounted for 80% of shopping spend",
      ],
      suggestion: "Review recent purchases for impulse buys",
    },
    {
      type: "suggestion",
      headline: "Transport costs dropped 10% this week.",
      reasons: [
        "Fewer Uber rides this week",
        "Metro usage increased",
      ],
      suggestion: "Keep using metro — on track to save \u20B9150/week",
    },
  ],
  monthly: [
    {
      type: "spending_change",
      headline: "Food spending increased 28% this month.",
      reasons: [
        "Zomato orders increased from 6 to 11",
        "Weekend spending is 2x higher than weekdays",
      ],
      suggestion: "Reducing 2 deliveries per week saves ~\u20B91,200/month",
    },
    {
      type: "anomaly",
      headline: "Shopping spike detected.",
      reasons: [
        "3x higher than your 3-month average",
        "Amazon accounted for 72% of shopping spend",
      ],
      suggestion: "Review recent purchases for impulse buys",
    },
    {
      type: "suggestion",
      headline: "Transport costs dropped 10%.",
      reasons: [
        "Fewer Uber rides this month",
        "Metro usage increased",
      ],
      suggestion: "Keep using metro — on track to save \u20B9600/month",
    },
  ],
  yearly: [
    {
      type: "spending_change",
      headline: "Food spending increased 23% this year.",
      reasons: [
        "Annual food spend crossed \u20B996,000",
        "Weekend spending is 2x higher than weekdays",
      ],
      suggestion: "Reducing 2 deliveries per week saves ~\u20B914,400/year",
    },
    {
      type: "anomaly",
      headline: "Shopping spike detected this year.",
      reasons: [
        "20% higher than your 2024 total",
        "Amazon accounted for 72% of shopping spend",
      ],
      suggestion: "Review subscriptions and recurring purchases",
    },
    {
      type: "suggestion",
      headline: "Transport costs dropped 6% this year.",
      reasons: [
        "Fewer Uber rides overall",
        "Metro usage increased consistently",
      ],
      suggestion: "Keep using metro — on track to save \u20B97,200/year",
    },
  ],
};

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { merchant: "Netflix", amount: 649, interval: "monthly", category: "ENTERTAINMENT" },
  { merchant: "Spotify", amount: 119, interval: "monthly", category: "ENTERTAINMENT" },
  { merchant: "Gym", amount: 1500, interval: "monthly", category: "HEALTHCARE" },
  { merchant: "AWS", amount: 300, interval: "monthly", category: "BILLS_UTILITIES" },
];
