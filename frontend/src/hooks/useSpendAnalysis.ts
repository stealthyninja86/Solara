import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface SpendData {
  totalSpent: number;
  monthlyBudget: number;
  safeToSpend: number;
}

function toIsoDate(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function useSpendAnalysis(refreshKey = 0, month?: number, year?: number) {
  const [data, setData] = useState<SpendData>({
    totalSpent: 0,
    monthlyBudget: 0,
    safeToSpend: 0,
  });

  const fetchAnalysis = useCallback(async () => {
    const now = new Date();
    const m = month ?? now.getMonth();
    const y = year ?? now.getFullYear();
    const at = toIsoDate(y, m);
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID, at });
    try {
      const [budgetRes, safeRes] = await Promise.all([
        api(`/api/v1/insights/budget?${params}`),
        api(`/api/v1/insights/safe-to-spend?${params}`),
      ]);
      if (budgetRes.ok && safeRes.ok) {
        const budget = await budgetRes.json();
        const safe = await safeRes.json();
        setData({
          totalSpent: budget.totalSpent,
          monthlyBudget: budget.monthlyBudget,
          safeToSpend: safe.safeToSpend,
        });
      }
    } catch {
      // silent
    }
  }, [month, year]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis, refreshKey]);

  const remaining = data.monthlyBudget > 0
    ? data.monthlyBudget - data.totalSpent
    : 0;
  const withinBudget = data.monthlyBudget <= 0 || remaining >= 0;

  return { ...data, remaining, withinBudget, refresh: fetchAnalysis };
}
