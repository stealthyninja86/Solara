import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";
import type { InsightCard, SubscriptionFrequency, TrackedSubscription } from "../types/reports";

const CYCLES_PER_YEAR: Record<SubscriptionFrequency, number> = {
  DAILY: 365,
  WEEKLY: 52,
  MONTHLY: 12,
  YEARLY: 1,
};

export function annualCost(subscription: TrackedSubscription): number {
  const cycles = CYCLES_PER_YEAR[subscription.frequency];
  if (
    subscription.kind === "EMI" &&
    subscription.tenureMonths != null &&
    subscription.tenureMonths > 0
  ) {
    const remainingMonths = Math.max(0, subscription.tenureMonths - (subscription.paidMonths ?? 0));
    return Math.round(subscription.amount * cycles * (remainingMonths / 12));
  }
  return subscription.amount * cycles;
}

interface Period {
  year: number;
  month: number;
}

interface SectionData<T> {
  status: "ok" | "unavailable" | "skipped";
  data?: T;
  error?: { code: string; message: string; retryable: boolean };
}

interface DashboardResponse {
  userId: string;
  period: string;
  at: string;
  sections: {
    availableDates?: SectionData<Period[]>;
    income?: SectionData<{ userId: string; monthlyIncome: number }>;
    budget?: SectionData<{ userId: string; totalSpent: number; monthlyBudget: number }>;
    safeToSpend?: SectionData<{
      userId: string;
      safeToSpend: number;
      recurringCosts: number;
      recurringCostsByKind: Record<string, number>;
    }>;
    trends?: SectionData<{ userId: string; from: string; to: string; categories: Record<string, number> }>;
    subscriptions?: SectionData<TrackedSubscription[]>;
    overview?: SectionData<BackendCard[]>;
  };
}

interface BackendCard {
  factId: string;
  type: "STATUS" | "ACTION" | "NEXT";
  label: string;
  text: { headline: string; body: string; suggestion: string };
  value: string;
  changePercent: string | null;
  action: string | null;
  retryAfterSeconds: number | null;
}

interface TrendCategory {
  category: string;
  total: number;
}

function toCard(data: BackendCard): InsightCard {
  return {
    factId: data.factId,
    type: data.type,
    label: data.label,
    text: data.text,
    value: data.value,
    changePercent: data.changePercent,
    action: data.action,
    retryAfterSeconds: data.retryAfterSeconds,
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Single aggregate read for the dashboard: GET /api/v1/insights/dashboard.
 * All numeric + AI sections arrive in one payload; each section can degrade
 * independently (status "unavailable") without failing the rest.
 *
 * When pollWhenEmpty is true and the overview section returns empty (AI
 * generation runs in the background), the hook polls the same endpoint every
 * 3s until cards appear or the 90s deadline passes.
 */
export function useDashboard(month?: number, year?: number, pollWhenEmpty = false) {
  const now = new Date();
  const m = month ?? now.getMonth();
  const y = year ?? now.getFullYear();
  const at = toIsoDate(y, m, now.getDate());

  const [periods, setPeriods] = useState<Period[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [recurringCosts, setRecurringCosts] = useState(0);
  const [recurringCostsByKind, setRecurringCostsByKind] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<TrendCategory[]>([]);
  const [subscriptions, setSubscriptions] = useState<TrackedSubscription[]>([]);
  const [overviewCards, setOverviewCards] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);
  const loadedOverviewRef = useRef<string | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    clearPoll();
    setLoading(true);
    const params = new URLSearchParams({
      userId: getUserId() ?? DEFAULT_USER_ID,
      period: "MONTHLY",
      at,
    });
    try {
      const res = await api(`/api/v1/insights/dashboard?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as DashboardResponse;
      const sectionOk = <T,>(key: keyof DashboardResponse["sections"]): T | undefined => {
        const section = data.sections?.[key];
        return section?.status === "ok" ? (section.data as T) : undefined;
      };

      const dates = sectionOk<Period[]>("availableDates");
      if (dates) setPeriods(dates);

      const income = sectionOk<{ monthlyIncome: number }>("income");
      setMonthlyIncome(income?.monthlyIncome ?? 0);

      const budget = sectionOk<{ totalSpent: number; monthlyBudget: number }>("budget");
      setTotalSpent(budget?.totalSpent ?? 0);
      setMonthlyBudget(budget?.monthlyBudget ?? 0);

      const safe = sectionOk<{
        safeToSpend: number;
        recurringCosts: number;
        recurringCostsByKind: Record<string, number>;
      }>("safeToSpend");
      setSafeToSpend(safe?.safeToSpend ?? 0);
      setRecurringCosts(safe?.recurringCosts ?? 0);
      setRecurringCostsByKind(safe?.recurringCostsByKind ?? {});

      const trends = sectionOk<{ categories: Record<string, number> }>("trends");
      const entries = Object.entries(trends?.categories ?? {})
        .filter(([category]) => category !== "BUDGET")
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      setCategories(entries);

      const tracked = sectionOk<TrackedSubscription[]>("subscriptions");
      if (tracked) setSubscriptions(tracked);

      const overview = sectionOk<BackendCard[]>("overview");
      setOverviewCards((prev) => {
        const fresh = (overview ?? []).map(toCard);
        if (fresh.length === 0 && prev.length > 0 && loadedOverviewRef.current === `${y}-${m}`) {
          return prev;
        }
        loadedOverviewRef.current = `${y}-${m}`;
        return fresh;
      });

      if (overview !== undefined && overview.length === 0 && pollWhenEmpty) {
        setRegenerating(true);
        schedulePoll();
      } else {
        setRegenerating(false);
        pollAttemptsRef.current = 0;
      }
    } catch {
      if (pollWhenEmpty) {
        schedulePoll();
      }
    } finally {
      setLoading(false);
    }
  }, [at, pollWhenEmpty, clearPoll]);

  function schedulePoll() {
    if (pollAttemptsRef.current < 30) {
      pollAttemptsRef.current += 1;
      pollTimerRef.current = window.setTimeout(() => {
        void load();
      }, 3000);
    } else {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    load();
    return clearPoll;
  }, [load, clearPoll]);

  const totalSubscriptions = subscriptions.reduce(
    (sum, subscription) =>
      subscription.status === "ACTIVE" ? sum + annualCost(subscription) : sum,
    0,
  );

  return {
    periods,
    spendAnalysis: {
      totalSpent,
      monthlyBudget,
      safeToSpend,
      recurringCosts,
      recurringCostsByKind,
    },
    income: {
      monthlyIncome,
      hasIncome: monthlyIncome > 0,
    },
    trends: {
      categories,
      totalSpend: categories.reduce((sum, category) => sum + category.total, 0),
    },
    subscriptions,
    totalSubscriptions,
    overviewCards,
    loading,
    regenerating,
    load,
  };
}
