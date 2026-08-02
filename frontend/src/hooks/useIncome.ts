import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface IncomeResponse {
  userId: string;
  monthlyIncome: number;
}

export function useIncome(refreshKey: number = 0) {
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [hasIncome, setHasIncome] = useState(false);

  const fetchIncome = useCallback(async () => {
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
    try {
      const res = await api(`/api/v1/insights/income?${params}`);
      if (res.ok) {
        const data: IncomeResponse = await res.json();
        const value = data.monthlyIncome ?? 0;
        setMonthlyIncome(value);
        setHasIncome(value > 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome, refreshKey]);

  async function setMonthlyIncomeValue(value: number): Promise<boolean> {
    try {
      const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
      const res = await api(`/api/v1/insights/income?${params}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ income: value }),
      });
      if (res.ok) {
        setMonthlyIncome(value);
        setHasIncome(value > 0);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return {
    monthlyIncome,
    hasIncome,
    setMonthlyIncome: setMonthlyIncomeValue,
    refresh: fetchIncome,
  };
}
