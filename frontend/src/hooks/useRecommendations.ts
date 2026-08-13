import { useEffect, useRef, useState } from "react";
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
  retryAfterSeconds: number | null;
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
      retryAfterSeconds: data.card.retryAfterSeconds,
    },
  };
}

/**
 * Reads the Recommendations surface for a single period.
 * Single fetch — the LLM is expensive, so we only request what's needed.
 * Backed by GET /api/v1/insights/recommendations — the advisor-voiced ACTION
 * cards, generated separately from (and never overlapping) the Overview feed.
 *
 * When pollWhenEmpty is true and the feed comes back empty (AI generation
 * runs in the background), the hook polls the same endpoint every 3s until
 * cards appear or the 90s deadline passes.
 */
export function useRecommendations(month: number, year: number, period: TimePeriod, refreshKey: number = 0, pollWhenEmpty = false) {
  const day = new Date().getDate();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);
  const loadedPeriodRef = useRef<string | null>(null);

  async function load(force = false) {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
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
      const currentKey = `${year}-${month}-${period}`;
      setRecommendations((prev) => {
        if (data.length === 0 && prev.length > 0 && loadedPeriodRef.current === currentKey) {
          return prev;
        }
        loadedPeriodRef.current = currentKey;
        return data.map(toRecommendation);
      });
      if (data.length === 0 && pollWhenEmpty) {
        setRegenerating(true);
        schedulePoll();
      } else {
        setRegenerating(false);
        pollAttemptsRef.current = 0;
      }
    } catch {
      if (pollWhenEmpty) {
        schedulePoll();
      } else {
        setError("Failed to load recommendations.");
      }
    } finally {
      setLoading(false);
    }
  }

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
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, period, refreshKey, pollWhenEmpty]);

  return { recommendations, loading, error, regenerating, regenerate: () => load(true) };
}
