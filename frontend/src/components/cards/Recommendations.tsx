import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TimePeriod } from "../../types/reports";
import { useRecommendations } from "../../hooks/useRecommendations";
import { useAuth } from "../../hooks/useAuth";
import { useRegenerationStatus } from "../../hooks/useRegenerationStatus";
import { PeriodSelect } from "../ui/PeriodSelect";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { RetryCountdown } from "./RetryCountdown";
import { StatusDot } from "../ui/StatusDot";
import { highlightText } from "../../utils/highlight";

interface Props {
  month: number;
  year: number;
  refreshKey?: number;
  hasEnoughData?: boolean;
}

const TYPE_DOTS: Record<string, { color: string; pulseClass: string; title: string }> = {
  ACTION: { color: "var(--color-warn)", pulseClass: "animate-ping-slow", title: "Action" },
  NEXT: { color: "var(--color-warn)", pulseClass: "animate-ping-slow", title: "Next" },
  STATUS: { color: "var(--color-ok)", pulseClass: "animate-ping-slow", title: "Status" },
};

const ACTION_DOTS: Record<string, { color: string; pulseClass: string; title: string }> = {
  cut_spending: { color: "var(--color-bad)", pulseClass: "animate-ping", title: "Cut spending" },
  set_budget: { color: "var(--color-warn)", pulseClass: "animate-ping-slow", title: "Set budget" },
  review_budget: { color: "var(--color-warn)", pulseClass: "animate-ping-slow", title: "Review budget" },
  categorize_transactions: { color: "var(--color-text-muted)", pulseClass: "", title: "Categorize transactions" },
};

const ACTION_LABELS: Record<string, string> = {
  set_budget: "Set budget",
  review_budget: "Review budget",
  cut_spending: "Cut spending",
  categorize_transactions: "Categorize transactions",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function Recommendations({ month, year, refreshKey = 0, hasEnoughData = true }: Props) {
  const navigate = useNavigate();
  const { llmEnabled } = useAuth();
  const { remaining, limit, refresh: refreshRegenerationStatus } = useRegenerationStatus();
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const { recommendations, loading, error, regenerating, regenerate } = useRecommendations(month, year, period, refreshKey, llmEnabled === true);

  if (llmEnabled === false) return null;

  const now = new Date();
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-card">
          <Icon name="reports" size={14} /> Recommendations
        </h2>
        <div className="flex items-center gap-2">
          <PeriodSelect value={period} onChange={setPeriod} />
          {recommendations.length > 0 && isCurrentMonth && (
            <div className="flex items-center gap-2">
              <span
                className={`text-caption ${
                  remaining === 0
                    ? "text-[var(--color-bad)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {remaining}/{limit} today
              </span>
              <button
                type="button"
                onClick={() => {
                  regenerate();
                  void refreshRegenerationStatus();
                }}
                disabled={loading || remaining === 0}
                className="text-button shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  remaining === 0
                    ? "Regeneration limit reached — try again tomorrow"
                    : "Re-roll the cards with the latest data"
                }
              >
                {loading ? (
                  <>
                    <span className="spinner !h-3.5 !w-3.5" /> Regenerating…
                  </>
                ) : (
                  <>
                    <Icon name="ai-insights" size={12} /> Regenerate
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 text-small text-[var(--color-text-muted)]">
        Today's recommendations — what to do next
      </p>

      {error && <p className="mb-3 text-small text-[var(--color-bad)]">{error}</p>}

      {!isCurrentMonth ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 text-center">
          <p className="text-caption text-[var(--color-text-muted)]">
            To view your up-to-date recommendations for {MONTH_NAMES[month]} {year}, please check your current month.
          </p>
        </div>
      ) : regenerating && hasEnoughData ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-10 text-center">
          <span className="spinner !h-6 !w-6" aria-hidden="true" />
          <p className="text-caption text-[var(--color-text-muted)]">
            Regenerating your recommendations…
          </p>
        </div>
      ) : recommendations.length > 0 ? (
        <div className="flex flex-col gap-4">
          {recommendations.map((rec) => {
            const dot = rec.action ? (ACTION_DOTS[rec.action] ?? TYPE_DOTS[rec.card.type]) : TYPE_DOTS[rec.card.type];
            const change = rec.card.changePercent;
            const delta = change !== null ? Number.parseInt(change, 10) : null;
            return (
              <div key={rec.card.factId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  {dot && (
                    <StatusDot color={dot.color} pulseClass={dot.pulseClass} title={dot.title} />
                  )}
                  <span className="text-[0.95rem] font-semibold leading-snug text-[var(--color-text)]">
                    {highlightText(rec.card.text.headline ?? rec.card.label, rec.card.label)}
                  </span>
                </div>

                <div className="mb-2 ml-1">
                  <p className="text-small text-[var(--color-text)]">
                    {highlightText(rec.card.text.body ?? "", rec.card.label)}
                  </p>
                </div>

                {rec.card.retryAfterSeconds != null && (
                  <div className="mb-2 ml-1">
                    <p className="text-caption text-[var(--color-warn)]">
                      Generation failed — <RetryCountdown seconds={rec.card.retryAfterSeconds} />
                    </p>
                  </div>
                )}

                <div className="mb-3 ml-1 flex flex-wrap items-center gap-2">
                  <span className="text-caption font-medium text-[var(--color-text-light)]">
                    {rec.card.value ?? ""}
                  </span>
                  {delta !== null && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${
                        delta >= 0
                          ? "bg-[var(--color-warn)]/10 text-[var(--color-warn)]"
                          : "bg-[var(--color-ok)]/10 text-[var(--color-ok)]"
                      }`}
                    >
                      {delta >= 0 ? "↑" : "↓"}
                      {Math.abs(delta)}%
                    </span>
                  )}
                </div>

                {rec.card.text.suggestion && (
                  <div className="mb-1 ml-1 border-l-2 border-[var(--color-ok)] pl-3">
                    <p className="text-caption text-[var(--color-text-light)]">
                      {rec.card.text.suggestion}
                    </p>
                  </div>
                )}

                {rec.action && (
                  <div className="ml-1 mt-3">
                    <button
                      className="btn-primary"
                      onClick={() => navigate("/dashboard")}
                    >
                      {ACTION_LABELS[rec.action] ?? rec.action}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-4">
              <div className="mb-2 flex items-start gap-2">
                <div className="h-4 w-12 animate-pulse rounded bg-[var(--color-text)]/10" />
                <div className="h-3.5 w-48 animate-pulse rounded bg-[var(--color-text)]/8" />
              </div>
              <div className="ml-1 flex flex-col gap-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-[var(--color-text)]/6" />
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-text)]/6" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 text-center">
          <p className="text-caption text-[var(--color-text-muted)]">
            No recommendations generated yet.
          </p>
          <button
            onClick={regenerate}
            disabled={loading}
            className="btn-primary mt-3"
          >
            {loading ? (
              <>
                <span className="spinner !h-3.5 !w-3.5" /> Generating recommendations…
              </>
            ) : (
              <>
                <Icon name="ai-insights" size={14} /> Generate Recommendations
              </>
            )}
          </button>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-caption text-[var(--color-text-muted)]">
        <Icon name="recurring-payments" size={12} /> Refreshes daily — come back tomorrow for updated recommendations
      </p>

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "How they're generated",
    description: "Recommendations come from your spending patterns — overspending, category share, and budget gaps.",
  },
  {
    title: "Reading a card",
    description: "Each card gives you one action, why it matters, and a concrete next step.",
  },
];
