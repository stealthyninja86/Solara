import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TimePeriod } from "../../types/reports";
import { useRecommendations } from "../../hooks/useRecommendations";
import { useAuth } from "../../hooks/useAuth";
import { PeriodSelect } from "../ui/PeriodSelect";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { TypewriterText } from "../ui/TypewriterText";

interface Props {
  month: number;
  year: number;
  refreshKey?: number;
  transactionCount?: number;
  onGenerate?: () => void;
}

const TYPE_DOTS: Record<string, { className: string; title: string }> = {
  ACTION: { className: "bg-[var(--color-bad)]", title: "Action" },
  NEXT: { className: "bg-[var(--color-warn)]", title: "Next" },
  STATUS: { className: "bg-[var(--color-ok)]", title: "Status" },
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

export function Recommendations({ month, year, refreshKey = 0, transactionCount = 0, onGenerate }: Props) {
  const navigate = useNavigate();
  const { llmEnabled } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const { recommendations, loading, error, regenerate } = useRecommendations(month, year, period, refreshKey);
  const hasEnoughData = transactionCount >= 3;

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
            <button
              type="button"
              onClick={regenerate}
              disabled={loading}
              className="text-button shrink-0"
              title="Re-roll the cards with the latest data"
            >
              <Icon name="ai-insights" size={12} /> Regenerate
            </button>
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
      ) : recommendations.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 text-center">
          {hasEnoughData ? (
            <>
              <p className="text-caption text-[var(--color-text-muted)]">
                No recommendations generated yet.
              </p>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  className="btn-primary mt-3"
                >
                  <Icon name="ai-insights" size={14} /> Generate Recommendations
                </button>
              )}
            </>
          ) : (
            <p className="text-caption text-[var(--color-text-muted)]">
              Add at least 3 transactions to see Recommendations.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {recommendations.map((rec, index) => {
            const dot = TYPE_DOTS[rec.card.type];
            const change = rec.card.changePercent;
            const delta = change !== null ? Number.parseInt(change, 10) : null;
            return (
              <div key={rec.card.factId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  {dot && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot.className}`}
                      title={dot.title}
                      aria-hidden
                    />
                  )}
                  <span className="text-[0.95rem] font-semibold leading-snug text-[var(--color-text)]">
                    <TypewriterText
                      text={rec.card.text.headline ?? rec.card.label}
                      speed={16 + index * 2}
                      className="text-[0.95rem] font-semibold leading-snug text-[var(--color-text)]"
                    />
                  </span>
                </div>

                <div className="mb-2 ml-1">
                  <p className="text-small text-[var(--color-text)]">
                    <TypewriterText text={rec.card.text.body} speed={12 + index * 2} />
                  </p>
                </div>

                <div className="mb-3 ml-1 flex flex-wrap items-center gap-2">
                  <span className="text-caption font-medium text-[var(--color-text-light)]">
                    <TypewriterText text={rec.card.value} speed={14 + index * 2} />
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
