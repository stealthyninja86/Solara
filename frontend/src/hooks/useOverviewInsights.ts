import { useEffect, useState } from "react";
import type { InsightCard } from "../types/reports";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface BackendCard {
  factId: string;
  type: "STATUS" | "ACTION" | "NEXT";
  label: string;
  text: { headline: string; body: string; suggestion: string };
  value: string;
  changePercent: string | null;
  action: string | null;
}

function toIsoDate(month: number, year: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  };
}

/**
 * Reads the Overview surface: the analyst-voiced STATUS + NEXT cards for the
 * monthly period. Single fetch — the LLM is expensive, so we only request
 * what's needed. Backed by GET /api/v1/insights/overview (dedicated endpoint
 * owns card text + caching, separate from the Recommendations feed).
 */
export function useOverviewInsights(month: number, year: number, refreshKey: number = 0) {
  const day = new Date().getDate();
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<InsightCard[]>([]);

  useEffect(() => {
    setLoading(true);
    const userId = getUserId() ?? DEFAULT_USER_ID;
    const at = toIsoDate(month, year, day);
    const params = new URLSearchParams({
      userId,
      period: "MONTHLY",
      at,
    });
    api(`/api/v1/insights/overview?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BackendCard[] | null) => {
        setCards((data ?? []).map(toCard));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year, refreshKey]);

  return { cards, loading };
}
