import { useEffect, useState } from "react";
import type { Recommendation, TimePeriod } from "../types/reports";
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

interface BackendRecommendation {
  card: BackendCard;
  action: string;
}

function toBackendPeriod(period: TimePeriod): string {
  return period.toUpperCase();
}

function toIsoDate(month: number, year: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toRecommendation(data: BackendRecommendation): Recommendation {
  return {
    action: data.action,
    card: {
      factId: data.card.factId,
      type: data.card.type,
      label: data.card.label,
      text: data.card.text,
      value: data.card.value,
      changePercent: data.card.changePercent,
      action: data.card.action,
    },
  };
}

/**
 * Reads the Recommendations surface for a single period.
 * Single fetch — the LLM is expensive, so we only request what's needed.
 * Backed by GET /api/v1/insights/recommendations — the advisor-voiced ACTION
 * cards, generated separately from (and never overlapping) the Overview feed.
 */
export function useRecommendations(month: number, year: number, period: TimePeriod, refreshKey: number = 0) {
  const day = new Date().getDate();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState("");

  async function load(force = false) {
    setLoading(true);
    setError("");
    const userId = getUserId() ?? DEFAULT_USER_ID;
    const at = toIsoDate(month, year, day);
    const params = new URLSearchParams({
      userId,
      period: toBackendPeriod(period),
      at,
      ...(force ? { refresh: "true" } : {}),
    });
    try {
      const res = await api(`/api/v1/insights/recommendations?${params}`);
      if (!res.ok) {
        if (res.status === 429) {
          setError("Regeneration limit reached — try again tomorrow.");
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Failed to load recommendations.");
        }
        return;
      }
      const data = (await res.json()) as BackendRecommendation[];
      setRecommendations(data.map(toRecommendation));
    } catch {
      setError("Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, period, refreshKey]);

  return { recommendations, loading, error, regenerate: () => load(true) };
}
