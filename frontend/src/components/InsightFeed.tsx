import { useState } from "react";
import type { SolaraInsight, TimePeriod } from "../types/reports";
import { PeriodSelect } from "./PeriodSelect";
import { Icon } from "./Icon";

interface Props {
  data: Record<TimePeriod, SolaraInsight[]>;
}

const TYPE_ICONS: Record<string, string> = {
  spending_change: "\uD83D\uDCC8",
  anomaly: "\u26A0\uFE0F",
  suggestion: "\uD83D\uDCA1",
};

export function InsightFeed({ data }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const insights = data[period];

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Icon name="ai-insights" size={14} /> Solara Insights
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-[var(--color-text-muted)]">AI-powered analysis of your spending patterns</p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

      <div className="flex flex-col gap-4">
        {insights.map((insight, index) => (
          <div key={index} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-4">
            <div className="mb-2 flex items-start gap-2">
              <span className="text-[0.85rem]">{TYPE_ICONS[insight.type] ?? ""}</span>
              <span className="text-[0.8rem] font-medium text-[var(--color-text)]">{insight.headline}</span>
            </div>

            <div className="mb-3 ml-6">
              <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Why</div>
              <ul className="flex flex-col gap-1">
                {insight.reasons.map((reason, i) => (
                  <li key={i} className="text-[0.72rem] text-[var(--color-text-dim)]">
                    {'\u2022'} {reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ml-6 rounded-md border border-[var(--color-ok)]/20 bg-[var(--color-ok)]/5 px-3 py-2">
              <div className="mb-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--color-ok)]">
                Suggested action
              </div>
              <div className="text-[0.72rem] text-[var(--color-text-lighter)]">{insight.suggestion}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
