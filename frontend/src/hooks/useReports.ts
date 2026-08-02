import { useEffect, useMemo, useState } from "react";
import { MOCK_INSIGHTS, MOCK_SUBSCRIPTIONS } from "../data/mockReports";
import type { FinancialSummary, SpendingChange, TimePeriod, TrendPoint } from "../types/reports";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface BackendReportResponse {
  userId: string;
  period: string;
  summary: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
  };
  categories: {
    category: string;
    amount: number;
    previousAmount: number;
    changePercent: number;
  }[];
  trend: {
    label: string;
    income: number;
    expenses: number;
  }[];
}

type SummaryMap = Record<TimePeriod, FinancialSummary>;
type SpendingMap = Record<TimePeriod, SpendingChange[]>;
type TrendMap = Record<TimePeriod, TrendPoint[]>;

const EMPTY_SUMMARY: FinancialSummary = { income: 0, expenses: 0, savings: 0, savingsRate: 0 };

function toBackendPeriod(period: TimePeriod): string {
  return period.toUpperCase();
}

function toIsoDate(month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function useReports(month: number, year: number, refreshKey: number = 0) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryMap>({
    weekly: EMPTY_SUMMARY,
    monthly: EMPTY_SUMMARY,
    yearly: EMPTY_SUMMARY,
  });
  const [spendingChanges, setSpendingChanges] = useState<SpendingMap>({
    weekly: [],
    monthly: [],
    yearly: [],
  });
  const [trends, setTrends] = useState<TrendMap>({
    weekly: [],
    monthly: [],
    yearly: [],
  });

  useEffect(() => {
    setLoading(true);
    const userId = getUserId() ?? DEFAULT_USER_ID;
    const at = toIsoDate(month, year);
    const periods: TimePeriod[] = ["weekly", "monthly", "yearly"];
    let pending = periods.length;

    for (const period of periods) {
      const params = new URLSearchParams({
        userId,
        period: toBackendPeriod(period),
        at,
      });
      api(`/api/v1/insights/report?${params}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: BackendReportResponse | null) => {
          if (!data) return;
          setSummary((previous) => ({
            ...previous,
            [period]: {
              income: data.summary.income,
              expenses: data.summary.expenses,
              savings: data.summary.savings,
              savingsRate: data.summary.savingsRate,
            },
          }));
          setSpendingChanges((previous) => ({
            ...previous,
            [period]: data.categories.map((c) => ({
              category: c.category,
              amount: c.amount,
              previousAmount: c.previousAmount,
              changePercent: c.changePercent,
            })),
          }));
          setTrends((previous) => ({
            ...previous,
            [period]: data.trend.map((t) => ({
              label: t.label,
              income: t.income,
              expenses: t.expenses,
            })),
          }));
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending <= 0) setLoading(false);
        });
    }
  }, [month, year, refreshKey]);

  const insights = MOCK_INSIGHTS;
  const subscriptions = MOCK_SUBSCRIPTIONS;

  const totalSubscriptions = useMemo(
    () => subscriptions.reduce((sum, s) => sum + s.amount * 12, 0),
    [subscriptions],
  );

  return {
    loading,
    summary,
    spendingChanges,
    trends,
    insights,
    subscriptions,
    totalSubscriptions,
  };
}
