import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import type { RegenerationStatus } from "../types/reports";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

const POLL_INTERVAL_MS = 30_000;

/**
 * Reads the per-day regeneration allowance from the backend
 * (`GET /api/v1/insights/regeneration-status`) and keeps it fresh with a
 * 30s poll while the consuming component is mounted. The backend Redis
 * counter is the single source of truth — the button counts in the UI are
 * never computed locally.
 */
export function useRegenerationStatus() {
  const [status, setStatus] = useState<RegenerationStatus>({ limit: 5, used: 0 });
  const [loading, setLoading] = useState(true);
  const pollTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const userId = getUserId() ?? DEFAULT_USER_ID;
    try {
      const response = await api(`/api/v1/insights/regeneration-status?userId=${userId}`);
      if (response.ok) {
        setStatus(await response.json());
      }
    } catch {
      // keep last known status — the backend 429 still guards the limit
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    pollTimerRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, [refresh]);

  const remaining = Math.max(0, status.limit - status.used);
  return { ...status, remaining, loading, refresh };
}