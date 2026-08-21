import { useAuth } from "../../hooks/useAuth";
import { useRegenerationStatus } from "../../hooks/useRegenerationStatus";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { RetryCountdown } from "./RetryCountdown";
import { StatusDot } from "../ui/StatusDot";
import { highlightText } from "../../utils/highlight";
import type { InsightCard } from "../../types/reports";

interface Props {
  month: number;
  year: number;
  cards: InsightCard[];
  loading?: boolean;
  transactionCount?: number;
  generating?: boolean;
  regenerating?: boolean;
  generateError?: string;
  onGenerate?: () => void;
  onRegenerate?: () => void;
}

const TYPE_DOTS: Record<string, { color: string; pulseClass: string; title: string }> = {
  ACTION: { color: "var(--color-bad)", pulseClass: "animate-radar", title: "Action" },
  NEXT: { color: "var(--color-warn)", pulseClass: "animate-radar-slow", title: "Next" },
  STATUS: { color: "var(--color-ok)", pulseClass: "animate-radar-slow", title: "Status" },
};

export function FinanceOverview({ month, year, cards, loading = false, transactionCount = 0, generating = false, regenerating = false, generateError, onGenerate, onRegenerate }: Props) {
  const { llmEnabled } = useAuth();
  const { remaining, limit, refresh: refreshRegenerationStatus } = useRegenerationStatus();
  const hasEnoughData = transactionCount >= 3;

  if (llmEnabled === false) return null;

  const now = new Date();
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

  return (
    <section className="card" style={{ "--section-delay": "160ms" } as React.CSSProperties}>
      <h2 className="text-card text-[var(--color-text)]"><Icon name="overview" size={16} /> Finance Overview</h2>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-small text-[var(--color-text-muted)]">
          Today's overview — what happened with your money this month
        </p>
        {onRegenerate && cards.length > 0 && isCurrentMonth && (
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
                onRegenerate();
                void refreshRegenerationStatus();
              }}
              disabled={generating || regenerating || remaining === 0}
              className="text-button shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                remaining === 0
                  ? "Regeneration limit reached — try again tomorrow"
                  : "Re-roll the cards with the latest data"
              }
            >
              {generating || regenerating ? (
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

      {!isCurrentMonth ? (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 text-center">
          <p className="text-caption text-[var(--color-text-muted)]">
            To view your up-to-date overview, please check your current month.
          </p>
        </div>
      ) : (generating || regenerating) && hasEnoughData ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-10 text-center">
          <span className="spinner !h-6 !w-6" aria-hidden="true" />
          <p className="text-caption text-[var(--color-text-muted)]">
            Regenerating your overview…
          </p>
        </div>
      ) : cards.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4">
          {cards.map((card) => {
            const dot = TYPE_DOTS[card.type];
            const change = card.changePercent;
            const delta = change !== null ? Number.parseInt(change, 10) : null;
            return (
              <li key={card.factId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  {dot && (
                    <StatusDot color={dot.color} pulseClass={dot.pulseClass} title={dot.title} />
                  )}
                  <span className="text-[0.95rem] font-semibold leading-snug text-[var(--color-text)]">
                    {highlightText(card.text.headline ?? card.label, card.label)}
                  </span>
                </div>

                <div className="mb-2 ml-1">
                  <p className="text-small text-[var(--color-text)]">
                    {highlightText(card.text.body ?? "", card.label)}
                  </p>
                </div>

                {card.retryAfterSeconds != null && (
                  <div className="mb-2 ml-1">
                    <p className="text-caption text-[var(--color-warn)]">
                      Generation failed — <RetryCountdown seconds={card.retryAfterSeconds} />
                    </p>
                  </div>
                )}

                <div className="ml-1 flex flex-wrap items-center gap-2">
                  <span className="text-caption font-medium text-[var(--color-text-light)]">
                    {card.value ?? ""}
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
              </li>
            );
          })}
        </ul>
      ) : loading ? (
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-text)]/10" />
              <div className="h-3.5 w-full animate-pulse rounded bg-[var(--color-text)]/6" />
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-text)]/6" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 text-center">
          {hasEnoughData ? (
            <>
              <p className="text-caption text-[var(--color-text-muted)]">
                No insights generated yet.
              </p>
              {generateError && (
                <p className="mt-2 text-small text-[var(--color-bad)]">{generateError}</p>
              )}
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  disabled={generating || regenerating}
                  className="btn-primary mt-3"
                >
                  {generating || regenerating ? (
                    <><span className="spinner !w-3.5 !h-3.5" /> Generating overview…</>
                  ) : (
                    <><Icon name="ai-insights" size={14} /> Generate Overview</>
                  )}
                </button>
              )}
            </>
          ) : (
            <p className="text-caption text-[var(--color-text-muted)]">
              Add at least 3 transactions to see your Finance Overview.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-caption text-[var(--color-text-muted)]">
        <Icon name="recurring-payments" size={12} /> Refreshes daily — come back tomorrow for updated insights
      </p>

      <HowItWorks items={OVERVIEW_HOW_IT_WORKS} />
    </section>
  );
}

const OVERVIEW_HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "What insights cover",
    description: "Overview is computed from your spending patterns — savings rate, spending spikes, and category trends.",
  },
  {
    title: "Reading a card",
    description: "Each card tells you what changed and why it matters. For what to do about it, see your Recommendations.",
  },
];
