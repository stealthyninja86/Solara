import { useState } from "react";
import type { DateRange, FinancialSummary, TimePeriod } from "../../types/reports";
import { PeriodSelect } from "../ui/PeriodSelect";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { formatDateRange } from "../../utils/date";

interface Props {
  data: Record<TimePeriod, FinancialSummary>;
  ranges: Record<TimePeriod, DateRange>;
}

export function FinancialSnapshot({ data, ranges }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const snapshot = data[period];
  const range = ranges[period];
  const hasRange = range && range.from && range.to;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-card">
          <Icon name="reports" size={16} /> Financial Snapshot
        </h2>
        <div className="flex items-center gap-2">
          {hasRange && (
            <span className="text-small">{formatDateRange(range)}</span>
          )}
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-label text-[var(--color-text-muted)]">Income</div>
          <div className="mt-1 text-page text-[var(--color-ok)]">
            {'\u20B9'}{snapshot.income.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="text-label text-[var(--color-text-muted)]">Expenses</div>
          <div className="mt-1 text-page text-[var(--color-bad)]">
            {'\u20B9'}{snapshot.expenses.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="text-label text-[var(--color-text-muted)]">Saved</div>
          <div className="mt-1 text-page text-[var(--color-text)]">
            {'\u20B9'}{snapshot.savings.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-label text-[var(--color-text-muted)]">Savings Rate</span>
          <span className="text-caption font-semibold text-[var(--color-text)]">{snapshot.savingsRate}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-ok)] transition-all duration-500"
            style={{ width: `${Math.min(snapshot.savingsRate, 100)}%` }}
          />
        </div>
      </div>

      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-caption leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> {snapshot.savingsRate >= 20
          ? "Great job! You're saving over 20% — that's a healthy rate."
          : snapshot.savingsRate > 0
          ? "You're saving, but try to reach 20% for long-term financial health."
          : snapshot.income > 0
          ? "Expenses exceed income this period. Look at your top spending categories for areas to cut."
          : "Set your monthly income to track your savings rate."}
      </p>

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "The three numbers",
    description: "Income, expenses, and savings for the selected period. Expenses are your debits minus refunds (never below zero). Savings is simply what's left after expenses.",
  },
  {
    title: "Savings rate",
    description: "The bar shows how much of your income you're saving — the green benchmark at 20% is a healthy target.",
  },
  {
    title: "Without income set",
    description: "Expenses still show up, but the savings rate stays at 0% until you set your monthly income.",
  },
];
