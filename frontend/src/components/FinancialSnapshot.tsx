import { useState } from "react";
import type { FinancialSummary, TimePeriod } from "../types/reports";
import { PeriodSelect } from "./PeriodSelect";
import { Icon } from "./Icon";

interface Props {
  data: Record<TimePeriod, FinancialSummary>;
}

export function FinancialSnapshot({ data }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const snapshot = data[period];

  return (
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-[1rem] font-medium text-[var(--color-text)]">
            <Icon name="reports" size={16} /> Financial Snapshot
          </h2>
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-[var(--color-text-muted)]">Income</div>
          <div className="mt-1 text-[1.1rem] font-bold text-[var(--color-ok)]">
            {'\u20B9'}{snapshot.income.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-[var(--color-text-muted)]">Expenses</div>
          <div className="mt-1 text-[1.1rem] font-bold text-[var(--color-bad)]">
            {'\u20B9'}{snapshot.expenses.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-[var(--color-text-muted)]">Saved</div>
          <div className="mt-1 text-[1.1rem] font-bold text-[var(--color-text)]">
            {'\u20B9'}{snapshot.savings.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[0.7rem] uppercase tracking-wider text-[var(--color-text-muted)]">Savings Rate</span>
          <span className="text-[0.8rem] font-semibold text-[var(--color-text)]">{snapshot.savingsRate}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-ok)] transition-all duration-500"
            style={{ width: `${snapshot.savingsRate}%` }}
          />
        </div>
      </div>

      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> {snapshot.savingsRate >= 20
          ? "Great job! You're saving over 20% — that's a healthy rate."
          : snapshot.savingsRate > 0
          ? "You're saving, but try to reach 20% for long-term financial health."
          : snapshot.income > 0
          ? "Expenses exceed income this period. Look at your top spending categories for areas to cut."
          : "Set your monthly income to track your savings rate."}
      </p>
    </div>
  );
}
