import { useOverviewInsights } from "../../hooks/useOverviewInsights";
import { useAuth } from "../../hooks/useAuth";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { TypewriterText } from "../ui/TypewriterText";
import type { InsightCard } from "../../types/reports";

interface Props {
  month: number;
  year: number;
  refreshKey?: number;
  transactionCount?: number;
  generating?: boolean;
  generateError?: string;
  streamingCards?: InsightCard[];
  onGenerate?: () => void;
  onRegenerate?: () => void;
}

const TYPE_DOTS: Record<string, { className: string; title: string }> = {
  ACTION: { className: "bg-[var(--color-bad)]", title: "Action" },
  NEXT: { className: "bg-[var(--color-warn)]", title: "Next" },
  STATUS: { className: "bg-[var(--color-ok)]", title: "Status" },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function FinanceOverview({ month, year, refreshKey = 0, transactionCount = 0, generating = false, generateError, streamingCards = [], onGenerate, onRegenerate }: Props) {
  const { llmEnabled } = useAuth();
  const { cards: overviewCards, loading } = useOverviewInsights(month, year, refreshKey);
  const hasEnoughData = transactionCount >= 3;
  const displayCards = streamingCards.length > 0 ? streamingCards : overviewCards;

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
        {onRegenerate && overviewCards.length > 0 && !generating && isCurrentMonth && (
          <button
            type="button"
            onClick={onRegenerate}
            className="text-button shrink-0"
            title="Re-roll the cards with the latest data"
          >
            <Icon name="ai-insights" size={12} /> Regenerate
          </button>
        )}
      </div>

      {!isCurrentMonth ? (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 text-center">
          <p className="text-caption text-[var(--color-text-muted)]">
            To view your up-to-date overview for {MONTH_NAMES[month]} {year}, please check your current month.
          </p>
        </div>
      ) : loading && streamingCards.length === 0 ? (
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-text)]/10" />
              <div className="h-3.5 w-full animate-pulse rounded bg-[var(--color-text)]/6" />
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-text)]/6" />
            </div>
          ))}
        </div>
      ) : displayCards.length === 0 ? (
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
                  disabled={generating}
                  className="btn-primary mt-3"
                >
                  {generating ? (
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
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {displayCards.map((card, index) => {
            const dot = TYPE_DOTS[card.type];
            const change = card.changePercent;
            const delta = change !== null ? Number.parseInt(change, 10) : null;
            return (
              <li key={card.factId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-4">
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
                      text={card.text.headline ?? card.label}
                      speed={16 + index * 2}
                      className="text-[0.95rem] font-semibold leading-snug text-[var(--color-text)]"
                    />
                  </span>
                </div>

                <div className="mb-2 ml-1">
                  <p className="text-small text-[var(--color-text)]">
                    <TypewriterText text={card.text.body} speed={12 + index * 2} />
                  </p>
                </div>

                <div className="ml-1 flex flex-wrap items-center gap-2">
                  <span className="text-caption font-medium text-[var(--color-text-light)]">
                    <TypewriterText text={card.value} speed={14 + index * 2} />
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
          {generating && (
            <li className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 p-4 text-center">
              <span className="spinner !w-3.5 !h-3.5" />
              <span className="ml-2 text-caption text-[var(--color-text-muted)]">Generating next card…</span>
            </li>
          )}
        </ul>
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
