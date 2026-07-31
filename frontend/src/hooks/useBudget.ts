import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

export function useBudget(refreshKey: number = 0) {
  const [monthlyBudget, setMonthlyBudgetState] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [hasBudget, setHasBudget] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("userId", getUserId() ?? DEFAULT_USER_ID);
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
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget, refreshKey]);

  async function setMonthlyBudget(budget: number): Promise<boolean> {
    try {
      const response = await api(
        `/api/v1/insights/budget?userId=${getUserId() ?? DEFAULT_USER_ID}`,
        {
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
