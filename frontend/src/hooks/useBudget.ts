import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

function toIsoDate(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function useBudget(refreshKey: number = 0, month?: number, year?: number) {
  const [monthlyBudget, setMonthlyBudgetState] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [hasBudget, setHasBudget] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const now = new Date();
      const m = month ?? now.getMonth();
      const y = year ?? now.getFullYear();
      const at = toIsoDate(y, m);
      const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID, at });
      const response = await api(
        `/api/v1/insights/budget?${params}`
      );
      if (response.ok) {
        const data: { totalSpent: number; monthlyBudget: number } =
          await response.json();
        setTotalSpent(data.totalSpent);
        setMonthlyBudgetState(data.monthlyBudget);
        setHasBudget(data.monthlyBudget > 0);
      }
    } catch {
      // silent
    }
  }, [month, year]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget, refreshKey]);

  async function setMonthlyBudget(budget: number): Promise<boolean> {
    try {
      const now = new Date();
      const m = month ?? now.getMonth();
      const y = year ?? now.getFullYear();
      const at = toIsoDate(y, m);
      const params = new URLSearchParams({
        userId: getUserId() ?? DEFAULT_USER_ID,
        at,
      });
      const response = await api(`/api/v1/insights/budget?${params}`, {
        method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget }),
        }
      );
      if (!response.ok) return false;
      const data: { totalSpent: number; monthlyBudget: number } =
        await response.json();
      setMonthlyBudgetState(data.monthlyBudget);
      setTotalSpent(data.totalSpent);
      setHasBudget(data.monthlyBudget > 0);
      return true;
    } catch {
      return false;
    }
  }

  const remaining = hasBudget ? monthlyBudget - totalSpent : 0;
  const percentLeft =
    hasBudget && monthlyBudget > 0
      ? Math.min(100, Math.max(0, (remaining / monthlyBudget) * 100))
      : 0;
  const exceeded = hasBudget && remaining < 0;

  return {
    monthlyBudget,
    totalSpent,
    remaining,
    percentLeft,
    hasBudget,
    exceeded,
    setMonthlyBudget,
    refresh: fetchBudget,
  };
}
