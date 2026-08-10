import { useEffect, useState } from "react";
import { api } from "../utils/api";

interface AiStatus {
  available: boolean;
}

const UNKNOWN_STATUS: AiStatus = { available: true };

const PROBE_INTERVAL_MS = 30_000;

/**
 * Reads the LLM runtime health for the settings page:
 * GET /api/v1/insights/ai/status (Ollama /api/tags probe, 2s timeout).
 * "false" means Ollama is down — insight cards are hidden and the settings
 * page explains why. Defaults to "available" until proven otherwise (the
 * warning must never flicker on a healthy setup); any failed probe flips it
 * to "unavailable" — including non-OK HTTP responses (401 expired session,
 * 5xx gateway), because if insight-service can't answer, the cards can't be
 * narrated either. Re-probes on window focus and every 30s so stopping
 * Ollama mid-session is reflected without a reload; the status self-corrects
 * on the next probe.
 */
export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>(UNKNOWN_STATUS);

  useEffect(() => {
    let cancelled = false;

    function probe() {
      api("/api/v1/insights/ai/status")
        .then((res) => (res.ok ? res.json() : { available: false }))
        .then((data: AiStatus) => {
          if (!cancelled) setStatus(data);
        })
        .catch(() => {
          if (!cancelled) setStatus({ available: false });
        });
    }

    probe();
    const interval = setInterval(probe, PROBE_INTERVAL_MS);
    window.addEventListener("focus", probe);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", probe);
    };
  }, []);

  return status;
}
