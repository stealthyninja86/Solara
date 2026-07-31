import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface SpendData {
  totalSpent: number;
  monthlyBudget: number;
  safeToSpend: number;
}

export function useSpendAnalysis(refreshKey = 0) {
  const [data, setData] = useState<SpendData>({
    totalSpent: 0,
    monthlyBudget: 0,
    safeToSpend: 0,
  });

  const fetchAnalysis = useCallback(async () => {
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
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
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis, refreshKey]);

  const remaining = data.monthlyBudget > 0
    ? data.monthlyBudget - data.totalSpent
    : 0;
  const withinBudget = data.monthlyBudget <= 0 || remaining >= 0;

  return { ...data, remaining, withinBudget, refresh: fetchAnalysis };
}
