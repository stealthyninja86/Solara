import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface TrendCategory {
  category: string;
  total: number;
}

export function useTrends(refreshKey = 0, month?: number, year?: number) {
  const [categories, setCategories] = useState<TrendCategory[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);

  const fetchTrends = useCallback(async () => {
    const now = new Date();
    const m = month ?? now.getMonth();
    const y = year ?? now.getFullYear();
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m + 1, 0));
    const params = new URLSearchParams({
      userId: getUserId() ?? DEFAULT_USER_ID,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    try {
      const res = await api(`/api/v1/insights/trends?${params}`);
      if (res.ok) {
        const data: { categories: Record<string, number> } = await res.json();
        const entries = Object.entries(data.categories)
          .filter(([category]) => category !== "BUDGET")
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total);
        setCategories(entries);
        setTotalSpend(entries.reduce((sum, c) => sum + c.total, 0));
      }
    } catch {
      // silent
    }
  }, [month, year]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends, refreshKey]);

  return { categories, totalSpend, refresh: fetchTrends };
}
